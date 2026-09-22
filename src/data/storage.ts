// 数据层：本地持久化（localStorage，单一根状态，无第三方依赖）

import type {AppState} from './types';

const STORAGE_KEY = 'license-lens-console-v1';

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (
      !parsed ||
      !Array.isArray(parsed.channels) ||
      !Array.isArray(parsed.components) ||
      !Array.isArray(parsed.batches) ||
      !Array.isArray(parsed.packages)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时静默失败，内存状态仍可用
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
