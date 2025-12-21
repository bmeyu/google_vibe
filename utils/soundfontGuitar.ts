import Soundfont from 'soundfont-player';
import { initAudio } from './audioUtils';

type SoundfontInstrument = Awaited<ReturnType<typeof Soundfont.instrument>>;

const DEFAULT_SOUNDFONT = 'FluidR3_GM';
const DEFAULT_INSTRUMENT = 'acoustic_guitar_steel';
const DEFAULT_FORMAT: 'mp3' | 'ogg' = 'mp3';

const nameToUrl = (name: string, soundfont: string, format: string) =>
  `https://gleitz.github.io/midi-js-soundfonts/${soundfont}/${name}-${format}.js`;

let guitarPromise: Promise<SoundfontInstrument> | null = null;

export const loadSoundfontGuitar = async (): Promise<SoundfontInstrument> => {
  if (!guitarPromise) {
    const ac = initAudio();
    guitarPromise = Soundfont.instrument(ac, DEFAULT_INSTRUMENT, {
      soundfont: DEFAULT_SOUNDFONT,
      format: DEFAULT_FORMAT,
      nameToUrl,
      gain: 0.9,
      attack: 0.004,
      decay: 0.08,
      sustain: 0.85,
      release: 0.35,
    });
  }
  return guitarPromise;
};

export const frequencyToMidi = (frequency: number) => {
  const midi = 69 + 12 * Math.log2(frequency / 440);
  return Math.round(midi);
};

export const playSoundfontChord = (
  instrument: SoundfontInstrument,
  frequencies: number[],
  options?: { strumMs?: number; durationSec?: number; gain?: number }
) => {
  const ac = initAudio();
  const strumMs = options?.strumMs ?? 20;
  const durationSec = options?.durationSec ?? 1.6;
  const gain = options?.gain;

  const now = ac.currentTime;
  frequencies.forEach((freq, i) => {
    const when = now + (i * strumMs) / 1000;
    const note = frequencyToMidi(freq);
    instrument.play(note, when, { duration: durationSec, gain });
  });
};

