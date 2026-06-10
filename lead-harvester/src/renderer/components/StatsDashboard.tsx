import React from 'react';
import type { ProjectStats } from '../../shared/types';

interface StatsDashboardProps {
  stats: ProjectStats | null;
  loading: boolean;
}

export function StatsDashboard({ stats, loading }: StatsDashboardProps) {
  if (loading) {
    return (
      <div className="p-6 text-center text-gray-500">
        Loading statistics...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6 text-center text-gray-500">
        No statistics available
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    contacted: 'bg-yellow-100 text-yellow-800',
    interested: 'bg-purple-100 text-purple-800',
    won: 'bg-green-100 text-green-800',
    lost: 'bg-red-100 text-red-800',
  };

  const conversionRate = stats.totalLeads > 0
    ? ((stats.leadsByStatus.won / stats.totalLeads) * 100).toFixed(1)
    : '0';

  const emailRate = stats.totalLeads > 0
    ? ((stats.leadsWithEmail / stats.totalLeads) * 100).toFixed(1)
    : '0';

  const websiteRate = stats.totalLeads > 0
    ? ((stats.leadsWithWebsite / stats.totalLeads) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.totalLeads}</div>
          <div className="text-sm text-gray-500">Total Leads</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{stats.leadsWithEmail}</div>
          <div className="text-sm text-gray-500">With Email ({emailRate}%)</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.leadsWithWebsite}</div>
          <div className="text-sm text-gray-500">With Website ({websiteRate}%)</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-purple-600">{conversionRate}%</div>
          <div className="text-sm text-gray-500">Won Rate</div>
        </div>
      </div>

      {/* Pipeline Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="font-semibold text-gray-900 mb-4">Pipeline Status</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats.leadsByStatus).map(([status, count]) => (
            <div
              key={status}
              className={`px-3 py-2 rounded-lg ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}
            >
              <span className="font-semibold">{count}</span>
              <span className="ml-1 capitalize">{status}</span>
            </div>
          ))}
        </div>

        {/* Pipeline Bar */}
        <div className="mt-4 h-4 bg-gray-100 rounded-full overflow-hidden flex">
          {stats.totalLeads > 0 && Object.entries(stats.leadsByStatus).map(([status, count]) => {
            const percentage = (count / stats.totalLeads) * 100;
            if (percentage === 0) return null;

            const barColors: Record<string, string> = {
              new: 'bg-blue-500',
              contacted: 'bg-yellow-500',
              interested: 'bg-purple-500',
              won: 'bg-green-500',
              lost: 'bg-red-500',
            };

            return (
              <div
                key={status}
                className={`h-full ${barColors[status] || 'bg-gray-400'}`}
                style={{ width: `${percentage}%` }}
                title={`${status}: ${count} (${percentage.toFixed(1)}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* Averages */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Average Rating</h3>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-amber-500">
              {stats.avgRating.toFixed(1)}
            </span>
            <span className="text-amber-500">★</span>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-2">Average Reviews</h3>
          <div className="text-2xl font-bold text-gray-700">
            {Math.round(stats.avgReviewCount)}
          </div>
        </div>
      </div>

      {/* Categories */}
      {Object.keys(stats.leadsByCategory).length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Top Categories</h3>
          <div className="space-y-2">
            {Object.entries(stats.leadsByCategory)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([category, count]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-gray-700 truncate">{category}</span>
                  <span className="text-gray-500 font-medium">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Leads Over Time */}
      {stats.leadsOverTime.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Leads Over Time (Last 30 Days)</h3>
          <div className="h-32 flex items-end gap-1">
            {stats.leadsOverTime.map((day, index) => {
              const maxCount = Math.max(...stats.leadsOverTime.map(d => d.count));
              const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;

              return (
                <div
                  key={index}
                  className="flex-1 bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${day.date}: ${day.count} leads`}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{stats.leadsOverTime[0]?.date}</span>
            <span>{stats.leadsOverTime[stats.leadsOverTime.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Additional Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.leadsWithPhone}</div>
          <div className="text-sm text-gray-500">With Phone Number</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{stats.enrichedLeads}</div>
          <div className="text-sm text-gray-500">Enriched Leads</div>
        </div>
      </div>
    </div>
  );
}
