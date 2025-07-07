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
        this.silenceTimer = null;
        this.silenceThreshold = 3000; // 3 seconds of silence before auto-stop
        this.minRecordingTime = 500; // Minimum 500ms recording
        
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
            processing: false
        };
        
        // Set up racing engineer socket events
        this.socket.on('engineer:connected', () => {
            this.racingEngineer.connected = true;
            this.racingEngineer.connecting = false;
            this.updateEngineerStatus('connected', 'Ready');
            console.log('🏁 Racing Engineer connected');
        });
        
        this.socket.on('engineer:disconnected', () => {
            this.racingEngineer.connected = false;
            this.racingEngineer.connecting = false;
            this.updateEngineerStatus('disconnected', 'Disconnected');
            console.log('🏁 Racing Engineer disconnected');
        });
        
        this.socket.on('engineer:processing', (isProcessing) => {
            this.racingEngineer.processing = isProcessing;
            if (isProcessing) {
                this.updateEngineerStatus('processing', 'Processing...');
            } else {
                this.updateEngineerStatus('connected', 'Ready');
            }
        });
        
        this.socket.on('engineer:error', (error) => {
            this.racingEngineer.connecting = false;
            this.racingEngineer.processing = false;
            this.updateEngineerStatus('error', `Error: ${error}`);
            console.error('🏁 Racing Engineer error:', error);
        });
        
        this.socket.on('engineer:audioResponse', (response) => {
            console.log('🏁 Received engineer response:', response.text);
            this.playEngineerAudio(response.audio);
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
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
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
        statusElement.classList.remove('connecting', 'error', 'processing');
        
        switch (state) {
            case 'connected':
                // Default connected state (green)
                break;
            case 'connecting':
                statusElement.classList.add('connecting');
                break;
            case 'processing':
                statusElement.classList.add('processing');
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
            this.recordingStartTime = Date.now();
            
            // Update UI
            const talkButton = document.getElementById('talkButton');
            const talkButtonText = talkButton.querySelector('.talk-button-text');
            const micIcon = talkButton.querySelector('.mic-icon');
            
            talkButton.classList.add('active');
            talkButtonText.textContent = 'LISTENING';
            
            // Change icon to listening icon (pulsing circle)
            micIcon.innerHTML = `
                <circle cx="12" cy="12" r="6" fill="currentColor" opacity="0.8"/>
                <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/>
            `;
            
            // Clear previous audio data
            this.audioChunks = [];
            
            // Create MediaRecorder with the best available format
            const options = this.getRecorderOptions();
            console.log('🎤 Using recorder options:', options);
            
            this.mediaRecorder = new MediaRecorder(this.audioStream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    this.resetSilenceTimer(); // Reset silence timer when we get audio data
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecordedAudio();
            };
            
            // Start recording
            this.mediaRecorder.start(250); // Collect data every 250ms
            
            // Start silence detection
            this.startSilenceDetection();
            
        } catch (error) {
            console.error('🎤 Failed to start recording:', error);
            this.isRecording = false;
            this.resetTalkButton();
        }
    }
    
    getRecorderOptions() {
        // Try formats in order of OpenAI preference
        const mimeTypes = [
            { mimeType: 'audio/mp4', extension: '.m4a' },
            { mimeType: 'audio/mpeg', extension: '.mp3' },
            { mimeType: 'audio/webm;codecs=opus', extension: '.webm' },
            { mimeType: 'audio/webm', extension: '.webm' }
        ];
        
        console.log('🎤 Checking supported MIME types...');
        for (const format of mimeTypes) {
            if (MediaRecorder.isTypeSupported(format.mimeType)) {
                console.log(`🎤 Using MIME type: ${format.mimeType}`);
                // Store the extension for later use
                this.recordingFormat = format;
                return { mimeType: format.mimeType };
            } else {
                console.log(`🎤 Not supported: ${format.mimeType}`);
            }
        }
        
        console.log('🎤 Using default MediaRecorder options');
        this.recordingFormat = { mimeType: 'audio/webm', extension: '.webm' };
        return {};
    }
    
    stopTalking() {
        if (!this.isRecording) {
            return;
        }
        
        console.log('🎤 Stopping recording...');
        this.isRecording = false;
        
        // Clear silence timer
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.silenceTimer = null;
        }
        
        // Reset UI
        this.resetTalkButton();
        
        // Stop recording
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
    }
    
    startSilenceDetection() {
        // Auto-stop after silence threshold
        this.silenceTimer = setTimeout(() => {
            if (this.isRecording) {
                console.log('🎤 Auto-stopping due to silence');
                this.stopTalking();
            }
        }, this.silenceThreshold);
    }
    
    resetSilenceTimer() {
        if (this.silenceTimer) {
            clearTimeout(this.silenceTimer);
            this.startSilenceDetection();
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
    
    async processRecordedAudio() {
        if (this.audioChunks.length === 0) {
            console.log('🎤 No audio chunks to process');
            return;
        }
        
        // Check if we have enough audio duration
        const recordingDuration = Date.now() - this.recordingStartTime;
        if (recordingDuration < this.minRecordingTime) {
            console.log(`🎤 Recording too short: ${recordingDuration}ms, minimum: ${this.minRecordingTime}ms`);
            return;
        }
        
        try {
            console.log(`🎤 Processing ${this.audioChunks.length} audio chunks, duration: ${recordingDuration}ms`);
            
            // Create blob from audio chunks
            const recordedMimeType = this.mediaRecorder.mimeType || this.recordingFormat.mimeType;
            const audioBlob = new Blob(this.audioChunks, { type: recordedMimeType });
            console.log(`🎤 Audio blob size: ${audioBlob.size} bytes, type: ${recordedMimeType}`);
            
            if (audioBlob.size === 0) {
                console.log('🎤 Empty audio blob, skipping');
                return;
            }
            
            // Upload audio file to server
            await this.uploadAudioToServer(audioBlob);
            
        } catch (error) {
            console.error('🎤 Failed to process audio:', error);
        }
    }
    
    async uploadAudioToServer(audioBlob) {
        try {
            console.log('🎤 Uploading audio to server...');
            console.log('🎤 Blob type:', audioBlob.type);
            console.log('🎤 Blob size:', audioBlob.size);
            
            const formData = new FormData();
            
            // Determine file extension based on MIME type or recording format
            let extension = '.webm'; // default
            if (this.recordingFormat) {
                extension = this.recordingFormat.extension;
            } else if (audioBlob.type.includes('mp4')) {
                extension = '.m4a';
            } else if (audioBlob.type.includes('mpeg')) {
                extension = '.mp3';
            }
            
            const filename = `recording${extension}`;
            console.log('🎤 Using filename:', filename);
            
            // Add blob with proper filename
            formData.append('audio', audioBlob, filename);
            
            // Add format hint for server
            formData.append('mimeType', audioBlob.type);
            
            const response = await fetch('/api/engineer/audio', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Audio uploaded successfully:', result.message);
            } else {
                const error = await response.json();
                console.error('❌ Server error:', error);
                throw new Error(error.error || 'Upload failed');
            }
            
        } catch (error) {
            console.error('❌ Audio upload failed:', error);
            this.updateEngineerStatus('error', 'Upload failed');
        }
    }
    
    async playEngineerAudio(audioBase64) {
        try {
            console.log('🔊 Playing engineer audio response...');
            
            // Create audio context if not available
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Decode base64 audio data
            const binaryString = atob(audioBase64);
            const audioBytes = new Uint8Array(binaryString.length);
            
            for (let i = 0; i < binaryString.length; i++) {
                audioBytes[i] = binaryString.charCodeAt(i);
            }
            
            // Try to decode and play the audio
            try {
                const audioBuffer = await this.audioContext.decodeAudioData(audioBytes.buffer);
                
                const source = this.audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(this.audioContext.destination);
                
                source.onended = () => {
                    console.log('🔊 Engineer audio playback completed');
                };
                
                source.start();
            } catch (decodeError) {
                console.log('🔊 Web Audio API decode failed, trying HTML5 audio fallback');
                
                // Fallback: try to play using HTML5 audio element
                const audioBlob = new Blob([audioBytes], { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                const audio = new Audio(audioUrl);
                
                audio.onended = () => {
                    URL.revokeObjectURL(audioUrl);
                    console.log('🔊 Engineer audio playback completed (fallback)');
                };
                
                audio.onerror = (e) => {
                    console.error('🔊 HTML5 audio playback error:', e);
                    URL.revokeObjectURL(audioUrl);
                };
                
                await audio.play();
            }
            
        } catch (error) {
            console.error('🔊 Failed to play engineer audio:', error);
        }
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