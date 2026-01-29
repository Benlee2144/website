import React, { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useIPC';
import { USER_AGENTS, DEFAULT_SETTINGS } from '../../shared/types';

export default function Settings() {
  const { data: settings, loading, error, update, refetch } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleChange = (key: string, value: any) => {
    setLocalSettings((prev) => (prev ? { ...prev, [key]: value } : null));
  };

  const handleSave = async () => {
    if (!localSettings) return;
    setSaving(true);
    setSaved(false);

    const result = await update(localSettings);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }

    setSaving(false);
  };

  const handleReset = async () => {
    if (confirm('Reset all settings to defaults?')) {
      const result = await window.api.settings.reset();
      if (result.success && result.data) {
        setLocalSettings(result.data);
        refetch();
      }
    }
  };

  if (loading || !localSettings) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading settings: {error}</p>
          <button onClick={refetch} className="btn-secondary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="drag-region h-12 flex items-center justify-between px-6 border-b border-gray-200 bg-white">
        <h1 className="no-drag text-lg font-semibold text-gray-900">Settings</h1>
        <div className="no-drag flex items-center gap-2">
          {saved && <span className="text-green-600 text-sm">Saved!</span>}
          <button onClick={handleReset} className="btn-secondary btn-sm">
            Reset to Defaults
          </button>
          <button onClick={handleSave} className="btn-primary btn-sm" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-8">
          {/* Scraping Settings */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Scraping Settings</h2>

            {/* Safe Mode */}
            <div className="mb-6">
              <label className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">Safe Mode</span>
                  <p className="text-sm text-gray-500">
                    Slower scraping with more delays to reduce detection risk
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={localSettings.safeMode}
                  onChange={(e) => handleChange('safeMode', e.target.checked)}
                />
              </label>
            </div>

            {/* Concurrency */}
            <div className="mb-6">
              <label className="label">Concurrency Level</label>
              <select
                className="input"
                value={localSettings.concurrency}
                onChange={(e) => handleChange('concurrency', parseInt(e.target.value))}
              >
                <option value="1">1 (Safest)</option>
                <option value="2">2 (Moderate)</option>
                <option value="3">3 (Fastest)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Number of parallel enrichment tasks. Higher values are faster but riskier.
              </p>
            </div>

            {/* Delay between actions */}
            <div className="mb-6">
              <label className="label">Delay Between Actions (ms)</label>
              <input
                type="number"
                className="input"
                min="500"
                max="10000"
                step="100"
                value={localSettings.delayBetweenActions}
                onChange={(e) => handleChange('delayBetweenActions', parseInt(e.target.value))}
              />
              <p className="mt-1 text-xs text-gray-500">
                Minimum delay between scraping actions (500-10000ms)
              </p>
            </div>

            {/* Website crawl timeout */}
            <div className="mb-6">
              <label className="label">Website Crawl Timeout (ms)</label>
              <input
                type="number"
                className="input"
                min="5000"
                max="60000"
                step="1000"
                value={localSettings.websiteCrawlTimeout}
                onChange={(e) => handleChange('websiteCrawlTimeout', parseInt(e.target.value))}
              />
              <p className="mt-1 text-xs text-gray-500">
                How long to wait for a website to load during enrichment (5000-60000ms)
              </p>
            </div>

            {/* User Agent */}
            <div>
              <label className="label">User Agent</label>
              <select
                className="input"
                value={localSettings.userAgent}
                onChange={(e) => handleChange('userAgent', e.target.value)}
              >
                {USER_AGENTS.map((ua, i) => (
                  <option key={i} value={ua}>
                    {ua.includes('Windows') ? 'Windows Chrome' : ''}
                    {ua.includes('Macintosh') && ua.includes('Chrome') ? 'Mac Chrome' : ''}
                    {ua.includes('Firefox') ? 'Windows Firefox' : ''}
                    {ua.includes('Safari') && !ua.includes('Chrome') ? 'Mac Safari' : ''}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">Browser identity used for scraping</p>
            </div>
          </div>

          {/* Default Settings */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Default Project Settings</h2>

            {/* Default max results */}
            <div>
              <label className="label">Default Max Results</label>
              <input
                type="number"
                className="input"
                min="10"
                max="500"
                value={localSettings.maxResultsDefault}
                onChange={(e) => handleChange('maxResultsDefault', parseInt(e.target.value))}
              />
              <p className="mt-1 text-xs text-gray-500">
                Default maximum leads to collect per project (10-500)
              </p>
            </div>
          </div>

          {/* App Settings */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">App Settings</h2>

            {/* Show onboarding */}
            <div>
              <label className="flex items-center justify-between">
                <div>
                  <span className="font-medium text-gray-900">Show Onboarding</span>
                  <p className="text-sm text-gray-500">
                    Display the welcome screen on next startup
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={localSettings.showOnboarding}
                  onChange={(e) => handleChange('showOnboarding', e.target.checked)}
                />
              </label>
            </div>
          </div>

          {/* About */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">About</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <p>
                <strong>LeadHarvester</strong> is a local-first desktop application for
                extracting business leads from Google Maps.
              </p>
              <p>
                Version: 1.0.0
              </p>
              <p className="text-xs text-gray-500 mt-4">
                This tool scrapes only publicly visible information. Users are responsible
                for compliance with applicable laws and terms of service.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
