import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppState } from '../store';
import { useLeads, useTags } from '../hooks/useIPC';
import type { Lead, LeadFilters, Tag, VerifiedEmail } from '../../shared/types';

interface LeadsTableProps {
  projectId: string;
  onRefresh: () => void;
}

type SortField = 'businessName' | 'rating' | 'reviewCount' | 'leadScore' | 'enrichmentStatus';
type SortDirection = 'asc' | 'desc';

const TAG_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

export default function LeadsTable({ projectId, onRefresh }: LeadsTableProps) {
  const { state, dispatch } = useAppState();
  const [sortField, setSortField] = useState<SortField>('leadScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [minScore, setMinScore] = useState<number | undefined>();
  const [maxScore, setMaxScore] = useState<number | undefined>();
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [emailVerifications, setEmailVerifications] = useState<Map<string, VerifiedEmail>>(new Map());

  const { data: tags, refetch: refetchTags } = useTags();

  // Build filters
  const filters: LeadFilters = useMemo(() => ({
    ...state.leadFilters,
    searchQuery: searchQuery || undefined,
  }), [state.leadFilters, searchQuery]);

  const { data: leads, loading, error, refetch } = useLeads(projectId, filters);

  // Sort and filter leads
  const sortedLeads = useMemo(() => {
    if (!leads) return [];
    let filtered = [...leads];

    // Apply score range filter
    if (minScore !== undefined) {
      filtered = filtered.filter(l => l.leadScore >= minScore);
    }
    if (maxScore !== undefined) {
      filtered = filtered.filter(l => l.leadScore <= maxScore);
    }

    return filtered.sort((a, b) => {
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
  }, [leads, sortField, sortDirection, minScore, maxScore]);

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

  // Bulk selection handlers
  const toggleSelectAll = useCallback(() => {
    if (selectedLeadIds.size === sortedLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(sortedLeads.map(l => l.id)));
    }
  }, [sortedLeads, selectedLeadIds]);

  const toggleSelectLead = useCallback((leadId: string) => {
    const newSet = new Set(selectedLeadIds);
    if (newSet.has(leadId)) {
      newSet.delete(leadId);
    } else {
      newSet.add(leadId);
    }
    setSelectedLeadIds(newSet);
  }, [selectedLeadIds]);

  // Bulk actions
  const handleBulkDelete = async () => {
    if (selectedLeadIds.size === 0) return;
    if (!confirm(`Delete ${selectedLeadIds.size} selected leads?`)) return;

    const result = await window.api.bulk.deleteLeads(Array.from(selectedLeadIds));
    if (result.success) {
      setSelectedLeadIds(new Set());
      refetch();
      onRefresh();
    }
  };

  const handleBulkTag = async (tagId: string) => {
    if (selectedLeadIds.size === 0) return;

    const result = await window.api.bulk.addTag(Array.from(selectedLeadIds), tagId);
    if (result.success) {
      setShowTagMenu(false);
      refetch();
    }
  };

  const handleBulkExport = async (format: 'csv' | 'json' | 'xlsx') => {
    const result = await window.api.export.leads(
      projectId,
      format,
      filters,
      selectedLeadIds.size > 0 ? Array.from(selectedLeadIds) : undefined
    );
    if (result.success) {
      setShowExportMenu(false);
    }
  };

  const handleVerifyEmails = async () => {
    const leadsToVerify = selectedLeadIds.size > 0
      ? sortedLeads.filter(l => selectedLeadIds.has(l.id))
      : sortedLeads;

    const allEmails = leadsToVerify.flatMap(l => l.emails);
    if (allEmails.length === 0) return;

    const result = await window.api.email.verifyBulk(allEmails);
    if (result.success && result.data) {
      const newVerifications = new Map(emailVerifications);
      result.data.forEach(v => newVerifications.set(v.email, v));
      setEmailVerifications(newVerifications);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-300 dark:text-gray-600 ml-1">&#8597;</span>;
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

  const getEmailVerificationIcon = (email: string) => {
    const verification = emailVerifications.get(email);
    if (!verification) return null;

    switch (verification.status) {
      case 'valid':
        return (
          <svg className="w-3 h-3 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'invalid':
        return (
          <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Filters */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 space-y-3">
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
          <label className="filter-toggle">
            <input
              type="checkbox"
              className="checkbox"
              checked={state.leadFilters.hasEmail || false}
              onChange={(e) => handleFilterChange('hasEmail', e.target.checked || undefined)}
            />
            <span className="text-sm">Has Email</span>
          </label>

          <label className="filter-toggle">
            <input
              type="checkbox"
              className="checkbox"
              checked={state.leadFilters.hasWebsite || false}
              onChange={(e) => handleFilterChange('hasWebsite', e.target.checked || undefined)}
            />
            <span className="text-sm">Has Website</span>
          </label>

          <label className="filter-toggle">
            <input
              type="checkbox"
              className="checkbox"
              checked={state.leadFilters.opportunityFinder || false}
              onChange={(e) => handleFilterChange('opportunityFinder', e.target.checked || undefined)}
            />
            <span className="text-sm">Opportunity Finder</span>
          </label>

          <select
            className="filter-select"
            value={state.leadFilters.minRating || ''}
            onChange={(e) => handleFilterChange('minRating', e.target.value ? parseFloat(e.target.value) : undefined)}
          >
            <option value="">Any Rating</option>
            <option value="3">3+ Stars</option>
            <option value="4">4+ Stars</option>
            <option value="4.5">4.5+ Stars</option>
          </select>

          <select
            className="filter-select"
            value={state.leadFilters.minReviews || ''}
            onChange={(e) => handleFilterChange('minReviews', e.target.value ? parseInt(e.target.value) : undefined)}
          >
            <option value="">Any Reviews</option>
            <option value="10">10+ Reviews</option>
            <option value="50">50+ Reviews</option>
            <option value="100">100+ Reviews</option>
          </select>

          {/* Score range filter */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              className="filter-input w-16"
              placeholder="Min"
              min="0"
              max="100"
              value={minScore ?? ''}
              onChange={(e) => setMinScore(e.target.value ? parseInt(e.target.value) : undefined)}
            />
            <span className="text-gray-400">-</span>
            <input
              type="number"
              className="filter-input w-16"
              placeholder="Max"
              min="0"
              max="100"
              value={maxScore ?? ''}
              onChange={(e) => setMaxScore(e.target.value ? parseInt(e.target.value) : undefined)}
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">Score</span>
          </div>

          {(Object.keys(state.leadFilters).length > 0 || minScore !== undefined || maxScore !== undefined) && (
            <button
              onClick={() => {
                dispatch({ type: 'RESET_LEAD_FILTERS' });
                setMinScore(undefined);
                setMaxScore(undefined);
              }}
              className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:text-red-700"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Bulk actions bar */}
        {selectedLeadIds.size > 0 && (
          <div className="flex items-center gap-3 p-2 bg-primary-50 dark:bg-primary-900/30 rounded-lg">
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {selectedLeadIds.size} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkDelete}
                className="btn-sm btn-danger"
              >
                Delete
              </button>
              <div className="relative">
                <button
                  onClick={() => setShowTagMenu(!showTagMenu)}
                  className="btn-sm btn-secondary"
                >
                  Tag
                </button>
                {showTagMenu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                    {tags?.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => handleBulkTag(tag.id)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </button>
                    ))}
                    {(!tags || tags.length === 0) && (
                      <div className="px-3 py-2 text-sm text-gray-500">No tags yet</div>
                    )}
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn-sm btn-secondary"
                >
                  Export
                </button>
                {showExportMenu && (
                  <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                    <button
                      onClick={() => handleBulkExport('csv')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      CSV
                    </button>
                    <button
                      onClick={() => handleBulkExport('json')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      JSON
                    </button>
                    <button
                      onClick={() => handleBulkExport('xlsx')}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Excel
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleVerifyEmails}
                className="btn-sm btn-secondary"
              >
                Verify Emails
              </button>
              <button
                onClick={() => setSelectedLeadIds(new Set())}
                className="btn-sm btn-ghost"
              >
                Clear
              </button>
            </div>
          </div>
        )}
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
              className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-1">No leads found</h3>
            <p className="text-gray-500 dark:text-gray-400">
              {Object.keys(state.leadFilters).length > 0
                ? 'Try adjusting your filters'
                : 'Run a scrape to find leads'}
            </p>
          </div>
        ) : (
          <table className="table">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={selectedLeadIds.size === sortedLeads.length && sortedLeads.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('businessName')}
                >
                  Business Name <SortIcon field="businessName" />
                </th>
                <th>Category</th>
                <th
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('rating')}
                >
                  Rating <SortIcon field="rating" />
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('reviewCount')}
                >
                  Reviews <SortIcon field="reviewCount" />
                </th>
                <th>Phone</th>
                <th>Emails</th>
                <th
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('leadScore')}
                >
                  Score <SortIcon field="leadScore" />
                </th>
                <th
                  className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                  onClick={() => handleSort('enrichmentStatus')}
                >
                  Status <SortIcon field="enrichmentStatus" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedLeads.map((lead) => (
                <tr
                  key={lead.id}
                  className={`cursor-pointer transition-colors ${
                    selectedLeadIds.has(lead.id)
                      ? 'bg-primary-50 dark:bg-primary-900/20'
                      : state.selectedLeadId === lead.id
                      ? 'bg-gray-50 dark:bg-gray-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedLeadIds.has(lead.id)}
                      onChange={() => toggleSelectLead(lead.id)}
                    />
                  </td>
                  <td
                    className="max-w-xs"
                    onClick={() => dispatch({ type: 'SELECT_LEAD', leadId: lead.id })}
                  >
                    <div className="truncate font-medium text-gray-900 dark:text-gray-100">{lead.businessName}</div>
                    {lead.address && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{lead.address}</div>
                    )}
                  </td>
                  <td className="text-gray-500 dark:text-gray-400">{lead.category || '-'}</td>
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
                  <td className="text-gray-500 dark:text-gray-400">{lead.phone || '-'}</td>
                  <td>
                    {lead.emails.length > 0 ? (
                      <div className="flex items-center gap-1">
                        <span className="badge-success">{lead.emails.length}</span>
                        {lead.emails.map(email => getEmailVerificationIcon(email))}
                      </div>
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
      <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-500 dark:text-gray-400 flex justify-between items-center">
        <span>
          {sortedLeads.length} leads
          {leads && sortedLeads.length !== leads.length && ` (filtered from ${leads.length})`}
        </span>
        {selectedLeadIds.size === 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkExport('csv')}
              className="btn-sm btn-ghost"
            >
              Export CSV
            </button>
            <button
              onClick={() => handleBulkExport('json')}
              className="btn-sm btn-ghost"
            >
              Export JSON
            </button>
            <button
              onClick={() => handleBulkExport('xlsx')}
              className="btn-sm btn-ghost"
            >
              Export Excel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
