// GT7 Dashboard JavaScript
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
        this.audioContext = null;
        this.isRecording = false;
        this.audioChunks = [];
        this.audioBuffer = [];
        this.minAudioDurationMs = 500; // Minimum 500ms of audio before sending
        
        this.initializeSocket();
        this.initializeGauges();
        this.initializeRacingEngineer();
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
    
    initializeRacingEngineer() {
        this.racingEngineer = {
            connected: false,
            connecting: false,
            audioQueue: [],
            currentlyPlaying: false
        };
        
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
    
    // Racing Engineer Methods
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
                    sampleRate: 24000,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });
            
            // Create audio context for processing
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
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
        
        textElement.textContent = text;
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
        if (!this.racingEngineer.connected || this.isRecording) {
            return;
        }
        
        try {
            console.log('🎤 Starting to record...');
            this.isRecording = true;
            
            // Update UI
            const talkButton = document.getElementById('talkButton');
            const talkButtonText = talkButton.querySelector('.talk-button-text');
            const micIcon = talkButton.querySelector('.mic-icon');
            
            talkButton.classList.add('active');
            talkButtonText.textContent = 'STOP';
            
            // Change icon to stop icon
            micIcon.innerHTML = `
                <rect x="6" y="6" width="12" height="12" fill="currentColor"/>
            `;
            
            // Clear previous audio data
            this.audioChunks = [];
            this.audioBuffer = [];
            this.recordingStartTime = Date.now();
            
            // Create MediaRecorder with better settings
            this.mediaRecorder = new MediaRecorder(this.audioStream, {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000
            });
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processAudioForEngineer();
            };
            
            // Start recording with larger chunks
            this.mediaRecorder.start(250); // Collect data every 250ms
            
        } catch (error) {
            console.error('🎤 Failed to start recording:', error);
            this.isRecording = false;
            this.resetTalkButton();
        }
    }
    
    stopTalking() {
        if (!this.isRecording) {
            return;
        }
        
        console.log('🎤 Stopping recording...');
        this.isRecording = false;
        
        // Reset UI
        this.resetTalkButton();
        
        // Stop recording
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }
    
    resetTalkButton() {
        const talkButton = document.getElementById('talkButton');
        const talkButtonText = talkButton.querySelector('.talk-button-text');
        const micIcon = talkButton.querySelector('.mic-icon');
        
        talkButton.classList.remove('active');
        talkButtonText.textContent = 'TALK';
        
        // Restore microphone icon
        micIcon.innerHTML = `
            <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
        `;
    }
    
    async processAudioForEngineer() {
        if (this.audioChunks.length === 0) {
            console.log('🎤 No audio chunks to process');
            return;
        }
        
        // Check if we have enough audio duration
        const recordingDuration = Date.now() - this.recordingStartTime;
        if (recordingDuration < this.minAudioDurationMs) {
            console.log(`🎤 Recording too short: ${recordingDuration}ms, minimum: ${this.minAudioDurationMs}ms`);
            return;
        }
        
        try {
            console.log(`🎤 Processing ${this.audioChunks.length} audio chunks, duration: ${recordingDuration}ms`);
            
            // Create blob from audio chunks
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
            console.log(`🎤 Audio blob size: ${audioBlob.size} bytes`);
            
            if (audioBlob.size === 0) {
                console.log('🎤 Empty audio blob, skipping');
                return;
            }
            
            // Convert to PCM16 format required by OpenAI
            const arrayBuffer = await audioBlob.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            console.log(`🎤 Audio buffer duration: ${audioBuffer.duration.toFixed(2)}s, sample rate: ${audioBuffer.sampleRate}Hz`);
            
            // Only proceed if we have sufficient audio
            if (audioBuffer.duration < 0.5) {
                console.log('🎤 Audio duration too short after decoding');
                return;
            }
            
            // Convert to PCM16
            const pcm16Data = this.convertToPCM16(audioBuffer);
            console.log(`🎤 PCM16 data size: ${pcm16Data.length} bytes`);
            
            // Send audio data in chunks to avoid overwhelming the buffer
            await this.sendAudioInChunks(pcm16Data);
            
            // Commit the audio buffer
            this.socket.emit('engineer:commitAudio');
            
            console.log('🎤 Audio sent to Racing Engineer');
            
        } catch (error) {
            console.error('🎤 Failed to process audio:', error);
        }
    }
    
    async sendAudioInChunks(pcm16Data) {
        const chunkSize = 8192; // 8KB chunks
        const totalChunks = Math.ceil(pcm16Data.length / chunkSize);
        
        console.log(`🎤 Sending audio in ${totalChunks} chunks`);
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, pcm16Data.length);
            const chunk = pcm16Data.slice(start, end);
            
            // Convert to base64 and send to server
            const base64Audio = btoa(String.fromCharCode.apply(null, chunk));
            this.socket.emit('engineer:audio', base64Audio);
            
            // Small delay between chunks to avoid overwhelming the server
            if (i < totalChunks - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
    }
    
    convertToPCM16(audioBuffer) {
        // Resample to 24kHz if needed (OpenAI requirement)
        const targetSampleRate = 24000;
        let processedBuffer = audioBuffer;
        
        if (audioBuffer.sampleRate !== targetSampleRate) {
            processedBuffer = this.resampleAudioBuffer(audioBuffer, targetSampleRate);
        }
        
        // Get the audio data (first channel)
        const audioData = processedBuffer.getChannelData(0);
        
        // Convert float32 to int16 (PCM16) with proper scaling
        const pcm16Data = new Int16Array(audioData.length);
        
        for (let i = 0; i < audioData.length; i++) {
            // Clamp the value between -1 and 1, then convert to 16-bit int
            let sample = Math.max(-1, Math.min(1, audioData[i]));
            
            // Apply slight gain reduction to prevent clipping
            sample *= 0.95;
            
            // Convert to 16-bit integer
            pcm16Data[i] = Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
        }
        
        // Convert to Uint8Array (little-endian)
        const uint8Array = new Uint8Array(pcm16Data.length * 2);
        for (let i = 0; i < pcm16Data.length; i++) {
            const value = pcm16Data[i];
            uint8Array[i * 2] = value & 0xFF;
            uint8Array[i * 2 + 1] = (value >> 8) & 0xFF;
        }
        
        return uint8Array;
    }
    
    resampleAudioBuffer(audioBuffer, targetSampleRate) {
        if (audioBuffer.sampleRate === targetSampleRate) {
            return audioBuffer;
        }
        
        const ratio = targetSampleRate / audioBuffer.sampleRate;
        const newLength = Math.round(audioBuffer.length * ratio);
        const newBuffer = this.audioContext.createBuffer(1, newLength, targetSampleRate);
        const oldData = audioBuffer.getChannelData(0);
        const newData = newBuffer.getChannelData(0);
        
        // Simple linear interpolation resampling
        for (let i = 0; i < newLength; i++) {
            const oldIndex = i / ratio;
            const index = Math.floor(oldIndex);
            const fraction = oldIndex - index;
            
            if (index + 1 < oldData.length) {
                newData[i] = oldData[index] * (1 - fraction) + oldData[index + 1] * fraction;
            } else {
                newData[i] = oldData[index] || 0;
            }
        }
        
        return newBuffer;
    }
    
    async playEngineerAudio(audioData) {
        try {
            if (!this.audioContext) {
                console.error('🔊 Audio context not available');
                return;
            }
            
            // Decode base64 audio data
            const binaryString = atob(audioData);
            const audioBytes = new Uint8Array(binaryString.length);
            
            for (let i = 0; i < binaryString.length; i++) {
                audioBytes[i] = binaryString.charCodeAt(i);
            }
            
            // Check if we have valid audio data
            if (audioBytes.length < 2) {
                console.log('🔊 Insufficient audio data');
                return;
            }
            
            // Convert PCM16 data to audio buffer
            const audioBuffer = await this.pcm16ToAudioBuffer(audioBytes);
            
            // Create gain node for volume control
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0.8; // Reduce volume slightly
            
            // Play the audio
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            source.onended = () => {
                console.log('🔊 Engineer audio playback completed');
            };
            
            source.start();
            
        } catch (error) {
            console.error('🔊 Failed to play engineer audio:', error);
        }
    }
    
    async pcm16ToAudioBuffer(pcm16Data) {
        // Convert PCM16 data back to float32 audio buffer
        const samples = pcm16Data.length / 2;
        
        if (samples === 0) {
            throw new Error('No audio samples to process');
        }
        
        const audioBuffer = this.audioContext.createBuffer(1, samples, 24000);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < samples; i++) {
            // Read little-endian 16-bit signed integer
            let value = pcm16Data[i * 2] | (pcm16Data[i * 2 + 1] << 8);
            
            // Convert from unsigned to signed 16-bit
            if (value > 0x7FFF) {
                value -= 0x10000;
            }
            
            // Convert signed 16-bit to float32 (-1.0 to 1.0)
            channelData[i] = value / 0x8000;
        }
        
        return audioBuffer;
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