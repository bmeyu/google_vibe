
import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { playPluckSound } from '../utils/audioUtils';
import { segmentsIntersect } from '../utils/geoUtils';
import { Point, HandLandmark, MusicalNote } from '../types';
import { DEFAULT_THEME } from '../data/themes';

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
const CURRENT_THEME = DEFAULT_THEME;
const PLUCK_COOLDOWN = 150; // ms

// --- INTERACTION CONSTANTS ---
const SPAWN_DISTANCE_THRESHOLD = 0.08; // Hands must be very close (8% of screen) to spawn/despawn
const SPAWN_TIME_REQUIRED = 60; // Frames (~1s) to spawn/despawn
const LOCK_DISTANCE_THRESHOLD = 0.55; // Must be VERY wide (55%) to lock
const UNLOCK_DISTANCE_THRESHOLD = 0.25; // Closer to unlock
const LOCK_TIME_REQUIRED = 30; // Frames (~0.5s)
const STRING_SMOOTHING = 0.2; 
const STRING_GAP = 25; 
const VIBRATION_DECAY = 0.85; // Faster decay for tighter feel
const MAX_SWIRLS = 16;
const NOTE_SYMBOLS = ['✦', '★', '✶', '✴', '✹', '✨'];

// Helper: Linear Interpolation
const lerp = (start: number, end: number, t: number) => {
  return start * (1 - t) + end * t;
};

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

interface LockedStringState {
  p1: Point;
  p2: Point;
}

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

