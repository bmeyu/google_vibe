/**
 * NoteManager - 音符管理器
 *
 * 根据歌曲配置和当前播放时间，管理音符的生命周期
 */

import { Song, SongNote, ActiveNote, JudgeResult } from '../types';

// 判定窗口配置
export const NOTE_JUDGE_WINDOWS = {
  PERFECT: 0.08,  // progress 在 0.92-1.08 之间
  GOOD: 0.15,     // progress 在 0.85-1.15 之间
} as const;

// 音符消失阈值
const NOTE_MISS_THRESHOLD = 1.3; // progress 超过此值后移除

class NoteManager {
  private song: Song | null = null;
  private activeNotes: ActiveNote[] = [];
  private nextNoteIndex: number = 0;
  private noteIdCounter: number = 0;

  /**
   * 加载歌曲数据
   */
  loadSong(song: Song): void {
    this.song = song;
    this.reset();
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.activeNotes = [];
    this.nextNoteIndex = 0;
    this.noteIdCounter = 0;
  }

  /**
   * 根据当前播放时间更新音符状态
   * @param currentTime 当前播放时间 (ms)
   * @returns 当前活跃的音符列表
   */
  update(currentTime: number): ActiveNote[] {
    if (!this.song) return [];

    const leadTime = this.song.leadTime;

    // 1. 添加新音符（提前 leadTime 出现）
    while (this.nextNoteIndex < this.song.notes.length) {
      const songNote = this.song.notes[this.nextNoteIndex];
      const appearTime = songNote.time - leadTime;

      if (currentTime >= appearTime) {
        this.activeNotes.push({
          id: this.noteIdCounter++,
          songNote,
          progress: 0,
          hit: false,
          missed: false,
        });
        this.nextNoteIndex++;
      } else {
        break;
      }
    }

    // 2. 更新现有音符的 progress
    this.activeNotes.forEach(note => {
      if (note.hit || note.missed) return;

      const timeSinceAppear = currentTime - (note.songNote.time - leadTime);
      note.progress = timeSinceAppear / leadTime;

      // 检查是否错过（超过判定窗口）
      if (note.progress > 1 + NOTE_JUDGE_WINDOWS.GOOD) {
        note.missed = true;
      }
    });

    // 3. 移除已消失的音符
    this.activeNotes = this.activeNotes.filter(
      note => note.progress < NOTE_MISS_THRESHOLD
    );

    return this.activeNotes;
  }

  /**
   * 尝试击中指定弦上的音符
   * @param stringIndex 弦索引 (-1, 0, 1)
   * @returns 判定结果，如果没有音符则返回 null
   */
  tryHitNote(stringIndex: -1 | 0 | 1): { note: ActiveNote; result: JudgeResult } | null {
    // 找到该弦上未被击中且在判定范围内的音符
    const candidates = this.activeNotes.filter(
      note =>
        note.songNote.string === stringIndex &&
        !note.hit &&
        !note.missed &&
        note.progress >= (1 - NOTE_JUDGE_WINDOWS.GOOD) &&
        note.progress <= (1 + NOTE_JUDGE_WINDOWS.GOOD)
    );

    if (candidates.length === 0) return null;

    // 选择最接近判定线的音符
    const note = candidates.reduce((closest, current) =>
      Math.abs(current.progress - 1) < Math.abs(closest.progress - 1) ? current : closest
    );

    // 计算判定结果
    const deviation = Math.abs(note.progress - 1);
    let result: JudgeResult;

    if (deviation <= NOTE_JUDGE_WINDOWS.PERFECT) {
      result = 'perfect';
    } else if (deviation <= NOTE_JUDGE_WINDOWS.GOOD) {
      result = 'good';
    } else {
      result = 'miss';
    }

    note.hit = true;

    return { note, result };
  }

  /**
   * 获取当前活跃的音符列表
   */
  getActiveNotes(): ActiveNote[] {
    return this.activeNotes;
  }

  /**
   * 获取当前歌曲
   */
  getSong(): Song | null {
    return this.song;
  }
}

// 导出单例
let instance: NoteManager | null = null;

export function getNoteManager(): NoteManager {
  if (!instance) {
    instance = new NoteManager();
  }
  return instance;
}

export function resetNoteManager(): void {
  if (instance) {
    instance.reset();
    instance = null;
  }
}

export { NoteManager };
export default NoteManager;
