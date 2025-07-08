import React from 'react';
import { TelemetryData } from '../types/telemetry';
import './StatusIndicators.css';

interface StatusIndicatorsProps {
  data: TelemetryData;
}

export const StatusIndicators: React.FC<StatusIndicatorsProps> = ({ data }) => {
  return (
    <div className="status-indicators">
      <div className="indicator-group">
        <div className={`status-indicator ${data.simulatorFlags?.tcsActive ? 'active' : ''}`}>
          <span className="indicator-value">{data.simulatorFlags?.tcsLevel || '0'}</span>
          <span className="indicator-label">TC</span>
        </div>
        <div className="status-indicator">
          <span className="indicator-value">0</span>
          <span className="indicator-label">TC CUT</span>
        </div>
        <div className={`status-indicator ${data.simulatorFlags?.asmActive ? 'active' : ''}`}>
          <span className="indicator-value">{data.simulatorFlags?.absLevel || '0'}</span>
          <span className="indicator-label">ABS</span>
        </div>
        <div className={`status-indicator warning`}>
          <span className="indicator-value">{data.brakeBalance?.toFixed(1) || '50.0'}</span>
          <span className="indicator-label">BB</span>
        </div>
        <div className="status-indicator active engine-map">
          <span className="indicator-value">{data.engineMap || '1'}</span>
          <span className="indicator-label">ENGINE MAP</span>
        </div>
      </div>
      
      {/* Additional Flags */}
      <div className="additional-flags">
        <div className={`flag-item ${data.simulatorFlags?.handbrakeActive ? 'active' : ''}`}>
          <span className="flag-indicator"></span>
          <span className="flag-label">Handbrake</span>
        </div>
        <div className={`flag-item ${data.simulatorFlags?.lightsActive ? 'active' : ''}`}>
          <span className="flag-indicator"></span>
          <span className="flag-label">Lights</span>
        </div>
        <div className={`flag-item ${data.simulatorFlags?.revLimiterAlert ? 'active' : ''}`}>
          <span className="flag-indicator"></span>
          <span className="flag-label">Rev Limiter</span>
        </div>
        <div className={`flag-item ${data.simulatorFlags?.paused ? 'active' : ''}`}>
          <span className="flag-indicator"></span>
          <span className="flag-label">Paused</span>
        </div>
      </div>
    </div>
  );
};