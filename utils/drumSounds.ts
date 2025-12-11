
import { DrumType } from '../types';

let audioCtx: AudioContext | null = null;

const initAudio = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
};

// 大鼓 (Kick) - 低沉有力，更长衰减
export const playKick = () => {
  const ctx = initAudio();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Master gain for overall volume
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(0.8, now);

  // 主音振荡器 - 低频正弦波，更长衰减
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.5);

  // 音量包络 - 更长衰减
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(1, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

  // 点击层 - 用 square 波增加打击感
  const clickOsc = ctx.createOscillator();
  clickOsc.type = 'square';
  clickOsc.frequency.setValueAtTime(300, now);

  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.3, now);
  clickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);

  // 连接
  osc.connect(gainNode);
  gainNode.connect(masterGain);

  clickOsc.connect(clickGain);
  clickGain.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.5);

  clickOsc.start(now);
  clickOsc.stop(now + 0.05);
};

// 小鼓 (Snare) - 更厚实的声音
export const playSnare = () => {
  const ctx = initAudio();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Master gain
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);
  masterGain.gain.setValueAtTime(0.8, now);

  // 噪声部分 - 更长的 buffer，更低的高通
  const bufferSize = ctx.sampleRate * 0.5;  // 0.5s instead of 0.2s
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  // 更低的高通滤波 - 声音更厚实
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'highpass';
  noiseFilter.frequency.value = 400;  // 400Hz instead of 5000Hz

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(1, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

  // 音调部分 - 中频
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(250, now);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.5, now);
  oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

  // 连接
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(masterGain);

  osc.connect(oscGain);
  oscGain.connect(masterGain);

  noise.start(now);
  osc.start(now);
  osc.stop(now + 0.2);
};

// 镲 (Cymbal) - 更长的金属质感
export const playCymbal = () => {
  const ctx = initAudio();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 更长的白噪声 buffer
  const bufferSize = ctx.sampleRate * 1.5;  // 1.5s instead of 0.8s
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  // 更低的高通滤波 - 声音更厚实
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 2000;  // 2000Hz instead of 7000Hz

  // 音量包络 - 更长的衰减
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0.4, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.2);  // 1.2s instead of 0.8s

  // 连接
  noise.connect(highpass);
  highpass.connect(gainNode);
  gainNode.connect(ctx.destination);

  noise.start(now);
};

// 统一播放接口
export const playDrumSound = (type: DrumType) => {
  switch (type) {
    case 'kick':
      playKick();
      break;
    case 'snare':
      playSnare();
      break;
    case 'cymbal':
      playCymbal();
      break;
  }
};
