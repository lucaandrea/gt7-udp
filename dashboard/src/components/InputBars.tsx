import React from 'react';
import './InputBars.css';

interface InputBarsProps {
  throttlePercent: number;
  brakePercent: number;
}

export const InputBars: React.FC<InputBarsProps> = ({ throttlePercent, brakePercent }) => {
  return (
    <div className="input-controls">
      <div className="input-bar-container">
        <div className="input-bar brake-bar">
          <span className="input-label">BRAKE</span>
          <div className="input-bar-background">
            <div 
              className="input-bar-fill brake-fill" 
              style={{ height: `${Math.min(100, Math.max(0, brakePercent))}%` }}
            />
          </div>
          <span className="input-value">{brakePercent.toFixed(0)}%</span>
        </div>
        <div className="input-bar throttle-bar">
          <span className="input-label">THROTTLE</span>
          <div className="input-bar-background">
            <div 
              className="input-bar-fill throttle-fill" 
              style={{ height: `${Math.min(100, Math.max(0, throttlePercent))}%` }}
            />
          </div>
          <span className="input-value">{throttlePercent.toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};