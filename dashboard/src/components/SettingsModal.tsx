import React, { useState } from 'react';
import './SettingsModal.css';

interface UserSettings {
  ipAddress: string;
  userName: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  currentSettings: UserSettings;
  onSave: (settings: UserSettings) => void;
  onClose: () => void;
  onBackToStart: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  currentSettings,
  onSave,
  onClose,
  onBackToStart
}) => {
  const [ipAddress, setIpAddress] = useState(currentSettings.ipAddress);
  const [userName, setUserName] = useState(currentSettings.userName);
  const [error, setError] = useState('');

  const validateIPAddress = (ip: string): boolean => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  };

  const handleSave = () => {
    if (!ipAddress.trim()) {
      setError('Please enter your PS5 IP address');
      return;
    }

    if (!validateIPAddress(ipAddress)) {
      setError('Please enter a valid IP address (e.g., 192.168.1.100)');
      return;
    }

    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }

    setError('');
    onSave({ ipAddress, userName });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">CONNECTION SETTINGS</h2>
          <button className="close-button" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="modal-content">
          <div className="input-section">
            <label className="input-label">PS5 NETWORK ADDRESS</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => {
                  setIpAddress(e.target.value);
                  if (error) setError('');
                }}
                onKeyPress={handleKeyPress}
                placeholder="192.168.1.100"
                className={`settings-input ${error ? 'error' : ''}`}
              />
              <div className="input-underline"></div>
            </div>

            <label className="input-label">DRIVER NAME</label>
            <div className="input-wrapper">
              <input
                type="text"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  if (error) setError('');
                }}
                onKeyPress={handleKeyPress}
                placeholder="Enter your name"
                className={`settings-input ${error ? 'error' : ''}`}
              />
              <div className="input-underline"></div>
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="modal-actions">
            <button className="action-button secondary" onClick={onBackToStart}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m12 19-7-7 7-7"/>
                <path d="M19 12H5"/>
              </svg>
              BACK TO START
            </button>
            
            <div className="primary-actions">
              <button className="action-button secondary" onClick={onClose}>
                CANCEL
              </button>
              <button className="action-button primary" onClick={handleSave}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20,6 9,17 4,12"></polyline>
                </svg>
                SAVE
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 