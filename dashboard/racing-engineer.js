const WebSocket = require('ws');
const EventEmitter = require('events');

class RacingEngineer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
        this.model = options.model || process.env.RACING_ENGINEER_MODEL || 'gpt-4o-mini-realtime-preview-2024-12-17';
        this.voice = options.voice || process.env.RACING_ENGINEER_VOICE || 'alloy';
        
        this.ws = null;
        this.connected = false;
        this.sessionId = null;
        this.lastTelemetry = null;
        this.conversationHistory = [];
        
        // Buffer for audio data
        this.audioBuffer = [];
        this.totalAudioReceived = 0;
        
        console.log('🏁 Racing Engineer initialized');
    }
    
    async connect() {
        if (this.connected) {
            console.log('🏁 Racing Engineer already connected');
            return;
        }
        
        try {
            console.log('🏁 Connecting to OpenAI Realtime API...');
            
            // Connect to OpenAI Realtime API using WebSocket
            const url = 'wss://api.openai.com/v1/realtime?model=' + this.model;
            
            this.ws = new WebSocket(url, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'OpenAI-Beta': 'realtime=v1'
                }
            });
            
            this.ws.on('open', () => {
                console.log('✅ Connected to OpenAI Realtime API');
                this.connected = true;
                this.emit('connected');
                this.initializeSession();
            });
            
            this.ws.on('message', (data) => {
                this.handleServerMessage(JSON.parse(data.toString()));
            });
            
            this.ws.on('close', () => {
                console.log('❌ Disconnected from OpenAI Realtime API');
                this.connected = false;
                this.emit('disconnected');
            });
            
            this.ws.on('error', (error) => {
                console.error('❌ Racing Engineer WebSocket error:', error);
                this.emit('error', error);
            });
            
        } catch (error) {
            console.error('❌ Failed to connect Racing Engineer:', error);
            this.emit('error', error);
        }
    }
    
    initializeSession() {
        const sessionConfig = {
            type: 'session.update',
            session: {
                modalities: ['text', 'audio'],
                instructions: this.getEngineerInstructions(),
                voice: this.voice,
                input_audio_format: 'pcm16',
                output_audio_format: 'pcm16',
                input_audio_transcription: {
                    model: 'whisper-1'
                },
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    prefix_padding_ms: 300,
                    silence_duration_ms: 500,
                    create_response: true
                },
                temperature: 0.8,
                max_response_output_tokens: 1000
            }
        };
        
        this.sendMessage(sessionConfig);
        console.log('🏁 Racing Engineer session initialized');
    }
    
    getEngineerInstructions() {
        return `# Racing Engineer Personality and Role

## Identity
You are an experienced racing engineer working with a professional race car driver during a Gran Turismo 7 session. You have decades of experience in motorsports, having worked with teams in Formula 1, endurance racing, and various other racing series. You're calm under pressure, analytical, and always focused on helping the driver optimize their performance.

## Task
Monitor telemetry data in real-time and provide strategic advice, performance feedback, and tactical guidance to help the driver improve lap times, manage resources, and make optimal racing decisions.

## Demeanor
Professional but approachable, calm and focused during intense moments, encouraging but honest about performance.

## Tone
Clear, confident, and precise. Use racing terminology naturally but explain technical concepts when helpful.

## Level of Enthusiasm
Measured enthusiasm that increases during exciting moments or significant improvements, but always maintains professionalism.

## Level of Formality
Professional but not overly formal - like an experienced engineer talking to a trusted driver.

## Filler Words
Occasionally use "uh," "right," or "okay" for natural speech flow, but keep it minimal.

## Pacing
Speak at a measured pace that allows for clear understanding, but can increase tempo during urgent situations.

# Instructions
- Always acknowledge the driver's questions and provide specific, actionable advice
- Reference current telemetry data when giving feedback (speed, RPM, fuel, tire temps, etc.)
- Use racing terminology appropriately (understeer, oversteer, apex, racing line, etc.)
- Provide strategic advice on tire management, fuel consumption, and race tactics
- Be encouraging while being honest about areas for improvement
- If telemetry shows concerning values, alert the driver appropriately
- Keep responses concise but informative
- Remember that you're in a live racing situation where quick, clear communication is essential

# Current Telemetry Context
You have access to real-time telemetry including:
- Speed (MPH/KMH), RPM, current gear
- Fuel level and capacity
- Tire temperatures and slip ratios for all four tires
- Engine temperatures (oil, water)
- Brake and throttle input percentages
- Lap times (current, best, last)
- Racing flags and assists (TCS, ASM, etc.)
- Track position and other racing data

Use this data to provide informed advice and respond to driver questions about their performance and race strategy.`;
    }
    
    updateTelemetry(telemetryData) {
        this.lastTelemetry = telemetryData;
        
        // Check for concerning telemetry values and provide proactive advice
        this.checkTelemetryAlerts(telemetryData);
    }
    
    checkTelemetryAlerts(data) {
        if (!this.connected || !data) return;
        
        // Check for critical alerts that warrant immediate engineer input
        const alerts = [];
        
        // Fuel level check
        if (data.fuelCapacity > 0) {
            const fuelPercent = (data.fuelLevel / data.fuelCapacity) * 100;
            if (fuelPercent < 10) {
                alerts.push(`Critical fuel level: ${fuelPercent.toFixed(1)}% remaining`);
            }
        }
        
        // Tire temperature check
        if (data.tyreTemp) {
            const maxTireTemp = Math.max(...data.tyreTemp);
            if (maxTireTemp > 110) {
                alerts.push(`High tire temperatures detected: ${maxTireTemp.toFixed(0)}°C`);
            }
        }
        
        // Engine temperature check
        if (data.waterTemp > 120) {
            alerts.push(`High water temperature: ${data.waterTemp.toFixed(0)}°C`);
        }
        
        if (data.oilTemp > 150) {
            alerts.push(`High oil temperature: ${data.oilTemp.toFixed(0)}°C`);
        }
        
        // Send alerts if any critical issues detected
        if (alerts.length > 0 && this.shouldSendAlert()) {
            const alertMessage = `Engineer alert: ${alerts.join(', ')}`;
            this.sendTextMessage(alertMessage);
        }
    }
    
    shouldSendAlert() {
        // Throttle alerts to avoid spam - only send every 30 seconds
        const now = Date.now();
        if (!this.lastAlertTime || (now - this.lastAlertTime) > 30000) {
            this.lastAlertTime = now;
            return true;
        }
        return false;
    }
    
    sendAudioData(audioBuffer) {
        if (!this.connected || !audioBuffer || audioBuffer.length === 0) {
            console.log('🏁 Cannot send audio: not connected or empty buffer');
            return;
        }
        
        this.totalAudioReceived += audioBuffer.length;
        console.log(`🏁 Sending audio chunk: ${audioBuffer.length} bytes (total: ${this.totalAudioReceived} bytes)`);
        
        // Convert audio buffer to base64
        const audioBase64 = Buffer.from(audioBuffer).toString('base64');
        
        const audioMessage = {
            type: 'input_audio_buffer.append',
            audio: audioBase64
        };
        
        this.sendMessage(audioMessage);
    }
    
    commitAudio() {
        if (!this.connected) {
            console.log('🏁 Cannot commit audio: not connected');
            return;
        }
        
        console.log(`🏁 Committing audio buffer (total audio: ${this.totalAudioReceived} bytes)`);
        
        const commitMessage = {
            type: 'input_audio_buffer.commit'
        };
        
        this.sendMessage(commitMessage);
        
        // Reset audio counter for next recording
        this.totalAudioReceived = 0;
    }
    
    sendTextMessage(text) {
        if (!this.connected) return;
        
        const textMessage = {
            type: 'conversation.item.create',
            item: {
                type: 'message',
                role: 'user',
                content: [
                    {
                        type: 'input_text',
                        text: this.addTelemetryContext(text)
                    }
                ]
            }
        };
        
        this.sendMessage(textMessage);
        
        // Trigger a response
        const responseMessage = {
            type: 'response.create'
        };
        
        this.sendMessage(responseMessage);
    }
    
    addTelemetryContext(userText) {
        if (!this.lastTelemetry) return userText;
        
        const telemetryContext = `
Current telemetry:
- Speed: ${this.lastTelemetry.speedMph?.toFixed(1) || 0} MPH
- RPM: ${this.lastTelemetry.engineRPM?.toFixed(0) || 0}
- Gear: ${this.lastTelemetry.currentGear || 'N'}
- Fuel: ${this.lastTelemetry.fuelLevel?.toFixed(1) || 0}L (${((this.lastTelemetry.fuelLevel / this.lastTelemetry.fuelCapacity) * 100)?.toFixed(1) || 0}%)
- Tire temps: FL:${this.lastTelemetry.tyreTemp?.[0]?.toFixed(0) || 0}°C, FR:${this.lastTelemetry.tyreTemp?.[1]?.toFixed(0) || 0}°C, RL:${this.lastTelemetry.tyreTemp?.[2]?.toFixed(0) || 0}°C, RR:${this.lastTelemetry.tyreTemp?.[3]?.toFixed(0) || 0}°C
- Engine temps: Oil ${this.lastTelemetry.oilTemp?.toFixed(0) || 0}°C, Water ${this.lastTelemetry.waterTemp?.toFixed(0) || 0}°C
- Best lap: ${this.formatLapTime(this.lastTelemetry.bestLaptime)}
- Last lap: ${this.formatLapTime(this.lastTelemetry.lastLaptime)}

Driver question: ${userText}`;
        
        return telemetryContext;
    }
    
    formatLapTime(milliseconds) {
        if (!milliseconds || milliseconds < 0) return '--:--.---';
        
        const totalSeconds = milliseconds / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const ms = Math.floor((totalSeconds % 1) * 1000);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    
    handleServerMessage(message) {
        switch (message.type) {
            case 'session.created':
                this.sessionId = message.session.id;
                console.log('🏁 Racing Engineer session created:', this.sessionId);
                break;
                
            case 'session.updated':
                console.log('🏁 Racing Engineer session updated');
                break;
                
            case 'response.audio.delta':
                // Forward audio data to client
                this.emit('audioData', message.delta);
                break;
                
            case 'response.audio.done':
                console.log('🏁 Racing Engineer audio response completed');
                this.emit('audioComplete');
                break;
                
            case 'response.text.delta':
                // Forward text response to client for debugging
                this.emit('textDelta', message.delta);
                break;
                
            case 'response.text.done':
                console.log('🏁 Racing Engineer text response:', message.text);
                this.emit('textComplete', message.text);
                break;
                
            case 'conversation.item.input_audio_transcription.completed':
                console.log('🏁 Driver transcription:', message.transcript);
                this.emit('transcription', message.transcript);
                break;
                
            case 'input_audio_buffer.speech_started':
                console.log('🏁 Driver started speaking');
                this.emit('speechStarted');
                break;
                
            case 'input_audio_buffer.speech_stopped':
                console.log('🏁 Driver stopped speaking');
                this.emit('speechStopped');
                break;
                
            case 'error':
                console.error('🏁 Racing Engineer API error:', message.error);
                this.emit('error', message.error);
                break;
                
            default:
                // Handle other message types silently
                break;
        }
    }
    
    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        console.log('🏁 Racing Engineer disconnected');
    }
}

module.exports = RacingEngineer;
