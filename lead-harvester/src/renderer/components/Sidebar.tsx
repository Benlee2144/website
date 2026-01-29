import React from 'react';
import { useAppState } from '../store';
import { useProjects, useScraper } from '../hooks/useIPC';

export default function Sidebar() {
  const { state, dispatch } = useAppState();
  const { data: projects } = useProjects();
  const { status } = useScraper();

  const menuItems = [
    {
      id: 'projects',
      label: 'Projects',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      view: 'projects' as const,
    },
    {
      id: 'stats',
      label: 'Statistics',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      view: 'stats' as const,
    },
    {
      id: 'followups',
      label: 'Follow-ups',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      view: 'followups' as const,
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      view: 'templates' as const,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      view: 'settings' as const,
    },
  ];

  return (
    <div className="sidebar">
      {/* App title */}
      <div className="drag-region h-12 flex items-center px-4 border-b border-gray-200">
        <div className="no-drag flex items-center gap-2">
          <svg className="w-6 h-6 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <span className="font-semibold text-gray-900">LeadHarvester</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => dispatch({ type: 'SET_VIEW', view: item.view })}
            className={`sidebar-item w-full ${
              state.currentView === item.view ? 'active' : ''
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

        {/* Recent projects */}
        {projects && projects.length > 0 && (
          <div className="mt-6">
            <h3 className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Recent Projects
            </h3>
            <div className="mt-2">
              {projects.slice(0, 5).map((project) => (
                <button
                  key={project.id}
                  onClick={() => dispatch({ type: 'SELECT_PROJECT', projectId: project.id })}
                  className={`sidebar-item w-full text-left ${
                    state.selectedProjectId === project.id ? 'active' : ''
                  }`}
                >
                  <span className="truncate flex-1">{project.name}</span>
                  {status.isRunning && status.projectId === project.id && (
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Status bar */}
      <div className="px-4 py-3 border-t border-gray-200 text-xs text-gray-500">
        {status.isRunning ? (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>Scraping in progress...</span>
          </div>
        ) : (
          <span>{projects?.length || 0} projects</span>
        )}
      </div>
    </div>
  );
}
