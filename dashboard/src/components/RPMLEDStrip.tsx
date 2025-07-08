import React from 'react';
import './RPMLEDStrip.css';

interface RPMLEDStripProps {
  currentRPM: number;
  maxRPM: number;
  isPaused: boolean;
}

export const RPMLEDStrip: React.FC<RPMLEDStripProps> = ({ currentRPM, maxRPM, isPaused }) => {
  const ledCount = 16;
  const rpmPercent = Math.max(0, Math.min(100, (currentRPM / maxRPM) * 100));
  const activeLEDCount = Math.floor((rpmPercent / 100) * ledCount);

  const getLEDColor = (index: number): string => {
    if (index < 8) return 'green';
    if (index < 12) return 'yellow';
    if (index < 14) return 'orange';
    return 'red';
  };

  return (
    <div className="rpm-led-strip">
      <div className="led-container">
        {Array.from({ length: ledCount }, (_, index) => (
          <div
            key={index}
            className={`led ${getLEDColor(index)} ${
              isPaused 
                ? 'paused' 
                : index < activeLEDCount 
                  ? 'active' 
                  : ''
            }`}
            data-led={index}
            style={isPaused ? { animationDelay: `${index * 0.1}s` } : {}}
          />
        ))}
      </div>
    </div>
  );
};