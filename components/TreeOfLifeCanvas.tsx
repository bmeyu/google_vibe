
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { initAudio, playGuitarNote } from '../utils/audioUtils';
import { segmentsIntersect } from '../utils/geoUtils';
import { loadSoundfontGuitar, frequencyToMidi } from '../utils/soundfontGuitar';
import { Point, HandLandmark, MusicalNote } from '../types';
import { isOpenPalm } from '../utils/gestureUtils';
import { THEME_TREE_OF_LIFE } from '../data/themes';

// Define the shape of MediaPipe results locally
interface MPResults {
  multiHandLandmarks: HandLandmark[][];
  multiHandedness: { label: string }[];
  image: any;
}

// Declare the global Hands class provided by the script tag
declare global {
  class Hands {
    constructor(config: { locateFile: (file: string) => string });
    setOptions(options: {
      maxNumHands?: number;
      modelComplexity?: number;
      minDetectionConfidence?: number;
      minTrackingConfidence?: number;
    }): void;
    onResults(callback: (results: MPResults) => void): void;
    send(input: { image: HTMLVideoElement }): Promise<void>;
    close(): void;
  }
  interface Window {
    Hands: typeof Hands;
  }
}

// --- CONFIG ---
const CURRENT_THEME = THEME_TREE_OF_LIFE;
const STRUM_COOLDOWN = 1100; // ms between phrases
const PICK_STEP_MS = 280; // ~8th-note feel at a mid tempo
const PICK_SUSTAIN_SEC = 1.4;
const PICK_PATTERN_TRIAD = [0, 1, 2, 1, 0, 1, 2, 1];
const PICK_PATTERN_EXT = [0, 1, 3, 2, 0, 1, 3, 2];

// --- INTERACTION CONSTANTS ---
const SPAWN_DISTANCE_THRESHOLD = 0.08;
const SPAWN_TIME_REQUIRED = 60;
const VIBRATION_DECAY = 0.88;
const MAX_SWIRLS = 32;
const NOTE_SYMBOLS = ['♪', '♫', '♬', '✦', '★', '✶'];

type Chord = { name: string; notes: number[] };
type MelodyPreset = { id: string; name: string; chords: Chord[] };

// 3 preset progressions (simple, pleasant triads)
const MELODIES: MelodyPreset[] = [
  {
    id: 'canon-in-d',
    name: '♫ Canon in D',
    chords: [
      // A (1-8)
      { name: 'D', notes: [293.66, 369.99, 440.00] },
      { name: 'A', notes: [220.00, 277.18, 329.63] },
      { name: 'Bm', notes: [246.94, 293.66, 369.99] },
      { name: 'F#m', notes: [185.00, 220.00, 277.18] },
      { name: 'G', notes: [196.00, 246.94, 293.66] },
      { name: 'D', notes: [293.66, 369.99, 440.00] },
      { name: 'G', notes: [196.00, 246.94, 293.66] },
      { name: 'A', notes: [220.00, 277.18, 329.63] },
      // A' (9-16)
      { name: 'D(add9)', notes: [293.66, 329.63, 369.99, 440.00] },
      { name: 'A', notes: [220.00, 277.18, 329.63] },
      { name: 'Bm7', notes: [246.94, 293.66, 369.99, 440.00] },
      { name: 'F#m7', notes: [185.00, 220.00, 277.18, 329.63] },
      { name: 'G', notes: [196.00, 246.94, 293.66] },
      { name: 'D', notes: [293.66, 369.99, 440.00] },
      { name: 'Em7', notes: [164.81, 196.00, 246.94, 293.66] },
      { name: 'A', notes: [220.00, 277.18, 329.63] },
      // B (17-20)
      { name: 'Bm7', notes: [246.94, 293.66, 369.99, 440.00] },
      { name: 'G', notes: [196.00, 246.94, 293.66] },
      { name: 'D', notes: [293.66, 369.99, 440.00] },
      { name: 'A', notes: [220.00, 277.18, 329.63] },
      // A return (21-24)
      { name: 'D', notes: [293.66, 369.99, 440.00] },
      { name: 'A', notes: [220.00, 277.18, 329.63] },
      { name: 'Bm', notes: [246.94, 293.66, 369.99] },
      { name: 'A', notes: [220.00, 277.18, 329.63] },
    ],
  },
  {
    id: 'axis',
    name: '♫ I–V–vi–IV',
    chords: [
      { name: 'C', notes: [261.63, 329.63, 392.0] },    // C4, E4, G4
      { name: 'G', notes: [196.0, 246.94, 293.66] },    // G3, B3, D4
      { name: 'Am', notes: [220.0, 261.63, 329.63] },   // A3, C4, E4
      { name: 'F', notes: [174.61, 220.0, 261.63] },    // F3, A3, C4
      { name: 'C', notes: [261.63, 329.63, 392.0] },
      { name: 'G', notes: [196.0, 246.94, 293.66] },
      { name: 'Am', notes: [220.0, 261.63, 329.63] },
      { name: 'F', notes: [174.61, 220.0, 261.63] },
    ],
  },
  {
    id: 'stand-by-me',
    name: '♫ I–vi–IV–V',
    chords: [
      { name: 'G', notes: [196.0, 246.94, 293.66] },    // G3, B3, D4
      { name: 'Em', notes: [164.81, 196.0, 246.94] },   // E3, G3, B3
      { name: 'C', notes: [261.63, 329.63, 392.0] },    // C4, E4, G4
      { name: 'D', notes: [293.66, 369.99, 440.0] },    // D4, F#4, A4
      { name: 'G', notes: [196.0, 246.94, 293.66] },
      { name: 'Em', notes: [164.81, 196.0, 246.94] },
      { name: 'C', notes: [261.63, 329.63, 392.0] },
      { name: 'D', notes: [293.66, 369.99, 440.0] },
    ],
  },
];

