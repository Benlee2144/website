import React, { useState, useMemo } from 'react';
import { useAppState } from '../store';
import { useLeads } from '../hooks/useIPC';
import type { Lead, LeadFilters } from '../../shared/types';

interface LeadsTableProps {
  projectId: string;
  onRefresh: () => void;
}

type SortField = 'businessName' | 'rating' | 'reviewCount' | 'leadScore' | 'enrichmentStatus';
type SortDirection = 'asc' | 'desc';

export default function LeadsTable({ projectId, onRefresh }: LeadsTableProps) {
  const { state, dispatch } = useAppState();
  const [sortField, setSortField] = useState<SortField>('leadScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');

  // Build filters
  const filters: LeadFilters = useMemo(() => ({
    ...state.leadFilters,
    searchQuery: searchQuery || undefined,
  }), [state.leadFilters, searchQuery]);

  const { data: leads, loading, error, refetch } = useLeads(projectId, filters);

  // Sort leads
  const sortedLeads = useMemo(() => {
    if (!leads) return [];
    return [...leads].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'businessName':
          comparison = a.businessName.localeCompare(b.businessName);
          break;
        case 'rating':
          comparison = (a.rating || 0) - (b.rating || 0);
          break;
        case 'reviewCount':
          comparison = (a.reviewCount || 0) - (b.reviewCount || 0);
          break;
        case 'leadScore':
          comparison = a.leadScore - b.leadScore;
          break;
        case 'enrichmentStatus':
          comparison = a.enrichmentStatus.localeCompare(b.enrichmentStatus);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [leads, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleFilterChange = (key: keyof LeadFilters, value: any) => {
    const newFilters = { ...state.leadFilters };
    if (value === undefined || value === false || value === '') {
      delete newFilters[key];
    } else {
      (newFilters as any)[key] = value;
    }
    dispatch({ type: 'SET_LEAD_FILTERS', filters: newFilters });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 ml-1">&#8597;</span>;
    }
    return (
      <span className="text-primary-600 ml-1">
        {sortDirection === 'asc' ? '&#8593;' : '&#8595;'}
      </span>
    );
  };

  const getStatusBadge = (status: Lead['enrichmentStatus']) => {
    switch (status) {
      case 'done':
        return <span className="badge-success">Done</span>;
      case 'in_progress':
        return <span className="badge-info">Processing</span>;
      case 'error':
        return <span className="badge-error">Error</span>;
      case 'skipped':
        return <span className="badge-gray">Skipped</span>;
      default:
        return <span className="badge-warning">Pending</span>;
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <span className="badge-success">{score}</span>;
    if (score >= 60) return <span className="badge-info">{score}</span>;
    if (score >= 40) return <span className="badge-warning">{score}</span>;
    return <span className="badge-gray">{score}</span>;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Filters */}
      <div className="p-4 bg-gray-50 border-b border-gray-200 space-y-3">
        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            className="input pl-10"
            placeholder="Search leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Filter toggles */}
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={state.leadFilters.hasEmail || false}
              onChange={(e) => handleFilterChange('hasEmail', e.target.checked || undefined)}
            />
            <span className="text-sm">Has Email</span>
          </label>

          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={state.leadFilters.hasWebsite || false}
              onChange={(e) => handleFilterChange('hasWebsite', e.target.checked || undefined)}
            />
            <span className="text-sm">Has Website</span>
          </label>

          <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={state.leadFilters.opportunityFinder || false}
              onChange={(e) => handleFilterChange('opportunityFinder', e.target.checked || undefined)}
            />
            <span className="text-sm">Opportunity Finder</span>
          </label>

          <select
            className="px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm"
            value={state.leadFilters.minRating || ''}
            onChange={(e) => handleFilterChange('minRating', e.target.value ? parseFloat(e.target.value) : undefined)}
          >
            <option value="">Any Rating</option>
            <option value="3">3+ Stars</option>
            <option value="4">4+ Stars</option>
            <option value="4.5">4.5+ Stars</option>
          </select>

          <select
            className="px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-sm"
            value={state.leadFilters.minReviews || ''}
            onChange={(e) => handleFilterChange('minReviews', e.target.value ? parseInt(e.target.value) : undefined)}
          >
            <option value="">Any Reviews</option>
            <option value="10">10+ Reviews</option>
            <option value="50">50+ Reviews</option>
            <option value="100">100+ Reviews</option>
          </select>

          {Object.keys(state.leadFilters).length > 0 && (
            <button
              onClick={() => dispatch({ type: 'RESET_LEAD_FILTERS' })}
              className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : error ? (
          <div className="text-center text-red-600 py-8">
            <p>Error loading leads: {error}</p>
            <button onClick={refetch} className="btn-secondary btn-sm mt-4">
              Retry
            </button>
          </div>
        ) : sortedLeads.length === 0 ? (
          <div className="text-center py-16">
            <svg
              className="w-16 h-16 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No leads found</h3>
            <p className="text-gray-500">
              {Object.keys(state.leadFilters).length > 0
                ? 'Try adjusting your filters'
                : 'Run a scrape to find leads'}
            </p>
          </div>
        ) : (
          <table className="table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('businessName')}
                >
                  Business Name <SortIcon field="businessName" />
                </th>
                <th>Category</th>
                <th
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('rating')}
                >
                  Rating <SortIcon field="rating" />
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('reviewCount')}
                >
                  Reviews <SortIcon field="reviewCount" />
                </th>
                <th>Phone</th>
                <th>Emails</th>
                <th
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('leadScore')}
                >
                  Score <SortIcon field="leadScore" />
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('enrichmentStatus')}
                >
                  Status <SortIcon field="enrichmentStatus" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => dispatch({ type: 'SELECT_LEAD', leadId: lead.id })}
                  className={state.selectedLeadId === lead.id ? 'bg-primary-50' : ''}
                >
                  <td className="max-w-xs">
                    <div className="truncate font-medium">{lead.businessName}</div>
                    {lead.address && (
                      <div className="text-xs text-gray-500 truncate">{lead.address}</div>
                    )}
                  </td>
                  <td className="text-gray-500">{lead.category || '-'}</td>
                  <td>
                    {lead.rating ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {lead.rating.toFixed(1)}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{lead.reviewCount ?? '-'}</td>
                  <td className="text-gray-500">{lead.phone || '-'}</td>
                  <td>
                    {lead.emails.length > 0 ? (
                      <span className="badge-success">{lead.emails.length}</span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>{getScoreBadge(lead.leadScore)}</td>
                  <td>{getStatusBadge(lead.enrichmentStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-200 bg-white text-sm text-gray-500">
        {sortedLeads.length} leads
        {leads && sortedLeads.length !== leads.length && ` (filtered from ${leads.length})`}
      </div>
    </div>
  );
}
