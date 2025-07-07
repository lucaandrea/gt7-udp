// GT7 Dashboard JavaScript
class GT7Dashboard {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.lastPacket = null;
        this.gauges = {};
        
        this.initializeSocket();
        this.initializeGauges();
        this.setupEventListeners();
    }
    
    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            this.connected = true;
            this.updateConnectionStatus();
            console.log('🌐 Connected to GT7 Dashboard server');
        });
        
        this.socket.on('disconnect', () => {
            this.connected = false;
            this.updateConnectionStatus();
            console.log('🌐 Disconnected from GT7 Dashboard server');
        });
        
        this.socket.on('serverStatus', (status) => {
            console.log('📊 Server status:', status);
            this.displayServerStatus(status);
        });
        
        this.socket.on('telemetry', (data) => {
            console.log('📡 Received telemetry data:', {
                speed: data.speedMph?.toFixed(1),
                rpm: data.engineRPM?.toFixed(0),
                gear: data.currentGear,
                packetId: data.packetId
            });
            this.handleTelemetryData(data);
        });
        
        // Debug connection issues
        this.socket.on('connect_error', (error) => {
            console.error('❌ Connection error:', error);
        });
        
        this.socket.on('reconnect', (attemptNumber) => {
            console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
        });
        
        this.socket.on('reconnect_error', (error) => {
            console.error('❌ Reconnection error:', error);
        });
    }
    
    initializeGauges() {
        this.gauges.speed = new CircularGauge('speedGauge', {
            min: 0,
            max: 200,
            unit: 'MPH',
            color: '#ff6b35',
            warningThreshold: 160
        });
        
        this.gauges.rpm = new CircularGauge('rpmGauge', {
            min: 0,
            max: 8000,
            unit: 'RPM',
            color: '#ff6b35',
            warningThreshold: 7000,
            dangerThreshold: 7500
        });
    }
    
    setupEventListeners() {
        // Add any additional event listeners here
    }
    
    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('.status-text');
        
        if (this.connected) {
            indicator.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            indicator.classList.remove('connected');
            text.textContent = 'Disconnected';
        }
    }
    
    handleTelemetryData(data) {
        this.lastPacket = data;
        console.log('🎮 Updating dashboard with telemetry data');
        
        // Update gauges
        this.gauges.speed.update(data.speedMph || 0);
        this.gauges.rpm.update(data.engineRPM || 0);
        
        // Update numerical displays
        document.getElementById('speedValue').textContent = Math.round(data.speedMph || 0);
        document.getElementById('rpmValue').textContent = Math.round(data.engineRPM || 0);
        
        // Update gear display
        this.updateGearDisplay(data);
        
        // Update car status
        this.updateCarStatus(data);
        
        // Update tire data
        this.updateTireData(data);
        
        // Update lap information
        this.updateLapInfo(data);
        
        // Update input bars
        this.updateInputBars(data);
        
        // Update flags
        this.updateFlags(data);
        
        // Update last update time display
        this.updateLastUpdateTime();
    }
    
    updateGearDisplay(data) {
        const currentGear = document.getElementById('currentGear');
        const suggestedGear = document.getElementById('suggestedGear');
        
        let gearText = 'N';
        if (data.currentGear === 0) {
            gearText = 'R';
        } else if (data.currentGear > 0) {
            gearText = data.currentGear.toString();
        }
        
        currentGear.textContent = gearText;
        
        if (data.suggestedGear && data.suggestedGear !== 15) {
            suggestedGear.textContent = data.suggestedGear.toString();
        } else {
            suggestedGear.textContent = '-';
        }
    }
    
    updateCarStatus(data) {
        // Fuel
        const fuelFill = document.getElementById('fuelFill');
        const fuelValue = document.getElementById('fuelValue');
        
        if (data.fuelCapacity > 0) {
            const fuelPercent = (data.fuelLevel / data.fuelCapacity) * 100;
            fuelFill.style.width = `${Math.max(0, Math.min(100, fuelPercent))}%`;
            fuelValue.textContent = `${data.fuelLevel.toFixed(1)}L`;
        } else {
            fuelFill.style.width = '0%';
            fuelValue.textContent = 'N/A';
        }
        
        // Boost
        const boostValue = document.getElementById('boostValue');
        const boostBar = (data.boost - 1) * 100; // Convert from GT7 format
        boostValue.textContent = `${boostBar.toFixed(1)} kPa`;
        
        // Temperatures
        const oilTempValue = document.getElementById('oilTempValue');
        const waterTempValue = document.getElementById('waterTempValue');
        
        oilTempValue.textContent = `${data.oilTemp.toFixed(0)}°C`;
        waterTempValue.textContent = `${data.waterTemp.toFixed(0)}°C`;
    }
    
    updateTireData(data) {
        if (data.tyreTemp && data.tyreSlipRatio) {
            for (let i = 0; i < 4; i++) {
                const tempElement = document.getElementById(`tireTemp${i}`);
                const slipElement = document.getElementById(`tireSlip${i}`);
                
                if (tempElement && slipElement) {
                    tempElement.textContent = `${data.tyreTemp[i].toFixed(0)}°C`;
                    slipElement.textContent = `${(data.tyreSlipRatio[i] * 100).toFixed(1)}%`;
                    
                    // Color code tires based on temperature
                    const tireData = tempElement.closest('.tire-data');
                    if (data.tyreTemp[i] > 100) {
                        tireData.style.borderColor = '#ff4444';
                    } else if (data.tyreTemp[i] > 80) {
                        tireData.style.borderColor = '#ffaa00';
                    } else {
                        tireData.style.borderColor = 'rgba(255, 107, 53, 0.3)';
                    }
                }
            }
        }
    }
    
    updateLapInfo(data) {
        const currentLap = document.getElementById('currentLap');
        const totalLaps = document.getElementById('totalLaps');
        const bestLap = document.getElementById('bestLap');
        const lastLap = document.getElementById('lastLap');
        
        currentLap.textContent = data.lapCount || 0;
        totalLaps.textContent = data.totalLaps || 0;
        
        bestLap.textContent = this.formatLapTime(data.bestLaptime);
        lastLap.textContent = this.formatLapTime(data.lastLaptime);
    }
    
    updateInputBars(data) {
        const throttleFill = document.getElementById('throttleFill');
        const brakeFill = document.getElementById('brakeFill');
        const throttleValue = document.getElementById('throttleValue');
        const brakeValue = document.getElementById('brakeValue');
        
        const throttlePercent = data.throttlePercent || 0;
        const brakePercent = data.brakePercent || 0;
        
        throttleFill.style.height = `${throttlePercent}%`;
        brakeFill.style.height = `${brakePercent}%`;
        
        throttleValue.textContent = `${throttlePercent.toFixed(0)}%`;
        brakeValue.textContent = `${brakePercent.toFixed(0)}%`;
    }
    
    updateFlags(data) {
        if (data.simulatorFlags) {
            const flags = [
                { id: 'flagTCS', active: data.simulatorFlags.tcsActive },
                { id: 'flagASM', active: data.simulatorFlags.asmActive },
                { id: 'flagHandbrake', active: data.simulatorFlags.handbrakeActive },
                { id: 'flagLights', active: data.simulatorFlags.lightsActive },
                { id: 'flagRevLimiter', active: data.simulatorFlags.revLimiterAlert },
                { id: 'flagPaused', active: data.simulatorFlags.paused }
            ];
            
            flags.forEach(flag => {
                const element = document.getElementById(flag.id);
                if (element) {
                    if (flag.active) {
                        element.classList.add('active');
                    } else {
                        element.classList.remove('active');
                    }
                }
            });
            
            // Special handling for rev limiter warning
            if (data.simulatorFlags.revLimiterAlert) {
                document.body.classList.add('rev-limiter-warning');
            } else {
                document.body.classList.remove('rev-limiter-warning');
            }
        }
    }
    
    formatLapTime(milliseconds) {
        if (!milliseconds || milliseconds < 0) {
            return '--:--.---';
        }
        
        const totalSeconds = milliseconds / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const ms = Math.floor((totalSeconds % 1) * 1000);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    
    displayServerStatus(status) {
        console.log('🔧 Server Status Display:', status);
        // You could add a status panel to show server info
    }
    
    updateLastUpdateTime() {
        // Add a last update indicator if needed
        const now = new Date().toLocaleTimeString();
        console.log(`⏰ Dashboard updated at ${now}`);
    }
}

