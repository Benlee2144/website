import React, { useEffect, useRef } from 'react';
import { useLogs } from '../hooks/useIPC';
import type { LogEntry } from '../../shared/types';

interface LogViewerProps {
  projectId: string;
}

export default function LogViewer({ projectId }: LogViewerProps) {
  const logs = useLogs(projectId);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogLevelStyle = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-red-600';
      case 'warn':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      case 'debug':
        return 'text-gray-400';
      default:
        return 'text-gray-600';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleClearLogs = async () => {
    await window.api.logs.clear(projectId);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <span className="text-sm text-gray-400">{logs.length} log entries</span>
        <button
          onClick={handleClearLogs}
          className="text-xs text-gray-400 hover:text-gray-200"
        >
          Clear Logs
        </button>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto p-4 font-mono text-xs"
      >
        {logs.length === 0 ? (
          <p className="text-gray-500">No log entries yet. Start a run to see logs.</p>
        ) : (
          <div className="space-y-1">
            {/* Reverse to show oldest first */}
            {[...logs].reverse().map((log) => (
              <div key={log.id} className="flex gap-2">
                <span className="text-gray-500 flex-shrink-0">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className={`flex-shrink-0 uppercase w-12 ${getLogLevelStyle(log.level)}`}>
                  [{log.level}]
                </span>
                <span className="text-gray-300">{log.message}</span>
                {log.metadata && (
                  <span className="text-gray-500">
                    {JSON.stringify(log.metadata)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
