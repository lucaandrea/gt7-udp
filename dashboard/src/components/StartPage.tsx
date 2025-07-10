import React, { useState } from 'react';
import './StartPage.css';

interface UserSettings {
  ipAddress: string;
  userName: string;
}

interface StartPageProps {
  onConnect: (settings: UserSettings) => void;
  initialSettings?: UserSettings;
}

export const StartPage: React.FC<StartPageProps> = ({ onConnect, initialSettings }) => {
  const [ipAddress, setIpAddress] = useState(initialSettings?.ipAddress || '10.0.1.74');
  const [userName, setUserName] = useState(initialSettings?.userName || '');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const validateIPAddress = (ip: string): boolean => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const handleConnect = () => {
    if (!ipAddress.trim()) {
      setError('Please enter your PS5 IP address');
      return;
    }

    if (!validateIPAddress(ipAddress)) {
      setError('Please enter a valid IP address (e.g., 192.168.1.100)');
      return;
    }

    if (!userName.trim()) {
      setError('Please enter your name for the Racing Engineer');
      return;
    }

    setError('');
    setIsConnecting(true);
    
    // Start the ignition sequence
    setTimeout(() => {
      onConnect({ ipAddress, userName });
    }, 100);
  };

  const handleIpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIpAddress(e.target.value);
    if (error) setError('');
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(e.target.value);
    if (error) setError('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConnect();
    }
  };

  return (
    <div className="start-page">
      {/* Animated background */}
      <div className="racing-grid"></div>
      <div className="ambient-glow"></div>
      
      {/* Main content */}
      <div className="start-container">
        {/* Header */}
        <header className="start-header">
          <div className="logo-section">
            <h1 className="main-title">GT7</h1>
            <div className="subtitle">RACING DASHBOARD</div>
          </div>
          <div className="status-bar">
            <div className="status-indicator offline"></div>
            <span className="status-text">OFFLINE</span>
          </div>
        </header>

        {/* Connection Panel */}
        <div className="connection-panel">
          <div className="panel-header">
            <h2 className="panel-title">INITIALIZE CONNECTION</h2>
            <div className="panel-subtitle">Connect to your PlayStation 5 racing session</div>
          </div>

          <div className="input-section">
            <label className="input-label">PS5 NETWORK ADDRESS</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={ipAddress}
                onChange={handleIpChange}
                onKeyPress={handleKeyPress}
                placeholder="192.168.1.100"
                className={`ip-input ${error ? 'error' : ''}`}
                disabled={isConnecting}
              />
              <div className="input-underline"></div>
            </div>

            <label className="input-label">DRIVER NAME</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={userName}
                onChange={handleNameChange}
                onKeyPress={handleKeyPress}
                placeholder="Enter your name"
                className={`ip-input ${error ? 'error' : ''}`}
                disabled={isConnecting}
              />
              <div className="input-underline"></div>
            </div>
            {error && <div className="error-message">{error}</div>}
            
            <div className="input-help">
              <div className="help-item">
                <span className="help-icon">ℹ</span>
                <span>Find your PS5 IP in Settings → System → Console Information</span>
              </div>
              <div className="help-item">
                <span className="help-icon">⚡</span>
                <span>Ensure GT7 telemetry is enabled (default: ON)</span>
              </div>
              <div className="help-item">
                <span className="help-icon">🏁</span>
                <span>Your name will be used by the Racing Engineer for personalized coaching</span>
              </div>
            </div>
          </div>

          <div className="connect-section">
            <button 
              className={`connect-button ${isConnecting ? 'connecting' : ''}`}
              onClick={handleConnect}
              disabled={isConnecting}
            >
              <div className="button-content">
                <div className="button-icon">
                  {isConnecting ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5,3 19,12 5,21 5,3"></polygon>
                    </svg>
                  )}
                </div>
                <span className="button-text">
                  {isConnecting ? 'INITIALIZING...' : 'START ENGINE'}
                </span>
              </div>
              <div className="button-glow"></div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="start-footer">
          <div className="version-info">v2.1.0</div>
          <div className="copyright">© 2024 GT7 Racing Dashboard</div>
        </footer>
      </div>
    </div>
  );
}; 