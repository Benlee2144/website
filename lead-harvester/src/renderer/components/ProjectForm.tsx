import React, { useState } from 'react';
import { useCreateProject, useSettings } from '../hooks/useIPC';

interface ProjectFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function ProjectForm({ onSuccess, onCancel }: ProjectFormProps) {
  const { create, loading, error } = useCreateProject();
  const { data: settings } = useSettings();

  const [formData, setFormData] = useState({
    name: '',
    keyword: '',
    location: '',
    radius: '',
    maxResults: settings?.maxResultsDefault?.toString() || '50',
    notes: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Project name is required';
    }
    if (!formData.keyword.trim()) {
      errors.keyword = 'Search keyword is required';
    }
    if (!formData.location.trim()) {
      errors.location = 'Location is required';
    }

    const maxResults = parseInt(formData.maxResults, 10);
    if (isNaN(maxResults) || maxResults < 1 || maxResults > 500) {
      errors.maxResults = 'Max results must be between 1 and 500';
    }

    if (formData.radius) {
      const radius = parseInt(formData.radius, 10);
      if (isNaN(radius) || radius < 1 || radius > 100) {
        errors.radius = 'Radius must be between 1 and 100 km';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    const project = await create({
      name: formData.name.trim(),
      keyword: formData.keyword.trim(),
      location: formData.location.trim(),
      radius: formData.radius ? parseInt(formData.radius, 10) : undefined,
      maxResults: parseInt(formData.maxResults, 10),
      notes: formData.notes.trim() || undefined,
    });

    if (project) {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      <div className="card p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Create New Project</h2>
          <p className="text-sm text-gray-500">
            Set up a new lead harvesting project. Define your search criteria below.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Project Name */}
        <div>
          <label className="label">
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${validationErrors.name ? 'border-red-500' : ''}`}
            placeholder="e.g., Restaurants in Chicago"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          {validationErrors.name && (
            <p className="mt-1 text-sm text-red-500">{validationErrors.name}</p>
          )}
        </div>

        {/* Search Keyword */}
        <div>
          <label className="label">
            Search Keyword <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${validationErrors.keyword ? 'border-red-500' : ''}`}
            placeholder="e.g., restaurants, plumbers, dentists"
            value={formData.keyword}
            onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
          />
          {validationErrors.keyword && (
            <p className="mt-1 text-sm text-red-500">{validationErrors.keyword}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            The type of business you're looking for
          </p>
        </div>

        {/* Location */}
        <div>
          <label className="label">
            Location <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className={`input ${validationErrors.location ? 'border-red-500' : ''}`}
            placeholder="e.g., Chicago, IL or 90210"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
          {validationErrors.location && (
            <p className="mt-1 text-sm text-red-500">{validationErrors.location}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            City, state, zip code, or address
          </p>
        </div>

        {/* Radius and Max Results */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Radius (km)</label>
            <input
              type="number"
              className={`input ${validationErrors.radius ? 'border-red-500' : ''}`}
              placeholder="Optional"
              min="1"
              max="100"
              value={formData.radius}
              onChange={(e) => setFormData({ ...formData, radius: e.target.value })}
            />
            {validationErrors.radius && (
              <p className="mt-1 text-sm text-red-500">{validationErrors.radius}</p>
            )}
          </div>
          <div>
            <label className="label">
              Max Results <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              className={`input ${validationErrors.maxResults ? 'border-red-500' : ''}`}
              min="1"
              max="500"
              value={formData.maxResults}
              onChange={(e) => setFormData({ ...formData, maxResults: e.target.value })}
            />
            {validationErrors.maxResults && (
              <p className="mt-1 text-sm text-red-500">{validationErrors.maxResults}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[100px]"
            placeholder="Optional notes about this project..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={onCancel} className="btn-secondary" disabled={loading}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner mr-2" />
                Creating...
              </>
            ) : (
              'Create Project'
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
