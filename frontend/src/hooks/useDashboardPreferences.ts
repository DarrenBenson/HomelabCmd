import { useState, useCallback, useEffect, useRef } from 'react';
import { getDashboardPreferences, saveDashboardPreferences } from '../api/preferences';
import { ApiError } from '../api/client';
import type {
  DashboardPreferences,
  DashboardPreferencesSaveRequest,
  CardOrder,
} from '../types/preferences';

/**
 * US0136: Default preferences for first-time users and error fallback.
 */
export const DEFAULT_PREFERENCES: DashboardPreferences = {
  card_order: {
    servers: [],
    workstations: [],
  },
  collapsed_sections: [],
  view_mode: 'grid',
  updated_at: null,
};

export interface UseDashboardPreferencesResult {
  /** Current preferences (defaults if not loaded) */
  preferences: DashboardPreferences;
  /** True while initial load is in progress */
  isLoading: boolean;
  /** Error message if load failed */
  loadError: string | null;
  /** True while save is in progress */
  isSaving: boolean;
  /** True briefly after successful save */
  showSavedIndicator: boolean;
  /** Error message if save failed */
  saveError: string | null;
  /** Update card order for a section */
  updateCardOrder: (section: 'servers' | 'workstations', order: string[]) => void;
  /** Update collapsed sections */
  updateCollapsedSections: (collapsed: string[]) => void;
  /** Retry save after error */
  retrySave: () => void;
  /** Dismiss save error */
  dismissSaveError: () => void;
}

/**
 * US0136: Unified dashboard preferences hook.
 *
 * Provides loading, saving (debounced), and error handling for dashboard preferences.
 * Loads preferences in a single API call on mount, saves changes with 500ms debounce.
 *
 * AC1: Unified preference storage
 * AC2: Single-call load
 * AC3: Immediate save (debounced 500ms) with "Saved" indicator
 * AC6: Loading state
 * AC7: Fallback to defaults on error
 */
export function useDashboardPreferences(): UseDashboardPreferencesResult {
  const [preferences, setPreferences] = useState<DashboardPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Track pending save for debouncing
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPreferencesRef = useRef<DashboardPreferencesSaveRequest | null>(null);
  const savedIndicatorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load preferences on mount
  useEffect(() => {
    let ignore = false;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;

    async function loadPreferences(): Promise<void> {
      try {
        // AC6: Timeout after 2 seconds
        loadTimeout = setTimeout(() => {
          if (!ignore && isLoading) {
            setLoadError('Preferences unavailable, using defaults');
            setPreferences(DEFAULT_PREFERENCES);
            setIsLoading(false);
          }
        }, 2000);

        const data = await getDashboardPreferences();
        if (!ignore) {
          setPreferences(data);
          setLoadError(null);
        }
      } catch (error) {
        if (!ignore) {
          // AC7: Toast notification on load failure
          const message =
            error instanceof ApiError
              ? error.message
              : 'Preferences unavailable, using defaults';
          setLoadError(message);
          setPreferences(DEFAULT_PREFERENCES);
        }
      } finally {
        if (!ignore) {
          if (loadTimeout) clearTimeout(loadTimeout);
          setIsLoading(false);
        }
      }
    }

    loadPreferences();

    return () => {
      ignore = true;
      if (loadTimeout) clearTimeout(loadTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (savedIndicatorTimeoutRef.current) clearTimeout(savedIndicatorTimeoutRef.current);
    };
  }, []);

  // Debounced save function
  const debouncedSave = useCallback((newPrefs: DashboardPreferencesSaveRequest) => {
    pendingPreferencesRef.current = newPrefs;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // AC3: 500ms debounce
    saveTimeoutRef.current = setTimeout(async () => {
      if (!pendingPreferencesRef.current) return;

      setIsSaving(true);
      setSaveError(null);

      try {
        await saveDashboardPreferences(pendingPreferencesRef.current);

        // Show "Saved" indicator briefly
        setShowSavedIndicator(true);
        if (savedIndicatorTimeoutRef.current) {
          clearTimeout(savedIndicatorTimeoutRef.current);
        }
        savedIndicatorTimeoutRef.current = setTimeout(() => {
          setShowSavedIndicator(false);
        }, 2000);
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : 'Failed to save preferences';
        setSaveError(message);
      } finally {
        setIsSaving(false);
      }
    }, 500);
  }, []);

  // Update card order for a specific section
  const updateCardOrder = useCallback(
    (section: 'servers' | 'workstations', order: string[]) => {
      setPreferences((prev) => {
        const newCardOrder: CardOrder = {
          ...prev.card_order,
          [section]: order,
        };
        const newPrefs: DashboardPreferences = {
          ...prev,
          card_order: newCardOrder,
        };

        // Trigger debounced save
        debouncedSave({
          card_order: newCardOrder,
          collapsed_sections: prev.collapsed_sections,
          view_mode: prev.view_mode,
        });

        return newPrefs;
      });
    },
    [debouncedSave]
  );

  // Update collapsed sections
  const updateCollapsedSections = useCallback(
    (collapsed: string[]) => {
      setPreferences((prev) => {
        const newPrefs: DashboardPreferences = {
          ...prev,
          collapsed_sections: collapsed,
        };

        // Trigger debounced save
        debouncedSave({
          card_order: prev.card_order,
          collapsed_sections: collapsed,
          view_mode: prev.view_mode,
        });

        return newPrefs;
      });
    },
    [debouncedSave]
  );

  // Retry save after error
  const retrySave = useCallback(() => {
    if (pendingPreferencesRef.current) {
      setSaveError(null);
      debouncedSave(pendingPreferencesRef.current);
    }
  }, [debouncedSave]);

  // Dismiss save error
  const dismissSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  return {
    preferences,
    isLoading,
    loadError,
    isSaving,
    showSavedIndicator,
    saveError,
    updateCardOrder,
    updateCollapsedSections,
    retrySave,
    dismissSaveError,
  };
}
