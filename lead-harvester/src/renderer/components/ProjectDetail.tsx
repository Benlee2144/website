import React, { useState } from 'react';
import { useAppState } from '../store';
import { useProject, useScraper, useExport } from '../hooks/useIPC';
import RunDashboard from './RunDashboard';
import LeadsTable from './LeadsTable';
import LeadDetails from './LeadDetails';
import LogViewer from './LogViewer';

type Tab = 'leads' | 'logs';

export default function ProjectDetail() {
  const { state, dispatch } = useAppState();
  const { data: project, loading, error, refetch } = useProject(state.selectedProjectId);
  const { progress, status, start, pause, stop } = useScraper();
  const { exportCSV, loading: exporting } = useExport();
  const [activeTab, setActiveTab] = useState<Tab>('leads');
  const [showDemoOption, setShowDemoOption] = useState(false);

  const handleBack = () => {
    dispatch({ type: 'SELECT_PROJECT', projectId: null });
  };

  const handleStart = async (demoMode: boolean = false) => {
    if (!project) return;
    setShowDemoOption(false);
    await start(project.id, demoMode);
  };

  const handlePause = async () => {
    await pause();
    refetch();
  };

  const handleStop = async () => {
    if (confirm('Are you sure you want to stop the current run? Progress will be saved.')) {
      await stop();
      refetch();
    }
  };

  const handleExport = async () => {
    if (!project) return;
    const result = await exportCSV(project.id, state.leadFilters);
    if (result.success && result.data) {
      alert(`Exported ${result.data.count} leads to ${result.data.path}`);
    } else if (result.error && result.error !== 'Export cancelled') {
      alert(`Export failed: ${result.error}`);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="h-full flex flex-col">
        <div className="drag-region h-12 flex items-center px-6 border-b border-gray-200 bg-white">
          <button onClick={handleBack} className="no-drag flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || 'Project not found'}</p>
            <button onClick={handleBack} className="btn-secondary">
              Go back to projects
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isRunning = status.isRunning && status.projectId === project.id;
  const isPaused = status.isPaused && status.projectId === project.id;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="drag-region h-12 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
        <div className="no-drag flex items-center gap-4">
          <button onClick={handleBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{project.name}</h1>
            <p className="text-xs text-gray-500">
              {project.keyword} in {project.location}
            </p>
          </div>
        </div>

        <div className="no-drag flex items-center gap-2">
          {/* Export button */}
          <button
            onClick={handleExport}
            className="btn-secondary btn-sm"
            disabled={exporting || project.totalLeads === 0}
          >
            {exporting ? (
              <>
                <div className="spinner mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export CSV
              </>
            )}
          </button>

          {/* Run controls */}
          {isRunning ? (
            <>
              <button onClick={handlePause} className="btn-warning btn-sm">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Pause
              </button>
              <button onClick={handleStop} className="btn-danger btn-sm">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                Stop
              </button>
            </>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowDemoOption(!showDemoOption)}
                className="btn-success btn-sm"
                disabled={status.isRunning}
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isPaused ? 'Resume' : 'Start Run'}
              </button>
              {showDemoOption && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                  <button
                    onClick={() => handleStart(false)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    Real Mode (Google Maps)
                  </button>
                  <button
                    onClick={() => handleStart(true)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
                  >
                    Demo Mode (Test Data)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Run Dashboard */}
      {(isRunning || isPaused || (progress && progress.phase !== 'idle')) && (
        <RunDashboard progress={progress} isRunning={isRunning} isPaused={isPaused} />
      )}

      {/* Tabs */}
      <div className="px-6 pt-4 bg-white border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('leads')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'leads'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Leads ({project.totalLeads})
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Logs
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {activeTab === 'leads' ? (
          <>
            <div className={`flex-1 overflow-hidden ${state.selectedLeadId ? 'hidden lg:block' : ''}`}>
              <LeadsTable projectId={project.id} onRefresh={refetch} />
            </div>
            {state.selectedLeadId && (
              <div className="w-full lg:w-96 border-l border-gray-200 overflow-hidden">
                <LeadDetails leadId={state.selectedLeadId} />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 overflow-hidden">
            <LogViewer projectId={project.id} />
          </div>
        )}
      </div>
    </div>
  );
}
