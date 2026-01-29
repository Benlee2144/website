import React, { useState } from 'react';
import { useAppState } from '../store';
import { useSearchTemplates, useCreateProject, useSettings } from '../hooks/useIPC';
import type { SearchTemplate } from '../../shared/types';

export default function TemplatesView() {
  const { dispatch } = useAppState();
  const { data: templates, loading, createTemplate, deleteTemplate } = useSearchTemplates();
  const { create: createProject } = useCreateProject();
  const { data: settings } = useSettings();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    keyword: '',
    location: '',
    radius: 0,
    maxResults: 50,
  });

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.keyword || !newTemplate.location) {
      alert('Please fill in all required fields');
      return;
    }

    await createTemplate({
      name: newTemplate.name,
      keyword: newTemplate.keyword,
      location: newTemplate.location,
      radius: newTemplate.radius || undefined,
      maxResults: newTemplate.maxResults,
    });

    setShowCreateModal(false);
    setNewTemplate({
      name: '',
      keyword: '',
      location: '',
      radius: 0,
      maxResults: settings?.maxResultsDefault || 50,
    });
  };

  const handleUseTemplate = async (template: SearchTemplate) => {
    const project = await createProject({
      name: `${template.keyword} in ${template.location}`,
      keyword: template.keyword,
      location: template.location,
      radius: template.radius,
      maxResults: template.maxResults,
    });

    if (project) {
      dispatch({ type: 'SELECT_PROJECT', projectId: project.id });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm('Delete this template?')) {
      await deleteTemplate(id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="drag-region h-12 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
        <h1 className="no-drag text-lg font-semibold text-gray-900">Search Templates</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="no-drag btn-primary btn-sm"
        >
          New Template
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : !templates || templates.length === 0 ? (
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No Templates Yet</h3>
            <p className="text-gray-600 mb-4">
              Save your favorite search combinations as templates for quick reuse
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary"
            >
              Create First Template
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            <div className="grid gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <div className="mt-2 text-sm text-gray-600 space-y-1">
                        <p>
                          <span className="text-gray-500">Keyword:</span>{' '}
                          {template.keyword}
                        </p>
                        <p>
                          <span className="text-gray-500">Location:</span>{' '}
                          {template.location}
                        </p>
                        <p>
                          <span className="text-gray-500">Max Results:</span>{' '}
                          {template.maxResults}
                        </p>
                        {template.radius && (
                          <p>
                            <span className="text-gray-500">Radius:</span>{' '}
                            {template.radius} km
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => handleUseTemplate(template)}
                        className="btn-primary btn-sm"
                      >
                        Use Template
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="btn-ghost btn-sm text-red-600 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Template Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create Template</h2>

            <div className="space-y-4">
              <div>
                <label className="label">Template Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Restaurants in NYC"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Search Keyword</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., restaurants, plumbers, dentists"
                  value={newTemplate.keyword}
                  onChange={(e) => setNewTemplate({ ...newTemplate, keyword: e.target.value })}
                />
              </div>

              <div>
                <label className="label">Location</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., New York, NY"
                  value={newTemplate.location}
                  onChange={(e) => setNewTemplate({ ...newTemplate, location: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Max Results</label>
                  <input
                    type="number"
                    className="input"
                    min="10"
                    max="500"
                    value={newTemplate.maxResults}
                    onChange={(e) => setNewTemplate({ ...newTemplate, maxResults: parseInt(e.target.value) || 50 })}
                  />
                </div>
                <div>
                  <label className="label">Radius (km, optional)</label>
                  <input
                    type="number"
                    className="input"
                    min="0"
                    placeholder="0"
                    value={newTemplate.radius || ''}
                    onChange={(e) => setNewTemplate({ ...newTemplate, radius: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                className="btn-primary"
              >
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
