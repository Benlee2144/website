import React, { useState } from 'react';
import { useAppState } from '../store';
import { useProjects, useDeleteProject } from '../hooks/useIPC';
import ProjectForm from './ProjectForm';
import type { Project } from '../../shared/types';

export default function ProjectList() {
  const { dispatch } = useAppState();
  const { data: projects, loading, error, refetch } = useProjects();
  const { deleteProject, loading: deleting } = useDeleteProject();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const handleProjectCreated = () => {
    setShowCreateForm(false);
    refetch();
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setDeleteConfirm(null);
    refetch();
  };

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'running':
        return <span className="badge-info">Running</span>;
      case 'paused':
        return <span className="badge-warning">Paused</span>;
      case 'completed':
        return <span className="badge-success">Completed</span>;
      case 'error':
        return <span className="badge-error">Error</span>;
      default:
        return <span className="badge-gray">Idle</span>;
    }
  };

  if (showCreateForm) {
    return (
      <div className="h-full flex flex-col">
        <div className="drag-region h-12 flex items-center px-6 border-b border-gray-200 bg-white">
          <button
            onClick={() => setShowCreateForm(false)}
            className="no-drag flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="ml-4 text-lg font-semibold text-gray-900">New Project</h1>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <ProjectForm onSuccess={handleProjectCreated} onCancel={() => setShowCreateForm(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="drag-region h-12 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
        <h1 className="no-drag text-lg font-semibold text-gray-900">Projects</h1>
        <button
          onClick={() => setShowCreateForm(true)}
          className="no-drag btn-primary btn-sm"
        >
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="text-center text-red-600 py-8">
            <p>Error loading projects: {error}</p>
            <button onClick={refetch} className="btn-secondary btn-sm mt-4">
              Retry
            </button>
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No projects yet</h3>
            <p className="text-gray-500 mb-4">Create your first project to start harvesting leads</p>
            <button onClick={() => setShowCreateForm(true)} className="btn-primary">
              Create Project
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="card p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => dispatch({ type: 'SELECT_PROJECT', projectId: project.id })}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{project.name}</h3>
                    <p className="text-sm text-gray-500 truncate">
                      {project.keyword} in {project.location}
                    </p>
                  </div>
                  {getStatusBadge(project.status)}
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <span>{project.totalLeads} leads</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{project.enrichedLeads} enriched</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm(project.id);
                    }}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 animate-fadeIn">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Project?</h3>
            <p className="text-gray-600 mb-4">
              This will permanently delete this project and all its leads. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="btn-danger"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
