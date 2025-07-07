// GT7-specific Salsa20 implementation matching the C++ version exactly
class Salsa20 {
    constructor(key) {
        if (key.length !== 32) {
            throw new Error('Key must be 32 bytes');
        }
        this.vector = new Uint32Array(16);
        this.setKey(key);
    }
    
    setKey(key) {
        const constants = "expand 32-byte k";
        
        // Layout matches C++ implementation exactly
        this.vector[0] = this.convert(constants.slice(0, 4));    // "expa"
        this.vector[1] = this.convert(key.slice(0, 4));
        this.vector[2] = this.convert(key.slice(4, 8));
        this.vector[3] = this.convert(key.slice(8, 12));
        this.vector[4] = this.convert(key.slice(12, 16));
        this.vector[5] = this.convert(constants.slice(4, 8));    // "nd 3"
        
        // IV positions (will be set later)
        this.vector[6] = 0;
        this.vector[7] = 0;
        this.vector[8] = 0;  // Counter low
        this.vector[9] = 0;  // Counter high
        
        this.vector[10] = this.convert(constants.slice(8, 12));  // "2-by"
        this.vector[11] = this.convert(key.slice(16, 20));
        this.vector[12] = this.convert(key.slice(20, 24));
        this.vector[13] = this.convert(key.slice(24, 28));
        this.vector[14] = this.convert(key.slice(28, 32));
        this.vector[15] = this.convert(constants.slice(12, 16)); // "te k"
    }
    
    setIv(iv) {
        if (iv.length !== 8) {
            throw new Error('IV must be 8 bytes');
        }
        // IV goes in positions 6 and 7, counter in 8 and 9
        this.vector[6] = this.convert(iv.slice(0, 4));
        this.vector[7] = this.convert(iv.slice(4, 8));
        this.vector[8] = 0;  // Reset counter
        this.vector[9] = 0;
    }
    
    convert(bytes) {
        if (typeof bytes === 'string') {
            const arr = new Uint8Array(4);
            for (let i = 0; i < 4; i++) {
                arr[i] = bytes.charCodeAt(i) || 0;
            }
            bytes = arr;
        }
        
        return ((bytes[0] << 0) |
                (bytes[1] << 8) |
                (bytes[2] << 16) |
                (bytes[3] << 24)) >>> 0;
    }
    
    convertBack(value) {
        return new Uint8Array([
            (value >>> 0) & 0xff,
            (value >>> 8) & 0xff,
            (value >>> 16) & 0xff,
            (value >>> 24) & 0xff
        ]);
    }
    
    rotate(value, numBits) {
        return ((value << numBits) | (value >>> (32 - numBits))) >>> 0;
    }
    
    generateKeyStream() {
        const x = new Uint32Array(this.vector);
        
        // 20 rounds (10 double rounds) - matches C++ exactly
        for (let i = 20; i > 0; i -= 2) {
            // Column rounds
            x[4 ] ^= this.rotate((x[0 ] + x[12]) >>> 0,  7);
            x[8 ] ^= this.rotate((x[4 ] + x[0 ]) >>> 0,  9);
            x[12] ^= this.rotate((x[8 ] + x[4 ]) >>> 0, 13);
            x[0 ] ^= this.rotate((x[12] + x[8 ]) >>> 0, 18);
            x[9 ] ^= this.rotate((x[5 ] + x[1 ]) >>> 0,  7);
            x[13] ^= this.rotate((x[9 ] + x[5 ]) >>> 0,  9);
            x[1 ] ^= this.rotate((x[13] + x[9 ]) >>> 0, 13);
            x[5 ] ^= this.rotate((x[1 ] + x[13]) >>> 0, 18);
            x[14] ^= this.rotate((x[10] + x[6 ]) >>> 0,  7);
            x[2 ] ^= this.rotate((x[14] + x[10]) >>> 0,  9);
            x[6 ] ^= this.rotate((x[2 ] + x[14]) >>> 0, 13);
            x[10] ^= this.rotate((x[6 ] + x[2 ]) >>> 0, 18);
            x[3 ] ^= this.rotate((x[15] + x[11]) >>> 0,  7);
            x[7 ] ^= this.rotate((x[3 ] + x[15]) >>> 0,  9);
            x[11] ^= this.rotate((x[7 ] + x[3 ]) >>> 0, 13);
            x[15] ^= this.rotate((x[11] + x[7 ]) >>> 0, 18);
            
            // Diagonal rounds
            x[1 ] ^= this.rotate((x[0 ] + x[3 ]) >>> 0,  7);
            x[2 ] ^= this.rotate((x[1 ] + x[0 ]) >>> 0,  9);
            x[3 ] ^= this.rotate((x[2 ] + x[1 ]) >>> 0, 13);
            x[0 ] ^= this.rotate((x[3 ] + x[2 ]) >>> 0, 18);
            x[6 ] ^= this.rotate((x[5 ] + x[4 ]) >>> 0,  7);
            x[7 ] ^= this.rotate((x[6 ] + x[5 ]) >>> 0,  9);
            x[4 ] ^= this.rotate((x[7 ] + x[6 ]) >>> 0, 13);
            x[5 ] ^= this.rotate((x[4 ] + x[7 ]) >>> 0, 18);
            x[11] ^= this.rotate((x[10] + x[9 ]) >>> 0,  7);
            x[8 ] ^= this.rotate((x[11] + x[10]) >>> 0,  9);
            x[9 ] ^= this.rotate((x[8 ] + x[11]) >>> 0, 13);
            x[10] ^= this.rotate((x[9 ] + x[8 ]) >>> 0, 18);
            x[12] ^= this.rotate((x[15] + x[14]) >>> 0,  7);
            x[13] ^= this.rotate((x[12] + x[15]) >>> 0,  9);
            x[14] ^= this.rotate((x[13] + x[12]) >>> 0, 13);
            x[15] ^= this.rotate((x[14] + x[13]) >>> 0, 18);
        }
        
        // Add original state
        for (let i = 0; i < 16; i++) {
            x[i] = (x[i] + this.vector[i]) >>> 0;
        }
        
        // Convert to byte array
        const output = new Uint8Array(64);
        for (let i = 0; i < 16; i++) {
            const bytes = this.convertBack(x[i]);
            output[i * 4] = bytes[0];
            output[i * 4 + 1] = bytes[1];
            output[i * 4 + 2] = bytes[2];
            output[i * 4 + 3] = bytes[3];
        }
        
        // Increment counter (matches C++ behavior)
        this.vector[8]++;
        if (this.vector[8] === 0) {
            this.vector[9]++;
        }
        
        return output;
    }
    
    decrypt(data) {
        const result = new Uint8Array(data.length);
        let pos = 0;
        
        while (pos < data.length) {
            const keyStream = this.generateKeyStream();
            const bytesToProcess = Math.min(64, data.length - pos);
            
            for (let i = 0; i < bytesToProcess; i++) {
                result[pos + i] = data[pos + i] ^ keyStream[i];
            }
            
            pos += bytesToProcess;
        }
        
        return result;
    }
}

// Export for Node.js
if (typeof module !== 'undefined') {
    module.exports = Salsa20;
}