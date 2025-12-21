# Project Context: M3U8 Proxy Server

## Overview
This project is a robust M3U8 streaming proxy server designed to filter advertisements from HLS streams. It features a hybrid detection engine (URL pattern matching + TS metadata analysis), a high-performance caching system, and a modern web dashboard for monitoring and configuration.

## Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Core Libraries:** 
  - `axios` (HTTP requests)
  - `mpegts.js` / `ts-demuxer` (TS stream analysis)
  - `@tensorflow/tfjs` (Experimental AI detection)
- **Persistence:** Local JSON files (for cache/learning data)

### Frontend (`/frontend`)
- **Framework:** React 18
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State/Data:** TanStack Query
- **Player:** HLS.js
- **Router:** React Router DOM

## Architecture

1.  **Proxy Layer (`server.js`)**: Entry point handling HTTP requests. Routes traffic to specific handlers.
2.  **Processor (`m3u8-processor.js`)**:
    - Fetches the original M3U8 playlist.
    - Parses segments.
    - Applies filtering logic.
    - Reconstructs the cleaned playlist.
3.  **Ad Detection**:
    - **URL Patterns**: Regex matching against known ad domains/paths.
    - **TS Metadata (`ts-metadata-detector.js`)**: Analyzes segment headers (resolution, bitrate, duration) to identify anomalies characteristic of ads.
    - **Neural Network (`neural-network-model.js`)**: (Experimental) AI-based classification.
4.  **Caching (`cache-manager.js`)**: 
    - In-memory LRU cache for high-speed access.
    - Persistence to `cache/` directory.
5.  **Dashboard**: Communicates via REST API to display stats, logs, and player.

## Key Files & Directories

- **`server.js`**: Main application entry point.
- **`config.js`**: Central configuration file (ports, toggles, thresholds).
- **`m3u8-processor.js`**: Core logic for M3U8 manipulation.
- **`ts-metadata-detector.js`**: Logic for inspecting TS segment headers.
- **`frontend/`**: Source code for the React UI.
- **`docs/`**: Detailed documentation on implementation plans and architecture.
- **`test/`**: Integration and unit tests (`test-ts-detection.js`, `test-real-scenario.js`).

## Development Workflow

### Prerequisites
- Node.js >= 14.0.0
- NPM or Yarn

### Setup
```bash
# Install Backend Dependencies
npm install

# Install Frontend Dependencies
npm run ui:install
```

### Running (Development)
1.  **Backend (Port 3000):**
    ```bash
    npm run dev
    ```
2.  **Frontend (UI):**
    ```bash
    npm run ui:dev
    ```
    Access the UI at the URL provided by Vite (usually `http://localhost:5173`).

### Running (Production)
```bash
# Build Frontend
npm run ui:build

# Start Server (Serves both API and Static UI)
npm start
```

## Configuration
Configuration is managed in `config.js` and can be overridden by environment variables.
- **`adFilter`**: Settings for regex patterns and TS detection thresholds.
- **`cache`**: TTL and memory limits.
- **`security`**: Rate limiting and CORS.

## Testing
Run specific test suites to verify functionality:
```bash
node test/test-ts-detection.js   # Test TS metadata logic
node test/test-integration.js    # Full system integration
```
