import React from 'react';
import { useAppState } from '../store';
import { useIPCQuery } from '../hooks/useIPC';
import type { Lead } from '../../shared/types';

interface LeadDetailsProps {
  leadId: string;
}

export default function LeadDetails({ leadId }: LeadDetailsProps) {
  const { dispatch } = useAppState();
  const { data: lead, loading, error } = useIPCQuery<Lead | null>(
    () => window.api.leads.get(leadId),
    [leadId]
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-gray-500">Lead not found</p>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 truncate pr-2">{lead.businessName}</h3>
        <button
          onClick={() => dispatch({ type: 'SELECT_LEAD', leadId: null })}
          className="text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Score */}
        <div className="text-center py-4">
          <p className={`text-5xl font-bold ${getScoreColor(lead.leadScore)}`}>
            {lead.leadScore}
          </p>
          <p className="text-sm text-gray-500 mt-1">Lead Score</p>
        </div>

        {/* Status */}
        {lead.enrichmentStatus === 'error' && lead.errorMessage && (
          <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
            <p className="font-medium">Enrichment Error</p>
            <p className="mt-1">{lead.errorMessage}</p>
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Business Info
          </h4>

          {lead.category && (
            <div>
              <p className="text-xs text-gray-500">Category</p>
              <p className="text-sm text-gray-900">{lead.category}</p>
            </div>
          )}

          {lead.rating !== undefined && (
            <div>
              <p className="text-xs text-gray-500">Rating</p>
              <p className="text-sm text-gray-900 flex items-center gap-1">
                <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {lead.rating.toFixed(1)} ({lead.reviewCount || 0} reviews)
              </p>
            </div>
          )}

          {lead.address && (
            <div>
              <p className="text-xs text-gray-500">Address</p>
              <p className="text-sm text-gray-900">{lead.address}</p>
            </div>
          )}
        </div>

        {/* Contact Info */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Contact Info
          </h4>

          {lead.phone && (
            <div>
              <p className="text-xs text-gray-500">Phone</p>
              <a
                href={`tel:${lead.phone}`}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {lead.phone}
              </a>
            </div>
          )}

          {lead.websiteUrl && (
            <div>
              <p className="text-xs text-gray-500">Website</p>
              <a
                href={lead.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:text-primary-700 break-all"
              >
                {lead.websiteUrl}
              </a>
            </div>
          )}

          {lead.emails.length > 0 && (
            <div>
              <p className="text-xs text-gray-500">Emails</p>
              <div className="space-y-1">
                {lead.emails.map((email, i) => (
                  <a
                    key={i}
                    href={`mailto:${email}`}
                    className="block text-sm text-primary-600 hover:text-primary-700"
                  >
                    {email}
                  </a>
                ))}
              </div>
            </div>
          )}

          {lead.contactPageUrl && (
            <div>
              <p className="text-xs text-gray-500">Contact Page</p>
              <a
                href={lead.contactPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary-600 hover:text-primary-700 break-all"
              >
                {lead.contactPageUrl}
              </a>
            </div>
          )}
        </div>

        {/* Google Maps Link */}
        <div>
          <a
            href={lead.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            View on Google Maps
          </a>
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
          <p>Created: {new Date(lead.createdAt).toLocaleString()}</p>
          <p>Updated: {new Date(lead.updatedAt).toLocaleString()}</p>
          {lead.isDuplicate && <p className="text-yellow-600">Marked as duplicate</p>}
        </div>
      </div>
    </div>
  );
}
