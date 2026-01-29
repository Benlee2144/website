import React from 'react';
import { useAppState } from '../store';
import Sidebar from './Sidebar';
import ProjectList from './ProjectList';
import ProjectDetail from './ProjectDetail';
import Settings from './Settings';

export default function Layout() {
  const { state } = useAppState();

  const renderContent = () => {
    switch (state.currentView) {
      case 'projects':
        return <ProjectList />;
      case 'project-detail':
        return <ProjectDetail />;
      case 'settings':
        return <Settings />;
      default:
        return <ProjectList />;
    }
  };

  return (
    <div className="h-screen flex overflow-hidden bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-hidden">
        {renderContent()}
      </main>
    </div>
  );
}
