/**
 * RhythmEngine - 节拍时钟引擎
 *
 * 基于 AudioContext 提供精确的节拍计时，用于：
 * - 星星呼吸动画同步
 * - 拨弦判定（Perfect/Good/Miss）
 */

// 判定窗口配置（毫秒）
export const JUDGE_WINDOWS = {
  PERFECT: 50,  // ±50ms
  GOOD: 100,    // ±100ms
} as const;

export type JudgeResult = 'perfect' | 'good' | 'miss';

export interface JudgeEvent {
  result: JudgeResult;
  timing: number;    // 偏差 ms，负=早，正=晚
  timestamp: number; // 触发时间
}

type BeatCallback = (beatNumber: number) => void;

class RhythmEngine {
  private _bpm: number = 90;
  private _isRunning: boolean = false;
  private _startTime: number = 0;
  private _pausedTime: number = 0;
  private _audioContext: AudioContext | null = null;
  private _beatCallbacks: BeatCallback[] = [];
  private _lastBeatNumber: number = -1;
  private _animationFrameId: number | null = null;

  constructor(bpm: number = 90) {
    this._bpm = bpm;
  }

  // ============ Getters ============

  get bpm(): number {
    return this._bpm;
  }

  set bpm(value: number) {
    if (value > 0 && value <= 300) {
      this._bpm = value;
    }
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * 每拍的时长（毫秒）
   */
  get beatDuration(): number {
    return (60 / this._bpm) * 1000;
  }

  // ============ 核心方法 ============

  /**
   * 获取 AudioContext（懒加载）
   */
  private getAudioContext(): AudioContext {
    if (!this._audioContext) {
      this._audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this._audioContext.state === 'suspended') {
      this._audioContext.resume();
    }
    return this._audioContext;
  }

  /**
   * 获取当前精确时间（毫秒）
   */
  private getCurrentTime(): number {
    return this.getAudioContext().currentTime * 1000;
  }

  /**
   * 获取自引擎启动以来经过的时间（毫秒）
   */
  private getElapsedTime(): number {
    if (!this._isRunning) {
      return this._pausedTime;
    }
    return this.getCurrentTime() - this._startTime;
  }

  /**
   * 启动节拍引擎
   */
  start(): void {
    if (this._isRunning) return;

    const ctx = this.getAudioContext();

    if (this._pausedTime > 0) {
      // 从暂停状态恢复
      this._startTime = ctx.currentTime * 1000 - this._pausedTime;
    } else {
      // 全新启动
      this._startTime = ctx.currentTime * 1000;
    }

    this._isRunning = true;
    this._lastBeatNumber = -1;
    this.startBeatLoop();
  }

  /**
   * 停止节拍引擎
   */
  stop(): void {
    this._isRunning = false;
    this._pausedTime = 0;
    this._startTime = 0;
    this._lastBeatNumber = -1;
    this.stopBeatLoop();
  }

  /**
   * 暂停节拍引擎
   */
  pause(): void {
    if (!this._isRunning) return;
    this._pausedTime = this.getElapsedTime();
    this._isRunning = false;
    this.stopBeatLoop();
  }

  /**
   * 内部节拍循环，用于触发回调
   */
  private startBeatLoop(): void {
    const loop = () => {
      if (!this._isRunning) return;

      const currentBeat = this.getCurrentBeat();

      // 检测是否跨越了新的节拍
      if (currentBeat !== this._lastBeatNumber) {
        this._lastBeatNumber = currentBeat;
        this._beatCallbacks.forEach(cb => cb(currentBeat));
      }

      this._animationFrameId = requestAnimationFrame(loop);
    };

    loop();
  }

  private stopBeatLoop(): void {
    if (this._animationFrameId !== null) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }
  }

  // ============ 节拍查询 ============

  /**
   * 获取当前节拍编号（整数，从 0 开始）
   */
  getCurrentBeat(): number {
    const elapsed = this.getElapsedTime();
    return Math.floor(elapsed / this.beatDuration);
  }

  /**
   * 获取当前节拍相位（0-1）
   * 0 = 节拍开始，1 = 接近下一个节拍
   * 用于动画插值（如星星呼吸）
   */
  getBeatPhase(): number {
    const elapsed = this.getElapsedTime();
    return (elapsed % this.beatDuration) / this.beatDuration;
  }

  /**
   * 获取用于呼吸动画的缩放值
   * 返回 0-1，在节拍点为 1，然后 ease-out 衰减到 0
   */
  getBreathValue(): number {
    const phase = this.getBeatPhase();
    // 使用 ease-out 曲线：快速上升，缓慢下降
    // 在 phase=0 时值最大，然后衰减
    return Math.pow(1 - phase, 2);
  }

  /**
   * 获取距离上一个节拍的时间（毫秒）
   */
  getTimeSinceLastBeat(): number {
    const elapsed = this.getElapsedTime();
    return elapsed % this.beatDuration;
  }

  /**
   * 获取距离最近节拍的时间（毫秒，可正可负）
   * 负 = 在节拍之前，正 = 在节拍之后
   */
  getTimeToNearestBeat(): number {
    const timeSinceLast = this.getTimeSinceLastBeat();
    const timeToNext = this.beatDuration - timeSinceLast;

    // 返回绝对值更小的那个
    if (timeSinceLast <= timeToNext) {
      return timeSinceLast; // 刚过节拍
    } else {
      return -timeToNext;   // 接近下一个节拍
    }
  }

  /**
   * 判断当前是否在节拍上（在容差范围内）
   * @param toleranceMs 容差，默认使用 GOOD 窗口
   */
  isOnBeat(toleranceMs: number = JUDGE_WINDOWS.GOOD): boolean {
    const timeToNearest = Math.abs(this.getTimeToNearestBeat());
    return timeToNearest <= toleranceMs;
  }

  // ============ 判定系统 ============

  /**
   * 判定拨弦时机
   * @returns JudgeEvent 判定结果
   */
  judge(): JudgeEvent {
    const timing = this.getTimeToNearestBeat();
    const absTiming = Math.abs(timing);

    let result: JudgeResult;

    if (absTiming <= JUDGE_WINDOWS.PERFECT) {
      result = 'perfect';
    } else if (absTiming <= JUDGE_WINDOWS.GOOD) {
      result = 'good';
    } else {
      result = 'miss';
    }

    return {
      result,
      timing,
      timestamp: Date.now(),
    };
  }

  // ============ 回调注册 ============

  /**
   * 注册节拍回调
   * @param callback 每个节拍触发的回调
   * @returns 取消注册的函数
   */
  onBeat(callback: BeatCallback): () => void {
    this._beatCallbacks.push(callback);
    return () => {
      const index = this._beatCallbacks.indexOf(callback);
      if (index > -1) {
        this._beatCallbacks.splice(index, 1);
      }
    };
  }

  // ============ 清理 ============

  /**
   * 销毁引擎，释放资源
   */
  destroy(): void {
    this.stop();
    this._beatCallbacks = [];
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
  }
}

// 导出单例
let instance: RhythmEngine | null = null;

export function getRhythmEngine(bpm?: number): RhythmEngine {
  if (!instance) {
    instance = new RhythmEngine(bpm);
  } else if (bpm !== undefined) {
    instance.bpm = bpm;
  }
  return instance;
}

export function resetRhythmEngine(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

export { RhythmEngine };
export default RhythmEngine;
