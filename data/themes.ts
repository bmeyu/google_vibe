
import { Theme } from '../types';

export const THEME_STARRY_NIGHT_RHONE: Theme = {
  id: 'starry-night-rhone',
  name: 'Starry Night Over the Rhône',
  backgroundUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Starry_Night_Over_the_Rhone.jpg/2560px-Starry_Night_Over_the_Rhone.jpg',
  
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

// You can add more themes here in the future
export const DEFAULT_THEME = THEME_STARRY_NIGHT_RHONE;
