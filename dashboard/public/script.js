// F1-Style GT7 Dashboard JavaScript
class GT7Dashboard {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.lastPacket = null;
        this.gauges = {};
        
        // Racing Engineer
        this.racingEngineer = null;
        this.mediaRecorder = null;
        this.audioStream = null;
        this.audioContext = null; // for microphone input (16kHz)
        this.playbackContext = null; // for engineer audio output (24kHz)
        this.isRecording = false;
        
        // RPM LED Configuration
        this.ledElements = [];
        this.maxRPM = 8000; // Default max RPM, will be updated from telemetry
        
        this.initializeSocket();
        this.initializeGauges();
        this.initializeRacingEngineer();
        this.initializeRPMLEDs();
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
        // Keep hidden gauges for compatibility
        this.gauges.speed = new CircularGauge('speedGauge', {
            min: 0,
            max: 200,
            unit: 'MPH',
            color: '#00ff41',
            warningThreshold: 160
        });
        
        this.gauges.rpm = new CircularGauge('rpmGauge', {
            min: 0,
            max: 8000,
            unit: 'RPM',
            color: '#00ff41',
            warningThreshold: 7000,
            dangerThreshold: 7500
        });
    }
    
    initializeRPMLEDs() {
        // Get all LED elements
        this.ledElements = Array.from(document.querySelectorAll('.led'));
        console.log(`🚨 Initialized ${this.ledElements.length} RPM LEDs`);
        
        // Color configuration for 16 LEDs
        this.ledColorConfig = [
            // LEDs 0-7: Green
            'green', 'green', 'green', 'green', 'green', 'green', 'green', 'green',
            // LEDs 8-11: Yellow
            'yellow', 'yellow', 'yellow', 'yellow',
            // LEDs 12-13: Orange
            'orange', 'orange',
            // LEDs 14-15: Red (with blinking)
            'red', 'red'
        ];
    }
    
    updateRPMLEDs(currentRPM, maxRPM = this.maxRPM) {
        if (!this.ledElements.length) return;
        
        // Calculate RPM percentage
        const rpmPercent = Math.max(0, Math.min(100, (currentRPM / maxRPM) * 100));
        
        // Calculate how many LEDs should be active (0-16)
        const activeLEDCount = Math.floor((rpmPercent / 100) * 16);
        
        // Update each LED
        this.ledElements.forEach((led, index) => {
            const colorClass = this.ledColorConfig[index];
            
            // Remove all color classes
            led.classList.remove('active', 'green', 'yellow', 'orange', 'red');
            
            // Add color class
            led.classList.add(colorClass);
            
            // Add active class if this LED should be lit
            if (index < activeLEDCount) {
                led.classList.add('active');
            }
        });
        
        // Log for debugging
        if (currentRPM > 0) {
            console.log(`🚨 RPM: ${currentRPM.toFixed(0)}/${maxRPM} (${rpmPercent.toFixed(1)}%) - LEDs: ${activeLEDCount}/16`);
        }
    }
    
    initializeRacingEngineer() {
        this.racingEngineer = {
            connected: false,
            connecting: false,
            audioQueue: [],
            currentlyPlaying: false
        };

        this.audioSource = null;
        this.processor = null;
        
        // Set up racing engineer socket events
        this.socket.on('engineer:connected', () => {
            this.racingEngineer.connected = true;
            this.racingEngineer.connecting = false;
            this.updateEngineerStatus('connected', 'Connected');
            console.log('🏁 Racing Engineer connected');
        });
        
        this.socket.on('engineer:disconnected', () => {
            this.racingEngineer.connected = false;
            this.racingEngineer.connecting = false;
            this.updateEngineerStatus('disconnected', 'Disconnected');
            console.log('🏁 Racing Engineer disconnected');
        });
        
        this.socket.on('engineer:error', (error) => {
            this.racingEngineer.connecting = false;
            this.updateEngineerStatus('error', `Error: ${error}`);
            console.error('🏁 Racing Engineer error:', error);
        });
        
        this.socket.on('engineer:audio', (audioData) => {
            this.playEngineerAudio(audioData);
        });
        
        this.socket.on('engineer:audioComplete', () => {
            console.log('🏁 Engineer audio response completed');
        });
        
        this.socket.on('engineer:transcription', (transcript) => {
            console.log('🏁 Driver transcription:', transcript);
            // You could display this in the UI if desired
        });
        
        this.socket.on('engineer:speechStarted', () => {
            console.log('🏁 Driver speech detected');
        });
        
        this.socket.on('engineer:speechStopped', () => {
            console.log('🏁 Driver speech ended');
        });
    }
    
    setupEventListeners() {
        // Talk button event listeners
        const talkButton = document.getElementById('talkButton');
        
        // Click to toggle recording
        talkButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleTalking();
        });
        
        // Spacebar to toggle recording
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                e.preventDefault();
                this.toggleTalking();
            }
        });
        
        // Auto-connect engineer on page load
        setTimeout(() => {
            this.connectEngineer();
        }, 2000);
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
        console.log('🎮 Updating F1-style dashboard with telemetry data');
        
        // Update hidden gauges for compatibility
        this.gauges.speed.update(data.speedMph || 0);
        this.gauges.rpm.update(data.engineRPM || 0);
        
        // Update RPM LED strip
        this.updateRPMLEDs(data.engineRPM || 0, data.maxRPM || 8000);
        
        // Update main displays
        this.updateMainDisplays(data);
        
        // Update gear display
        this.updateGearDisplay(data);
        
        // Update tire data
        this.updateTireData(data);
        
        // Update lap information
        this.updateLapInfo(data);
        
        // Update fuel and engine data
        this.updateFuelData(data);
        
        // Update input bars
        this.updateInputBars(data);
        
        // Update status indicators
        this.updateStatusIndicators(data);
        
        // Update flags
        this.updateFlags(data);
        
        // Update last update time display
        this.updateLastUpdateTime();
    }
    
    updateMainDisplays(data) {
        // Speed value
        const speedValue = document.getElementById('speedValue');
        if (speedValue) {
            speedValue.textContent = Math.round(data.speedMph || 0);
        }
        
        // RPM value (in engine status section)
        const rpmValue = document.getElementById('rpmValue');
        if (rpmValue) {
            rpmValue.textContent = Math.round(data.engineRPM || 0);
        }
        
        // Current lap / total laps
        const currentLap = document.getElementById('currentLap');
        const totalLaps = document.getElementById('totalLaps');
        if (currentLap) currentLap.textContent = data.lapCount || 0;
        if (totalLaps) totalLaps.textContent = data.totalLaps || 0;
        
        // Delta time (placeholder for now)
        const deltaTime = document.getElementById('deltaTime');
        if (deltaTime && data.deltaTime) {
            const sign = data.deltaTime >= 0 ? '+' : '';
            deltaTime.textContent = `${sign}${data.deltaTime.toFixed(2)}`;
            deltaTime.className = data.deltaTime >= 0 ? 'delta-time positive' : 'delta-time negative';
        }
    }
    
    updateGearDisplay(data) {
        const currentGear = document.getElementById('currentGear');
        const suggestedGear = document.getElementById('suggestedGear');
        
        if (currentGear) {
            let gearText = 'N';
            if (data.currentGear === 0) {
                gearText = 'R';
            } else if (data.currentGear > 0) {
                gearText = data.currentGear.toString();
            }
            currentGear.textContent = gearText;
        }
        
        if (suggestedGear) {
            if (data.suggestedGear && data.suggestedGear !== 15) {
                suggestedGear.textContent = data.suggestedGear.toString();
            } else {
                suggestedGear.textContent = 'OPT';
            }
        }
    }
    
    updateTireData(data) {
        if (data.tyreTemp && data.tyreSlipRatio) {
            for (let i = 0; i < 4; i++) {
                const tempElement = document.getElementById(`tireTemp${i}`);
                const slipElement = document.getElementById(`tireSlip${i}`);
                
                if (tempElement && slipElement) {
                    tempElement.textContent = `${data.tyreTemp[i].toFixed(0)}°C`;
                    // Format slip as percentage without % symbol for cleaner look
                    slipElement.textContent = `${(data.tyreSlipRatio[i] * 100).toFixed(0)}°`;
                    
                    // Color code tires based on temperature
                    const tireData = tempElement.closest('.tire-data');
                    if (tireData) {
                        if (data.tyreTemp[i] > 100) {
                            tireData.style.borderColor = 'var(--accent-danger)';
                            tireData.style.background = 'rgba(255, 68, 68, 0.1)';
                        } else if (data.tyreTemp[i] > 80) {
                            tireData.style.borderColor = 'var(--accent-warning)';
                            tireData.style.background = 'rgba(255, 136, 0, 0.1)';
                        } else {
                            tireData.style.borderColor = 'var(--border-glass)';
                            tireData.style.background = 'rgba(0, 0, 0, 0.3)';
                        }
                    }
                }
            }
        }
    }
    
    updateLapInfo(data) {
        const bestLap = document.getElementById('bestLap');
        const lastLap = document.getElementById('lastLap');
        const estimatedLap = document.getElementById('estimatedLap');
        
        if (bestLap) bestLap.textContent = this.formatLapTime(data.bestLaptime);
        if (lastLap) lastLap.textContent = this.formatLapTime(data.lastLaptime);
        if (estimatedLap) estimatedLap.textContent = this.formatLapTime(data.currentLaptime || data.lastLaptime);
    }
    
    updateFuelData(data) {
        // Fuel value
        const fuelValue = document.getElementById('fuelValue');
        if (fuelValue) {
            fuelValue.textContent = Math.round(data.fuelLevel || 0);
        }
        
        // Fuel consumption (calculate from fuel level changes)
        const consumptionValue = document.querySelector('.consumption-value');
        if (consumptionValue && data.fuelConsumptionRate) {
            consumptionValue.textContent = data.fuelConsumptionRate.toFixed(2);
        }
        
        // Estimated laps remaining
        const lapsValue = document.querySelector('.laps-value');
        if (lapsValue && data.fuelLevel && data.fuelConsumptionRate && data.fuelConsumptionRate > 0) {
            const estimatedLaps = Math.floor(data.fuelLevel / data.fuelConsumptionRate);
            lapsValue.textContent = estimatedLaps;
        }
        
        // Engine temperatures
        const oilTempValue = document.getElementById('oilTempValue');
        const waterTempValue = document.getElementById('waterTempValue');
        const boostValue = document.getElementById('boostValue');
        
        if (oilTempValue) oilTempValue.textContent = `${data.oilTemp?.toFixed(0) || 0}°C`;
        if (waterTempValue) waterTempValue.textContent = `${data.waterTemp?.toFixed(0) || 0}°C`;
        if (boostValue) {
            const boostBar = (data.boost - 1) * 100; // Convert from GT7 format
            boostValue.textContent = `${boostBar.toFixed(1)} kPa`;
        }
    }
    
    updateInputBars(data) {
        const throttleFill = document.getElementById('throttleFill');
        const brakeFill = document.getElementById('brakeFill');
        const throttleValue = document.getElementById('throttleValue');
        const brakeValue = document.getElementById('brakeValue');
        
        const throttlePercent = data.throttlePercent || 0;
        const brakePercent = data.brakePercent || 0;
        
        if (throttleFill) throttleFill.style.height = `${throttlePercent}%`;
        if (brakeFill) brakeFill.style.height = `${brakePercent}%`;
        
        if (throttleValue) throttleValue.textContent = `${throttlePercent.toFixed(0)}%`;
        if (brakeValue) brakeValue.textContent = `${brakePercent.toFixed(0)}%`;
    }
    
    updateStatusIndicators(data) {
        // Update the new F1-style status indicators
        if (data.simulatorFlags) {
            // TC (Traction Control)
            const tcIndicator = document.getElementById('flagTCS');
            if (tcIndicator) {
                const valueElement = tcIndicator.querySelector('.indicator-value');
                if (valueElement) valueElement.textContent = data.simulatorFlags.tcsLevel || '0';
                if (data.simulatorFlags.tcsActive) {
                    tcIndicator.classList.add('active');
                } else {
                    tcIndicator.classList.remove('active');
                }
            }
            
            // ABS
            const absIndicator = document.getElementById('flagASM');
            if (absIndicator) {
                const valueElement = absIndicator.querySelector('.indicator-value');
                if (valueElement) valueElement.textContent = data.simulatorFlags.absLevel || '0';
                if (data.simulatorFlags.asmActive) {
                    absIndicator.classList.add('active');
                } else {
                    absIndicator.classList.remove('active');
                }
            }
            
            // BB (Brake Balance)
            const bbIndicator = document.getElementById('flagBB');
            if (bbIndicator) {
                const valueElement = bbIndicator.querySelector('.indicator-value');
                if (valueElement) valueElement.textContent = data.brakeBalance?.toFixed(1) || '50.0';
                // BB is often in warning state when not neutral
                const brakeBalance = data.brakeBalance || 50;
                if (Math.abs(brakeBalance - 50) > 5) {
                    bbIndicator.classList.add('warning');
                } else {
                    bbIndicator.classList.remove('warning');
                }
            }
            
            // MAP (Engine Map)
            const mapIndicator = document.getElementById('flagMAP');
            if (mapIndicator) {
                const valueElement = mapIndicator.querySelector('.indicator-value');
                if (valueElement) valueElement.textContent = data.engineMap || '1';
                mapIndicator.classList.add('active'); // Usually always active
            }
        }
    }
    
    updateFlags(data) {
        if (data.simulatorFlags) {
            const flags = [
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
        console.log(`⏰ F1 Dashboard updated at ${now}`);
    }
    
    // Racing Engineer Methods (preserved from original)
    async connectEngineer() {
        if (this.racingEngineer.connected || this.racingEngineer.connecting) {
            return;
        }
        
        this.racingEngineer.connecting = true;
        this.updateEngineerStatus('connecting', 'Connecting...');
        
        try {
            // Request microphone permission
            await this.requestMicrophonePermission();
            
            // Connect to racing engineer
            this.socket.emit('engineer:connect');
            console.log('🏁 Requesting Racing Engineer connection...');
        } catch (error) {
            console.error('🏁 Failed to connect to Racing Engineer:', error);
            this.updateEngineerStatus('error', 'Microphone access required');
            this.racingEngineer.connecting = false;
        }
    }
    
    async requestMicrophonePermission() {
        try {
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: 16000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Create audio contexts
            // Input context at 16 kHz for the realtime API
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });

            // Separate context for playback of engineer responses (24 kHz)
            this.playbackContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 24000
            });
            
            console.log('🎤 Microphone access granted');
            return true;
        } catch (error) {
            console.error('🎤 Microphone access denied:', error);
            throw new Error('Microphone access is required for the Racing Engineer');
        }
    }
    
    updateEngineerStatus(state, text) {
        const statusElement = document.getElementById('engineerStatus');
        if (!statusElement) return;
        
        const indicator = statusElement.querySelector('.status-indicator');
        const textElement = statusElement.querySelector('.status-text');
        
        // Remove all state classes
        statusElement.classList.remove('connecting', 'error');
        
        switch (state) {
            case 'connected':
                // Default connected state
                break;
            case 'connecting':
                statusElement.classList.add('connecting');
                break;
            case 'error':
                statusElement.classList.add('error');
                break;
        }
        
        if (textElement) textElement.textContent = text;
    }
    
    toggleTalking() {
        if (!this.racingEngineer.connected) {
            console.log('🏁 Racing Engineer not connected');
            return;
        }

        if (this.isRecording) {
            this.stopTalking();
        } else {
            this.startTalking();
        }
    }
    
    async startTalking() {
        if (this.isRecording) {
            return;
        }

        if (!this.racingEngineer.connected) {
            await this.connectEngineer();
        }

        try {
            console.log('🎤 Starting to stream audio...');
            this.isRecording = true;

            const talkButton = document.getElementById('talkButton');
            const talkButtonText = talkButton.querySelector('.talk-button-text');
            const micIcon = talkButton.querySelector('.mic-icon');

            talkButton.classList.add('active');
            if (talkButtonText) talkButtonText.textContent = 'STOP';

            if (micIcon) {
                micIcon.innerHTML = `
                    <rect x="6" y="6" width="12" height="12" fill="currentColor"/>
                `;
            }

            // Create stream processor for raw PCM capture
            this.audioSource = this.audioContext.createMediaStreamSource(this.audioStream);
            const bufferSize = 1024;
            this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
            this.audioSource.connect(this.processor);
            this.processor.connect(this.audioContext.destination);

            this.processor.onaudioprocess = (e) => {
                if (!this.isRecording) return;
                const input = e.inputBuffer.getChannelData(0);
                const pcm16 = new Int16Array(input.length);
                for (let i = 0; i < input.length; i++) {
                    let s = Math.max(-1, Math.min(1, input[i]));
                    s *= 0.95;
                    pcm16[i] = Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
                }
                const uint8 = new Uint8Array(pcm16.buffer);
                const base64Audio = btoa(String.fromCharCode.apply(null, uint8));
                this.socket.emit('engineer:audio', base64Audio);
            };

            console.log('🎤 Audio streaming started');
        } catch (error) {
            console.error('🎤 Failed to start audio streaming:', error);
            this.isRecording = false;
            this.resetTalkButton();
        }
    }
    
    stopTalking() {
        if (!this.isRecording) {
            return;
        }

        console.log('🎤 Stopping audio stream...');
        this.isRecording = false;

        // Stop audio processing
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.audioSource) {
            this.audioSource.disconnect();
            this.audioSource = null;
        }

        // Commit the audio buffer to the realtime API
        this.socket.emit('engineer:commit-audio');

        this.resetTalkButton();
        console.log('🎤 Audio streaming stopped');
    }
    
    resetTalkButton() {
        const talkButton = document.getElementById('talkButton');
        const talkButtonText = talkButton.querySelector('.talk-button-text');
        const micIcon = talkButton.querySelector('.mic-icon');

        talkButton.classList.remove('active');
        if (talkButtonText) talkButtonText.textContent = 'ENGINEER';

        if (micIcon) {
            micIcon.innerHTML = `
                <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            `;
        }
    }
    
    async playEngineerAudio(audioData) {
        try {
            console.log('🔊 Playing engineer audio response...');
            
            // Decode base64 audio data
            const audioBytes = atob(audioData);
            const audioBuffer = new ArrayBuffer(audioBytes.length);
            const audioArray = new Uint8Array(audioBuffer);
            for (let i = 0; i < audioBytes.length; i++) {
                audioArray[i] = audioBytes.charCodeAt(i);
            }
            
            // Convert PCM16 to AudioBuffer
            const pcm16Array = new Int16Array(audioBuffer);
            const floatArray = new Float32Array(pcm16Array.length);
            for (let i = 0; i < pcm16Array.length; i++) {
                floatArray[i] = pcm16Array[i] / 32768.0;
            }
            
            const playbackBuffer = this.playbackContext.createBuffer(1, floatArray.length, 24000);
            playbackBuffer.copyToChannel(floatArray, 0);
            
            const source = this.playbackContext.createBufferSource();
            source.buffer = playbackBuffer;
            source.connect(this.playbackContext.destination);
            source.start();
            
        } catch (error) {
            console.error('🔊 Failed to play engineer audio:', error);
        }
    }
}

