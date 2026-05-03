# PRTS-Vis Tactical Terminal

> An industrial cyberpunk security audit terminal — Electron desktop app powered by an LLM-driven vulnerability analysis engine.

## Overview

PRTS-Vis is a network and computer security agent, inspired by PRTS, the onboard AI from the game *Arknights*. It features an immersive tactical terminal interface that simulates the visual experience of a security audit workstation.

Once inside the system, connect to OpenAI / DeepSeek / SiliconFlow or any compatible LLM provider to perform vulnerability lookups, configuration audits, file analysis, and other security tasks.

## Features

- **LLM Security Audit Kernel** — Function-calling-driven CVE queries, hardcoded credential detection, and online threat intelligence gathering
- **Local CVE Database** — Built-in offline vulnerability database with exact and fuzzy matching
- **Drag & Drop File Analysis** — Drag `.txt`, `.md`, `.json`, `.docx` files into the window for instant analysis
- **System Monitor Panel** — Real-time CPU, RAM, and system metrics display
- **Multi-Provider Support** — OpenAI, DeepSeek, SiliconFlow, and custom API endpoints; configuration stored in localStorage
- **Industrial Cyberpunk Visuals** — Canvas particle engine, wireframe sphere parallax, dynamic scanlines/noise/hexgrid overlays, blast door transition

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Electron |
| Build Tool | Vite |
| Language | Vanilla JavaScript (ES Modules) |
| Styling | Pure CSS |
| Document Parsing | mammoth (.docx) |
| Packaging | electron-builder |

## Project Structure

```
CLOSURE/
├── app/
│   └── main.cjs              # Electron main process
├── src/
│   ├── css/
│   │   └── style.css          # All styles
│   └── js/
│       ├── main.js            # Entry point — the only file that touches the DOM
│       ├── mainLoop.js        # Centralized requestAnimationFrame loop
│       ├── stateMachine.js    # Finite state machine
│       ├── bootSequence.js    # Boot sequence orchestration
│       ├── terminalLogger.js  # Terminal log line rendering
│       ├── particleEngine.js  # Canvas 2D particle system
│       ├── parallax.js        # Mouse-driven sphere parallax rotation
│       ├── agentKernel.js     # LLM system prompt & tool definitions
│       ├── llmService.js      # LLM API streaming (SSE)
│       ├── tools.js           # Tool execution (CVE lookup, config audit)
│       ├── cveDatabase.js     # Local CVE database
│       ├── configManager.js   # Provider configuration management
│       ├── markedLocal.js     # Markdown parser
│       ├── sttService.js      # Speech-to-text service
│       ├── sysMonitor.js      # System monitor & visualization
│       └── surveillance.js    # Reconnaissance analysis
├── index.html                 # Single-page entry
├── package.json
├── vite.config.js
└── .gitignore
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install

```bash
npm install
```

### Development

Start the Vite dev server and auto-launch Electron (with DevTools):

```bash
npm run dev
```

### Build

```bash
npm run dist
```

Output goes to the `release/` directory.

## Usage

1. **Launch the app** — Wait for the boot sequence to finish
2. **Click LOG IN** — Watch the transition animation
3. **Configure a Provider** — Click `[SYS.CONFIG]`, choose an LLM provider and enter your API key
4. **Enter a command** — Type a security analysis request in the terminal input and press Enter
5. **Drag & drop files** — Drop files into the window for analysis (supports `.txt`, `.md`, `.json`, `.docx`)

### Example Commands

- `Check Redis 5.0.5 for known vulnerabilities`
- `Scan this config file for hardcoded credentials`
- `Fetch the latest Log4j threat intelligence`

## State Machine

```
IDLE → BOOTING → LOADING → READY → TRANSITIONING → SYSTEM_ONLINE
```

| State | Description |
|-------|-------------|
| BOOTING | Boot message typed character by character |
| LOADING | Progress bar animation + terminal log stream |
| READY | LOG IN button appears, side panels slide in |
| TRANSITIONING | Sphere rings burst, blast doors open |
| SYSTEM_ONLINE | HUD activates, particle background visible |

## Configuration

Provider settings are stored entirely in browser localStorage (key: `prts-config`):

| Field | Description |
|-------|-------------|
| provider | Provider name (OpenAI / DeepSeek / SiliconFlow / Custom) |
| url | API endpoint URL |
| apiKey | API key |
| model | Model name |

No configuration data is ever uploaded or written to local files. The API key is only transmitted via the `Authorization` header during LLM requests.
