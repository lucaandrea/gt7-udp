import React, { useState } from 'react';
import { StartPage } from './StartPage';
import { IgnitionAnimation } from './IgnitionAnimation';
import { Dashboard } from './Dashboard';

interface UserSettings {
  ipAddress: string;
  userName: string;
}

type AppState = 'start' | 'ignition' | 'dashboard';

export const App: React.FC = () => {
  const [currentState, setCurrentState] = useState<AppState>('start');
  const [userSettings, setUserSettings] = useState<UserSettings>({
    ipAddress: '10.0.1.74',
    userName: ''
  });
  const [showSettings, setShowSettings] = useState(false);

  const handleConnect = (settings: UserSettings) => {
    setUserSettings(settings);
    setCurrentState('ignition');
  };

  const handleIgnitionComplete = () => {
    setCurrentState('dashboard');
  };

  const handleSettingsUpdate = (settings: UserSettings) => {
    setUserSettings(settings);
    setShowSettings(false);
  };

  const handleBackToStart = () => {
    setCurrentState('start');
    setShowSettings(false);
  };

  if (currentState === 'start') {
    return (
      <StartPage 
        onConnect={handleConnect}
        initialSettings={userSettings}
      />
    );
  }

  if (currentState === 'ignition') {
    return (
      <IgnitionAnimation
        onComplete={handleIgnitionComplete}
        ipAddress={userSettings.ipAddress}
        userName={userSettings.userName}
      />
    );
  }

  return (
    <Dashboard 
      userSettings={userSettings}
      onSettingsClick={() => setShowSettings(true)}
      showSettings={showSettings}
      onSettingsUpdate={handleSettingsUpdate}
      onBackToStart={handleBackToStart}
      onCloseSettings={() => setShowSettings(false)}
    />
  );
}; 