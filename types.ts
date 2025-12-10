
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

// --- RHYTHM GAME TYPES ---

export type JudgeResult = 'perfect' | 'good' | 'miss';

export interface JudgeEvent {
  result: JudgeResult;
  timing: number;    // 偏差 ms，负=早，正=晚
  timestamp: number; // 触发时间
}

// --- SONG & NOTE TYPES ---

export interface SongNote {
  time: number;           // 到达判定线的时间 (ms)
  string: -1 | 0 | 1;     // 哪根弦 (-1=下, 0=中, 1=上)
}

export interface Song {
  id: string;
  title: string;
  composer?: string;
  audioUrl: string;
  duration: number;       // 歌曲时长 (ms)
  bpm: number;
  leadTime: number;       // 音符从出现到到达判定线的时间 (ms)
  notes: SongNote[];
}

// 运行时的音符状态
export interface ActiveNote {
  id: number;
  songNote: SongNote;
  progress: number;       // 0-1, 1=到达判定线
  hit: boolean;           // 是否已被击中
  missed: boolean;        // 是否已错过
}
