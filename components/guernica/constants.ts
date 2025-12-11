import { DrumConfig, DrumTypeEnum as DrumType } from '../../types';

// Neon Cyberpunk Palette
export const COLORS = {
  NEON_PINK: '#FF0088',
  NEON_CYAN: '#00FFFF',
  ELECTRIC_BLUE: '#0088FF',
  BG_DARK: '#050505',
  SNARE_WHITE: '#E0FFFF',
  KICK_RED: '#FF0044',
  CYMBAL_BLUE: '#00CCFF'
};

// Drum Layout (Orthographic space coordinates)
export const DRUMS: DrumConfig[] = [
  {
    id: DrumType.KICK,
    position: [0, -2.5, 0], // Lowered slightly
    radius: 1.2,
    color: COLORS.NEON_PINK,
    type: 'circle',
    hitSound: 'kick'
  },
  {
    id: DrumType.SNARE,
    position: [-3.0, -0.5, 0],
    radius: 1.0,
    color: COLORS.NEON_CYAN,
    type: 'circle',
    hitSound: 'snare'
  },
  {
    id: DrumType.CYMBAL_L,
    position: [-3.5, 2.5, 0],
    radius: 0.9,
    color: COLORS.NEON_CYAN,
    type: 'arc',
    hitSound: 'cymbal'
  },
  {
    id: DrumType.CYMBAL_R,
    position: [3.5, 2.5, 0],
    radius: 0.9,
    color: COLORS.NEON_PINK, // Changed to Pink for visual balance
    type: 'arc',
    hitSound: 'cymbal'
  }
];

export const SHATTER_CONFIG = {
  gridX: 12,
  gridY: 6,
  returnSpeed: 0.08,
  explosionForce: 3.5
};