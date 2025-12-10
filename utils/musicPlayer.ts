/**
 * MusicPlayer - 音乐播放器
 *
 * 基于 Web Audio API 的精确音乐播放，与 AudioContext 时间同步
 */

import { Song } from '../types';

type MusicPlayerCallback = (currentTime: number) => void;
type MusicEndCallback = () => void;

class MusicPlayer {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;

  private _isPlaying: boolean = false;
  private _startTime: number = 0;  // AudioContext 时间
  private _pausedAt: number = 0;   // 暂停时的播放位置

  private song: Song | null = null;
  private onTimeUpdate: MusicPlayerCallback | null = null;
  private onEnd: MusicEndCallback | null = null;
  private animationFrameId: number | null = null;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * 获取当前播放时间 (毫秒)
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this._isPlaying) {
      return this._pausedAt;
    }
    return (this.audioContext.currentTime - this._startTime) * 1000;
  }

  /**
   * 获取 AudioContext
   */
  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * 加载歌曲
   */
  async loadSong(song: Song): Promise<void> {
    this.song = song;
    const ctx = this.getAudioContext();

    try {
      const response = await fetch(song.audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to load audio: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.warn('Failed to load audio file:', error);
      // 即使没有音频文件，也允许游戏运行（静音模式）
      this.audioBuffer = null;
    }
  }

  /**
   * 开始播放
   */
  play(): void {
    if (this._isPlaying) return;

    const ctx = this.getAudioContext();

    if (this.audioBuffer) {
      // 创建音频节点
      this.sourceNode = ctx.createBufferSource();
      this.sourceNode.buffer = this.audioBuffer;

      this.gainNode = ctx.createGain();
      this.gainNode.gain.value = 0.7; // 稍微降低音量

      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(ctx.destination);

      // 设置结束回调
      this.sourceNode.onended = () => {
        if (this._isPlaying) {
          this.stop();
          this.onEnd?.();
        }
      };

      // 从暂停位置开始播放
      const offset = this._pausedAt / 1000;
      this.sourceNode.start(0, offset);
    }

    this._startTime = ctx.currentTime - (this._pausedAt / 1000);
    this._isPlaying = true;

    // 启动时间更新循环
    this.startTimeUpdateLoop();
  }

  /**
   * 暂停播放
   */
  pause(): void {
    if (!this._isPlaying) return;

    this._pausedAt = this.getCurrentTime();
    this._isPlaying = false;

    this.sourceNode?.stop();
    this.sourceNode = null;

    this.stopTimeUpdateLoop();
  }

  /**
   * 停止播放
   */
  stop(): void {
    this._isPlaying = false;
    this._pausedAt = 0;
    this._startTime = 0;

    this.sourceNode?.stop();
    this.sourceNode = null;

    this.stopTimeUpdateLoop();
  }

  /**
   * 跳转到指定时间 (毫秒)
   */
  seek(timeMs: number): void {
    const wasPlaying = this._isPlaying;

    if (wasPlaying) {
      this.pause();
    }

    this._pausedAt = Math.max(0, Math.min(timeMs, this.song?.duration || 0));

    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * 设置时间更新回调
   */
  setOnTimeUpdate(callback: MusicPlayerCallback): void {
    this.onTimeUpdate = callback;
  }

  /**
   * 设置播放结束回调
   */
  setOnEnd(callback: MusicEndCallback): void {
    this.onEnd = callback;
  }

  /**
   * 内部：时间更新循环
   */
  private startTimeUpdateLoop(): void {
    const loop = () => {
      if (!this._isPlaying) return;

      const currentTime = this.getCurrentTime();
      this.onTimeUpdate?.(currentTime);

      // 检查是否超过歌曲时长
      if (this.song && currentTime >= this.song.duration) {
        this.stop();
        this.onEnd?.();
        return;
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    loop();
  }

  private stopTimeUpdateLoop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * 销毁播放器
   */
  destroy(): void {
    this.stop();
    this.audioBuffer = null;
    this.song = null;
    this.onTimeUpdate = null;
    this.onEnd = null;

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// 导出单例
let instance: MusicPlayer | null = null;

export function getMusicPlayer(): MusicPlayer {
  if (!instance) {
    instance = new MusicPlayer();
  }
  return instance;
}

export function resetMusicPlayer(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

export { MusicPlayer };
export default MusicPlayer;
