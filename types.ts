
export interface Point {
  x: number;
  y: number;
}

export interface MusicalNote {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  symbol: string;
  life: number;
  opacity: number;
  color: string;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface DetectedHand {
  landmarks: HandLandmark[];
  label: 'Left' | 'Right';
}

// --- THEME & CONFIGURATION TYPES ---

export interface InstrumentConfig {
  oscillatorType: 'triangle' | 'sine' | 'square' | 'sawtooth';
  attack: number;
  decay: number;
  filterFreqStart: number;
  filterFreqEnd: number;
}

export interface InteractablePoint {
  x: number;
  y: number;
  size: number;
  type: 'sky' | 'lamp' | 'other';
}

export interface ThemeColors {
  primary: string;   // Main interaction color (e.g., Cyan for Lock)
  secondary: string; // Secondary interaction color (e.g., Orange for Spawn)
  text: string;      // General UI text
  note: string;      // Base color for musical notes
  beam: string;      // Color of the connecting beam
}

export interface Theme {
  id: string;
  name: string;
  backgroundUrl: string;
  colors: ThemeColors;
  instrument: InstrumentConfig;
  points: InteractablePoint[];
  swirlIntensityMap: { [key in InteractablePoint['type']]: number };
  interactionMode?: 'strings' | 'drum';  // 交互模式
}

// --- GUERNICA DRUM THEME TYPES ---

export type DrumType = 'kick' | 'snare' | 'cymbal';

export interface DrumPad {
  id: number;
  type: DrumType;
  x: number;           // 相对位置 (0-1)
  y: number;
  radius: number;      // 触发半径
  isPressed: boolean;  // 当前是否被按下
  lastHitTime: number; // 上次触发时间（冷却）
  color: string;       // 鼓的颜色
}

export interface GlassFragment {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  vertices: number[];  // 多边形顶点角度
  opacity: number;
  life: number;        // 1.0 → 0.0
  color: string;
}

export interface CrackLine {
  points: Point[];     // 裂痕路径点
  width: number;       // 线宽
  opacity: number;     // 透明度
  life: number;        // 生命周期
}

// --- R3F GUERNICA TYPES (from guernica-reconstructed) ---

// MediaPipe landmark with visibility
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// MediaPipe results
export interface Results {
  multiHandLandmarks: Landmark[][];
  multiHandedness: any[];
}

// R3F Drum types (enum version)
export enum DrumTypeEnum {
  KICK = 'KICK',
  SNARE = 'SNARE',
  CYMBAL_L = 'CYMBAL_L',
  CYMBAL_R = 'CYMBAL_R'
}

export interface DrumConfig {
  id: DrumTypeEnum;
  position: [number, number, number];
  radius: number;
  color: string;
  type: 'circle' | 'arc';
  hitSound: 'kick' | 'snare' | 'cymbal';
}

// Global window extensions for MediaPipe
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}
