import React, { useReducer, useEffect } from 'react';
import { AppContext, appReducer, initialState } from './store';
import { useSettings } from './hooks/useIPC';
import Layout from './components/Layout';
import OnboardingModal from './components/OnboardingModal';

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { data: settings, update: updateSettings, loading: settingsLoading } = useSettings();

  // Check if we should show onboarding
  useEffect(() => {
    if (settings) {
      dispatch({ type: 'SET_ONBOARDING', show: settings.showOnboarding });
    }
  }, [settings]);

  // Handle onboarding complete
  const handleOnboardingComplete = async () => {
    await updateSettings({ showOnboarding: false });
    dispatch({ type: 'SET_ONBOARDING', show: false });
  };

  if (settingsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="spinner mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {state.showOnboarding && (
        <OnboardingModal onComplete={handleOnboardingComplete} />
      )}
      <Layout />
    </AppContext.Provider>
  );
}

export default App;
