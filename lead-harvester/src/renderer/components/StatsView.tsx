import React from 'react';
import { useAppState } from '../store';
import { useProjects, useProjectStats } from '../hooks/useIPC';
import { StatsDashboard } from './StatsDashboard';

export default function StatsView() {
  const { state } = useAppState();
  const { data: projects, loading: projectsLoading } = useProjects();
  const [selectedProjectId, setSelectedProjectId] = React.useState<string | null>(null);
  const { data: stats, loading: statsLoading } = useProjectStats(selectedProjectId);

  // Auto-select first project if none selected
  React.useEffect(() => {
    if (projects && projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="drag-region h-12 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
        <h1 className="no-drag text-lg font-semibold text-gray-900">Statistics Dashboard</h1>
        <div className="no-drag">
          <select
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
          >
            <option value="">Select a project</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {projectsLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : !selectedProjectId ? (
          <div className="text-center py-16">
            <svg
              className="w-16 h-16 text-gray-400 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">Select a Project</h3>
            <p className="text-gray-600">Choose a project to view its statistics</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <StatsDashboard stats={stats} loading={statsLoading} />
          </div>
        )}
      </div>
    </div>
  );
}
