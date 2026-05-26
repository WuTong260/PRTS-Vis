# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Vite dev server on port 3000
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Architecture

This is a cyberpunk "PRTS-Vis Tactical Terminal" UI prototype — a single-page visual experience with no routing or backend. All modules are plain JavaScript (ES modules, no framework). The single HTML entry point is `index.html`, which contains ~20 DOM elements with specific IDs.

### Module dependency graph

```
main.js (entry point — wires all modules to DOM elements)
  ├── mainLoop.js       ← central rAF tick; modules register callbacks
  ├── stateMachine.js   ← FSM: IDLE → BOOTING → LOADING → READY → TRANSITIONING
  ├── bootSequence.js   ← orchestrates boot: typing → progress bar → ready
  ├── terminalLogger.js ← renders fake terminal log lines during loading
  ├── particleEngine.js ← Canvas 2D particle system with spatial-grid connections
  └── parallax.js       ← mouse-driven rotation on the wireframe sphere
```

`main.js` is the only file that touches the DOM. It owns all `document.getElementById` refs, wires state machine `onEnter` transitions to visual side effects, and is the only place that imports from multiple modules.

### Module roles

| Module | Role |
|--------|------|
| `mainLoop.js` | Central `requestAnimationFrame` loop. Other modules call `register(fn)` / `unregister(fn)` to hook into the tick. |
| `stateMachine.js` | Finite state machine with 5 states. Modules import `STATES`, `transition()`, `onEnter()`, `is()`. Only valid transitions are accepted; invalid ones warn to console. |
| `bootSequence.js` | Drives the loading flow: types a boot message character-by-character, then starts a time-based progress bar (0→100% over ~6.2s), streams terminal log lines while loading, and transitions to `READY` when complete. |
| `terminalLogger.js` | Appends `<div>` log lines into the terminal container. Supports `ok`/`warn` CSS classes. Auto-removes old lines when exceeding 80. |
| `particleEngine.js` | Full-screen Canvas 2D background. ~130 glowing particles with a spatial grid (150px cells) for O(n) neighbor lookups when drawing connections. |
| `parallax.js` | Updates CSS custom properties `--rotate-y`/`--rotate-x` on the wireframe sphere based on mouse position + a continuous auto-spin. Can be paused (for the burst transition). |

### State-driven UI flow

1. **BOOTING**: Boot message typed on screen. Cursor blinks. Wireframe sphere visible.
2. **LOADING**: Boot cursor fades out. Main content becomes visible. Progress bar animates, terminal log streams, sphere stays visible.
3. **READY**: Progress hits 100%. Progress bar fills. "LOG IN" button appears. Side panels slide in. Sphere fully visible. Seam glow enhanced.
4. **TRANSITIONING** (on ENTER click): Sphere rings burst outward with randomized scales/rotations. Blast doors slide open. Loading screen fades out.
5. After transition: blast doors fade out entirely, revealing the canvas particle background.

### CSS

`src/css/style.css` (~16KB) contains all styling — overlay effects, wireframe sphere 3D transforms, blast door animation, progress bar, terminal log area, side panels, and responsive/interactive states (`.visible`, `.grown`, `.burst`, `.open`, `.enhanced`).

CSS custom properties `--rotate-y` and `--rotate-x` are the bridge between `parallax.js` and the CSS `.wireframe-sphere` transform. `parallax.js` sets them on the sphere element each frame; the CSS consumes them via `transform: rotateY(var(--rotate-y)) rotateX(var(--rotate-x))`.
