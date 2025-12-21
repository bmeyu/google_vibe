
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

/**
 * Play a single note at an exact frequency (for chord playing)
 */
export const playNote = (frequency: number, config: InstrumentConfig, volume: number = 0.2) => {
  const ctx = initAudio();
  if (!ctx) return;

  // Oscillator
  const osc = ctx.createOscillator();
  osc.type = config.oscillatorType;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Gain (Volume Envelope)
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + config.attack);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + config.decay);

  // Filter (Timbre)
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(config.filterFreqStart, ctx.currentTime);
  filter.frequency.linearRampToValueAtTime(config.filterFreqEnd, ctx.currentTime + 1.0);

  // Reverb/Delay
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.15;
  const delayGain = ctx.createGain();
  delayGain.gain.value = 0.15;

  // Connections
  osc.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(ctx.destination);
  gainNode.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(delay);
  delayGain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + config.decay + 0.5);
};

/**
 * Play a guitar-like note with harmonics for more realistic sound
 */
export const playGuitarNote = (frequency: number, volume: number = 0.12) => {
  const ctx = initAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const decay = 2.0;

  // Create multiple oscillators for harmonics (more guitar-like)
  const harmonics = [
    { freq: frequency, vol: volume, type: 'triangle' as OscillatorType }, // Fundamental
    { freq: frequency * 2, vol: volume * 0.3, type: 'triangle' as OscillatorType }, // 2nd harmonic
    { freq: frequency * 3, vol: volume * 0.15, type: 'sine' as OscillatorType }, // 3rd harmonic
    { freq: frequency * 4, vol: volume * 0.08, type: 'sine' as OscillatorType }, // 4th harmonic
  ];

  // Master gain for the whole note
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, now);
  masterGain.gain.linearRampToValueAtTime(1, now + 0.003); // Very fast attack
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + decay);

  // Lowpass filter for guitar body resonance
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2500, now);
  filter.frequency.exponentialRampToValueAtTime(400, now + 0.8);
  filter.Q.value = 1;

  // Highpass to remove mud
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 80;

  // Subtle delay for body resonance
  const delay = ctx.createDelay();
  delay.delayTime.value = 0.08;
  const delayGain = ctx.createGain();
  delayGain.gain.value = 0.1;

  // Connect chain
  filter.connect(highpass);
  highpass.connect(masterGain);
  masterGain.connect(ctx.destination);
  masterGain.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(ctx.destination);

  // Create and connect oscillators
  harmonics.forEach(h => {
    const osc = ctx.createOscillator();
    osc.type = h.type;
    // Add slight detune for warmth (±3 cents random)
    osc.detune.value = (Math.random() - 0.5) * 6;
    osc.frequency.setValueAtTime(h.freq, now);

    const oscGain = ctx.createGain();
    oscGain.gain.value = h.vol;

    osc.connect(oscGain);
    oscGain.connect(filter);

    osc.start(now);
    osc.stop(now + decay + 0.5);
  });
};

/**
 * Play a guitar chord (multiple notes with slight arpeggio)
 */
export const playGuitarChord = (notes: number[], strumSpeed: number = 25) => {
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playGuitarNote(freq, 0.1);
    }, i * strumSpeed);
  });
};
