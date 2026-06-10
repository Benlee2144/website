import { useEffect, useCallback } from 'react';
import { useAppState } from '../store';
import type { LeadStatus } from '../../shared/types';

interface ShortcutHandlers {
  onNewProject?: () => void;
  onStartScrape?: () => void;
  onPauseScrape?: () => void;
  onExportLeads?: () => void;
  onFocusSearch?: () => void;
  onClearSelection?: () => void;
  onSelectAll?: () => void;
  onToggleDetails?: () => void;
  onStatusChange?: (status: LeadStatus) => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const { dispatch } = useAppState();

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Ignore if typing in an input field
    const target = event.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Allow Escape even in input fields
      if (event.key !== 'Escape') {
        return;
      }
    }

    const isMod = event.ctrlKey || event.metaKey;

    switch (event.key.toLowerCase()) {
      case 'n':
        if (isMod && handlers.onNewProject) {
          event.preventDefault();
          handlers.onNewProject();
        }
        break;

      case 's':
        if (isMod && handlers.onStartScrape) {
          event.preventDefault();
          handlers.onStartScrape();
        }
        break;

      case 'p':
        if (isMod && handlers.onPauseScrape) {
          event.preventDefault();
          handlers.onPauseScrape();
        }
        break;

      case 'e':
        if (isMod && handlers.onExportLeads) {
          event.preventDefault();
          handlers.onExportLeads();
        }
        break;

      case 'f':
        if (isMod && handlers.onFocusSearch) {
          event.preventDefault();
          handlers.onFocusSearch();
        }
        break;

      case 'escape':
        if (handlers.onClearSelection) {
          handlers.onClearSelection();
        }
        break;

      case 'a':
        if (isMod && handlers.onSelectAll) {
          event.preventDefault();
          handlers.onSelectAll();
        }
        break;

      case 'd':
        if (isMod && handlers.onToggleDetails) {
          event.preventDefault();
          handlers.onToggleDetails();
        }
        break;

      // Number keys for status
      case '1':
        if (!isMod && handlers.onStatusChange) {
          handlers.onStatusChange('new');
        }
        break;

      case '2':
        if (!isMod && handlers.onStatusChange) {
          handlers.onStatusChange('contacted');
        }
        break;

      case '3':
        if (!isMod && handlers.onStatusChange) {
          handlers.onStatusChange('interested');
        }
        break;

      case '4':
        if (!isMod && handlers.onStatusChange) {
          handlers.onStatusChange('won');
        }
        break;

      case '5':
        if (!isMod && handlers.onStatusChange) {
          handlers.onStatusChange('lost');
        }
        break;
    }
  }, [handlers]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
