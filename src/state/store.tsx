// 状态层：领域动作编排（调用判定层，结果整体落盘）。本身不实现规则。

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type {
  AppState,
  Batch,
  Channel,
  ChannelKind,
  ComponentRecord,
  EntryInput,
  NoticePackage,
} from '../data/types';
import {clearState, loadState, saveState} from '../data/storage';
import {
  seedBatches,
  seedChannels,
  seedComponents,
  toEntryInput,
} from '../data/seed';
import {buildPackageDraft, verifyEntries} from '../logic/rules';
import {dayStamp, fingerprintOf} from '../logic/fingerprint';

export function uid(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

/** 新建批次入参 */
export interface SubmitBatchInput {
  channelId: string;
  reason: string;
  basePackageId?: string;
  entries: Array<Omit<EntryInput, 'id'>>;
}

/** 组件登记保存入参（id 为空表示新增） */
export interface SaveComponentInput {
  id?: string;
  name: string;
  version: string;
  license: string;
  licensePath: string;
  copyrights: string[];
  licenseText: string;
}

interface StoreValue {
  state: AppState;
  addChannel: (input: {name: string; kind: ChannelKind; note: string}) => Channel;
  saveComponent: (input: SaveComponentInput) => void;
  removeComponent: (id: string) => void;
  submitBatch: (input: SubmitBatchInput) => {passed: boolean; batchId: string; packageId?: string};
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

// ---- 编号分配：批次按日递增，通知包按渠道递增（基于已有数据，刷新后连续） ----

function nextBatchCode(state: AppState, ts: number): string {
  const day = dayStamp(ts);
  const prefix = `B-${day}-`;
  const max = state.batches.reduce((acc, b) => {
    if (b.code.startsWith(prefix)) {
      const n = Number(b.code.slice(prefix.length));
      return Number.isFinite(n) ? Math.max(acc, n) : acc;
    }
    return acc;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

function nextPackageSeq(state: AppState, channelId: string): number {
  return (
    state.packages.reduce(
      (acc, p) => (p.channelId === channelId ? Math.max(acc, p.seq) : acc),
      0,
    ) + 1
  );
}

// ---- 初始状态：用种子数据跑一遍真实的核验流水线，保证数据与判定一致 ----

function buildInitialState(): AppState {
  const base: AppState = {
    channels: [...seedChannels],
    components: [...seedComponents],
    batches: [],
    packages: [],
  };

  let working = base;
  for (const spec of seedBatches) {
    const channel = working.channels.find((c) => c.id === spec.channelId)!;
    const entries = spec.entries.map(toEntryInput);
    const result = submitDraft(working, channel, spec.reason, undefined, entries, spec.createdAt);
    working = result.state;
  }
  return working;
}

/** 纯函数版批次提交，供初始化与 store 动作共用 */
function submitDraft(
  prev: AppState,
  channel: Channel,
  reason: string,
  basePackageId: string | undefined,
  rawEntries: Array<Omit<EntryInput, 'id'>>,
  createdAt: number,
): {state: AppState; batch: Batch; pkg?: NoticePackage} {
  const entries: EntryInput[] = rawEntries.map((e) => ({...e, id: uid('ent')}));
  const result = verifyEntries(entries, channel);

  const batch: Batch = {
    id: uid('batch'),
    code: nextBatchCode(prev, createdAt),
    channelId: channel.id,
    reason,
    basePackageId,
    entries,
    status: result.passed ? 'approved' : 'rejected',
    violations: result.violations,
    createdAt,
  };

  let pkg: NoticePackage | undefined;
  let packages = prev.packages;

  if (result.passed) {
    const seq = nextPackageSeq(prev, channel.id);
    pkg = {
      id: uid('pkg'),
      code: `NP-${String(packages.length + 1).padStart(3, '0')}`,
      seq,
      batchId: batch.id,
      ...buildPackageDraft(channel, result.items, createdAt),
    };
    batch.packageId = pkg.id;
    packages = [...packages, pkg];
  }

  return {
    state: {...prev, batches: [...prev.batches, batch], packages},
    batch,
    pkg,
  };
}

export function StoreProvider({children}: {children: ReactNode}) {
  const [state, setState] = useState<AppState>(() => loadState() ?? buildInitialState());
  const stateRef = useRef(state);
  stateRef.current = state;

  // 刷新后渠道、组件、批次、通知包一致：根状态整体写入同一个 key
  useEffect(() => {
    saveState(state);
  }, [state]);

  const value = useMemo<StoreValue>(
    () => ({
      state,

      addChannel({name, kind, note}) {
        const channel: Channel = {
          id: uid('ch'),
          name: name.trim(),
          kind,
          note: note.trim(),
          createdAt: Date.now(),
        };
        setState((s) => ({...s, channels: [...s.channels, channel]}));
        return channel;
      },

      saveComponent(input) {
        setState((s) => {
          const fingerprint = fingerprintOf(input.licenseText);
          if (input.id) {
            // 组件主数据可自由维护；已冻结通知包使用自己的快照，不受影响
            return {
              ...s,
              components: s.components.map((c) =>
                c.id === input.id
                  ? {...c, ...input, copyrights: input.copyrights, fingerprint, updatedAt: Date.now()}
                  : c,
              ),
            };
          }
          const record: ComponentRecord = {
            id: uid('cmp'),
            name: input.name.trim(),
            version: input.version.trim(),
            license: input.license,
            licensePath: input.licensePath.trim(),
            copyrights: input.copyrights,
            licenseText: input.licenseText,
            fingerprint,
            updatedAt: Date.now(),
          };
          return {...s, components: [...s.components, record]};
        });
      },

      removeComponent(id) {
        setState((s) => ({...s, components: s.components.filter((c) => c.id !== id)}));
      },

      submitBatch(input) {
        const channel = stateRef.current.channels.find((c) => c.id === input.channelId);
        if (!channel) throw new Error('渠道不存在');
        if (input.entries.length === 0) throw new Error('至少录入一条组件');
        const draft = submitDraft(
          stateRef.current,
          channel,
          input.reason.trim(),
          input.basePackageId,
          input.entries,
          Date.now(),
        );
        setState(draft.state);
        return {passed: draft.batch.status === 'approved', batchId: draft.batch.id, packageId: draft.pkg?.id};
      },

      resetDemo() {
        clearState();
        setState(buildInitialState());
      },
    }),
    [state],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用');
  return ctx;
}
