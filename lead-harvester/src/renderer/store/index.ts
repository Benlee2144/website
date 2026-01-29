import { createContext, useContext } from 'react';
import type { Project, Lead, AppSettings, LeadFilters } from '../../shared/types';

// App state interface
export interface AppState {
  // Navigation
  currentView: 'projects' | 'project-detail' | 'settings';
  selectedProjectId: string | null;
  selectedLeadId: string | null;

  // UI state
  showOnboarding: boolean;
  sidebarCollapsed: boolean;

  // Filters
  leadFilters: LeadFilters;
}

// Initial state
export const initialState: AppState = {
  currentView: 'projects',
  selectedProjectId: null,
  selectedLeadId: null,
  showOnboarding: true,
  sidebarCollapsed: false,
  leadFilters: {},
};

// Actions
export type AppAction =
  | { type: 'SET_VIEW'; view: AppState['currentView'] }
  | { type: 'SELECT_PROJECT'; projectId: string | null }
  | { type: 'SELECT_LEAD'; leadId: string | null }
  | { type: 'SET_ONBOARDING'; show: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_LEAD_FILTERS'; filters: LeadFilters }
  | { type: 'RESET_LEAD_FILTERS' };

// Reducer
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.view };

    case 'SELECT_PROJECT':
      return {
        ...state,
        selectedProjectId: action.projectId,
        currentView: action.projectId ? 'project-detail' : 'projects',
        selectedLeadId: null,
        leadFilters: {},
      };

    case 'SELECT_LEAD':
      return { ...state, selectedLeadId: action.leadId };

    case 'SET_ONBOARDING':
      return { ...state, showOnboarding: action.show };

    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };

    case 'SET_LEAD_FILTERS':
      return { ...state, leadFilters: action.filters };

    case 'RESET_LEAD_FILTERS':
      return { ...state, leadFilters: {} };

    default:
      return state;
  }
}

// Context
export interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return context;
}
