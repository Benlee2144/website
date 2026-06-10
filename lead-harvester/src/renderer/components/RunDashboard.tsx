import React from 'react';
import type { ScrapeProgress } from '../../shared/types';

interface RunDashboardProps {
  progress: ScrapeProgress | null;
  isRunning: boolean;
  isPaused: boolean;
}

export default function RunDashboard({ progress, isRunning, isPaused }: RunDashboardProps) {
  if (!progress) return null;

  const getPhaseLabel = () => {
    switch (progress.phase) {
      case 'starting':
        return 'Starting...';
      case 'scraping':
        return 'Scraping Google Maps';
      case 'enriching':
        return 'Enriching with emails';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  };

  const getProgressPercent = () => {
    if (progress.phase === 'scraping' && progress.totalFound > 0) {
      return Math.round((progress.scraped / progress.totalFound) * 100);
    }
    if (progress.phase === 'enriching' && progress.scraped > 0) {
      return Math.round((progress.enriched / progress.scraped) * 100);
    }
    if (progress.phase === 'completed') {
      return 100;
    }
    return 0;
  };

  const percent = getProgressPercent();

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {(isRunning || progress.phase === 'starting') && (
            <div className="spinner" />
          )}
          {isPaused && (
            <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {progress.phase === 'completed' && (
            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {progress.phase === 'error' && (
            <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <div>
            <p className="font-medium text-gray-900">{getPhaseLabel()}</p>
            {progress.currentItem && (
              <p className="text-sm text-gray-500 truncate max-w-md">{progress.currentItem}</p>
            )}
            {progress.message && !progress.currentItem && (
              <p className="text-sm text-gray-500">{progress.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{progress.scraped}</p>
            <p className="text-gray-500">Scraped</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{progress.enriched}</p>
            <p className="text-gray-500">Enriched</p>
          </div>
          {progress.errors > 0 && (
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{progress.errors}</p>
              <p className="text-gray-500">Errors</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            progress.phase === 'error'
              ? 'bg-red-500'
              : progress.phase === 'completed'
              ? 'bg-green-500'
              : isPaused
              ? 'bg-yellow-500'
              : 'bg-primary-500 progress-bar-animated'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {progress.phase !== 'idle' && progress.phase !== 'starting' && (
        <p className="text-xs text-gray-400 mt-2 text-right">{percent}% complete</p>
      )}
    </div>
  );
}
