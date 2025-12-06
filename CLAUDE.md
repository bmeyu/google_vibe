# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Starry Night Strings** is an interactive audiovisual experience that combines MediaPipe hand gesture recognition with Van Gogh's "Starry Night Over the Rhône" painting. Users create cosmic strings between their hands and pluck them to generate musical notes and visual effects that ripple across the artwork.

## Development Commands

### Running the Application
```bash
npm install          # Install dependencies
npm run dev          # Start development server on http://localhost:3000
npm run build        # Build for production
npm run preview      # Preview production build
```

### Environment Setup
- Set `GEMINI_API_KEY` in `.env.local` (required for AI Studio integration)
- Camera permissions are required for hand tracking

## Architecture

### Core Technologies
- **React 19** with TypeScript
- **Three.js** for WebGL shader-based visual effects
- **MediaPipe Hands** (loaded via CDN) for real-time hand tracking
- **Web Audio API** for procedural sound synthesis
- **Vite** for build tooling

### Application Flow

1. **Entry Point** (`App.tsx`): Simple state wrapper that shows splash screen, then renders main canvas
2. **Main Canvas** (`StarryNightCanvas.tsx`): Orchestrates all systems:
   - Three.js WebGL renderer with custom fragment shader for swirl effects
   - HTML5 Canvas overlay for string/UI rendering
   - MediaPipe hand detection loop
   - Audio playback and visual particle effects

### Hand Gesture System

The app uses **MediaPipe Hands** to detect hand landmarks and implements a state machine:

1. **Spawn/Despawn**: Hold both index fingertips close together (~8% screen distance) for ~1 second
   - Toggles strings on/off
   - Progress circle appears between hands
   - Despawning also unlocks strings

2. **Lock/Unlock**: When strings are active:
   - Spread hands very wide (>55% screen distance) for ~0.5s to **lock** strings in place
   - Bring hands close together (<25% screen distance) to **unlock**
   - Locked strings glow cyan, active strings glow gold

3. **Pluck**: Move fingertips (index/middle/ring/pinky) across any of the 3 parallel strings
   - Triggers musical note (pentatonic scale based on horizontal position)
   - Spawns visual note particles
   - Creates energy beam to nearest themed point (star/lamp)
   - Adds swirl effect to background shader

### Visual Rendering Pipeline

**Background Layer (WebGL)**:
- Fragment shader (`StarryNightCanvas.tsx:64-104`) applies real-time distortion to Van Gogh painting
- Two effects:
  1. **Ambient flow**: Continuous sine wave distortion for organic movement
  2. **Interactive swirls**: Point-based vortex distortions triggered by plucks
- Shader receives up to 16 swirl points with intensity values, applies rotation-based UV offset

**Overlay Layer (Canvas 2D)**:
- Cosmic strings with physics-based vibration (standing wave simulation)
- Progress indicators for spawn/lock actions
- Musical note particles with fade-out animation
- Energy beams connecting pluck points to painting features
- Camera feed preview with state indicators

### Audio System

- **Pentatonic scale** (E minor: E, G, A, B, D) mapped across 15 frequencies
- Horizontal position determines pitch (left = low, right = high)
- Each string has a scale offset for harmonies
- Sound synthesis (`utils/audioUtils.ts`):
  - Oscillator type, attack/decay, and filter controlled by theme
  - Lowpass filter sweep for natural pluck timbre
  - Delay line with feedback for reverb effect

### Theme System

All visual and audio properties are defined in `data/themes.ts`:
- **Colors**: Primary (lock/magic), Secondary (spawn/active), Notes, Beams
- **Instrument config**: Oscillator type, envelope, filter frequencies
- **Interactable points**: Coordinates of stars/lamps with swirl intensity multipliers
- **Background URL**: Source image for WebGL texture

Current theme: `THEME_STARRY_NIGHT_RHONE` with 7 stars (Big Dipper) and 7 gas lamps along the shoreline.

### Key Implementation Details

**String Rendering** (`drawCosmicString`):
- Uses `globalCompositeOperation = 'lighter'` for additive blending
- Two-pass rendering: outer glow + white-hot core
- Standing wave vibration based on `sin(t * π) * sin(time + t * 5)` for realistic pluck physics
- Vibration amplitude decays by 0.85x per frame

**Intersection Detection** (`utils/geoUtils.ts`):
- Segment-segment intersection using CCW (counter-clockwise) test
- Compares finger movement path (prev → current) against string segments
- 150ms cooldown between plucks

**State Management**:
- React `useState` for high-level modes (isStringsActive, isLocked)
- `useRef` for animation state (swirls, notes, vibrations, landmarks)
- Frame counters for gesture timing (spawn requires 60 frames, lock requires 30)

## File Organization

```
/
├── App.tsx                          # Entry point, splash screen
├── components/
│   └── StarryNightCanvas.tsx        # Main canvas component (828 lines)
├── utils/
│   ├── audioUtils.ts                # Web Audio synthesis
│   └── geoUtils.ts                  # Segment intersection math
├── data/
│   └── themes.ts                    # Visual/audio theme configs
├── types.ts                         # TypeScript interfaces
├── vite.config.ts                   # Path alias: @ → ./
└── index.html                       # MediaPipe CDN script tag
```

## Development Notes

### MediaPipe Integration
- Loaded via `<script>` tag in `index.html` (not npm package)
- Global `window.Hands` class declared in TypeScript
- Detection loop runs continuously via `requestAnimationFrame`
- Returns `multiHandLandmarks` array with 21 landmarks per hand

### TypeScript Configuration
- Path alias `@/*` maps to project root
- `experimentalDecorators: true` and `useDefineForClassFields: false` enabled
- Vite-specific: `allowImportingTsExtensions: true`, `noEmit: true`

### Performance Considerations
- Single WebGL context with custom shader (no post-processing libraries)
- Max 16 swirls to avoid shader array overflow
- Canvas overlay only redraws when needed (cleared each frame)
- Vibration decay and particle cleanup prevent memory leaks

### Adding New Themes
1. Define new `Theme` object in `data/themes.ts`
2. Specify background image URL, color palette, instrument config
3. Map interactable points (use normalized 0-1 coordinates)
4. Set `CURRENT_THEME` constant in `StarryNightCanvas.tsx:36`
