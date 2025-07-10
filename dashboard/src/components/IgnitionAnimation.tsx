import React, { useState, useEffect } from 'react';
import './IgnitionAnimation.css';

interface IgnitionAnimationProps {
  onComplete: () => void;
  ipAddress: string;
  userName: string;
}

interface IgnitionStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'complete' | 'error';
  duration: number;
}

export const IgnitionAnimation: React.FC<IgnitionAnimationProps> = ({ onComplete, ipAddress, userName }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [engineRPM, setEngineRPM] = useState(0);
  const [fuelPressure, setFuelPressure] = useState(0);
  const [oilPressure, setOilPressure] = useState(0);
  const [temperature, setTemperature] = useState(20);
  const [isEngineRunning, setIsEngineRunning] = useState(false);

  const steps: IgnitionStep[] = [
    { id: 'power', label: 'POWER SYSTEMS', status: 'pending', duration: 800 },
    { id: 'diagnostics', label: 'SYSTEM DIAGNOSTICS', status: 'pending', duration: 1200 },
    { id: 'connection', label: 'NETWORK CONNECTION', status: 'pending', duration: 1000 },
    { id: 'telemetry', label: 'TELEMETRY LINK', status: 'pending', duration: 800 },
    { id: 'ignition', label: 'ENGINE IGNITION', status: 'pending', duration: 1500 },
    { id: 'complete', label: 'SYSTEMS ONLINE', status: 'pending', duration: 800 }
  ];

  const [ignitionSteps, setIgnitionSteps] = useState(steps);

  useEffect(() => {
    const executeStep = (stepIndex: number) => {
      if (stepIndex >= ignitionSteps.length) {
        setTimeout(() => {
          onComplete();
        }, 1000);
        return;
      }

      // Mark current step as active
      setIgnitionSteps(prev => prev.map((step, index) => ({
        ...step,
        status: index === stepIndex ? 'active' : index < stepIndex ? 'complete' : 'pending'
      })));

      setCurrentStep(stepIndex);

      // Simulate step completion
      setTimeout(() => {
        // Mark current step as complete
        setIgnitionSteps(prev => prev.map((step, index) => ({
          ...step,
          status: index <= stepIndex ? 'complete' : 'pending'
        })));

        // Handle specific step animations
        switch (stepIndex) {
          case 2: // Network connection - show IP
            break;
          case 4: // Engine ignition - start RPM animation
            startEngineSequence();
            break;
        }

        // Move to next step
        setTimeout(() => {
          executeStep(stepIndex + 1);
        }, 300);
      }, ignitionSteps[stepIndex].duration);
    };

    const timer = setTimeout(() => {
      executeStep(0);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const startEngineSequence = () => {
    setIsEngineRunning(true);
    
    // Animate RPM rise
    let rpm = 0;
    const rpmInterval = setInterval(() => {
      rpm += Math.random() * 200 + 100;
      if (rpm > 2000) {
        rpm = 800 + Math.random() * 400; // Settle to idle
        clearInterval(rpmInterval);
      }
      setEngineRPM(rpm);
    }, 50);

    // Animate fuel pressure
    let fuel = 0;
    const fuelInterval = setInterval(() => {
      fuel += Math.random() * 0.8 + 0.2;
      if (fuel > 3.5) {
        fuel = 3.2 + Math.random() * 0.3;
        clearInterval(fuelInterval);
      }
      setFuelPressure(fuel);
    }, 100);

    // Animate oil pressure
    let oil = 0;
    const oilInterval = setInterval(() => {
      oil += Math.random() * 1.5 + 0.5;
      if (oil > 45) {
        oil = 40 + Math.random() * 5;
        clearInterval(oilInterval);
      }
      setOilPressure(oil);
    }, 80);

    // Animate temperature
    let temp = 20;
    const tempInterval = setInterval(() => {
      temp += Math.random() * 2 + 0.5;
      if (temp > 85) {
        temp = 82 + Math.random() * 3;
        clearInterval(tempInterval);
      }
      setTemperature(temp);
    }, 150);
  };

  return (
    <div className="ignition-animation">
      <div className="ignition-grid"></div>
      <div className="ignition-glow"></div>
      
      <div className="ignition-container">
        {/* Header */}
        <div className="ignition-header">
          <h1 className="ignition-title">IGNITION SEQUENCE</h1>
          <div className="connection-info">
            <div className="ip-display">
              <span className="ip-label">TARGET:</span>
              <span className="ip-value">{ipAddress}</span>
            </div>
            <div className="driver-display">
              <span className="driver-label">DRIVER:</span>
              <span className="driver-value">{userName}</span>
            </div>
          </div>
        </div>

        {/* Main Display */}
        <div className="ignition-main">
          {/* Left Panel - System Status */}
          <div className="status-panel">
            <h3 className="panel-title">SYSTEM STATUS</h3>
            <div className="status-list">
              {ignitionSteps.map((step, index) => (
                <div key={step.id} className={`status-item ${step.status}`}>
                  <div className="status-indicator">
                    {step.status === 'active' && <div className="spinner"></div>}
                    {step.status === 'complete' && <div className="checkmark">✓</div>}
                    {step.status === 'pending' && <div className="pending-dot"></div>}
                  </div>
                  <span className="status-label">{step.label}</span>
                  {step.status === 'active' && <div className="progress-bar"></div>}
                </div>
              ))}
            </div>
          </div>

          {/* Center Panel - Engine Gauges */}
          <div className="gauges-panel">
            <h3 className="panel-title">ENGINE VITALS</h3>
            <div className="gauges-grid">
              <div className="gauge rpm-gauge">
                <div className="gauge-label">RPM</div>
                <div className="gauge-circle">
                  <div className="gauge-fill" style={{ 
                    '--fill-percent': `${(engineRPM / 8000) * 100}%` 
                  } as React.CSSProperties}></div>
                  <div className="gauge-value">{Math.round(engineRPM)}</div>
                </div>
              </div>
              
              <div className="gauge fuel-gauge">
                <div className="gauge-label">FUEL</div>
                <div className="gauge-circle">
                  <div className="gauge-fill fuel" style={{ 
                    '--fill-percent': `${(fuelPressure / 4) * 100}%` 
                  } as React.CSSProperties}></div>
                  <div className="gauge-value">{fuelPressure.toFixed(1)}</div>
                </div>
              </div>
              
              <div className="gauge oil-gauge">
                <div className="gauge-label">OIL</div>
                <div className="gauge-circle">
                  <div className="gauge-fill oil" style={{ 
                    '--fill-percent': `${(oilPressure / 60) * 100}%` 
                  } as React.CSSProperties}></div>
                  <div className="gauge-value">{Math.round(oilPressure)}</div>
                </div>
              </div>
              
              <div className="gauge temp-gauge">
                <div className="gauge-label">TEMP</div>
                <div className="gauge-circle">
                  <div className="gauge-fill temp" style={{ 
                    '--fill-percent': `${(temperature / 120) * 100}%` 
                  } as React.CSSProperties}></div>
                  <div className="gauge-value">{Math.round(temperature)}°</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Warning Lights */}
          <div className="lights-panel">
            <h3 className="panel-title">WARNING LIGHTS</h3>
            <div className="warning-lights">
              <div className={`warning-light engine ${isEngineRunning ? 'off' : 'on'}`}>
                <div className="light-icon">⚠</div>
                <div className="light-label">ENGINE</div>
              </div>
              <div className={`warning-light oil ${oilPressure > 30 ? 'off' : 'on'}`}>
                <div className="light-icon">🛢</div>
                <div className="light-label">OIL</div>
              </div>
              <div className={`warning-light fuel ${fuelPressure > 2 ? 'off' : 'on'}`}>
                <div className="light-icon">⛽</div>
                <div className="light-label">FUEL</div>
              </div>
              <div className={`warning-light temp ${temperature < 100 ? 'off' : 'on'}`}>
                <div className="light-icon">🌡</div>
                <div className="light-label">TEMP</div>
              </div>
              <div className={`warning-light ready ${currentStep >= 5 ? 'ready' : 'off'}`}>
                <div className="light-icon">✓</div>
                <div className="light-label">READY</div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="ignition-progress">
          <div className="progress-label">INITIALIZATION PROGRESS</div>
          <div className="progress-track">
            <div 
              className="progress-fill" 
              style={{ width: `${(currentStep / (ignitionSteps.length - 1)) * 100}%` }}
            ></div>
          </div>
          <div className="progress-percent">{Math.round((currentStep / (ignitionSteps.length - 1)) * 100)}%</div>
        </div>
      </div>
    </div>
  );
}; 