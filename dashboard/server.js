const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const dgram = require('dgram');
const path = require('path');
const Salsa20 = require('./salsa20.js');
const RacingEngineer = require('./racing-engineer.js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve static files from dist directory (React build) or public directory
app.use(express.static(path.join(__dirname, 'dist')));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration - Dynamic settings
let currentSettings = {
    ps5IP: '10.0.1.74',  // Default PS5 IP address
    userName: ''          // User's name for Racing Engineer
};
const PS5_PORT = 33739;      // PS5 receives heartbeat on this port
const LOCAL_UDP_PORT = 33740; // We listen for GT7 data on this port
const HEARTBEAT_INTERVAL = 1000; // Send heartbeat every 1000ms

// UDP server to receive GT7 telemetry data
const udpServer = dgram.createSocket('udp4');

// UDP client to send heartbeat to PS5
const heartbeatClient = dgram.createSocket('udp4');

// Packet tracking
let packetCount = 0;
let lastPacketTime = Date.now();
let heartbeatInterval;

// Racing Engineer
let racingEngineer = null;

console.log('=== GT7 Dashboard Server Starting ===');
console.log(`Default PS5 IP: ${currentSettings.ps5IP}`);
console.log(`PS5 Port: ${PS5_PORT}`);
console.log(`Local UDP Port: ${LOCAL_UDP_PORT}`);
console.log('=====================================');

// GT7 packet structure based on the C++ structs
const PACKET_A_SIZE = 296;
const PACKET_B_SIZE = 316;
const PACKET_C_SIZE = 344;

// GT7 Salsa20 decryption key
const GT7_KEY = "Simulator Interface Packet GT7 ver 0.0";
const keyBytes = Buffer.from(GT7_KEY, 'ascii').subarray(0, 32);

function sendHeartbeat() {
    const heartbeatMsg = Buffer.from('A'); // Send 'A' for packet type A
    
    heartbeatClient.send(heartbeatMsg, PS5_PORT, currentSettings.ps5IP, (err) => {
        if (err) {
            console.error('❌ Heartbeat send error:', err);
        } else {
            console.log(`💓 Heartbeat sent to ${currentSettings.ps5IP}:${PS5_PORT} at ${new Date().toISOString()}`);
        }
    });
}

function parseGT7Packet(buffer) {
    console.log(`📦 Received packet: ${buffer.length} bytes`);
    
    // Check minimum packet size
    if (buffer.length < 64) {
        console.log('❌ Packet too small, likely not a GT7 packet');
        return null;
    }

    // Extract IV from offset 0x40 (position 64)
    let iv1, iv2;
    try {
        if (buffer.length < 68) {
            console.log('❌ Packet too small to contain IV');
            return null;
        }
        
        iv1 = buffer.readUInt32LE(0x40); // Read IV from position 64
        console.log(`🔑 IV1 extracted: 0x${iv1.toString(16)}`);
        
        // Determine packet type and XOR constant based on size
        let xorConstant;
        if (buffer.length === PACKET_A_SIZE) {
            xorConstant = 0xDEADBEAF;
            console.log('📦 Detected Packet A');
        } else if (buffer.length === PACKET_B_SIZE) {
            xorConstant = 0xDEADBEEF;
            console.log('📦 Detected Packet B');
        } else if (buffer.length === PACKET_C_SIZE) {
            xorConstant = 0x55FABB4F;
            console.log('📦 Detected Packet C');
        } else {
            console.log(`⚠️  Unknown packet size: ${buffer.length}, trying Packet A constant`);
            xorConstant = 0xDEADBEAF;
        }
        
        iv2 = (iv1 ^ xorConstant) >>> 0;
        console.log(`🔑 IV2 calculated: 0x${iv2.toString(16)}`);
        
        // Create 8-byte nonce: iv2 first, then iv1 (this matches the C++ setIv order)
        const nonce = new Uint8Array(8);
        nonce[0] = iv2 & 0xff;
        nonce[1] = (iv2 >>> 8) & 0xff;
        nonce[2] = (iv2 >>> 16) & 0xff;
        nonce[3] = (iv2 >>> 24) & 0xff;
        nonce[4] = iv1 & 0xff;
        nonce[5] = (iv1 >>> 8) & 0xff;
        nonce[6] = (iv1 >>> 16) & 0xff;
        nonce[7] = (iv1 >>> 24) & 0xff;
        
        console.log(`🔑 Nonce: ${Array.from(nonce).map(b => b.toString(16).padStart(2, '0')).join('')}`);
        
        // Decrypt the packet
        const salsa20 = new Salsa20(keyBytes);
        salsa20.setIv(nonce);  // Use setIv instead of setNonce to match C++ API
        const decryptedBuffer = Buffer.from(salsa20.decrypt(buffer));
        
        console.log(`🔓 Decrypted packet, first 32 bytes: ${decryptedBuffer.subarray(0, 32).toString('hex')}`);
        
        // Now parse the decrypted data
        buffer = decryptedBuffer;
    } catch (error) {
        console.error('❌ Decryption error:', error);
        console.log('📄 Raw packet first 64 bytes:', buffer.subarray(0, 64).toString('hex'));
        return null;
    }

    let offset = 0;
    
    // Helper function to read different data types
    function readInt32() {
        if (offset + 4 > buffer.length) return 0;
        const value = buffer.readInt32LE(offset);
        offset += 4;
        return value;
    }
    
    function readFloat() {
        if (offset + 4 > buffer.length) return 0;
        const value = buffer.readFloatLE(offset);
        offset += 4;
        return value;
    }
    
    function readInt16() {
        if (offset + 2 > buffer.length) return 0;
        const value = buffer.readInt16LE(offset);
        offset += 2;
        return value;
    }
    
    function readUInt8() {
        if (offset + 1 > buffer.length) return 0;
        const value = buffer.readUInt8(offset);
        offset += 1;
        return value;
    }

    try {
        // Read magic number first
        const magic = readInt32();
        console.log(`🔮 Magic number: ${magic} (0x${magic.toString(16)})`);
        
        // Accept any reasonable magic number for now - GT7 seems to use various values
        // Common GT7 magic numbers observed: 0x23cfe750, etc.
        // We'll validate the data makes sense instead of checking specific magic
        console.log('✅ Proceeding with packet parsing (magic number accepted)');

        const packet = {
            magic: magic,
            position: [readFloat(), readFloat(), readFloat()],
            worldVelocity: [readFloat(), readFloat(), readFloat()],
            rotation: [readFloat(), readFloat(), readFloat()],
            orientationRelativeToNorth: readFloat(),
            angularVelocity: [readFloat(), readFloat(), readFloat()],
            bodyHeight: readFloat(),
            engineRPM: readFloat(),
            iv: [readUInt8(), readUInt8(), readUInt8(), readUInt8()],
            fuelLevel: readFloat(),
            fuelCapacity: readFloat(),
            speed: readFloat(),
            boost: readFloat(),
            oilPressure: readFloat(),
            waterTemp: readFloat(),
            oilTemp: readFloat(),
            tyreTemp: [readFloat(), readFloat(), readFloat(), readFloat()],
            packetId: readInt32(),
            lapCount: readInt16(),
            totalLaps: readInt16(),
            bestLaptime: readInt32(),
            lastLaptime: readInt32(),
            dayProgression: readInt32(),
            raceStartPosition: readInt16(),
            preRaceNumCars: readInt16(),
            minAlertRPM: readInt16(),
            maxAlertRPM: readInt16(),
            calcMaxSpeed: readInt16(),
            flags: readInt16(),
            gears: readUInt8(),
            throttle: readUInt8(),
            brake: readUInt8(),
            padding: readUInt8(),
            roadPlane: [readFloat(), readFloat(), readFloat()],
            roadPlaneDistance: readFloat(),
            wheelRPS: [readFloat(), readFloat(), readFloat(), readFloat()],
            tyreRadius: [readFloat(), readFloat(), readFloat(), readFloat()],
            suspHeight: [readFloat(), readFloat(), readFloat(), readFloat()],
            unknownFloats: Array.from({length: 8}, () => readFloat()),
            clutch: readFloat(),
            clutchEngagement: readFloat(),
            rpmFromClutchToGearbox: readFloat(),
            transmissionTopSpeed: readFloat(),
            gearRatios: Array.from({length: 8}, () => readFloat()),
            carCode: readInt32()
        };

        // GT7 telemetry doesn't provide current race position, only pre-race starting position
        // Use the raceStartPosition field that's already parsed correctly
        packet.currentPosition = packet.raceStartPosition;

        // Add PacketB fields if packet is large enough
        if (buffer.length >= PACKET_B_SIZE) {
            packet.wheelRotation = readFloat();
            packet.unknownFloat10 = readFloat();
            packet.sway = readFloat();
            packet.heave = readFloat();
            packet.surge = readFloat();
        }

        // Add PacketC fields if packet is large enough
        if (buffer.length >= PACKET_C_SIZE) {
            packet.throttleFiltered = readUInt8();
            packet.brakeFiltered = readUInt8();
            packet.unknownUInt81 = readUInt8();
            packet.unknownUInt82 = readUInt8();
            packet.torqueVectors = [readFloat(), readFloat(), readFloat(), readFloat()];
            packet.energyRecovery = readFloat();
            packet.unknownFloat11 = readFloat();
        }

        // Calculate derived values
        packet.speedKmh = packet.speed * 3.6;
        packet.speedMph = packet.speedKmh * 0.621371; // Convert km/h to mph
        packet.currentGear = packet.gears & 0x0F;
        packet.suggestedGear = (packet.gears >> 4) & 0x0F;
        packet.throttlePercent = (packet.throttle / 255) * 100;
        packet.brakePercent = (packet.brake / 255) * 100;
        
        // Calculate tire speeds and slip ratios
        packet.tyreSpeedKmh = packet.wheelRPS.map((rps, i) => 
            Math.abs(3.6 * packet.tyreRadius[i] * rps)
        );
        packet.tyreSlipRatio = packet.tyreSpeedKmh.map((tyreSpeed, i) => 
            packet.speedKmh !== 0 ? tyreSpeed / packet.speedKmh : 0
        );

        // Parse simulator flags
        packet.simulatorFlags = {
            carOnTrack: !!(packet.flags & (1 << 0)),
            paused: !!(packet.flags & (1 << 1)),
            loadingOrProcessing: !!(packet.flags & (1 << 2)),
            inGear: !!(packet.flags & (1 << 3)),
            hasTurbo: !!(packet.flags & (1 << 4)),
            revLimiterAlert: !!(packet.flags & (1 << 5)),
            handbrakeActive: !!(packet.flags & (1 << 6)),
            lightsActive: !!(packet.flags & (1 << 7)),
            highBeamActive: !!(packet.flags & (1 << 8)),
            lowBeamActive: !!(packet.flags & (1 << 9)),
            asmActive: !!(packet.flags & (1 << 10)),
            tcsActive: !!(packet.flags & (1 << 11))
        };

        // Debug: Show some key values to check if decryption is working
        console.log(`🔍 Debug values: Speed=${packet.speed}m/s, RPM=${packet.engineRPM}, PacketID=${packet.packetId}`);
        console.log(`🔍 Position: [${packet.position[0].toFixed(2)}, ${packet.position[1].toFixed(2)}, ${packet.position[2].toFixed(2)}]`);
        
        // More lenient validation for debugging
        if (isNaN(packet.speed) || isNaN(packet.engineRPM)) {
            console.log(`❌ Packet contains NaN values - decryption likely failed`);
            console.log('📄 This indicates decryption issues');
            return null;
        }
        
        console.log(`✅ Parsed packet #${packet.packetId}: Speed=${packet.speedKmh.toFixed(1)}km/h, RPM=${packet.engineRPM.toFixed(0)}, Gear=${packet.currentGear}`);
        return packet;
    } catch (error) {
        console.error('❌ Error parsing packet:', error);
        console.log('📄 First 64 bytes of problematic packet:', buffer.subarray(0, 64).toString('hex'));
        return null;
    }
}

// Handle UDP messages
udpServer.on('message', (msg, rinfo) => {
    packetCount++;
    lastPacketTime = Date.now();
    
    console.log(`\n📡 UDP packet #${packetCount} received from ${rinfo.address}:${rinfo.port}`);
    console.log(`   Size: ${msg.length} bytes`);
    console.log(`   Expected sizes: A=${PACKET_A_SIZE}, B=${PACKET_B_SIZE}, C=${PACKET_C_SIZE}`);
    
    // Show first few bytes for debugging
    console.log(`   First 16 bytes: ${msg.subarray(0, 16).toString('hex')}`);
    
    const packet = parseGT7Packet(msg);
    if (packet) {
        console.log('✅ Sending telemetry to connected clients');
        // Send telemetry data to all connected clients
        io.emit('telemetry', packet);
        
        // Update racing engineer with telemetry data
        if (racingEngineer) {
            racingEngineer.updateTelemetry(packet);
        }
    } else {
        console.log('❌ Failed to parse packet - might be encrypted or invalid format');
    }
});

udpServer.on('error', (err) => {
    console.error(`❌ UDP server error:\n${err.stack}`);
    udpServer.close();
});

udpServer.on('listening', () => {
    const address = udpServer.address();
    console.log(`🎯 UDP server listening on ${address.address}:${address.port}`);
    
    // Start sending heartbeat after UDP server is ready
    console.log('💓 Starting heartbeat to PS5...');
    sendHeartbeat(); // Send immediately
    heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
});

// Start UDP server
console.log(`🚀 Binding UDP server to port ${LOCAL_UDP_PORT}...`);
udpServer.bind(LOCAL_UDP_PORT);

// Handle WebSocket connections
io.on('connection', (socket) => {
    console.log('🌐 Web client connected');
    
    // Send connection status
    socket.emit('serverStatus', {
        ps5IP: currentSettings.ps5IP,
        ps5Port: PS5_PORT,
        localPort: LOCAL_UDP_PORT,
        packetCount: packetCount,
        lastPacketTime: lastPacketTime,
        engineerConnected: racingEngineer?.connected || false,
        userName: currentSettings.userName
    });
    
    // Handle initial settings from client (on first connection)
    socket.on('settings:initialize', (initialSettings) => {
        console.log('🚀 Initializing settings from client:', initialSettings);
        
        // Validate and update if provided
        if (initialSettings.ipAddress && initialSettings.userName) {
            const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            if (ipRegex.test(initialSettings.ipAddress) && initialSettings.userName.trim()) {
                currentSettings.ps5IP = initialSettings.ipAddress;
                currentSettings.userName = initialSettings.userName.trim();
                
                console.log(`🎯 Settings initialized: IP=${currentSettings.ps5IP}, Driver=${currentSettings.userName}`);
                
                // Broadcast updated settings to all clients
                io.emit('settings:updated', {
                    ipAddress: currentSettings.ps5IP,
                    userName: currentSettings.userName
                });
            }
        }
    });
    
    // Racing Engineer event handlers
    socket.on('engineer:connect', async () => {
        try {
            if (!racingEngineer) {
                racingEngineer = new RacingEngineer({
                    apiKey: process.env.OPENAI_API_KEY,
                    userName: currentSettings.userName || 'Driver'
                });
                
                // Set up engineer event listeners
                racingEngineer.on('connected', () => {
                    io.emit('engineer:connected');
                    console.log('🏁 Racing Engineer connected to all clients');
                });
                
                racingEngineer.on('disconnected', () => {
                    io.emit('engineer:disconnected');
                    console.log('🏁 Racing Engineer disconnected from all clients');
                });
                
                racingEngineer.on('error', (error) => {
                    io.emit('engineer:error', error.message);
                    console.error('🏁 Racing Engineer error:', error);
                });
                
                racingEngineer.on('audioData', (audioData) => {
                    io.emit('engineer:audio', audioData);
                });
                
                racingEngineer.on('audioComplete', () => {
                    io.emit('engineer:audioComplete');
                });
                
                racingEngineer.on('transcription', (transcript) => {
                    io.emit('engineer:transcription', transcript);
                });
                
                racingEngineer.on('speechStarted', () => {
                    io.emit('engineer:speechStarted');
                });
                
                racingEngineer.on('speechStopped', () => {
                    io.emit('engineer:speechStopped');
                });
            }
            
            await racingEngineer.connect();
        } catch (error) {
            console.error('❌ Failed to initialize Racing Engineer:', error);
            socket.emit('engineer:error', 'Failed to connect to Racing Engineer');
        }
    });
    
    socket.on('engineer:disconnect', () => {
        if (racingEngineer) {
            racingEngineer.disconnect();
            racingEngineer = null;
        }
    });
    
    socket.on('engineer:audio', (audioData) => {
        if (racingEngineer && racingEngineer.connected) {
            // audioData should be a base64 encoded PCM16 audio buffer
            const audioBuffer = Buffer.from(audioData, 'base64');
            racingEngineer.sendAudioData(audioBuffer);
        }
    });
    
    socket.on('engineer:commit-audio', () => {
        if (racingEngineer && racingEngineer.connected) {
            racingEngineer.commitAudio();
        }
    });
    
    socket.on('engineer:text', (text) => {
        if (racingEngineer && racingEngineer.connected) {
            racingEngineer.sendTextMessage(text);
        }
    });
    
    // Settings update handlers
    socket.on('settings:update', (newSettings) => {
        console.log('⚙️ Updating settings:', newSettings);
        
        // Validate IP address
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        if (!ipRegex.test(newSettings.ipAddress)) {
            socket.emit('settings:error', 'Invalid IP address format');
            return;
        }
        
        // Validate username
        if (!newSettings.userName || !newSettings.userName.trim()) {
            socket.emit('settings:error', 'Username is required');
            return;
        }
        
        // Update settings
        const oldIP = currentSettings.ps5IP;
        currentSettings.ps5IP = newSettings.ipAddress;
        currentSettings.userName = newSettings.userName.trim();
        
        // Update Racing Engineer with new username if connected
        if (racingEngineer && racingEngineer.connected) {
            racingEngineer.updateUserName(currentSettings.userName);
        }
        
        // Log the change
        if (oldIP !== currentSettings.ps5IP) {
            console.log(`🔄 PS5 IP changed from ${oldIP} to ${currentSettings.ps5IP}`);
        }
        console.log(`👤 Driver name set to: ${currentSettings.userName}`);
        
        // Confirm settings update to all clients
        io.emit('settings:updated', {
            ipAddress: currentSettings.ps5IP,
            userName: currentSettings.userName
        });
        
        // Send updated server status
        io.emit('serverStatus', {
            ps5IP: currentSettings.ps5IP,
            ps5Port: PS5_PORT,
            localPort: LOCAL_UDP_PORT,
            packetCount: packetCount,
            lastPacketTime: lastPacketTime,
            engineerConnected: racingEngineer?.connected || false,
            userName: currentSettings.userName
        });
    });
    
    socket.on('disconnect', () => {
        console.log('🌐 Web client disconnected');
    });
});

// Periodic status logging
setInterval(() => {
    const timeSinceLastPacket = Date.now() - lastPacketTime;
    console.log(`\n📊 Status Report:`);
    console.log(`   Packets received: ${packetCount}`);
    console.log(`   Time since last packet: ${timeSinceLastPacket}ms`);
    console.log(`   Connected clients: ${io.engine.clientsCount}`);
    
    if (packetCount === 0) {
        console.log('⚠️  No packets received yet. Check:');
        console.log('   1. GT7 is running and in a session');
        console.log('   2. PS5 is at the correct IP address');
        console.log('   3. Network firewall allows UDP traffic');
        console.log('   4. GT7 is sending telemetry (should be enabled by default)');
    }
}, 10000); // Every 10 seconds

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server...');
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    heartbeatClient.close();
    udpServer.close();
    server.close();
    process.exit(0);
});

// Start HTTP server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌟 Dashboard server running on port ${PORT}`);
    console.log(`🌍 Open http://localhost:${PORT} in your browser`);
    console.log('\n🎮 Waiting for GT7 telemetry data...');
});