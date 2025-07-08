import React, { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import './RacingEngineer.css';

interface RacingEngineerProps {
  socket: Socket | null;
}

export const RacingEngineer: React.FC<RacingEngineerProps> = ({ socket }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState('Ready');

  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Audio files for radio effects
  const startAudioRef = useRef<HTMLAudioElement | null>(null);
  const endAudioRef = useRef<HTMLAudioElement | null>(null);
  const idleAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize audio elements
    startAudioRef.current = new Audio('/Radio/Start.flac');
    endAudioRef.current = new Audio('/Radio/End1.wav');
    idleAudioRef.current = new Audio('/Radio/idle.wav');
    
    if (idleAudioRef.current) {
      idleAudioRef.current.volume = 0.15; // 15% volume
      idleAudioRef.current.loop = true;
    }

    if (!socket) return;

    socket.on('engineer:connected', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setStatus('Connected');
    });

    socket.on('engineer:disconnected', () => {
      setIsConnected(false);
      setIsConnecting(false);
      setStatus('Disconnected');
      cleanupAudioResources();
    });

    socket.on('engineer:error', (error: string) => {
      setIsConnecting(false);
      setStatus(`Error: ${error}`);
    });

    socket.on('engineer:audio', async (audioData: string) => {
      await playEngineerAudio(audioData);
    });

    socket.on('engineer:audioComplete', () => {
      // Play end sound and stop idle sound
      if (endAudioRef.current) {
        endAudioRef.current.play().catch(console.error);
      }
      if (idleAudioRef.current) {
        idleAudioRef.current.pause();
        idleAudioRef.current.currentTime = 0;
      }
    });

    // Auto-connect on mount
    const timer = setTimeout(() => {
      connectEngineer();
    }, 2000);

    return () => {
      clearTimeout(timer);
      cleanupAudioResources();
    };
  }, [socket]);

  const requestMicrophonePermission = async (): Promise<void> => {
    try {
      audioStreamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      // Input context at 16 kHz for the realtime API
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000
      });

      // Separate context for playback of engineer responses (24 kHz)
      playbackContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000
      });

      console.log('🎤 Microphone access granted');
    } catch (error) {
      console.error('🎤 Microphone access denied:', error);
      throw new Error('Microphone access is required for the Racing Engineer');
    }
  };

  const connectEngineer = async (): Promise<void> => {
    if (isConnected || isConnecting || !socket) {
      return;
    }

    setIsConnecting(true);
    setStatus('Connecting...');

    try {
      await requestMicrophonePermission();
      socket.emit('engineer:connect');
    } catch (error) {
      console.error('🏁 Failed to connect to Racing Engineer:', error);
      setStatus('Microphone access required');
      setIsConnecting(false);
    }
  };

  const startTalking = async (): Promise<void> => {
    if (isRecording || !isConnected || !socket || !audioStreamRef.current || !audioContextRef.current) {
      return;
    }

    try {
      setIsRecording(true);

      // Play start sound
      if (startAudioRef.current) {
        startAudioRef.current.play().catch(console.error);
      }

      // Create stream processor for raw PCM capture
      sourceRef.current = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);
      const bufferSize = 1024;
      processorRef.current = audioContextRef.current.createScriptProcessor(bufferSize, 1, 1);
      sourceRef.current.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      processorRef.current.onaudioprocess = (e) => {
        if (!isRecording) return;
        const input = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          let s = Math.max(-1, Math.min(1, input[i]));
          s *= 0.95;
          pcm16[i] = Math.round(s < 0 ? s * 0x8000 : s * 0x7fff);
        }
        const uint8 = new Uint8Array(pcm16.buffer);
        const base64Audio = btoa(String.fromCharCode.apply(null, uint8 as any));
        socket.emit('engineer:audio', base64Audio);
      };

      console.log('🎤 Audio streaming started');
    } catch (error) {
      console.error('🎤 Failed to start audio streaming:', error);
      setIsRecording(false);
    }
  };

  const stopTalking = (): void => {
    if (!isRecording || !socket) {
      return;
    }

    setIsRecording(false);

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    // Commit the audio buffer to the realtime API
    socket.emit('engineer:commit-audio');

    console.log('🎤 Audio streaming stopped');
  };

  const toggleTalking = (): void => {
    if (!isConnected) {
      console.log('🏁 Racing Engineer not connected');
      return;
    }

    if (isRecording) {
      stopTalking();
    } else {
      startTalking();
    }
  };

  const playEngineerAudio = async (audioData: string): Promise<void> => {
    try {
      if (!playbackContextRef.current) return;

      // Play start sound before engineer response
      if (startAudioRef.current) {
        startAudioRef.current.currentTime = 0;
        startAudioRef.current.play().catch(console.error);
      }

      // Play idle sound during engineer response
      if (idleAudioRef.current) {
        idleAudioRef.current.currentTime = 0;
        idleAudioRef.current.play().catch(console.error);
      }

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

      const playbackBuffer = playbackContextRef.current.createBuffer(1, floatArray.length, 24000);
      playbackBuffer.copyToChannel(floatArray, 0);

      const source = playbackContextRef.current.createBufferSource();
      source.buffer = playbackBuffer;
      source.connect(playbackContextRef.current.destination);
      source.start();

    } catch (error) {
      console.error('🔊 Failed to play engineer audio:', error);
    }
  };

  const cleanupAudioResources = (): void => {
    // Stop any active recording
    if (isRecording) {
      stopTalking();
    }

    // Clean up audio stream
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    // Clean up audio contexts
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (playbackContextRef.current) {
      playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    // Clean up audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  };

  // Handle spacebar for talk button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        toggleTalking();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, isRecording]);

  return (
    <div className="engineer-section">
      <div className="engineer-controls">
        <button 
          className={`talk-button ${isRecording ? 'active' : ''}`}
          onClick={toggleTalking}
        >
          <div className="talk-button-ring">
            <div className="talk-button-inner">
              {isRecording ? (
                <svg className="mic-icon" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="6" width="12" height="12"/>
                </svg>
              ) : (
                <svg className="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              )}
            </div>
          </div>
          <span className="talk-button-text">
            {isRecording ? 'STOP' : 'ENGINEER'}
          </span>
        </button>
        <div className={`engineer-status ${isConnecting ? 'connecting' : ''}`}>
          <span className="status-indicator"></span>
          <span className="status-text">{status}</span>
        </div>
      </div>
    </div>
  );
};