// Guitar rotation angle (tilted like holding position)
// Note: the overlay canvas is mirrored via `scaleX(-1)`, so we rotate "the other way"
// to make the user see a top-left → bottom-right guitar.
const GUITAR_ANGLE = Math.PI / 4; // About +45 degrees

// Hand skeleton connections for neon visualization (same style as Guernica)
const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],        // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],        // Index
  [0, 9], [9, 10], [10, 11], [11, 12],   // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17],             // Palm
];
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];
const HAND_NEON_COLOR = '#00ffff';
const PINCH_HOLD_MS = 2000;

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform sampler2D tDiffuse;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uSwirls[${MAX_SWIRLS}];
  varying vec2 vUv;

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / uResolution.y;
    vec2 totalOffset = vec2(0.0);

    // Ambient Flow
    float ambientStrength = 0.002;
    float time = uTime * 0.5;
    float waveX = sin(uv.y * 10.0 + time) * cos(uv.x * 5.0 + time * 0.5);
    float waveY = cos(uv.x * 10.0 + time) * sin(uv.y * 5.0 + time * 0.3);
    totalOffset += vec2(waveX, waveY) * ambientStrength;

    // Interactive Swirls
    for (int i = 0; i < ${MAX_SWIRLS}; i++) {
        vec3 swirl = uSwirls[i];
        float intensity = swirl.z;
        if (intensity > 0.01) {
            vec2 center = swirl.xy;
            vec2 p = uv - center;
            p.x *= aspect;
            float dist = length(p);
            float radius = 0.15 * (0.5 + intensity * 0.5);
            float influence = smoothstep(radius, 0.0, dist);
            float angle = influence * intensity * 8.0;
            float s = sin(angle);
            float c = cos(angle);
            vec2 offset = uv - center;
            vec2 rotated = vec2(offset.x * c - offset.y * s, offset.x * s + offset.y * c);
            totalOffset += (rotated - offset) * influence;
        }
    }
    gl_FragColor = texture2D(tDiffuse, uv + totalOffset);
  }
