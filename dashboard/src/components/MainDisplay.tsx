import React from 'react';
import { TelemetryData } from '../types/telemetry';
import { formatCarModel } from '../utils/carModels';
import './MainDisplay.css';

interface MainDisplayProps {
  data: TelemetryData;
}

export const MainDisplay: React.FC<MainDisplayProps> = ({ data }) => {
  const formatLapTime = (milliseconds?: number): string => {
    if (!milliseconds || milliseconds < 0) {
      return '--:--.---';
    }
    
    const totalSeconds = milliseconds / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const ms = Math.floor((totalSeconds % 1) * 1000);
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  const formatDeltaTime = (deltaTime?: number): string => {
    if (deltaTime === undefined || deltaTime === null) {
      return '--:--.---';
    }
    const sign = deltaTime >= 0 ? '+' : '';
    return `${sign}${deltaTime.toFixed(2)}`;
  };

  return (
    <section className="center-display">
      {/* Top Info Bar */}
      <div className="top-info-bar">
        <div className={`delta-time ${data.deltaTime && data.deltaTime >= 0 ? 'positive' : 'negative'}`}>
          {formatDeltaTime(data.deltaTime)}
        </div>
        <div className="session-info">
          <div className="lap-info">
            <span className="current-lap">{data.lapCount || 0}</span>
            <span className="lap-separator">/</span>
            <span className="total-laps">{data.totalLaps || 0}</span>
          </div>
          <div className="position-info">
            <span className="position-label">POS</span>
            <span className="position-value">{data.currentPosition || 1}</span>
          </div>
          <div className="time-info">
            <span className="lap-label">LAP</span>
            <span className="time-value">1 14:00</span>
          </div>
        </div>
        <div className="practice-mode">PRACTICE</div>
      </div>

      {/* Main Gear Display */}
      <div className="gear-section">
        <div className="gear-display">
          <span className="current-gear">
            {data.currentGear === 0 ? 'R' : data.currentGear === undefined ? 'N' : data.currentGear}
          </span>
        </div>
        <div className="gear-info">
          {data.carCode && (
            <div className="car-model-container">
              <div className="car-model-label">CAR</div>
              <div className="car-model">{formatCarModel(data.carCode)}</div>
            </div>
          )}
          <div className="speed-display">
            <span className="speed-value">{Math.round(data.speedMph || 0)}</span>
          </div>
          <div className="suggested-gear-container">
            <div className="gear-label">MT</div>
            <span className="suggested-gear">
              {data.suggestedGear && data.suggestedGear !== 15 ? data.suggestedGear : 'OPT'}
            </span>
          </div>
        </div>
      </div>

      {/* Lap Times Section */}
      <div className="lap-times">
        <div className="section-header">
          <h4>LAP TIMES</h4>
        </div>
        <div className="time-row current-time">
          <span className="time-label">ESTIMATED LAP (ALL TIME 01:47.552)</span>
          <span className="time-value">{formatLapTime(data.currentLaptime || data.lastLaptime)}</span>
        </div>
        <div className="time-row last-time">
          <span className="time-label">LAST LAP</span>
          <span className="time-value">{formatLapTime(data.lastLaptime)}</span>
        </div>
        <div className="time-row best-time">
          <span className="time-label">BEST LAP</span>
          <span className="time-value">{formatLapTime(data.bestLaptime)}</span>
        </div>
      </div>
    </section>
  );
};