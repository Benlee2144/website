import React, { useState } from 'react';
import { useAppState } from '../store';
import { useIPCQuery, useLeadOperations, useLeadNotes } from '../hooks/useIPC';
import type { Lead, LeadStatus } from '../../shared/types';

const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'contacted', label: 'Contacted', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  { value: 'interested', label: 'Interested', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  { value: 'won', label: 'Won', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'lost', label: 'Lost', color: 'bg-red-100 text-red-800 border-red-200' },
];

interface LeadDetailsProps {
  leadId: string;
}

export default function LeadDetails({ leadId }: LeadDetailsProps) {
  const { dispatch } = useAppState();
  const { data: lead, loading, error, refetch } = useIPCQuery<Lead | null>(
    () => window.api.leads.get(leadId),
    [leadId]
  );
  const { updateStatus, updateNotes, updateFollowUp } = useLeadOperations();
  const { data: notes, createNote, deleteNote } = useLeadNotes(leadId);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [newNote, setNewNote] = useState('');
  const [showFollowUpPicker, setShowFollowUpPicker] = useState(false);

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

  const handleStatusChange = async (status: LeadStatus) => {
    await updateStatus(leadId, status);
    refetch();
  };

  const handleNotesChange = async () => {
    await updateNotes(leadId, notesText);
    setEditingNotes(false);
    refetch();
  };

  const handleFollowUpChange = async (date: string | null) => {
    await updateFollowUp(leadId, date);
    setShowFollowUpPicker(false);
    refetch();
  };

  const handleAddNote = async () => {
    if (newNote.trim()) {
      await createNote(newNote.trim());
      setNewNote('');
    }
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
        {/* Score and Status Row */}
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className={`text-4xl font-bold ${getScoreColor(lead.leadScore)}`}>
              {lead.leadScore}
            </p>
            <p className="text-xs text-gray-500 mt-1">Score</p>
          </div>

          {/* Pipeline Status */}
          <div>
            <select
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
              value={lead.leadStatus || 'new'}
              onChange={(e) => handleStatusChange(e.target.value as LeadStatus)}
            >
              {LEAD_STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Follow-up Reminder */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Follow-up:</span>
            {lead.followUpDate ? (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  new Date(lead.followUpDate) <= new Date() ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {new Date(lead.followUpDate).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleFollowUpChange(null)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <input
                type="date"
                className="text-sm border border-gray-200 rounded px-2 py-1"
                onChange={(e) => handleFollowUpChange(e.target.value || null)}
                min={new Date().toISOString().split('T')[0]}
              />
            )}
          </div>
        </div>

        {/* Sentiment Badge */}
        {lead.reviewSentiment && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sentiment:</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
              lead.reviewSentiment === 'positive' ? 'bg-green-100 text-green-800' :
              lead.reviewSentiment === 'negative' ? 'bg-red-100 text-red-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {lead.reviewSentiment.charAt(0).toUpperCase() + lead.reviewSentiment.slice(1)}
            </span>
          </div>
        )}

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

        {/* Social Media */}
        {lead.socialMedia && Object.keys(lead.socialMedia).some(k => (lead.socialMedia as any)[k]) && (
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Social Media
            </h4>
            <div className="flex flex-wrap gap-2">
              {lead.socialMedia.facebook && (
                <a
                  href={lead.socialMedia.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 transition-colors"
                >
                  Facebook
                </a>
              )}
              {lead.socialMedia.instagram && (
                <a
                  href={lead.socialMedia.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-pink-100 text-pink-700 rounded-lg text-sm hover:bg-pink-200 transition-colors"
                >
                  Instagram
                </a>
              )}
              {lead.socialMedia.linkedin && (
                <a
                  href={lead.socialMedia.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm hover:bg-blue-200 transition-colors"
                >
                  LinkedIn
                </a>
              )}
              {lead.socialMedia.twitter && (
                <a
                  href={lead.socialMedia.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-sky-100 text-sky-700 rounded-lg text-sm hover:bg-sky-200 transition-colors"
                >
                  Twitter/X
                </a>
              )}
              {lead.socialMedia.youtube && (
                <a
                  href={lead.socialMedia.youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors"
                >
                  YouTube
                </a>
              )}
            </div>
          </div>
        )}

        {/* Business Hours */}
        {lead.businessHours && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Business Hours
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{lead.businessHours}</p>
          </div>
        )}

        {/* Contact Form Indicator */}
        {lead.hasContactForm !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Contact Form:</span>
            {lead.hasContactForm ? (
              <span className="text-green-600 text-sm flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Detected
              </span>
            ) : (
              <span className="text-gray-400 text-sm">Not found</span>
            )}
          </div>
        )}

        {/* Notes Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Quick Notes
          </h4>
          <textarea
            className="w-full border border-gray-200 rounded-lg p-2 text-sm resize-none"
            rows={3}
            placeholder="Add notes about this lead..."
            value={lead.notes || ''}
            onChange={(e) => updateNotes(leadId, e.target.value)}
            onBlur={() => refetch()}
          />
        </div>

        {/* Comments/Activity Log */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Activity Notes
          </h4>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="Add a note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
            />
            <button
              onClick={handleAddNote}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
              disabled={!newNote.trim()}
            >
              Add
            </button>
          </div>
          {notes && notes.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-auto">
              {notes.map((note) => (
                <div key={note.id} className="bg-gray-50 rounded-lg p-2 text-sm">
                  <div className="flex justify-between items-start">
                    <p className="text-gray-700">{note.content}</p>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-gray-400 hover:text-red-500 ml-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(note.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="pt-4 border-t border-gray-100 text-xs text-gray-400 space-y-1">
          <p>Created: {new Date(lead.createdAt).toLocaleString()}</p>
          <p>Updated: {new Date(lead.updatedAt).toLocaleString()}</p>
          {lead.isDuplicate && <p className="text-yellow-600">Marked as duplicate</p>}
          {lead.latitude && lead.longitude && (
            <p>Location: {lead.latitude.toFixed(4)}, {lead.longitude.toFixed(4)}</p>
          )}
        </div>
      </div>
    </div>
  );
}