// Circular Gauge Class (preserved for compatibility)
class CircularGauge {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.warn(`Canvas element with id '${canvasId}' not found`);
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.centerX = this.canvas.width / 2;
        this.centerY = this.canvas.height / 2;
        this.radius = Math.min(this.centerX, this.centerY) - 20;
        
        this.min = options.min || 0;
        this.max = options.max || 100;
        this.value = this.min;
        this.unit = options.unit || '';
        this.color = options.color || '#00ff41';
        this.warningThreshold = options.warningThreshold || this.max * 0.8;
        this.dangerThreshold = options.dangerThreshold || this.max * 0.9;
        
        this.draw();
    }
    
    update(value) {
        this.value = Math.max(this.min, Math.min(this.max, value));
        this.draw();
    }
    
    draw() {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Background arc
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius, 0.75 * Math.PI, 2.25 * Math.PI);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 8;
        this.ctx.stroke();
        
        // Value arc
        const valueAngle = 0.75 * Math.PI + (this.value - this.min) / (this.max - this.min) * 1.5 * Math.PI;
        
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius, 0.75 * Math.PI, valueAngle);
        
        // Color based on value
        if (this.value >= this.dangerThreshold) {
            this.ctx.strokeStyle = '#ff4444';
        } else if (this.value >= this.warningThreshold) {
            this.ctx.strokeStyle = '#ffaa00';
        } else {
            this.ctx.strokeStyle = this.color;
        }
        
        this.ctx.lineWidth = 8;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();
        
        // Tick marks
        this.drawTickMarks();
    }
    
    drawTickMarks() {
        const tickCount = 10;
        for (let i = 0; i <= tickCount; i++) {
            const angle = 0.75 * Math.PI + (i / tickCount) * 1.5 * Math.PI;
            const tickRadius = this.radius - 15;
            const tickEndRadius = this.radius - 5;
            
            const x1 = this.centerX + Math.cos(angle) * tickRadius;
            const y1 = this.centerY + Math.sin(angle) * tickRadius;
            const x2 = this.centerX + Math.cos(angle) * tickEndRadius;
            const y2 = this.centerY + Math.sin(angle) * tickEndRadius;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing F1-Style GT7 Dashboard...');
    window.dashboard = new GT7Dashboard();
});
