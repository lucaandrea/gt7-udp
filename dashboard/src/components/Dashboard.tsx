import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { TelemetryData } from '../types/telemetry';
import { RPMLEDStrip } from './RPMLEDStrip';
import { MainDisplay } from './MainDisplay';
import { InputBars } from './InputBars';
import { StatusIndicators } from './StatusIndicators';
import { RacingEngineer } from './RacingEngineer';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [telemetryData, setTelemetryData] = useState<TelemetryData>({
    speedMph: 0,
    engineRPM: 0,
    currentGear: 1,
    maxRPM: 8000,
    throttlePercent: 0,
    brakePercent: 0,
    currentPosition: 1,
    simulatorFlags: {
      paused: false
    }
  });

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnected(true);
      console.log('🌐 Connected to GT7 Dashboard server');
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
      console.log('🌐 Disconnected from GT7 Dashboard server');
    });

    newSocket.on('telemetry', (data: TelemetryData) => {
      console.log('📡 Received telemetry data:', {
        speed: data.speedMph?.toFixed(1),
        rpm: data.engineRPM?.toFixed(0),
        gear: data.currentGear,
        position: data.currentPosition,
        packetId: data.packetId
      });
      setTelemetryData(data);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
    });

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <div className={`racing-dashboard ${telemetryData.simulatorFlags?.revLimiterAlert ? 'rev-limiter-warning' : ''}`}>
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>GT7 RACING</h1>
        </div>
        <div className="header-right">
          <div className="connection-status">
            <span className={`status-indicator ${connected ? 'connected' : ''}`}></span>
            <span className="status-text">{connected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      {/* RPM LED Strip */}
      <RPMLEDStrip 
        currentRPM={telemetryData.engineRPM || 0}
        maxRPM={telemetryData.maxRPM || 8000}
        isPaused={telemetryData.simulatorFlags?.paused || false}
      />

      {/* Main Dashboard Content */}
      <main className="dashboard-main">
        {/* Left Section: Tire Data (placeholder for now) */}
        <section className="tire-section">
          <div className="section-header">
            <h3>TIRES</h3>
          </div>
          <div className="tire-grid">
            <div className="tire-data">
              <div className="tire-position">FL</div>
              <div className="tire-temp">
                {telemetryData.tyreTemp ? `${telemetryData.tyreTemp[0]?.toFixed(0)}°C` : '25°C'}
              </div>
            </div>
            <div className="tire-data">
              <div className="tire-position">FR</div>
              <div className="tire-temp">
                {telemetryData.tyreTemp ? `${telemetryData.tyreTemp[1]?.toFixed(0)}°C` : '26°C'}
              </div>
            </div>
            <div className="tire-data">
              <div className="tire-position">RL</div>
              <div className="tire-temp">
                {telemetryData.tyreTemp ? `${telemetryData.tyreTemp[2]?.toFixed(0)}°C` : '26°C'}
              </div>
            </div>
            <div className="tire-data">
              <div className="tire-position">RR</div>
              <div className="tire-temp">
                {telemetryData.tyreTemp ? `${telemetryData.tyreTemp[3]?.toFixed(0)}°C` : '27°C'}
              </div>
            </div>
          </div>
        </section>

        {/* Center Section: Main Display */}
        <MainDisplay data={telemetryData} />

        {/* Right Section: Fuel and Engine Data */}
        <section className="fuel-section">
          <div className="section-header">
            <h3>FUEL</h3>
          </div>
          <div className="fuel-display">
            <div className="fuel-amount">
              <span className="fuel-value">{Math.round(telemetryData.fuelLevel || 0)}</span>
              <span className="fuel-unit">LITERS</span>
            </div>
            <div className="fuel-consumption">
              <span className="consumption-value">
                {telemetryData.fuelConsumptionRate?.toFixed(2) || '0.00'}
              </span>
              <span className="consumption-unit">L/min</span>
            </div>
            <div className="fuel-laps">
              <span className="laps-value">
                {telemetryData.fuelLevel && telemetryData.fuelConsumptionRate && telemetryData.fuelConsumptionRate > 0
                  ? Math.floor(telemetryData.fuelLevel / telemetryData.fuelConsumptionRate)
                  : 0}
              </span>
              <span className="laps-unit">LAPS</span>
            </div>
          </div>
          
          {/* Engine Status */}
          <div className="engine-status">
            <div className="status-row">
              <div className="status-item">
                <span className="status-label">Oil Temp</span>
                <span className="status-value">{telemetryData.oilTemp?.toFixed(0) || 0}°C</span>
              </div>
              <div className="status-item">
                <span className="status-label">Water Temp</span>
                <span className="status-value">{telemetryData.waterTemp?.toFixed(0) || 0}°C</span>
              </div>
            </div>
            <div className="status-row">
              <div className="status-item">
                <span className="status-label">Boost</span>
                <span className="status-value">
                  {telemetryData.boost ? `${((telemetryData.boost - 1) * 100).toFixed(1)} kPa` : '0.0 kPa'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">RPM</span>
                <span className="status-value">{Math.round(telemetryData.engineRPM || 0)}</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        {/* Status Indicators */}
        <StatusIndicators data={telemetryData} />

        {/* Input Controls */}
        <InputBars 
          throttlePercent={telemetryData.throttlePercent || 0}
          brakePercent={telemetryData.brakePercent || 0}
        />

        {/* Racing Engineer */}
        <RacingEngineer socket={socket} />
      </footer>
    </div>
  );
};