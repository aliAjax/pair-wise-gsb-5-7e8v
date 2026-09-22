// ---------- 状态存储与迁移（持久化 + 不可变状态变更） ----------
import {mergeComponents, packageFingerprint, validateEntries} from './engine';
import {CANONICAL_FINGERPRINTS} from './canonical';
import {seedState} from './data';
import type {AppState, Batch, Channel, ChannelKind, ComponentRecord, NoticePackage} from './types';

const STORAGE_KEY = 'license-lens-console-v1';

/** 读取持久化状态；缺失或损坏时回退到种子数据 */
export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as AppState;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.channels) && Array.isArray(parsed.components)
      && Array.isArray(parsed.packages) && Array.isArray(parsed.batches)) {
      return parsed;
    }
  } catch {
    // 忽略损坏数据，回退种子
  }
  return seedState();
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function addChannel(state: AppState, name: string, kind: ChannelKind): AppState {
  const channel: Channel = {id: newId('ch'), name: name.trim(), kind};
  return {...state, channels: [...state.channels, channel]};
}

export function addComponent(state: AppState, record: Omit<ComponentRecord, 'id'>): AppState {
  return {...state, components: [...state.components, {...record, id: newId('cmp')}]};
}

export function updateComponent(state: AppState, id: string, patch: Omit<ComponentRecord, 'id' | 'channelId'>): AppState {
  return {
    ...state,
    components: state.components.map(c => (c.id === id ? {...c, ...patch} : c)),
  };
}

export function removeComponent(state: AppState, id: string): AppState {
  return {...state, components: state.components.filter(c => c.id !== id)};
}

/**
 * 提交核验：合并当前渠道登记 → 逐条判定 → 生成新批次。
 * 任一违规则整批拒绝；全部通过则冻结通知包。旧批次永远保留可查。
 */
export function submitBatch(state: AppState, channelId: string, reason: string, now: string): {state: AppState; batch: Batch; pkg: NoticePackage | null} {
  const channel = state.channels.find(c => c.id === channelId);
  if (!channel) throw new Error(`渠道不存在: ${channelId}`);
  const records = state.components.filter(c => c.channelId === channelId);
  const entries = mergeComponents(records);
  const violations = validateEntries(entries, channel, CANONICAL_FINGERPRINTS);
  const seq = state.batches.reduce((m, b) => Math.max(m, b.seq), 0) + 1;
  const batch: Batch = {
    id: `B-${String(seq).padStart(4, '0')}`,
    seq,
    channelId,
    channelName: channel.name,
    reason: reason.trim() || '首次核验',
    createdAt: now,
    status: violations.length > 0 ? 'rejected' : 'frozen',
    entries,
    violations,
    packageFingerprint: packageFingerprint(entries),
  };
  let pkg: NoticePackage | null = null;
  let packages = state.packages;
  if (batch.status === 'frozen') {
    const pseq = state.packages.reduce((m, p) => Math.max(m, Number(p.id.replace(/\D/g, '')) || 0), 0) + 1;
    pkg = {
      id: `PKG-${String(pseq).padStart(4, '0')}`,
      batchId: batch.id,
      channelId,
      channelName: channel.name,
      frozenAt: now,
      reason: batch.reason,
      entries,
      fingerprint: batch.packageFingerprint,
    };
    packages = [...packages, pkg];
  }
  return {state: {...state, batches: [...state.batches, batch], packages}, batch, pkg};
}
