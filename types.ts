
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
}