export const StarryNightCanvas: React.FC = () => {
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
  const stringVibrationRef = useRef<number[]>([0, 0, 0]);
  const lastPluckTimeRef = useRef<number>(0);
  const isMountedRef = useRef(true);
  
  // Logic Refs
  const currentStringCoordsRef = useRef<{p1: Point, p2: Point} | null>(null);
  const lockedStringDataRef = useRef<LockedStringState | null>(null);
  
  // --- NEW LOGIC REFS ---
  const spawnProgressFrameCounter = useRef<number>(0);
  const lockProgressFrameCounter = useRef<number>(0);
  const hasSpawnToggledRef = useRef<boolean>(false); // Prevent multiple toggles in one hold

  const latestLandmarksRef = useRef<HandLandmark[][] | null>(null);
  const prevFingerPosRef = useRef<Map<string, Point>>(new Map()); 
  
  const [isLoaded, setIsLoaded] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'initializing' | 'active' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Interaction States
  const [isStringsActive, setIsStringsActive] = useState(false);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Initialize Three.js Scene (unchanged)
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

    // Track if this effect instance is still valid
    let isEffectValid = true;

    const initMaterial = (texture: THREE.Texture) => {
        if (!isMountedRef.current || !isEffectValid) return;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        // Always create new material for this effect instance
        const initialSwirls = new Array(MAX_SWIRLS * 3).fill(0);
        const geometry = new THREE.PlaneGeometry(2, 2);
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
            grad.addColorStop(0, '#020514');
            grad.addColorStop(0.5, '#102240');
            grad.addColorStop(1, '#080f26');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 1024, 1024);
            for(let i=0; i<400; i++) {
                ctx.fillStyle = `rgba(255, 255, 180, ${Math.random() * 0.8})`;
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                const s = Math.random() * 3;
                ctx.beginPath();
                ctx.arc(x,y,s,0,Math.PI*2);
                ctx.fill();
            }
        }
        return new THREE.CanvasTexture(canvas);
    };

    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");
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
    } catch (e) {
        handleError();
    }
    const timeoutId = setTimeout(() => { if (!textureLoadHandled) handleError(); }, 4000); 
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
      // Invalidate this effect instance to prevent stale texture callbacks
      isEffectValid = false;
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      // Reset refs on cleanup to handle component switching
      materialRef.current = null;
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
    };
  }, []);

  const onResults = useCallback((results: MPResults) => {
    latestLandmarksRef.current = results.multiHandLandmarks;
  }, []);

  // Helper Drawing Functions
  
  // Replaced Graffiti line with Taut Cosmic String logic
  const drawCosmicString = (ctx: CanvasRenderingContext2D, p1: Point, p2: Point, color: string, vibrationAmp: number) => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // Normalized perpendicular vector
    const nx = -dy / length;
    const ny = dx / length;

    // Standing Wave Physics
    // Frequency increases with tension/tightness. 
    // We simulate a fast standing wave (sine) that is anchored at t=0 and t=1.
    // The vibrationAmp drives the amplitude.
    const time = Date.now() / 40; // High speed oscillation
    const waveFn = (t: number) => Math.sin(t * Math.PI) * Math.sin(time + t * 5); 

    ctx.save();
    // Use 'lighter' to make overlapping strings/glows add up like light
    ctx.globalCompositeOperation = 'lighter';
    
    // Pass 1: The Outer Glow (Halo)
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    if (vibrationAmp > 1) {
        // Quadratic curve for simple standing wave visual
        const midT = 0.5;
        const displacement = waveFn(midT) * vibrationAmp;
        const cx = p1.x + dx * 0.5 + nx * displacement;
        const cy = p1.y + dy * 0.5 + ny * displacement;
        ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
    } else {
        ctx.lineTo(p2.x, p2.y);
    }
    
    // Parse color to separate alpha for glow
    // Assuming hex or rgb, but for simplicity let's force a high-alpha core and low-alpha glow
    // Since color is passed as hex+alpha usually, we'll rely on shadowBlur
    
    ctx.strokeStyle = color; // Base color
    ctx.lineWidth = 3 + (vibrationAmp * 0.2); // Widen slightly when vibrating
    ctx.shadowBlur = 10 + vibrationAmp; // Bloom expands with vibration
    ctx.shadowColor = color;
    ctx.stroke();

    // Pass 2: The Core (White Hot Energy)
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    if (vibrationAmp > 1) {
        const midT = 0.5;
        const displacement = waveFn(midT) * vibrationAmp;
        const cx = p1.x + dx * 0.5 + nx * displacement;
        const cy = p1.y + dy * 0.5 + ny * displacement;
        ctx.quadraticCurveTo(cx, cy, p2.x, p2.y);
    } else {
        ctx.lineTo(p2.x, p2.y);
    }
    
    ctx.strokeStyle = '#FFFFFF'; // White core
    ctx.lineWidth = 1.0; // Very thin
    ctx.shadowBlur = 0; // Crisp core
    ctx.globalAlpha = 0.9;
    ctx.stroke();

    ctx.restore();
  };

  const drawProgressCircle = (ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, color: string, radius: number = 30) => {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 4;
      ctx.stroke();
      
      // Glow
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

      // WebGL Render
      if (rendererRef.current && sceneRef.current && cameraRef.current && materialRef.current) {
        materialRef.current.uniforms.uTime.value = timeRef.current;
        const swirlUniforms = new Float32Array(MAX_SWIRLS * 3);
        for(let i=0; i<MAX_SWIRLS; i++) {
            if (i < swirlsRef.current.length) {
                swirlUniforms[i*3 + 0] = swirlsRef.current[i].x;
                swirlUniforms[i*3 + 1] = swirlsRef.current[i].y;
                swirlUniforms[i*3 + 2] = swirlsRef.current[i].intensity;
            } else { swirlUniforms[i*3 + 2] = 0.0; }
        }
        materialRef.current.uniforms.uSwirls.value = swirlUniforms;
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      // Canvas Overlay
      const overlayCanvas = overlayCanvasRef.current;
      const overlayCtx = overlayCanvas?.getContext('2d');
      const landmarksData = latestLandmarksRef.current;

      if (overlayCanvas && overlayCtx) {
        // Resize check
        const overlayContainer = overlayCanvas.parentElement;
        if (overlayContainer && (overlayCanvas.width !== overlayContainer.clientWidth || overlayCanvas.height !== overlayContainer.clientHeight)) {
             overlayCanvas.width = overlayContainer.clientWidth;
             overlayCanvas.height = overlayContainer.clientHeight;
        }
        const overlayW = overlayCanvas.width;
        const overlayH = overlayCanvas.height;
        
        overlayCtx.clearRect(0, 0, overlayW, overlayH);
        stringVibrationRef.current = stringVibrationRef.current.map(v => Math.max(0, v * VIBRATION_DECAY));

        let currentStringLines: Array<{p1: Point, p2: Point, index: number}> = [];
        let detectedP1: Point | null = null;
        let detectedP2: Point | null = null;
        let isSpawning = false;
        let isLocking = false;

        // ----------------------------------------------------
        // LOGIC: MASTER SWITCH (PROXIMITY TOGGLE)
        // ----------------------------------------------------
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
                const dist = Math.sqrt(dx*dx + dy*dy);

                // 1. SPAWN / DESPAWN LOGIC (Close Hands)
                if (dist < SPAWN_DISTANCE_THRESHOLD) {
                    if (!hasSpawnToggledRef.current) {
                        spawnProgressFrameCounter.current += 1;
                        isSpawning = true;
                        
                        if (spawnProgressFrameCounter.current >= SPAWN_TIME_REQUIRED) {
                            // TOGGLE STATE
                            setIsStringsActive(prev => {
                                const newState = !prev;
                                // If turning off, also unlock
                                if (!newState) {
                                    setIsLocked(false);
                                    lockedStringDataRef.current = null;
                                }
                                return newState;
                            });
                            hasSpawnToggledRef.current = true; // Prevent rapid toggle
                            spawnProgressFrameCounter.current = 0;
                        }
                    }
                } else {
                    // Reset if hands move apart
                    spawnProgressFrameCounter.current = Math.max(0, spawnProgressFrameCounter.current - 5);
                    if (dist > SPAWN_DISTANCE_THRESHOLD * 1.5) {
                        hasSpawnToggledRef.current = false; // Allow next toggle
                    }
                }

                // 2. LOCKING LOGIC (Only if Active)
                if (isStringsActive && !isLocked) {
                    if (dist > LOCK_DISTANCE_THRESHOLD) {
                        lockProgressFrameCounter.current += 1;
                        isLocking = true;
                        if (lockProgressFrameCounter.current >= LOCK_TIME_REQUIRED) {
                            setIsLocked(true);
                            lockedStringDataRef.current = {
                                p1: currentStringCoordsRef.current ? currentStringCoordsRef.current.p1 : detectedP1,
                                p2: currentStringCoordsRef.current ? currentStringCoordsRef.current.p2 : detectedP2
                            };
                            lockProgressFrameCounter.current = 0;
                        }
                    } else {
                         lockProgressFrameCounter.current = 0;
                    }
                }
                
                // 3. UNLOCK LOGIC
                if (isLocked && dist < UNLOCK_DISTANCE_THRESHOLD) {
                    setIsLocked(false);
                    lockedStringDataRef.current = null;
                }
            }
        } else {
            spawnProgressFrameCounter.current = 0;
            lockProgressFrameCounter.current = 0;
        }

        // ----------------------------------------------------
        // RENDER: INDICATORS
        // ----------------------------------------------------
        
        // Draw Spawn/Despawn Progress (Magic Circle between hands)
        if (isSpawning && detectedP1 && detectedP2) {
             const midX = (detectedP1.x + detectedP2.x) / 2;
             const midY = (detectedP1.y + detectedP2.y) / 2;
             const progress = spawnProgressFrameCounter.current / SPAWN_TIME_REQUIRED;
             // Use Theme Colors
             const color = isStringsActive ? CURRENT_THEME.colors.secondary : CURRENT_THEME.colors.primary; 
             drawProgressCircle(overlayCtx, midX, midY, progress, color, 40);
             
             // Label
             overlayCtx.font = "12px serif";
             overlayCtx.fillStyle = "rgba(255,255,255,0.8)";
             overlayCtx.textAlign = "center";
             overlayCtx.fillText(isStringsActive ? "CLOSING..." : "SUMMONING...", midX, midY + 55);
        }

        // Draw Lock Progress (On fingertips)
        if (isLocking && !isLocked && detectedP1 && detectedP2) {
             const progress = lockProgressFrameCounter.current / LOCK_TIME_REQUIRED;
             drawProgressCircle(overlayCtx, detectedP1.x, detectedP1.y, progress, CURRENT_THEME.colors.primary, 20);
             drawProgressCircle(overlayCtx, detectedP2.x, detectedP2.y, progress, CURRENT_THEME.colors.primary, 20);
        }

        // ----------------------------------------------------
        // RENDER: STRINGS (If Active)
        // ----------------------------------------------------
        
        if (isStringsActive) {
            let renderP1: Point | null = null;
            let renderP2: Point | null = null;

            if (lockedStringDataRef.current) {
                renderP1 = lockedStringDataRef.current.p1;
                renderP2 = lockedStringDataRef.current.p2;
                // Keep smooth ref updated
                if (currentStringCoordsRef.current) {
                    currentStringCoordsRef.current.p1 = renderP1;
                    currentStringCoordsRef.current.p2 = renderP2;
                }
            } else if (detectedP1 && detectedP2) {
                if (!currentStringCoordsRef.current) {
                    currentStringCoordsRef.current = { p1: detectedP1, p2: detectedP2 };
                } else {
                    currentStringCoordsRef.current.p1.x = lerp(currentStringCoordsRef.current.p1.x, detectedP1.x, STRING_SMOOTHING);
                    currentStringCoordsRef.current.p1.y = lerp(currentStringCoordsRef.current.p1.y, detectedP1.y, STRING_SMOOTHING);
                    currentStringCoordsRef.current.p2.x = lerp(currentStringCoordsRef.current.p2.x, detectedP2.x, STRING_SMOOTHING);
                    currentStringCoordsRef.current.p2.y = lerp(currentStringCoordsRef.current.p2.y, detectedP2.y, STRING_SMOOTHING);
                }
                renderP1 = currentStringCoordsRef.current.p1;
                renderP2 = currentStringCoordsRef.current.p2;
            }

            if (renderP1 && renderP2) {
               const vx = renderP2.x - renderP1.x;
               const vy = renderP2.y - renderP1.y;
               const len = Math.sqrt(vx*vx + vy*vy);
               if (len > 0) {
                  const dx = vx / len;
                  const dy = vy / len;
                  const px = -dy;
                  const py = dx;

                  currentStringLines.push({ p1: { x: renderP1.x + px * STRING_GAP, y: renderP1.y + py * STRING_GAP }, p2: { x: renderP2.x + px * STRING_GAP, y: renderP2.y + py * STRING_GAP }, index: 1 });
                  currentStringLines.push({ p1: renderP1, p2: renderP2, index: 0 });
                  currentStringLines.push({ p1: { x: renderP1.x - px * STRING_GAP, y: renderP1.y - py * STRING_GAP }, p2: { x: renderP2.x - px * STRING_GAP, y: renderP2.y - py * STRING_GAP }, index: -1 });
               }
            }

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
                overlayCtx.arc(x, y, 3, 0, Math.PI*2);
                overlayCtx.fill();
                overlayCtx.restore();
            });

            // Draw Strings
            currentStringLines.forEach((line) => {
              const vibIndex = line.index === 1 ? 0 : line.index === 0 ? 1 : 2;
              const vibration = stringVibrationRef.current[vibIndex] || 0;
              
              // Use Theme Colors for Strings
              let color = lockedStringDataRef.current 
                  ? CURRENT_THEME.colors.primary // Locked
                  : CURRENT_THEME.colors.secondary; // Active
              
              // Fade opacity slightly for the "glow" pass inside the function
              color = color + 'FF'; 

              drawCosmicString(overlayCtx, line.p1, line.p2, color, vibration);
              
              // Endpoints
              overlayCtx.fillStyle = '#fff';
              overlayCtx.beginPath();
              overlayCtx.arc(line.p1.x, line.p1.y, 4, 0, Math.PI*2);
              overlayCtx.arc(line.p2.x, line.p2.y, 4, 0, Math.PI*2);
              overlayCtx.fill();
            });

            // Pluck Logic
            if (landmarksData && currentStringLines.length > 0) {
                const currentFingerPos = new Map<string, Point>();
                const now = Date.now();
                landmarksData.forEach((landmarks, handIndex) => {
                    [8, 12, 16, 20].forEach(tipIdx => {
                        const id = `h${handIndex}-f${tipIdx}`;
                        if (!landmarks[tipIdx]) return;
                        const pOverlay = { x: landmarks[tipIdx].x * overlayW, y: landmarks[tipIdx].y * overlayH };
                        currentFingerPos.set(id, pOverlay);
                        const prevOverlay = prevFingerPosRef.current.get(id);

                        if (prevOverlay) {
                            currentStringLines.forEach((line) => {
                               if (segmentsIntersect(line.p1, line.p2, prevOverlay, pOverlay)) {
                                   if (now - lastPluckTimeRef.current > PLUCK_COOLDOWN) {
                                      // Play Sound from Theme Instrument
                                      playPluckSound(landmarks[tipIdx].x, line.index * 3, CURRENT_THEME.instrument);
                                      
                                      const vibIndex = line.index === 1 ? 0 : line.index === 0 ? 1 : 2;
                                      stringVibrationRef.current[vibIndex] = 20; // Harder pluck
                                      
                                      const noteColor = CURRENT_THEME.colors.note;
                                      notesRef.current.push({ id: Math.random(), x: pOverlay.x, y: pOverlay.y, vx: (Math.random() - 0.5) * 2, vy: -2 - Math.random(), symbol: NOTE_SYMBOLS[Math.floor(Math.random() * NOTE_SYMBOLS.length)], life: 1.0, opacity: 1.0, color: noteColor });
                                      
                                      // Find closest themed point
                                      let closestPoint = CURRENT_THEME.points[0];
                                      let minDist = 1000;
                                      const fingerX = landmarks[tipIdx].x;
                                      const fingerY = landmarks[tipIdx].y;
                                      CURRENT_THEME.points.forEach(point => {
                                          const dx = point.x - fingerX;
                                          const dy = point.y - fingerY;
                                          const d = Math.sqrt(dx*dx + dy*dy);
                                          if (d < minDist) { minDist = d; closestPoint = point; }
                                      });
                                      
                                      beamsRef.current.push({ startX: pOverlay.x, startY: pOverlay.y, endX: closestPoint.x * overlayW, endY: closestPoint.y * overlayH, progress: 0, color: CURRENT_THEME.colors.beam });
                                      
                                      const intensity = CURRENT_THEME.swirlIntensityMap[closestPoint.type] || 1.0;
                                      swirlsRef.current.push({ x: closestPoint.x, y: 1.0 - closestPoint.y, intensity: intensity, decaySpeed: 0.005 });
                                      if (swirlsRef.current.length > MAX_SWIRLS) swirlsRef.current.shift();

                                      lastPluckTimeRef.current = now;
                                  }
                               }
                            });
                        }
                    });
                });
                prevFingerPosRef.current = currentFingerPos;
            }
        }
        
        // Render Notes (Always render if they exist)
        notesRef.current = notesRef.current.filter(n => n.life > 0);
        notesRef.current.forEach(note => {
          note.x += note.vx;
          note.y += note.vy;
          note.life -= 0.01;
          note.opacity = Math.max(0, note.life);
          overlayCtx.save();
          overlayCtx.font = `${20 + (1-note.life)*10}px serif`; 
          overlayCtx.shadowColor = note.color;
          overlayCtx.shadowBlur = 10;
          overlayCtx.fillStyle = note.color.replace(/[\d\.]+\)$/g, `${note.opacity})`);
          overlayCtx.fillText(note.symbol, note.x, note.y);
          overlayCtx.restore();
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => { active = false; cancelAnimationFrame(animationFrameId); };
  }, [isLoaded, isStringsActive, isLocked]);

  const startCamera = async () => {
    if (cameraStatus === 'initializing' || cameraStatus === 'active') return;
    setCameraStatus('initializing');
    setErrorMessage(null);

    try {
      if (!videoRef.current || typeof window.Hands === 'undefined') throw new Error("Initialization failed.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } });
      if (!isMountedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      videoRef.current.srcObject = stream;
      await new Promise<void>((resolve) => { if (videoRef.current) videoRef.current.onloadedmetadata = () => videoRef.current?.play().then(resolve); });
      const hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
      hands.onResults(onResults);
      setCameraStatus('active');
      const detectLoop = async () => {
        if (!isMountedRef.current) return;
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) { requestAnimationFrame(detectLoop); return; }
        try { await hands.send({ image: videoRef.current }); } catch (e) {}
        requestAnimationFrame(detectLoop);
      };
      detectLoop();
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setErrorMessage(err.message || "Failed to access camera.");
      setCameraStatus('error');
    }
  };

  useEffect(() => { if (isLoaded) startCamera(); }, [isLoaded]);

  const handleRestart = () => window.location.reload();

  return (
    <div className="relative w-full h-full bg-black overflow-hidden font-sans select-none">
      {!isLoaded && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black text-yellow-200 animate-pulse font-serif">
          <h2 className="text-2xl tracking-widest">Loading Masterpiece...</h2>
        </div>
      )}

      <canvas ref={webglCanvasRef} id="bg_canvas_webgl" className="absolute inset-0 w-full h-full z-0 block" />
      <canvas ref={canvasRef} id="output_canvas" className="absolute inset-0 w-full h-full z-10 block pointer-events-none" />

       <div className="absolute top-6 left-8 pointer-events-none z-20 opacity-40 mix-blend-screen">
          <h1 className="text-white font-serif text-2xl tracking-[0.2em] uppercase">{CURRENT_THEME.name}</h1>
       </div>
      
      <div className="absolute top-6 right-6 z-30 flex flex-col items-end gap-2 group">
        <div 
          className={`relative w-72 h-52 rounded-2xl overflow-hidden shadow-2xl transition-all duration-700 backdrop-blur-sm bg-black/20 ${
            isLocked 
              ? `shadow-[0_0_40px_${CURRENT_THEME.colors.primary}33] ring-1`
              : `shadow-[0_0_40px_${CURRENT_THEME.colors.secondary}26] ring-1`
          }`}
          style={{ borderColor: isLocked ? CURRENT_THEME.colors.primary : CURRENT_THEME.colors.secondary }}
        >
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-fill opacity-90 transition-opacity duration-500" playsInline muted style={{ transform: 'scaleX(-1)' }} />
            <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'scaleX(-1)' }} />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none transition-all duration-500 transform translate-y-1 group-hover:translate-y-0 opacity-80 group-hover:opacity-100">
                {!isStringsActive ? (
                  <span className="px-4 py-1.5 backdrop-blur-md text-[10px] font-bold tracking-widest uppercase rounded-full shadow-lg border flex items-center gap-2"
                        style={{ backgroundColor: `${CURRENT_THEME.colors.secondary}CC`, color: '#000', borderColor: CURRENT_THEME.colors.secondary }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/> 
                    Hold Hands Close to Summon
                  </span>
                ) : isLocked ? (
                  <span className="px-4 py-1.5 backdrop-blur-md text-[10px] font-bold tracking-widest uppercase rounded-full shadow-lg border flex items-center gap-2"
                        style={{ backgroundColor: `${CURRENT_THEME.colors.primary}CC`, color: '#000', borderColor: CURRENT_THEME.colors.primary }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_5px_white]"/> 
                    Strings Locked
                  </span>
                ) : (
                  <span className="px-4 py-1.5 bg-white/10 backdrop-blur-md text-white/80 text-[10px] font-bold tracking-widest uppercase rounded-full shadow-lg border border-white/10 flex items-center gap-2">
                    Active
                  </span>
                )}
            </div>
        </div>
        <div className="text-white/30 text-[9px] tracking-widest uppercase pr-3 font-medium group-hover:text-white/50 transition-colors">Camera Feed</div>
      </div>
      
      <div className="absolute bottom-10 left-0 right-0 pointer-events-none z-20 flex justify-center px-4">
         <div className="bg-gradient-to-t from-black/80 to-black/40 backdrop-blur-md border-t border-white/10 px-10 py-5 rounded-2xl text-center transform transition-all duration-500 hover:bg-black/90 shadow-2xl max-w-lg">
            <h3 className="text-yellow-100/90 font-serif text-xl tracking-wide mb-2 italic">The Cosmic Strings</h3>
            <p className="text-white/70 text-sm font-light leading-relaxed">
              {!isStringsActive && <span className="block mb-1" style={{color: CURRENT_THEME.colors.secondary}}>Hold fingertips close together to summon strings.</span>}
              {isStringsActive && (
                  <>
                    <span className="block mb-1">Pluck strings to play music and light up the stars.</span>
                    <span className="opacity-60 text-xs">Spread arms very wide to lock. Hold hands close to vanish.</span>
                  </>
              )}
            </p>
         </div>
      </div>

      {(cameraStatus === 'initializing' || cameraStatus === 'error') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-500">
             {cameraStatus === 'initializing' && (
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: CURRENT_THEME.colors.secondary }}></div>
                    <div className="text-yellow-200 font-serif tracking-widest text-sm animate-pulse">Accessing Vision...</div>
                </div>
             )}
             {cameraStatus === 'error' && (
               <div className="flex flex-col items-center gap-4 max-w-md text-center px-6">
                  <div className="text-red-300/90 font-serif text-xl mb-2">Camera Access Required</div>
                  <div className="text-white/60 text-sm mb-4 leading-relaxed">{errorMessage}</div>
                  <button onClick={startCamera} className="px-6 py-2 bg-yellow-700/50 hover:bg-yellow-600/50 text-yellow-100 border border-yellow-500/30 rounded-full transition-all uppercase text-xs tracking-widest">Try Again</button>
               </div>
             )}
        </div>
      )}
      
      <button onClick={handleRestart} className="absolute bottom-8 right-8 z-30 text-white/30 hover:text-white/80 transition-all p-3 rounded-full hover:bg-white/10" title="Restart Experience">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
      </button>
    </div>
  );
};
