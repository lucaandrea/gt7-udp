const OpenAI = require('openai');
const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');

class SimpleRacingEngineer extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.openai = new OpenAI({
            apiKey: options.apiKey || process.env.OPENAI_API_KEY
        });
        
        this.lastTelemetry = null;
        this.isProcessing = false;
        
        console.log('🏁 Simple Racing Engineer initialized');
    }
    
    updateTelemetry(telemetryData) {
        this.lastTelemetry = telemetryData;
        
        // Check for critical alerts that warrant immediate engineer input
        this.checkTelemetryAlerts(telemetryData);
    }
    
    checkTelemetryAlerts(data) {
        if (!data) return;
        
        // Check for critical alerts that warrant immediate engineer input
        const alerts = [];
        
        // Fuel level check
        if (data.fuelCapacity > 0) {
            const fuelPercent = (data.fuelLevel / data.fuelCapacity) * 100;
            if (fuelPercent < 5) {
                alerts.push(`Critical fuel level: ${fuelPercent.toFixed(1)}% remaining`);
            }
        }
        
        // Tire temperature check
        if (data.tyreTemp) {
            const maxTireTemp = Math.max(...data.tyreTemp);
            if (maxTireTemp > 120) {
                alerts.push(`Critical tire temperatures: ${maxTireTemp.toFixed(0)}°C`);
            }
        }
        
        // Engine temperature check
        if (data.waterTemp > 130) {
            alerts.push(`Critical water temperature: ${data.waterTemp.toFixed(0)}°C`);
        }
        
        // Send alerts if any critical issues detected
        if (alerts.length > 0 && this.shouldSendAlert()) {
            const alertMessage = `Alert: ${alerts.join(', ')}. Consider immediate action.`;
            this.processDriverMessage(alertMessage, true);
        }
    }
    
    shouldSendAlert() {
        // Throttle alerts to avoid spam - only send every 45 seconds
        const now = Date.now();
        if (!this.lastAlertTime || (now - this.lastAlertTime) > 45000) {
            this.lastAlertTime = now;
            return true;
        }
        return false;
    }
    
    async transcribeAudio(audioFilePath) {
        try {
            console.log('🎤 Transcribing audio...');
            console.log('🎤 Audio file path:', audioFilePath);
            
            // Check if file exists
            if (!fs.existsSync(audioFilePath)) {
                throw new Error('Audio file does not exist');
            }
            
            // Get file stats
            const stats = fs.statSync(audioFilePath);
            console.log('🎤 Audio file size:', stats.size, 'bytes');
            
            if (stats.size === 0) {
                throw new Error('Audio file is empty');
            }
            
            // Create a read stream for the file
            const audioStream = fs.createReadStream(audioFilePath);
            
            const transcription = await this.openai.audio.transcriptions.create({
                file: audioStream,
                model: 'whisper-1',
                response_format: 'text',
                prompt: 'This is a conversation with a racing engineer about Gran Turismo 7 telemetry data. The driver may ask about fuel, tires, engine temperatures, lap times, or racing strategy.'
            });
            
            console.log('✅ Transcription completed:', transcription);
            return transcription;
            
        } catch (error) {
            console.error('❌ Transcription failed:', error);
            
            // More detailed error logging
            if (error.response) {
                console.error('❌ OpenAI API error response:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
                
                // Specific handling for format errors
                if (error.response.status === 400 && error.response.data?.error?.message?.includes('Unrecognized file format')) {
                    console.error('❌ The audio file format is not supported by OpenAI.');
                    console.error('   Supported formats: flac, m4a, mp3, mp4, mpeg, mpga, oga, ogg, wav, webm');
                    console.error('   File path:', audioFilePath);
                    console.error('   File extension:', path.extname(audioFilePath));
                }
            }
            
            throw error;
        }
    }
    
    async generateEngineerResponse(driverMessage, isAlert = false) {
        try {
            console.log('🤖 Generating engineer response...');
            
            const systemPrompt = this.getEngineerPrompt();
            const telemetryContext = this.getTelemetryContext();
            
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                {
                    role: 'user',
                    content: `Current telemetry data:\n${telemetryContext}\n\n${isAlert ? 'AUTOMATIC ALERT: ' : 'Driver message: '}${driverMessage}`
                }
            ];
            
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: messages,
                max_tokens: 300,
                temperature: 0.7
            });
            
            const response = completion.choices[0].message.content;
            console.log('✅ Engineer response generated:', response);
            return response;
            
        } catch (error) {
            console.error('❌ Response generation failed:', error);
            throw error;
        }
    }
    
    async synthesizeSpeech(text) {
        try {
            console.log('🔊 Synthesizing speech...');
            
            const audio = await this.openai.audio.speech.create({
                model: 'tts-1',
                voice: 'alloy',
                input: text,
                response_format: 'wav' // WAV for better compatibility
            });
            
            const buffer = Buffer.from(await audio.arrayBuffer());
            console.log('✅ Speech synthesis completed, buffer size:', buffer.length);
            return buffer;
            
        } catch (error) {
            console.error('❌ Speech synthesis failed:', error);
            
            if (error.response) {
                console.error('❌ OpenAI API error response:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data
                });
            }
            
            throw error;
        }
    }
    
    async processDriverMessage(message, isAlert = false) {
        if (this.isProcessing && !isAlert) {
            console.log('🏁 Already processing, skipping...');
            return;
        }
        
        try {
            this.isProcessing = true;
            this.emit('processing', true);
            
            // Generate response from the AI
            const engineerResponse = await this.generateEngineerResponse(message, isAlert);
            
            // Convert response to speech
            const audioBuffer = await this.synthesizeSpeech(engineerResponse);
            
            // Emit the audio to clients
            this.emit('audioResponse', {
                text: engineerResponse,
                audio: audioBuffer.toString('base64'),
                isAlert: isAlert
            });
            
        } catch (error) {
            console.error('❌ Failed to process driver message:', error);
            this.emit('error', error.message);
        } finally {
            this.isProcessing = false;
            this.emit('processing', false);
        }
    }
    
    async processAudioFile(audioFilePath) {
        try {
            console.log('🎤 Processing audio file:', audioFilePath);
            
            // Check file extension
            const ext = path.extname(audioFilePath).toLowerCase();
            console.log('🎤 File extension:', ext);
            
            // Validate file exists and has content
            if (!fs.existsSync(audioFilePath)) {
                throw new Error('Audio file does not exist');
            }
            
            const stats = fs.statSync(audioFilePath);
            if (stats.size === 0) {
                throw new Error('Audio file is empty');
            }
            
            console.log('🎤 File size:', stats.size, 'bytes');
            
            // Step 1: Transcribe the audio
            let transcription;
            try {
                transcription = await this.transcribeAudio(audioFilePath);
            } catch (transcribeError) {
                console.error('❌ Transcription error:', transcribeError.message);
                
                // Clean up the file
                try {
                    fs.unlinkSync(audioFilePath);
                } catch (unlinkError) {
                    console.error('❌ Failed to delete audio file:', unlinkError);
                }
                
                // Emit a more user-friendly error
                this.emit('error', 'Failed to transcribe audio. Please try again.');
                return;
            }
            
            // Clean up the temporary file after successful transcription
            try {
                fs.unlinkSync(audioFilePath);
                console.log('✅ Temporary audio file deleted');
            } catch (unlinkError) {
                console.error('❌ Failed to delete audio file:', unlinkError);
            }
            
            // Step 2: Process the transcribed message
            if (transcription && transcription.trim().length > 0) {
                console.log('🎤 Transcribed text:', transcription);
                await this.processDriverMessage(transcription);
            } else {
                console.log('⚠️ Empty transcription received');
                this.emit('error', 'No speech detected. Please try again.');
            }
            
        } catch (error) {
            console.error('❌ Failed to process audio file:', error);
            this.emit('error', error.message || 'Failed to process audio');
            
            // Clean up the temporary file even on error
            try {
                if (fs.existsSync(audioFilePath)) {
                    fs.unlinkSync(audioFilePath);
                }
            } catch (unlinkError) {
                // Ignore unlink errors
            }
        }
    }
    
    getEngineerPrompt() {
        return `You are an experienced racing engineer working with a professional race car driver during a Gran Turismo 7 session. You have decades of experience in motorsports, having worked with teams in Formula 1, endurance racing, and various other racing series.

Your role:
- Monitor telemetry data and provide strategic advice
- Give performance feedback and tactical guidance  
- Help optimize lap times and manage resources
- Provide clear, actionable recommendations

Personality:
- Professional but approachable
- Calm and focused, especially under pressure
- Use appropriate racing terminology
- Keep responses concise but informative (under 200 words)
- Be encouraging while being honest about performance

Communication style:
- Speak like you're on a racing radio during a live session
- Use measured pace with clear diction
- Focus on actionable advice rather than explanations
- Reference specific telemetry values when relevant

Remember: You're providing real-time guidance during an active racing session, so prioritize clarity and actionability over lengthy explanations.`;
    }
    
    getTelemetryContext() {
        if (!this.lastTelemetry) {
            return 'No current telemetry data available.';
        }
        
        const t = this.lastTelemetry;
        
        const fuelPercent = t.fuelCapacity > 0 ? 
            ((t.fuelLevel / t.fuelCapacity) * 100).toFixed(1) : 'N/A';
        
        const tireTemps = t.tyreTemp ? 
            `FL:${t.tyreTemp[0]?.toFixed(0)}°C, FR:${t.tyreTemp[1]?.toFixed(0)}°C, RL:${t.tyreTemp[2]?.toFixed(0)}°C, RR:${t.tyreTemp[3]?.toFixed(0)}°C` : 
            'N/A';
        
        return `Current Status:
- Speed: ${t.speedMph?.toFixed(1) || 0} MPH
- RPM: ${t.engineRPM?.toFixed(0) || 0}
- Gear: ${t.currentGear || 'N'}
- Fuel: ${t.fuelLevel?.toFixed(1) || 0}L (${fuelPercent}%)
- Tire Temperatures: ${tireTemps}
- Engine Oil: ${t.oilTemp?.toFixed(0) || 0}°C
- Engine Water: ${t.waterTemp?.toFixed(0) || 0}°C
- Throttle: ${t.throttlePercent?.toFixed(0) || 0}%
- Brake: ${t.brakePercent?.toFixed(0) || 0}%
- Best Lap: ${this.formatLapTime(t.bestLaptime)}
- Last Lap: ${this.formatLapTime(t.lastLaptime)}
- Current Lap: ${t.lapCount || 0}`;
    }
    
    formatLapTime(milliseconds) {
        if (!milliseconds || milliseconds < 0) return '--:--.---';
        
        const totalSeconds = milliseconds / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const ms = Math.floor((totalSeconds % 1) * 1000);
        
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
}

module.exports = SimpleRacingEngineer;