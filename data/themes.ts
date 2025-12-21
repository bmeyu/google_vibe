
import { Theme } from '../types';

export const THEME_STARRY_NIGHT_RHONE: Theme = {
  id: 'starry-night-rhone',
  name: 'Starry Night Over the Rhône',
  backgroundUrl: '/images/StarryNight.jpg',
  
  colors: {
    primary: '#00ffff', // Cyan for magic/locking
    secondary: '#ffaa00', // Gold for lamps/stars
    text: '#ffffff',
    note: 'rgba(255, 230, 100, 0.9)', // Golden notes
    beam: 'rgba(255, 200, 50, 1.0)'
  },

  instrument: {
    oscillatorType: 'triangle', // Soft, harp-like
    attack: 0.02,
    decay: 1.5,
    filterFreqStart: 800,
    filterFreqEnd: 200
  },

  swirlIntensityMap: {
    sky: 1.0,
    lamp: 1.5,
    other: 0.8
  },

  points: [
    // --- Big Dipper (Sky) ---
    { x: 0.38, y: 0.12, size: 1.2, type: 'sky' },
    { x: 0.46, y: 0.15, size: 1.0, type: 'sky' },
    { x: 0.52, y: 0.09, size: 0.9, type: 'sky' },
    { x: 0.56, y: 0.18, size: 1.1, type: 'sky' },
    { x: 0.61, y: 0.21, size: 1.0, type: 'sky' },
    { x: 0.68, y: 0.24, size: 0.9, type: 'sky' },
    { x: 0.72, y: 0.15, size: 0.8, type: 'sky' },
    // --- Gas Lamps (Shoreline) ---
    { x: 0.12, y: 0.41, size: 1.5, type: 'lamp' },
    { x: 0.22, y: 0.42, size: 1.4, type: 'lamp' },
    { x: 0.35, y: 0.42, size: 1.3, type: 'lamp' },
    { x: 0.52, y: 0.41, size: 1.3, type: 'lamp' },
    { x: 0.65, y: 0.40, size: 1.3, type: 'lamp' },
    { x: 0.78, y: 0.39, size: 1.4, type: 'lamp' },
    { x: 0.91, y: 0.43, size: 1.5, type: 'lamp' },
  ]
};

// --- Tree of Life Theme (Klimt) ---
export const THEME_TREE_OF_LIFE: Theme = {
  id: 'tree-of-life',
  name: 'Tree of Life',
  backgroundUrl: '/images/TreeOfLife.png',

  colors: {
    primary: '#d4a84b',      // 金色（锁定/魔法效果）
    secondary: '#e8a849',    // 琥珀色（激活状态）
    text: '#ffffff',
    note: 'rgba(232, 168, 73, 0.9)',  // 金色音符
    beam: 'rgba(212, 168, 75, 1.0)'   // 金色光束
  },

  instrument: {
    oscillatorType: 'sawtooth',  // 吉他感
    attack: 0.01,                // 快速起音
    decay: 1.2,                  // 中等衰减
    filterFreqStart: 1200,       // 明亮起始
    filterFreqEnd: 300           // 温暖结束
  },

  swirlIntensityMap: {
    spiral: 1.2,    // 螺旋装饰
    branch: 0.8,    // 树枝区域
    other: 0.6
  },

  points: [
    // 约20个螺旋装饰点位（normalized 0-1 坐标）
    // 左上区域
    { x: 0.08, y: 0.15, size: 1.0, type: 'spiral' },
    { x: 0.15, y: 0.10, size: 1.1, type: 'spiral' },
    { x: 0.12, y: 0.28, size: 1.2, type: 'spiral' },
    { x: 0.05, y: 0.38, size: 0.9, type: 'spiral' },
    // 中上区域
    { x: 0.32, y: 0.08, size: 1.0, type: 'spiral' },
    { x: 0.42, y: 0.12, size: 1.1, type: 'spiral' },
    { x: 0.50, y: 0.06, size: 1.0, type: 'spiral' },
    { x: 0.48, y: 0.22, size: 1.3, type: 'spiral' },
    // 右上区域
    { x: 0.62, y: 0.10, size: 1.0, type: 'spiral' },
    { x: 0.72, y: 0.08, size: 1.1, type: 'spiral' },
    { x: 0.85, y: 0.15, size: 1.0, type: 'spiral' },
    { x: 0.92, y: 0.25, size: 0.9, type: 'spiral' },
    // 中部区域
    { x: 0.22, y: 0.45, size: 1.0, type: 'branch' },
    { x: 0.78, y: 0.42, size: 1.0, type: 'branch' },
    { x: 0.35, y: 0.35, size: 1.1, type: 'spiral' },
    { x: 0.65, y: 0.32, size: 1.1, type: 'spiral' },
    // 下部区域
    { x: 0.18, y: 0.72, size: 0.9, type: 'spiral' },
    { x: 0.50, y: 0.68, size: 1.0, type: 'branch' },
    { x: 0.82, y: 0.70, size: 0.9, type: 'spiral' },
    { x: 0.45, y: 0.85, size: 0.8, type: 'other' },
  ]
};

// --- Guernica Drum Theme ---
export const THEME_GUERNICA: Theme = {
  id: 'guernica',
  name: 'Guernica - Drum Mode',
  // Local image for reliability (download Guernica and place in public/images/)
  backgroundUrl: '/images/Guernica.png',
  interactionMode: 'drum',

  colors: {
    primary: '#00ffff',    // 霓虹青（骨骼线、鼓边框）
    secondary: '#ffffff',  // 白色（高亮）
    text: '#ffffff',
    note: 'rgba(200, 200, 200, 0.9)',  // 灰色
    beam: 'rgba(100, 100, 100, 1.0)'
  },

  instrument: {
    oscillatorType: 'sine',  // 鼓声用正弦波
    attack: 0.005,           // 极快攻击
    decay: 0.25,             // 快速衰减
    filterFreqStart: 3000,
    filterFreqEnd: 150
  },

  swirlIntensityMap: {
    sky: 0.5,
    lamp: 0.5,
    other: 0.5
  },

  // 格尔尼卡不需要interactable points（改用鼓）
  points: []
};

// You can add more themes here in the future
export const DEFAULT_THEME = THEME_STARRY_NIGHT_RHONE;

// Theme map for URL-based switching
export const THEMES: { [key: string]: Theme } = {
  'starry-night': THEME_STARRY_NIGHT_RHONE,
  'guernica': THEME_GUERNICA,
  'tree-of-life': THEME_TREE_OF_LIFE,
};
