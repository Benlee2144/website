import React from 'react';
import { useAppState } from '../store';
import { useFollowUps, useLeadOperations } from '../hooks/useIPC';
import type { Lead, LeadStatus } from '../../shared/types';

const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'interested', label: 'Interested', color: 'bg-purple-100 text-purple-800' },
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-800' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800' },
];

export default function FollowUpsView() {
  const { dueLeads, upcomingLeads, loading, refetch } = useFollowUps();
  const { updateStatus, updateFollowUp } = useLeadOperations();
  const { dispatch } = useAppState();

  const handleStatusChange = async (leadId: string, status: LeadStatus) => {
    await updateStatus(leadId, status);
    refetch();
  };

  const handleClearFollowUp = async (leadId: string) => {
    await updateFollowUp(leadId, null);
    refetch();
  };

  const handleViewLead = (lead: Lead) => {
    dispatch({ type: 'SELECT_PROJECT', projectId: lead.projectId });
    dispatch({ type: 'SELECT_LEAD', leadId: lead.id });
  };

  const LeadRow = ({ lead, isDue }: { lead: Lead; isDue: boolean }) => (
    <div
      className={`p-4 border rounded-lg ${
        isDue ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-medium text-gray-900">{lead.businessName}</h3>
          {lead.address && (
            <p className="text-sm text-gray-500 mt-1">{lead.address}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-xs font-medium ${isDue ? 'text-red-600' : 'text-gray-600'}`}>
              {isDue ? 'Due: ' : 'Follow-up: '}
              {new Date(lead.followUpDate!).toLocaleDateString()}
            </span>
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                {lead.phone}
              </a>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <select
            className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
            value={lead.leadStatus}
            onChange={(e) => handleStatusChange(lead.id, e.target.value as LeadStatus)}
          >
            {LEAD_STATUS_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              onClick={() => handleViewLead(lead)}
              className="text-xs text-blue-600 hover:text-blue-700"
            >
              View
            </button>
            <button
              onClick={() => handleClearFollowUp(lead.id)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="drag-region h-12 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
        <h1 className="no-drag text-lg font-semibold text-gray-900">Follow-up Reminders</h1>
        <button
          onClick={refetch}
          className="no-drag btn-secondary btn-sm"
        >
          Refresh
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="spinner" />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Due Follow-ups */}
            <div>
              <h2 className="text-sm font-semibold text-red-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Due Now ({dueLeads.length})
              </h2>
              {dueLeads.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No overdue follow-ups</p>
              ) : (
                <div className="space-y-3">
                  {dueLeads.map(lead => (
                    <LeadRow key={lead.id} lead={lead} isDue={true} />
                  ))}
                </div>
              )}
            </div>

            {/* Upcoming Follow-ups */}
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Upcoming (Next 7 Days) ({upcomingLeads.length})
              </h2>
              {upcomingLeads.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No upcoming follow-ups</p>
              ) : (
                <div className="space-y-3">
                  {upcomingLeads.map(lead => (
                    <LeadRow key={lead.id} lead={lead} isDue={false} />
                  ))}
                </div>
              )}
            </div>

            {/* Empty state */}
            {dueLeads.length === 0 && upcomingLeads.length === 0 && (
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No Follow-ups Scheduled</h3>
                <p className="text-gray-600">
                  Set follow-up dates on leads to see them here
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
