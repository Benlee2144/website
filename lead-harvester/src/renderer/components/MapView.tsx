import React, { useState, useMemo } from 'react';
import { useLeads, useProjects } from '../hooks/useIPC';
import type { Lead } from '../../shared/types';

interface MapViewProps {
  projectId: string | null;
}

export function MapView({ projectId }: MapViewProps) {
  const { data: leads, loading } = useLeads(projectId, {});

  // Filter leads that have coordinates
  const leadsWithCoords = useMemo(() => {
    if (!leads) return [];
    return leads.filter(lead => lead.latitude && lead.longitude);
  }, [leads]);

  // Calculate center of all leads
  const center = useMemo(() => {
    if (leadsWithCoords.length === 0) return null;

    const sumLat = leadsWithCoords.reduce((sum, lead) => sum + (lead.latitude || 0), 0);
    const sumLng = leadsWithCoords.reduce((sum, lead) => sum + (lead.longitude || 0), 0);

    return {
      lat: sumLat / leadsWithCoords.length,
      lng: sumLng / leadsWithCoords.length,
    };
  }, [leadsWithCoords]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  if (!projectId) {
    return (
      <div className="text-center py-8 text-gray-500">
        Select a project to view the map
      </div>
    );
  }

  if (leadsWithCoords.length === 0) {
    return (
      <div className="text-center py-8">
        <svg
          className="w-12 h-12 text-gray-400 mx-auto mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        <p className="text-gray-600 mb-2">No location data available</p>
        <p className="text-sm text-gray-500">
          Run enrichment to extract coordinates from Google Maps
        </p>
      </div>
    );
  }

  // Generate a Google Maps embed URL showing all locations
  const generateGoogleMapsUrl = () => {
    if (!center) return '';

    // Create a simple static maps URL or directions
    const markers = leadsWithCoords
      .slice(0, 10) // Limit to 10 markers for URL length
      .map(lead => `${lead.latitude},${lead.longitude}`)
      .join('|');

    return `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`;
  };

  return (
    <div className="space-y-4">
      {/* Map Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {leadsWithCoords.length} leads with location data
        </h3>
        <a
          href={generateGoogleMapsUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary btn-sm"
        >
          Open in Google Maps
        </a>
      </div>

      {/* Map placeholder - shows as a grid of location cards */}
      <div className="bg-gray-100 rounded-lg p-4 min-h-[300px]">
        <div className="text-center text-gray-500 mb-4">
          <p className="text-sm">Interactive map view</p>
          <p className="text-xs">(Install Leaflet package for full map visualization)</p>
        </div>

        {/* List of locations */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[400px] overflow-auto">
          {leadsWithCoords.map((lead) => (
            <div
              key={lead.id}
              className="bg-white rounded-lg p-3 shadow-sm border border-gray-200"
            >
              <p className="font-medium text-sm text-gray-900 truncate">
                {lead.businessName}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {lead.latitude?.toFixed(4)}, {lead.longitude?.toFixed(4)}
              </p>
              <a
                href={lead.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:text-blue-700 mt-1 block"
              >
                View on Maps
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500">
        {leads && (
          <p>
            {leadsWithCoords.length} of {leads.length} leads have location coordinates
          </p>
        )}
      </div>
    </div>
  );
}
