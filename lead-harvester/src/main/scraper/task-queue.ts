import { EventEmitter } from 'events';

interface Task<T> {
  id: string;
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  retries: number;
  maxRetries: number;
}

interface QueueOptions {
  concurrency: number;
  retryDelay: number;
  maxRetries: number;
}

/**
 * Task queue with concurrency control and retry logic
 */
export class TaskQueue<T = void> extends EventEmitter {
  private queue: Task<T>[] = [];
  private running: number = 0;
  private paused: boolean = false;
  private stopped: boolean = false;
  private options: QueueOptions;

  constructor(options: Partial<QueueOptions> = {}) {
    super();
    this.options = {
      concurrency: options.concurrency || 1,
      retryDelay: options.retryDelay || 1000,
      maxRetries: options.maxRetries || 3,
    };
  }

  /**
   * Add a task to the queue
   */
  add(id: string, execute: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (this.stopped) {
        reject(new Error('Queue is stopped'));
        return;
      }

      const task: Task<T> = {
        id,
        execute,
        resolve,
        reject,
        retries: 0,
        maxRetries: this.options.maxRetries,
      };

      this.queue.push(task);
      this.process();
    });
  }

  /**
   * Process queued tasks
   */
  private async process(): Promise<void> {
    if (this.paused || this.stopped) return;
    if (this.running >= this.options.concurrency) return;
    if (this.queue.length === 0) {
      if (this.running === 0) {
        this.emit('drain');
      }
      return;
    }

    const task = this.queue.shift()!;
    this.running++;

    this.emit('taskStart', task.id);

    try {
      const result = await task.execute();
      task.resolve(result);
      this.emit('taskComplete', task.id, result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (task.retries < task.maxRetries) {
        task.retries++;
        this.emit('taskRetry', task.id, task.retries, err);

        // Exponential backoff
        const delay = this.options.retryDelay * Math.pow(2, task.retries - 1);
        await this.sleep(delay);

        if (!this.stopped) {
          this.queue.unshift(task);
        }
      } else {
        task.reject(err);
        this.emit('taskError', task.id, err);
      }
    } finally {
      this.running--;
      this.process();
    }
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.paused = true;
    this.emit('paused');
  }

  /**
   * Resume queue processing
   */
  resume(): void {
    if (this.stopped) return;
    this.paused = false;
    this.emit('resumed');
    this.process();
  }

  /**
   * Stop the queue and reject all pending tasks
   */
  stop(): void {
    this.stopped = true;
    this.paused = true;

    // Reject all pending tasks
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      task.reject(new Error('Queue stopped'));
    }

    this.emit('stopped');
  }

  /**
   * Check if queue is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Check if queue is stopped
   */
  isStopped(): boolean {
    return this.stopped;
  }

  /**
   * Get number of pending tasks
   */
  pendingCount(): number {
    return this.queue.length;
  }

  /**
   * Get number of running tasks
   */
  runningCount(): number {
    return this.running;
  }

  /**
   * Update concurrency level
   */
  setConcurrency(level: number): void {
    this.options.concurrency = level;
    // Try to process more if concurrency increased
    for (let i = 0; i < level - this.running; i++) {
      this.process();
    }
  }

  /**
   * Clear all pending tasks
   */
  clear(): void {
    const cleared = this.queue.length;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      task.reject(new Error('Task cleared'));
    }
    this.emit('cleared', cleared);
  }

  /**
   * Wait for queue to drain (all tasks complete)
   */
  async drain(): Promise<void> {
    if (this.queue.length === 0 && this.running === 0) {
      return;
    }

    return new Promise(resolve => {
      this.once('drain', resolve);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Create a delay with random jitter
 */
export function delayWithJitter(baseDelay: number, jitterPercent: number = 0.2): Promise<void> {
  const jitter = baseDelay * jitterPercent * (Math.random() * 2 - 1);
  const delay = Math.max(0, baseDelay + jitter);
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const maxRetries = options.maxRetries || 3;
  const baseDelay = options.baseDelay || 1000;
  const maxDelay = options.maxDelay || 30000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        options.onRetry?.(attempt + 1, lastError);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