// Circular Gauge Class
class CircularGauge {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.options = {
            min: options.min || 0,
            max: options.max || 100,
            unit: options.unit || '',
            color: options.color || '#ff6b35',
            warningThreshold: options.warningThreshold || null,
            dangerThreshold: options.dangerThreshold || null,
            ...options
        };
        
        this.value = 0;
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.radius = Math.min(this.centerX, this.centerY) - 20;
        
        this.draw();
    }
    
    update(value) {
        this.value = Math.max(this.options.min, Math.min(this.options.max, value));
        this.draw();
    }
    
    draw() {
        const ctx = this.ctx;
        const centerX = this.centerX;
        const centerY = this.centerY;
        const radius = this.radius;
        
        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
        ctx.lineWidth = 20;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();
        
        // Calculate progress
        const progress = (this.value - this.options.min) / (this.options.max - this.options.min);
        const angle = 0.75 * Math.PI + (progress * 1.5 * Math.PI);
        
        // Determine color based on thresholds
        let color = this.options.color;
        if (this.options.dangerThreshold && this.value >= this.options.dangerThreshold) {
            color = '#ff4444';
        } else if (this.options.warningThreshold && this.value >= this.options.warningThreshold) {
            color = '#ffaa00';
        }
        
        // Draw progress arc
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, angle);
        ctx.lineWidth = 20;
        ctx.strokeStyle = color;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        // Draw tick marks
        this.drawTickMarks(ctx, centerX, centerY, radius);
        
        // Draw needle
        this.drawNeedle(ctx, centerX, centerY, radius - 30, angle);
    }
    
    drawTickMarks(ctx, centerX, centerY, radius) {
        const numTicks = 10;
        const tickRadius = radius + 10;
        
        for (let i = 0; i <= numTicks; i++) {
            const angle = 0.75 * Math.PI + (i / numTicks) * 1.5 * Math.PI;
            const x1 = centerX + (radius - 5) * Math.cos(angle);
            const y1 = centerY + (radius - 5) * Math.sin(angle);
            const x2 = centerX + tickRadius * Math.cos(angle);
            const y2 = centerY + tickRadius * Math.sin(angle);
            
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.stroke();
        }
    }
    
    drawNeedle(ctx, centerX, centerY, length, angle) {
        const needleX = centerX + length * Math.cos(angle);
        const needleY = centerY + length * Math.sin(angle);
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(needleX, needleY);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        
        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = this.options.color;
        ctx.fill();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new GT7Dashboard();
});