
import { InstrumentConfig } from '../types';

// Pentatonic scale frequencies (E Minor Pentatonic: E, G, A, B, D)
const PENTATONIC_SCALE = [
  164.81, // E3
  196.00, // G3
  220.00, // A3
  246.94, // B3
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.00, // A5
  987.77, // B5
  1174.66, // D6
];

let audioCtx: AudioContext | null = null;

export const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

export const playPluckSound = (horizontalPosition: number, scaleOffset: number = 0, config: InstrumentConfig) => {
  const ctx = initAudio();
  if (!ctx) return;

  // Map horizontal position (0-1) to a note index
  // Left side = lower pitch, Right side = higher pitch
  const baseIndex = Math.floor(horizontalPosition * (PENTATONIC_SCALE.length - 4));
  
  // Apply offset for different strings (e.g. +2 for a harmony)
  const noteIndex = baseIndex + scaleOffset;
  
  const clampedIndex = Math.max(0, Math.min(noteIndex, PENTATONIC_SCALE.length - 1));
  const frequency = PENTATONIC_SCALE[clampedIndex];

  // Oscillator (The String)
  const osc = ctx.createOscillator();
  osc.type = config.oscillatorType;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Gain (Volume Envelope)
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + config.attack); // Attack
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.decay); // Decay

  // Filter (Timbre)
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(config.filterFreqStart + (scaleOffset * 100), ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(config.filterFreqEnd, ctx.currentTime + 1.0);

  // Reverb/Delay
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.2;
  const delayGain = ctx.createGain();
  delayGain.gain.value = 0.2;

  // Connections
  osc.connect(filter);
  filter.connect(gainNode);
  
  // Dry path
  gainNode.connect(ctx.destination);
  
  // Echo path
  gainNode.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(delay); // Feedback
  delayGain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + config.decay + 0.5);
};