`;

interface Swirl {
  x: number;
  y: number;
  intensity: number;
  decaySpeed: number;
}

interface EnergyBeam {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  progress: number;
  color: string;
}

// Guitar string positions (normalized 0-1 within guitar body)
interface GuitarString {
  y: number; // Y position within guitar
  vibration: number;
}

export const TreeOfLifeCanvas: React.FC<{ onExit?: () => void }> = ({ onExit }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Three.js Refs
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Animation State
  const timeRef = useRef<number>(0);
  const swirlsRef = useRef<Swirl[]>([]);
  const notesRef = useRef<MusicalNote[]>([]);
  const beamsRef = useRef<EnergyBeam[]>([]);
  const lastStrumTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // Guitar State
  const guitarStringsRef = useRef<GuitarString[]>([
    { y: 0.15, vibration: 0 },
    { y: 0.30, vibration: 0 },
    { y: 0.45, vibration: 0 },
    { y: 0.60, vibration: 0 },
    { y: 0.75, vibration: 0 },
    { y: 0.90, vibration: 0 },
  ]);
  const chordIndexRef = useRef<number>(0);
  const currentChordRef = useRef<string>('');

  // Summoning Logic Refs
  const spawnProgressFrameCounter = useRef<number>(0);
  const hasSpawnToggledRef = useRef<boolean>(false);

  const latestLandmarksRef = useRef<HandLandmark[][] | null>(null);
  const prevFingerPosRef = useRef<Map<string, Point>>(new Map());
  const openHoldStartRef = useRef<number | null>(null);
  const openTriggeredRef = useRef(false);

  const [isLoaded, setIsLoaded] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'initializing' | 'active' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guitar active state
  const [isGuitarActive, setIsGuitarActive] = useState(false);

  // Melody preset index
  const [melodyIndex, setMelodyIndex] = useState<number>(0);

  // SoundFont guitar (runtime loaded)
  const soundfontGuitarRef = useRef<Awaited<ReturnType<typeof loadSoundfontGuitar>> | null>(null);
  const soundfontLoadStartedRef = useRef(false);

  // Mode switch gesture tracking
  const pinchStartTimeRef = useRef<number | null>(null);
  const pinchHasToggledRef = useRef<boolean>(false);
  const pinchProgressRef = useRef<number>(0);
  const toggleFlashUntilRef = useRef<number>(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!isGuitarActive) return;
    if (soundfontGuitarRef.current || soundfontLoadStartedRef.current) return;
    soundfontLoadStartedRef.current = true;
    void loadSoundfontGuitar()
      .then(inst => {
        soundfontGuitarRef.current = inst;
      })
      .catch(() => {
        soundfontLoadStartedRef.current = false;
      });
  }, [isGuitarActive]);

  const playFingerpickedChord = (notes: number[]) => {
    const sortedNotes = [...notes].sort((a, b) => a - b);
    const pattern = sortedNotes.length >= 4 ? PICK_PATTERN_EXT : PICK_PATTERN_TRIAD;
    const now = initAudio().currentTime;

    if (soundfontGuitarRef.current) {
      pattern.forEach((noteIndex, step) => {
        const freq = sortedNotes[Math.min(noteIndex, sortedNotes.length - 1)];
        const when = now + (step * PICK_STEP_MS) / 1000;
        soundfontGuitarRef.current?.play(frequencyToMidi(freq), when, {
          duration: PICK_SUSTAIN_SEC,
          gain: 0.7,
        });
      });
      return;
    }

    if (!soundfontLoadStartedRef.current) {
      soundfontLoadStartedRef.current = true;
      void loadSoundfontGuitar()
        .then(inst => {
          soundfontGuitarRef.current = inst;
        })
        .catch(() => {
          soundfontLoadStartedRef.current = false;
        });
    }

    pattern.forEach((noteIndex, step) => {
      const freq = sortedNotes[Math.min(noteIndex, sortedNotes.length - 1)];
      setTimeout(() => playGuitarNote(freq, 0.08), step * PICK_STEP_MS);
    });
  };

  // Initialize Three.js Scene
  useEffect(() => {
    if (!webglCanvasRef.current) return;

    const renderer = new THREE.WebGLRenderer({
      canvas: webglCanvasRef.current,
      alpha: false,
      antialias: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    cameraRef.current = camera;

    let isEffectValid = true;

    const initMaterial = (texture: THREE.Texture) => {
      if (!isMountedRef.current || !isEffectValid) return;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const imageAspect = texture.image.width / texture.image.height;
      const screenAspect = window.innerWidth / window.innerHeight;

      let planeWidth = 2;
      let planeHeight = 2;

      if (imageAspect > screenAspect) {
        planeWidth = 2;
        planeHeight = 2 / imageAspect * screenAspect;
      } else {
        planeHeight = 2;
        planeWidth = 2 * imageAspect / screenAspect;
      }

      const initialSwirls = new Array(MAX_SWIRLS * 3).fill(0);
      const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
      const material = new THREE.ShaderMaterial({
        uniforms: {
          tDiffuse: { value: texture },
          uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
          uTime: { value: 0.0 },
          uSwirls: { value: initialSwirls }
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        transparent: false
      });
      materialRef.current = material;
      scene.clear();
      scene.add(new THREE.Mesh(geometry, material));
      setIsLoaded(true);
    };

    const createFallbackTexture = (): THREE.Texture => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, 1024);
        grad.addColorStop(0, '#2a1810');
        grad.addColorStop(0.5, '#4a3020');
        grad.addColorStop(1, '#1a1008');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 300; i++) {
          const isBlue = Math.random() > 0.7;
          ctx.fillStyle = isBlue
            ? `rgba(70, 100, 150, ${Math.random() * 0.6})`
            : `rgba(212, 168, 75, ${Math.random() * 0.8})`;
          const x = Math.random() * 1024;
          const y = Math.random() * 1024;
          const s = Math.random() * 8 + 2;
          ctx.beginPath();
          ctx.arc(x, y, s, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return new THREE.CanvasTexture(canvas);
    };

    const loader = new THREE.TextureLoader();
    let textureLoadHandled = false;
    const handleSuccess = (texture: THREE.Texture) => {
      if (textureLoadHandled) return;
      textureLoadHandled = true;
      initMaterial(texture);
    };
    const handleError = () => {
      if (textureLoadHandled) return;
      textureLoadHandled = true;
      initMaterial(createFallbackTexture());
    };
    try {
      loader.load(CURRENT_THEME.backgroundUrl, handleSuccess, undefined, handleError);
    } catch {
      handleError();
    }
    const timeoutId = setTimeout(() => {
      if (!textureLoadHandled) handleError();
    }, 10000);

    const handleResize = () => {
      if (rendererRef.current && materialRef.current) {
        const w = window.innerWidth;
        const h = window.innerHeight;
        rendererRef.current.setSize(w, h);
        materialRef.current.uniforms.uResolution.value.set(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isEffectValid = false;
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      materialRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  const onResults = useCallback((results: MPResults) => {
    latestLandmarksRef.current = results.multiHandLandmarks;
  }, []);

  // Draw full tilted guitar with neck and headstock
  const drawGuitar = (
    ctx: CanvasRenderingContext2D,
    centerX: number,
    centerY: number,
    scale: number
  ) => {
    ctx.save();

    // Move to center and rotate
    ctx.translate(centerX, centerY);
    ctx.rotate(GUITAR_ANGLE);

    const color = CURRENT_THEME.colors.primary;

    // Dimensions (in local coordinates, centered at 0,0)
    const bodyW = scale * 0.9;
    const bodyH = scale * 1.1;
    const neckW = scale * 0.18;
    const neckH = scale * 0.8;
    const headW = scale * 0.22;
    const headH = scale * 0.25;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;

    // --- GUITAR BODY (figure-8 shape) ---
    ctx.beginPath();
    // Upper bout (smaller)
    ctx.moveTo(-bodyW * 0.35, 0);
    ctx.bezierCurveTo(-bodyW * 0.45, -bodyH * 0.25, -bodyW * 0.25, -bodyH * 0.4, 0, -bodyH * 0.35);
    ctx.bezierCurveTo(bodyW * 0.25, -bodyH * 0.4, bodyW * 0.45, -bodyH * 0.25, bodyW * 0.35, 0);
    // Lower bout (larger)
    ctx.bezierCurveTo(bodyW * 0.5, bodyH * 0.3, bodyW * 0.35, bodyH * 0.5, 0, bodyH * 0.45);
    ctx.bezierCurveTo(-bodyW * 0.35, bodyH * 0.5, -bodyW * 0.5, bodyH * 0.3, -bodyW * 0.35, 0);
    ctx.stroke();

    // Sound hole
    ctx.beginPath();
    ctx.arc(0, -bodyH * 0.05, bodyW * 0.18, 0, Math.PI * 2);
    ctx.strokeStyle = color + '60';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Sound hole inner ring
    ctx.beginPath();
    ctx.arc(0, -bodyH * 0.05, bodyW * 0.12, 0, Math.PI * 2);
    ctx.strokeStyle = color + '40';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Bridge
    ctx.strokeStyle = color + '80';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-bodyW * 0.2, bodyH * 0.25);
    ctx.lineTo(bodyW * 0.2, bodyH * 0.25);
    ctx.stroke();

    // --- NECK ---
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    // Left edge
    ctx.moveTo(-neckW * 0.5, -bodyH * 0.35);
    ctx.lineTo(-neckW * 0.45, -bodyH * 0.35 - neckH);
    // Right edge
    ctx.moveTo(neckW * 0.5, -bodyH * 0.35);
    ctx.lineTo(neckW * 0.45, -bodyH * 0.35 - neckH);
    ctx.stroke();

    // Frets (5 frets)
    ctx.strokeStyle = color + '50';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 5; i++) {
      const fretY = -bodyH * 0.35 - (neckH * i / 6);
      ctx.beginPath();
      const fretW = neckW * (0.5 - i * 0.01);
      ctx.moveTo(-fretW, fretY);
      ctx.lineTo(fretW, fretY);
      ctx.stroke();
    }

    // --- HEADSTOCK ---
    const headY = -bodyH * 0.35 - neckH;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-neckW * 0.45, headY);
    ctx.lineTo(-headW * 0.5, headY - headH * 0.3);
    ctx.lineTo(-headW * 0.45, headY - headH);
    ctx.lineTo(headW * 0.45, headY - headH);
    ctx.lineTo(headW * 0.5, headY - headH * 0.3);
    ctx.lineTo(neckW * 0.45, headY);
    ctx.stroke();

    // Tuning pegs (6 pegs, 3 on each side)
    ctx.fillStyle = color + '80';
    for (let i = 0; i < 3; i++) {
      const pegY = headY - headH * 0.3 - (headH * 0.5 * i / 2);
      // Left side
      ctx.beginPath();
      ctx.arc(-headW * 0.35, pegY, 4, 0, Math.PI * 2);
      ctx.fill();
      // Right side
      ctx.beginPath();
      ctx.arc(headW * 0.35, pegY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Calculate string bounds in screen coordinates (for hit detection)
    // Strings run from headstock to bridge
    const cos = Math.cos(GUITAR_ANGLE);
    const sin = Math.sin(GUITAR_ANGLE);

    // String start (at headstock) and end (at bridge) in local coords
    const stringStartLocal = { x: 0, y: -bodyH * 0.35 - neckH + headH * 0.1 };
    const stringEndLocal = { x: 0, y: bodyH * 0.25 };

    // Transform to screen coords
    const transformPoint = (p: { x: number; y: number }) => ({
      x: centerX + p.x * cos - p.y * sin,
      y: centerY + p.x * sin + p.y * cos
    });

    const stringStart = transformPoint(stringStartLocal);
    const stringEnd = transformPoint(stringEndLocal);

    // String spread (perpendicular to string direction)
    const stringSpread = neckW * 0.4;
    const perpX = -sin;
    const perpY = cos;

    return {
      startX: stringStart.x,
      startY: stringStart.y,
      endX: stringEnd.x,
      endY: stringEnd.y,
      perpX: perpX * stringSpread,
      perpY: perpY * stringSpread,
      scale
    };
  };

  // Draw guitar strings along the tilted guitar
  const drawGuitarStrings = (
    ctx: CanvasRenderingContext2D,
    bounds: {
      startX: number; startY: number;
      endX: number; endY: number;
      perpX: number; perpY: number;
      scale: number;
    }
  ) => {
    const { startX, startY, endX, endY, perpX, perpY } = bounds;
    const time = Date.now() / 40;
    const numStrings = 6;

    // Calculate perpendicular offset direction
    const dx = endX - startX;
    const dy = endY - startY;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;  // Perpendicular normal
    const ny = dx / len;

    guitarStringsRef.current.forEach((stringData, i) => {
      // String offset from center (spread across width)
      const offset = (i - (numStrings - 1) / 2) / ((numStrings - 1) / 2);
      const offsetX = perpX * offset;
      const offsetY = perpY * offset;

      const sStartX = startX + offsetX;
      const sStartY = startY + offsetY;
      const sEndX = endX + offsetX;
      const sEndY = endY + offsetY;

      const vibAmp = stringData.vibration;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Draw string with vibration
      ctx.beginPath();
      ctx.moveTo(sStartX, sStartY);

      if (vibAmp > 0.5) {
        const segments = 25;
        for (let s = 0; s <= segments; s++) {
          const t = s / segments;
          const baseX = sStartX + (sEndX - sStartX) * t;
          const baseY = sStartY + (sEndY - sStartY) * t;
          const wave = Math.sin(t * Math.PI) * Math.sin(time + t * 8) * vibAmp;
          ctx.lineTo(baseX + nx * wave, baseY + ny * wave);
        }
      } else {
        ctx.lineTo(sEndX, sEndY);
      }

      ctx.strokeStyle = CURRENT_THEME.colors.secondary;
      ctx.lineWidth = 1.5 + vibAmp * 0.1;
      ctx.shadowBlur = 6 + vibAmp;
      ctx.shadowColor = CURRENT_THEME.colors.secondary;
      ctx.stroke();

      // White core
      ctx.beginPath();
      ctx.moveTo(sStartX, sStartY);
      if (vibAmp > 0.5) {
        const segments = 25;
        for (let s = 0; s <= segments; s++) {
          const t = s / segments;
          const baseX = sStartX + (sEndX - sStartX) * t;
          const baseY = sStartY + (sEndY - sStartY) * t;
          const wave = Math.sin(t * Math.PI) * Math.sin(time + t * 8) * vibAmp;
          ctx.lineTo(baseX + nx * wave, baseY + ny * wave);
        }
      } else {
        ctx.lineTo(sEndX, sEndY);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 0.5;
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.6;
      ctx.stroke();

      ctx.restore();
    });

    // Return string lines for hit detection
    const stringLines: Array<{ p1: Point; p2: Point; index: number }> = [];
    guitarStringsRef.current.forEach((_, i) => {
      const offset = (i - (numStrings - 1) / 2) / ((numStrings - 1) / 2);
      const offsetX = perpX * offset;
      const offsetY = perpY * offset;
      stringLines.push({
        p1: { x: startX + offsetX, y: startY + offsetY },
        p2: { x: endX + offsetX, y: endY + offsetY },
        index: i
      });
    });
    return stringLines;
  };

  const drawProgressCircle = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    progress: number,
    color: string,
    radius: number = 30
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.shadowBlur = 10;
    ctx.shadowColor = color;

    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * progress));
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  };

  const drawHandSkeleton = (
    ctx: CanvasRenderingContext2D,
    landmarks: HandLandmark[],
    w: number,
    h: number,
    options?: { color?: string; alpha?: number; glow?: number }
  ) => {
    ctx.save();
    const color = options?.color ?? HAND_NEON_COLOR;
    const alpha = options?.alpha ?? 0.8;
    const glow = options?.glow ?? 15;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = glow;
    ctx.shadowColor = color;
    ctx.lineCap = 'round';
    ctx.globalAlpha = alpha;

    HAND_CONNECTIONS.forEach(([start, end]) => {
      const p1 = landmarks[start];
      const p2 = landmarks[end];
      if (!p1 || !p2) return;
      ctx.beginPath();
      ctx.moveTo(p1.x * w, p1.y * h);
      ctx.lineTo(p2.x * w, p2.y * h);
      ctx.stroke();
    });

    ctx.fillStyle = color;
    landmarks.forEach((lm, idx) => {
      const isFingerTip = FINGERTIP_INDICES.includes(idx);
      const radius = isFingerTip ? 5 : 3;
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  };

  const resetMelodyProgress = () => {
    chordIndexRef.current = 0;
    currentChordRef.current = '';
  };

  const getNearestThemePoints = (x: number, y: number, count: number) => {
    return CURRENT_THEME.points
      .map(point => {
        const dx = point.x - x;
        const dy = point.y - y;
        return { point, dist: Math.sqrt(dx * dx + dy * dy) };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, Math.max(1, count));
  };

  // --- RENDER LOOP ---
  useEffect(() => {
    if (!isLoaded) return;
    let animationFrameId: number;
    let active = true;

    const render = () => {
      if (!active) return;
      timeRef.current += 0.01;

      // Update Swirls
      for (let i = swirlsRef.current.length - 1; i >= 0; i--) {
        const swirl = swirlsRef.current[i];
        swirl.intensity -= swirl.decaySpeed;
        if (swirl.intensity <= 0) swirlsRef.current.splice(i, 1);
      }

      // Decay string vibrations
      guitarStringsRef.current.forEach(s => {
        s.vibration = Math.max(0, s.vibration * VIBRATION_DECAY);
      });

      // WebGL Render
      if (rendererRef.current && sceneRef.current && cameraRef.current && materialRef.current) {
        materialRef.current.uniforms.uTime.value = timeRef.current;
        const swirlUniforms = new Float32Array(MAX_SWIRLS * 3);
        for (let i = 0; i < MAX_SWIRLS; i++) {
          if (i < swirlsRef.current.length) {
            swirlUniforms[i * 3 + 0] = swirlsRef.current[i].x;
            swirlUniforms[i * 3 + 1] = swirlsRef.current[i].y;
            swirlUniforms[i * 3 + 2] = swirlsRef.current[i].intensity;
          } else {
            swirlUniforms[i * 3 + 2] = 0.0;
          }
        }
        materialRef.current.uniforms.uSwirls.value = swirlUniforms;
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      // Canvas Overlay
      const overlayCanvas = overlayCanvasRef.current;
      const overlayCtx = overlayCanvas?.getContext('2d');
      const landmarksData = latestLandmarksRef.current;

      if (overlayCanvas && overlayCtx) {
        const overlayContainer = overlayCanvas.parentElement;
        if (overlayContainer && (overlayCanvas.width !== overlayContainer.clientWidth || overlayCanvas.height !== overlayContainer.clientHeight)) {
          overlayCanvas.width = overlayContainer.clientWidth;
          overlayCanvas.height = overlayContainer.clientHeight;
        }
        const overlayW = overlayCanvas.width;
        const overlayH = overlayCanvas.height;

        overlayCtx.clearRect(0, 0, overlayW, overlayH);

        // Hand skeleton overlay (with pinch-hold feedback)
        const nowMs = Date.now();
        const flashActive = nowMs < toggleFlashUntilRef.current;
        const progress = pinchProgressRef.current;
        const baseAlpha = 0.55 + progress * 0.35;
        const color =
          flashActive ? '#ffffff' : progress > 0 ? CURRENT_THEME.colors.primary : HAND_NEON_COLOR;
        const glow = flashActive ? 24 : 14 + progress * 10;

        if (landmarksData) {
          landmarksData.forEach(landmarks => {
            drawHandSkeleton(overlayCtx, landmarks, overlayW, overlayH, {
              color,
              alpha: baseAlpha,
              glow,
            });
          });
        }

        if (landmarksData && landmarksData.length >= 1 && onExit) {
          const isOpen = isOpenPalm(landmarksData[0]);
          const now = performance.now();
          if (isOpen) {
            if (openHoldStartRef.current === null) {
              openHoldStartRef.current = now;
            } else if (now - openHoldStartRef.current > 2000 && !openTriggeredRef.current) {
              openTriggeredRef.current = true;
              onExit();
            }
          } else {
            openHoldStartRef.current = null;
            openTriggeredRef.current = false;
          }
        }

        let detectedP1: Point | null = null;
        let detectedP2: Point | null = null;
        let isSpawning = false;

        // Hand detection for summoning
        if (landmarksData && landmarksData.length >= 2) {
          const handA = landmarksData[0];
          const handB = landmarksData[1];
          const idxA = handA[8];
          const idxB = handB[8];

          if (idxA && idxB) {
            detectedP1 = { x: idxA.x * overlayW, y: idxA.y * overlayH };
            detectedP2 = { x: idxB.x * overlayW, y: idxB.y * overlayH };

            const dx = idxA.x - idxB.x;
            const dy = idxA.y - idxB.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < SPAWN_DISTANCE_THRESHOLD) {
              if (!hasSpawnToggledRef.current) {
                spawnProgressFrameCounter.current += 1;
                isSpawning = true;

                if (spawnProgressFrameCounter.current >= SPAWN_TIME_REQUIRED) {
                  setIsGuitarActive(prev => !prev);
                  hasSpawnToggledRef.current = true;
                  spawnProgressFrameCounter.current = 0;
                  resetMelodyProgress();
                }
              }
            } else {
              spawnProgressFrameCounter.current = Math.max(0, spawnProgressFrameCounter.current - 5);
              if (dist > SPAWN_DISTANCE_THRESHOLD * 1.5) {
                hasSpawnToggledRef.current = false;
              }
            }
          }
        } else {
          spawnProgressFrameCounter.current = 0;
        }

        // Draw spawn progress
        if (isSpawning && detectedP1 && detectedP2) {
          const midX = (detectedP1.x + detectedP2.x) / 2;
          const midY = (detectedP1.y + detectedP2.y) / 2;
          const progress = spawnProgressFrameCounter.current / SPAWN_TIME_REQUIRED;
          const color = isGuitarActive ? CURRENT_THEME.colors.secondary : CURRENT_THEME.colors.primary;
          drawProgressCircle(overlayCtx, midX, midY, progress, color, 40);

          overlayCtx.font = "12px serif";
          overlayCtx.fillStyle = "rgba(255,255,255,0.8)";
          overlayCtx.textAlign = "center";
          overlayCtx.fillText(isGuitarActive ? "CLOSING..." : "SUMMONING...", midX, midY + 55);
        }

        // Mode switch gesture detection: pinch (thumb+index) hold >= 2s
        if (isGuitarActive && landmarksData && landmarksData.length >= 1) {
          // Check first hand for gestures
          const hand = landmarksData[0];
          if (hand && hand[0] && hand[4] && hand[8] && hand[9]) {
            const dist2D = (a: HandLandmark, b: HandLandmark) => {
              const dx = a.x - b.x;
              const dy = a.y - b.y;
              return Math.sqrt(dx * dx + dy * dy);
            };

            const wrist = hand[0];
            const thumbTip = hand[4];
            const indexTip = hand[8];
            const middleMcp = hand[9];

            // Normalize by palm size to be robust across distance-to-camera.
            const palmSize = Math.max(0.001, dist2D(wrist, middleMcp));
            const pinchDist = dist2D(thumbTip, indexTip) / palmSize;
            const isPinched = pinchDist < 0.55;
            const now = Date.now();

            if (isPinched) {
              if (pinchStartTimeRef.current == null) pinchStartTimeRef.current = now;
              const heldMs = now - pinchStartTimeRef.current;
              pinchProgressRef.current = Math.max(0, Math.min(1, heldMs / PINCH_HOLD_MS));
              if (!pinchHasToggledRef.current && heldMs >= 2000) {
                setMelodyIndex(prev => (prev + 1) % MELODIES.length);
                resetMelodyProgress();
                pinchHasToggledRef.current = true;
                toggleFlashUntilRef.current = now + 650;
              }
            } else {
              pinchStartTimeRef.current = null;
              pinchHasToggledRef.current = false;
              pinchProgressRef.current = 0;
            }
          } else {
            pinchStartTimeRef.current = null;
            pinchHasToggledRef.current = false;
            pinchProgressRef.current = 0;
          }
        } else {
          pinchStartTimeRef.current = null;
          pinchHasToggledRef.current = false;
          pinchProgressRef.current = 0;
        }

        // Guitar rendering and interaction
        if (isGuitarActive) {
          const melody = MELODIES[melodyIndex] ?? MELODIES[0];

          // Guitar position: center-bottom, tilted
          const guitarScale = Math.min(overlayW, overlayH) * 0.34;
          const guitarX = overlayW * 0.5;
          const guitarY = overlayH * 0.60;

          // Draw guitar and get string bounds
          const stringBounds = drawGuitar(overlayCtx, guitarX, guitarY, guitarScale);
          const stringLines = drawGuitarStrings(overlayCtx, stringBounds);

          // Draw mode indicator and current chord/note
          overlayCtx.save();
          overlayCtx.font = "bold 16px sans-serif";
          overlayCtx.fillStyle = CURRENT_THEME.colors.primary;
          overlayCtx.shadowBlur = 8;
          overlayCtx.shadowColor = CURRENT_THEME.colors.primary;
          overlayCtx.textAlign = "center";
          overlayCtx.fillText(melody.name, guitarX, overlayH * 0.92);

          if (currentChordRef.current) {
            overlayCtx.font = "bold 28px serif";
            overlayCtx.fillStyle = CURRENT_THEME.colors.primary;
            overlayCtx.fillText(currentChordRef.current.replace(/\d/g, ''), guitarX, overlayH * 0.88);
          }

          overlayCtx.font = "10px sans-serif";
          overlayCtx.fillStyle = "rgba(255,255,255,0.4)";
          overlayCtx.fillText("🤏 Hold 2s to Switch Melody", guitarX, overlayH * 0.96);
          overlayCtx.restore();

          // Draw Beams
          beamsRef.current = beamsRef.current.filter(b => b.progress < 1.0);
          beamsRef.current.forEach(beam => {
            beam.progress += 0.05;
            const x = beam.startX + (beam.endX - beam.startX) * beam.progress;
            const y = beam.startY + (beam.endY - beam.startY) * beam.progress;
            const tailX = beam.startX + (beam.endX - beam.startX) * Math.max(0, beam.progress - 0.2);
            const tailY = beam.startY + (beam.endY - beam.startY) * Math.max(0, beam.progress - 0.2);

            overlayCtx.save();
            overlayCtx.globalCompositeOperation = 'lighter';
            overlayCtx.beginPath();
            overlayCtx.moveTo(tailX, tailY);
            overlayCtx.lineTo(x, y);
            overlayCtx.strokeStyle = beam.color;
            overlayCtx.lineWidth = 4 * (1 - beam.progress);
            overlayCtx.lineCap = 'round';
            overlayCtx.shadowBlur = 10;
            overlayCtx.shadowColor = beam.color;
            overlayCtx.stroke();

            overlayCtx.fillStyle = '#fff';
            overlayCtx.beginPath();
            overlayCtx.arc(x, y, 3, 0, Math.PI * 2);
            overlayCtx.fill();
            overlayCtx.restore();
          });

          // Strum detection
          if (landmarksData) {
            const now = Date.now();
            const currentFingerPos = new Map<string, Point>();

            landmarksData.forEach((landmarks, handIndex) => {
              [8, 12, 16, 20].forEach(tipIdx => {
                const id = `h${handIndex}-f${tipIdx}`;
                if (!landmarks[tipIdx]) return;
                const pOverlay = { x: landmarks[tipIdx].x * overlayW, y: landmarks[tipIdx].y * overlayH };
                currentFingerPos.set(id, pOverlay);
                const prevOverlay = prevFingerPosRef.current.get(id);

                if (prevOverlay && now - lastStrumTimeRef.current > STRUM_COOLDOWN) {
                  // Check if finger crossed any string
                  for (const line of stringLines) {
                    if (segmentsIntersect(line.p1, line.p2, prevOverlay, pOverlay)) {
                      // Strum detected!
                      const melody = MELODIES[melodyIndex] ?? MELODIES[0];
                      const chord = melody.chords[chordIndexRef.current % melody.chords.length];
                      currentChordRef.current = chord.name;
                      playFingerpickedChord(chord.notes);
                      chordIndexRef.current = (chordIndexRef.current + 1) % melody.chords.length;

                      // Vibrate strings
                      guitarStringsRef.current.forEach((s, idx) => {
                        s.vibration = 15 - Math.abs(idx - line.index) * 2;
                      });

                      // Spawn note particles
                      for (let n = 0; n < 3; n++) {
                        notesRef.current.push({
                          id: Math.random(),
                          x: pOverlay.x + (Math.random() - 0.5) * 40,
                          y: pOverlay.y,
                          vx: (Math.random() - 0.5) * 3,
                          vy: -2 - Math.random() * 2,
                          symbol: NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)],
                          life: 1.0,
                          opacity: 1.0,
                          color: CURRENT_THEME.colors.note
                        });
                      }

                      const fingerX = landmarks[tipIdx].x;
                      const fingerY = landmarks[tipIdx].y;
                      const nearest = getNearestThemePoints(fingerX, fingerY, 4);
                      const closestPoint = nearest[0].point;

                      beamsRef.current.push({
                        startX: pOverlay.x,
                        startY: pOverlay.y,
                        endX: closestPoint.x * overlayW,
                        endY: closestPoint.y * overlayH,
                        progress: 0,
                        color: CURRENT_THEME.colors.beam
                      });

                      // Inject multiple swirls for stronger feedback
                      nearest.forEach((entry, idx) => {
                        const base = CURRENT_THEME.swirlIntensityMap[entry.point.type] || 1.0;
                        const falloff = 1 - idx * 0.18;
                        swirlsRef.current.push({
                          x: entry.point.x,
                          y: 1.0 - entry.point.y,
                          intensity: base * Math.max(0.45, falloff),
                          decaySpeed: 0.005
                        });
                      });
                      while (swirlsRef.current.length > MAX_SWIRLS) swirlsRef.current.shift();

                      lastStrumTimeRef.current = now;
                      break; // Only trigger once per strum
                    }
                  }
                }
              });
            });
            prevFingerPosRef.current = currentFingerPos;
          }
        }

        // Render Notes
        notesRef.current = notesRef.current.filter(n => n.life > 0);
        notesRef.current.forEach(note => {
          note.x += note.vx;
          note.y += note.vy;
          note.life -= 0.015;
          note.opacity = Math.max(0, note.life);
          overlayCtx.save();
          overlayCtx.font = `${20 + (1 - note.life) * 10}px serif`;
          overlayCtx.shadowColor = note.color;
          overlayCtx.shadowBlur = 10;
          overlayCtx.fillStyle = note.color.replace(/[\d.]+\)$/g, `${note.opacity})`);
          overlayCtx.fillText(note.symbol, note.x, note.y);
          overlayCtx.restore();
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => {
      active = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [isLoaded, isGuitarActive, melodyIndex]);

  const startCamera = async () => {
    if (cameraStatus === 'initializing' || cameraStatus === 'active') return;
    setCameraStatus('initializing');
    setErrorMessage(null);

    try {
      if (!videoRef.current || typeof window.Hands === 'undefined') throw new Error("Initialization failed.");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      if (!isMountedRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await new Promise<void>((resolve) => {
        if (videoRef.current) videoRef.current.onloadedmetadata = () => videoRef.current?.play().then(resolve);
      });
      const hands = new window.Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      hands.onResults(onResults);
      setCameraStatus('active');
      const detectLoop = async () => {
        if (!isMountedRef.current) return;
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) {
          requestAnimationFrame(detectLoop);
          return;
        }
        try {
          await hands.send({ image: videoRef.current });
        } catch {}
        requestAnimationFrame(detectLoop);
      };
      detectLoop();
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setErrorMessage(err.message || "Failed to access camera.");
      setCameraStatus('error');
    }
  };

  useEffect(() => {
    if (isLoaded) startCamera();
  }, [isLoaded]);

  const handleRestart = () => window.location.reload();

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-sans select-none">
      {!isLoaded && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black text-amber-200 animate-pulse font-serif">
          <h2 className="text-2xl tracking-widest">Loading Tree of Life...</h2>
        </div>
      )}

      <canvas ref={webglCanvasRef} id="bg_canvas_webgl" className="absolute inset-0 w-full h-full z-0 block" />
      <canvas ref={canvasRef} id="output_canvas" className="absolute inset-0 w-full h-full z-10 block pointer-events-none" />

      <div className="absolute top-6 left-8 pointer-events-none z-20 opacity-40 mix-blend-screen">
        <h1 className="text-amber-100 font-serif text-2xl tracking-[0.2em] uppercase">{CURRENT_THEME.name}</h1>
        <p className="text-amber-200/50 text-xs mt-1 tracking-wider">Gustav Klimt</p>
      </div>

      <div className="absolute top-6 right-6 z-30 flex flex-col items-end gap-2 group">
        <div
          className={`relative w-72 h-52 rounded-2xl overflow-hidden shadow-2xl transition-all duration-700 backdrop-blur-sm bg-black/20 ${
            isGuitarActive
              ? 'shadow-[0_0_40px_rgba(212,168,75,0.3)] ring-1'
              : 'shadow-[0_0_40px_rgba(232,168,73,0.2)] ring-1'
          }`}
          style={{ borderColor: isGuitarActive ? CURRENT_THEME.colors.primary : CURRENT_THEME.colors.secondary }}
        >
          <video ref={videoRef} className="absolute inset-0 w-full h-full object-fill opacity-90 transition-opacity duration-500" playsInline muted style={{ transform: 'scaleX(-1)' }} />
          <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'scaleX(-1)' }} />
          <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none transition-all duration-500 transform translate-y-1 group-hover:translate-y-0 opacity-80 group-hover:opacity-100">
            {!isGuitarActive ? (
              <span className="px-4 py-1.5 backdrop-blur-md text-[10px] font-bold tracking-widest uppercase rounded-full shadow-lg border flex items-center gap-2"
                style={{ backgroundColor: `${CURRENT_THEME.colors.secondary}CC`, color: '#000', borderColor: CURRENT_THEME.colors.secondary }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Hold Hands Close to Summon
              </span>
            ) : (
              <span className="px-4 py-1.5 backdrop-blur-md text-[10px] font-bold tracking-widest uppercase rounded-full shadow-lg border flex items-center gap-2"
                style={{ backgroundColor: `${CURRENT_THEME.colors.primary}CC`, color: '#000', borderColor: CURRENT_THEME.colors.primary }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_white]" />
                Guitar Ready
              </span>
            )}
          </div>
        </div>
        <div className="text-amber-200/30 text-[9px] tracking-widest uppercase pr-3 font-medium group-hover:text-amber-200/50 transition-colors">Camera Feed</div>
      </div>

      <div className="absolute bottom-10 left-0 right-0 pointer-events-none z-20 flex justify-center px-4">
        <div className="bg-gradient-to-t from-black/80 to-black/40 backdrop-blur-md border-t border-amber-500/20 px-10 py-5 rounded-2xl text-center transform transition-all duration-500 hover:bg-black/90 shadow-2xl max-w-lg">
          <h3 className="text-amber-100/90 font-serif text-xl tracking-wide mb-2 italic">The Golden Guitar</h3>
          <p className="text-white/70 text-sm font-light leading-relaxed">
            {!isGuitarActive && <span className="block mb-1" style={{ color: CURRENT_THEME.colors.secondary }}>Hold fingertips close together to summon the guitar.</span>}
            {isGuitarActive && (
              <>
                <span className="block mb-1">Strum the strings to play the current progression.</span>
                <span className="opacity-60 text-xs">Each strum plays a fingerpicked phrase. 🤏 hold 2s switches melody. Hold hands close to dismiss.</span>
              </>
            )}
          </p>
        </div>
      </div>

      {(cameraStatus === 'initializing' || cameraStatus === 'error') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-500">
          {cameraStatus === 'initializing' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-amber-200 font-serif tracking-widest text-sm animate-pulse">Accessing Vision...</div>
            </div>
          )}
          {cameraStatus === 'error' && (
            <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
              <div className="text-red-300/90 font-serif text-xl mb-2">Camera Access Required</div>
              <div className="text-white/60 text-sm mb-4 leading-relaxed">{errorMessage}</div>
              <button onClick={startCamera} className="px-6 py-2 bg-amber-700/50 hover:bg-amber-600/50 text-amber-100 border border-amber-500/30 rounded-full transition-all uppercase text-xs tracking-widest">Try Again</button>
            </div>
          )}
        </div>
      )}

      <button onClick={handleRestart} className="absolute bottom-8 right-8 z-30 text-white/30 hover:text-white/80 transition-all p-3 rounded-full hover:bg-white/10" title="Restart Experience">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><path d="M16 21h5v-5" /></svg>
      </button>
    </div>
  );
};
