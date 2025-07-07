# GT7 Racing Dashboard

A beautiful, real-time racing dashboard for Gran Turismo 7 that displays telemetry data from your racing sessions.

## Features

- **Real-time Telemetry Display**: Speed, RPM, gear, and all car parameters
- **Beautiful Racing Theme**: Dark theme with orange accents and smooth animations
- **Comprehensive Data**: Tire temperatures, lap times, fuel level, boost pressure, and more
- **Status Indicators**: TCS, ASM, handbrake, lights, and other car system flags
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

- Node.js (v14 or higher)
- Gran Turismo 7 running on PS4/PS5
- SimHub (optional, for data forwarding)

## Installation

1. Navigate to the dashboard directory:
   ```bash
   cd dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

### Network Setup

Based on your network configuration in `project.md`:

- **PlayStation 5**: 10.0.1.74 (UDP Port 33740)
- **Dashboard (MacBook)**: 10.0.1.13
- **SimHub Forward**: Port 33742

### Option 1: Direct Connection (Recommended)

The dashboard is configured to receive UDP data on port 33742. If you're using SimHub, configure it to forward GT7 telemetry data to:
- IP: 10.0.1.13 (your MacBook)
- Port: 33742

### Option 2: Modify for Direct GT7 Connection

If you want to connect directly to GT7 without SimHub, modify `server.js`:

```javascript
const UDP_PORT = 33740; // Change from 33742 to 33740
```

## Usage

1. Start the dashboard server:
   ```bash
   npm start
   ```

2. Open your browser and go to:
   ```
   http://localhost:3000
   ```

3. Start Gran Turismo 7 and begin racing. The dashboard will automatically connect and display real-time telemetry data.

## Dashboard Features

### Main Display
- **Speed Gauge**: Real-time speed in MP/H with color-coded warning zones
- **RPM Gauge**: Engine RPM with rev limiter warnings
- **Gear Display**: Current gear and suggested gear
- **Fuel Level**: Visual fuel bar with remaining fuel amount

### Telemetry Data
- **Tire Information**: Individual tire temperatures and slip ratios
- **Car Status**: Oil temperature, water temperature, boost pressure
- **Lap Information**: Current lap, total laps, best lap time, last lap time
- **Input Monitoring**: Throttle and brake input percentages

### Status Flags
- TCS (Traction Control System)
- ASM (Active Stability Management)
- Handbrake status
- Lights status
- Rev limiter warnings
- Pause state

## Troubleshooting

### No Data Received
1. Check that GT7 is running and sending telemetry data
2. Verify network configuration matches your setup
3. Ensure firewall allows UDP traffic on port 33742
4. Check console for error messages

### Connection Issues
1. Verify the dashboard server is running on port 3000
2. Check that your browser can access `http://localhost:3000`
3. Look for WebSocket connection errors in browser console

### Performance Issues
1. Close other applications using network resources
2. Ensure stable network connection
3. Check for high CPU usage from other processes

## Development

To run in development mode with auto-reload:

```bash
npm run dev
```

## Customization

### Changing Colors
Edit `public/style.css` and modify the color variables:
- Primary color: `#ff6b35`
- Warning color: `#ffaa00`
- Danger color: `#ff4444`

### Adding New Telemetry Data
1. Modify the packet parsing in `server.js`
2. Add new HTML elements in `public/index.html`
3. Update the JavaScript handlers in `public/script.js`

## Technical Details

### Data Flow
1. GT7 sends UDP packets to SimHub
2. SimHub forwards data to dashboard on port 33742
3. Node.js server parses the GT7 packet format
4. WebSocket sends real-time updates to browser
5. Dashboard updates all displays in real-time

### Packet Format
The dashboard supports all GT7 packet types:
- **Packet A**: Basic telemetry (296 bytes)
- **Packet B**: Extended telemetry (316 bytes)
- **Packet C**: Full telemetry with energy recovery (344 bytes)

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - see LICENSE file for details.