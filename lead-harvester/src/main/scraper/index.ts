import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow } from 'electron';
import {
  initBrowser,
  closeBrowser,
  scrapeGoogleMaps,
  isBrowserRunning,
} from './google-maps';
import {
  initEnrichment,
  closeEnrichment,
  runEnrichment,
  pauseEnrichment,
  isEnrichmentRunning,
} from './enrichment';
import { calculateLeadScore } from '../utils/scoring';
import { initLogger, clearLogger, createScopedLogger } from '../utils/logger';
import {
  getProject,
  updateProject,
  createLead,
  getRunState,
  saveRunState,
  deleteRunState,
  getSettings,
  deleteLeadsByProject,
} from '../database';
import type { Project, ScrapeProgress, RunState } from '../../shared/types';

const logger = createScopedLogger('Scraper');

interface RunContext {
  projectId: string;
  runId: string;
  isPaused: boolean;
  isStopped: boolean;
}

let currentRun: RunContext | null = null;

/**
 * Broadcast progress to all windows
 */
function broadcastProgress(progress: ScrapeProgress): void {
  const windows = BrowserWindow.getAllWindows();
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('scraper:progress', progress);
    }
  }
}

/**
 * Start a new scraping run for a project
 */
export async function startRun(projectId: string): Promise<void> {
  const project = getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  if (currentRun && !currentRun.isStopped) {
    throw new Error('A run is already in progress');
  }

  const settings = getSettings();
  const runId = uuidv4();

  // Initialize logger
  initLogger(projectId, runId);
  logger.info(`Starting run for project: ${project.name}`);

  // Initialize run context
  currentRun = {
    projectId,
    runId,
    isPaused: false,
    isStopped: false,
  };

  // Update project status
  updateProject(projectId, { status: 'running' });

  // Broadcast initial progress
  broadcastProgress({
    phase: 'starting',
    totalFound: 0,
    scraped: 0,
    enriched: 0,
    errors: 0,
    message: 'Initializing browser...',
  });

  try {
    // Initialize browser
    await initBrowser(settings);
    await initEnrichment(settings);

    // Check for existing run state (resume capability)
    let existingState = getRunState(projectId);
    const isResume = existingState !== null && existingState.phase !== 'completed';

    let runState: RunState;
    if (isResume && existingState) {
      runState = existingState;
    } else {
      // Clear old leads for fresh run
      deleteLeadsByProject(projectId);
      deleteRunState(projectId);

      // Create new run state
      runState = {
        projectId,
        phase: 'scraping',
        scrollPosition: 0,
        scrapedCount: 0,
        enrichedCount: 0,
        pendingEnrichmentIds: [],
        startedAt: new Date().toISOString(),
      };
      saveRunState(runState);
    }

    if (runState.phase === 'scraping' || !isResume) {
      // Scraping phase
      broadcastProgress({
        phase: 'scraping',
        totalFound: 0,
        scraped: runState.scrapedCount,
        enriched: 0,
        errors: 0,
        message: `Searching for "${project.keyword}" in "${project.location}"...`,
      });

      logger.info(`Searching for: ${project.keyword} in ${project.location}`);

      const rawLeads = await scrapeGoogleMaps(project.keyword, project.location, {
        maxResults: project.maxResults,
        settings,
        onProgress: (scraped, total, current) => {
          broadcastProgress({
            phase: 'scraping',
            totalFound: total,
            scraped,
            enriched: 0,
            errors: 0,
            currentItem: current,
            message: `Scraping ${scraped}/${total}...`,
          });
        },
        shouldStop: () => currentRun?.isStopped || currentRun?.isPaused || false,
      });

      // Save leads to database
      for (const rawLead of rawLeads) {
        if (currentRun?.isStopped) break;

        const score = calculateLeadScore({
          businessName: rawLead.businessName,
          category: rawLead.category,
          rating: rawLead.rating,
          reviewCount: rawLead.reviewCount,
          address: rawLead.address,
          phone: rawLead.phone,
          websiteUrl: rawLead.websiteUrl,
          emails: [],
        });

        const lead = createLead({
          projectId,
          businessName: rawLead.businessName,
          category: rawLead.category,
          rating: rawLead.rating,
          reviewCount: rawLead.reviewCount,
          address: rawLead.address,
          phone: rawLead.phone,
          websiteUrl: rawLead.websiteUrl || undefined,
          googleMapsUrl: rawLead.googleMapsUrl,
        });

        // Update with initial score
        const { updateLead } = require('../database');
        updateLead(lead.id, { leadScore: score });
      }

      // Note: We no longer skip leads without website URLs
      // Enrichment will try to get website from Google Maps page

      // Update run state
      runState.phase = 'enriching';
      runState.scrapedCount = rawLeads.length;
      saveRunState(runState);

      logger.info(`Scraping complete. Found ${rawLeads.length} leads.`);
    }

    // Check if paused or stopped before enrichment
    if (currentRun?.isStopped) {
      throw new Error('Run stopped by user');
    }

    if (currentRun?.isPaused) {
      broadcastProgress({
        phase: 'paused',
        totalFound: runState.scrapedCount,
        scraped: runState.scrapedCount,
        enriched: runState.enrichedCount,
        errors: 0,
        message: 'Run paused',
      });
      return;
    }

    // Enrichment phase
    broadcastProgress({
      phase: 'enriching',
      totalFound: runState.scrapedCount,
      scraped: runState.scrapedCount,
      enriched: runState.enrichedCount,
      errors: 0,
      message: 'Starting email enrichment...',
    });

    logger.info('Starting enrichment phase');

    const enrichResult = await runEnrichment(projectId, {
      settings,
      onProgress: (enriched, total, current) => {
        broadcastProgress({
          phase: 'enriching',
          totalFound: runState!.scrapedCount,
          scraped: runState!.scrapedCount,
          enriched,
          errors: 0,
          currentItem: current,
          message: `Enriching ${enriched}/${total}...`,
        });
      },
      shouldStop: () => currentRun?.isStopped || currentRun?.isPaused || false,
    });

    // Update run state
    runState.phase = 'completed';
    runState.enrichedCount = enrichResult.enriched;
    saveRunState(runState);

    // Check final state
    if (currentRun?.isPaused) {
      broadcastProgress({
        phase: 'paused',
        totalFound: runState.scrapedCount,
        scraped: runState.scrapedCount,
        enriched: enrichResult.enriched,
        errors: enrichResult.errors,
        message: 'Run paused',
      });
      updateProject(projectId, { status: 'paused' });
    } else if (currentRun?.isStopped) {
      broadcastProgress({
        phase: 'completed',
        totalFound: runState.scrapedCount,
        scraped: runState.scrapedCount,
        enriched: enrichResult.enriched,
        errors: enrichResult.errors,
        message: 'Run stopped',
      });
      updateProject(projectId, { status: 'idle' });
    } else {
      broadcastProgress({
        phase: 'completed',
        totalFound: runState.scrapedCount,
        scraped: runState.scrapedCount,
        enriched: enrichResult.enriched,
        errors: enrichResult.errors,
        message: 'Run completed successfully!',
      });
      updateProject(projectId, { status: 'completed' });
    }

    logger.info(
      `Run completed. Scraped: ${runState.scrapedCount}, Enriched: ${enrichResult.enriched}, Errors: ${enrichResult.errors}`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Run failed', { error: errorMessage });

    broadcastProgress({
      phase: 'error',
      totalFound: 0,
      scraped: 0,
      enriched: 0,
      errors: 1,
      message: errorMessage,
    });

    updateProject(projectId, { status: 'error' });

    // Save error to run state
    const runState = getRunState(projectId);
    if (runState) {
      runState.error = errorMessage;
      saveRunState(runState);
    }

    throw error;
  } finally {
    // Cleanup
    await closeEnrichment();
    await closeBrowser();
    clearLogger();
    currentRun = null;
  }
}

/**
 * Pause the current run
 */
export function pauseRun(): void {
  if (currentRun) {
    currentRun.isPaused = true;
    pauseEnrichment();
    logger.info('Run paused');

    broadcastProgress({
      phase: 'paused',
      totalFound: 0,
      scraped: 0,
      enriched: 0,
      errors: 0,
      message: 'Run paused',
    });
  }
}

/**
 * Resume a paused run
 */
export async function resumeRun(projectId: string): Promise<void> {
  const project = getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const runState = getRunState(projectId);
  if (!runState) {
    throw new Error('No run state found. Start a new run instead.');
  }

  // Start a new run, which will resume from the saved state
  await startRun(projectId);
}

/**
 * Stop the current run
 */
export async function stopRun(): Promise<void> {
  if (currentRun) {
    currentRun.isStopped = true;
    currentRun.isPaused = true;
    pauseEnrichment();
    logger.info('Run stopped');

    const projectId = currentRun.projectId;
    updateProject(projectId, { status: 'idle' });

    broadcastProgress({
      phase: 'completed',
      totalFound: 0,
      scraped: 0,
      enriched: 0,
      errors: 0,
      message: 'Run stopped by user',
    });
  }

  // Cleanup
  await closeEnrichment();
  await closeBrowser();
}

/**
 * Check if a run is in progress
 */
export function isRunning(): boolean {
  return currentRun !== null && !currentRun.isStopped && !currentRun.isPaused;
}

/**
 * Check if a run is paused
 */
export function isPaused(): boolean {
  return currentRun !== null && currentRun.isPaused && !currentRun.isStopped;
}

/**
 * Get current run project ID
 */
export function getCurrentRunProjectId(): string | null {
  return currentRun?.projectId || null;
}
