// ---------- 界面壳：导航、视图切换、动作编排 ----------
import {useEffect, useMemo, useState} from 'react';
import {Download, Globe, History, Lock, Package, Plus, Scale, ShieldCheck, Sparkles} from 'lucide-react';
import type {AppState, ChannelKind, ComponentRecord, NoticePackage} from './types';
import {mergeComponents, buildNoticeExport} from './engine';
import {addChannel, addComponent, loadState, removeComponent, saveState, submitBatch, updateComponent} from './store';
import ConsoleView from './ui/ConsoleView';
import PackagesView from './ui/PackagesView';
import BatchesView from './ui/BatchesView';
import {ChannelModal, ComponentModal, SubmitModal} from './ui/modals';
import {KindBadge, download} from './ui/bits';

type View = 'console' | 'packages' | 'batches';
type Modal =
  | {type: 'addComponent'}
  | {type: 'editComponent'; id: string}
  | {type: 'addChannel'}
  | {type: 'submit'}
  | null;

export default function App() {
  const [state, setState] = useState<AppState>(loadState);
  const [view, setView] = useState<View>('console');
  const [channelId, setChannelId] = useState(state.channels[0]?.id ?? '');
  const [modal, setModal] = useState<Modal>(null);

  useEffect(() => saveState(state), [state]);

  const channel = state.channels.find(c => c.id === channelId) ?? state.channels[0];
  const records = useMemo(() => state.components.filter(c => c.channelId === channel?.id), [state.components, channel?.id]);
  const entries = useMemo(() => mergeComponents(records), [records]);
  const channelBatches = useMemo(
    () => state.batches.filter(b => b.channelId === channel?.id).sort((a, b) => b.seq - a.seq),
    [state.batches, channel?.id],
  );
  const channelPkg = useMemo(
    () => [...state.packages].reverse().find(p => p.channelId === channel?.id) ?? null,
    [state.packages, channel?.id],
  );
  const allBatchesDesc = useMemo(() => [...state.batches].sort((a, b) => b.seq - a.seq), [state.batches]);
  const lastBatch = allBatchesDesc[0];

  const exportPkg = (pkg: NoticePackage) => {
    const ch = state.channels.find(c => c.id === pkg.channelId);
    download(`NOTICE-${pkg.id}.txt`, buildNoticeExport(pkg, ch?.kind ?? 'closed'));
  };

  const doSubmit = (reason: string) => {
    if (!channel) return;
    const res = submitBatch(state, channel.id, reason, new Date().toISOString());
    setState(res.state);
    setModal(null);
    if (res.pkg) exportPkg(res.pkg); // 通过即冻结并导出
  };

  const saveComponent = (rec: Omit<ComponentRecord, 'id' | 'channelId'>) => {
    if (!channel) return;
    setState(s => modal?.type === 'editComponent'
      ? updateComponent(s, modal.id, rec)
      : addComponent(s, {...rec, channelId: channel.id}));
    setModal(null);
  };

  const editTarget = modal?.type === 'editComponent'
    ? state.components.find(c => c.id === modal.id)
    : undefined;

  const header = {
    console: {
      crumb: 'WORKSPACE / 核验台',
      title: channel?.name ?? '核验台',
      desc: channel?.kind === 'closed' ? '闭源分发渠道 · GPL 类许可证将触发整批拒绝' : '开源分发渠道 · 标准核验规则',
    },
    packages: {crumb: 'WORKSPACE / 通知包', title: '冻结通知包', desc: '核验通过后冻结的通知包，可导出，不可篡改'},
    batches: {crumb: 'WORKSPACE / 批次记录', title: '批次记录', desc: '每次核验生成不可变批次，旧批次保留可查'},
  }[view];

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={18}/></div>
          <div><b>License Lens</b><small>notice verification</small></div>
        </div>
        <div className="nav-title">工作台</div>
        <button className={view === 'console' ? 'nav active' : 'nav'} onClick={() => setView('console')}>
          <Scale size={16}/>核验台
        </button>
        <button className={view === 'packages' ? 'nav active' : 'nav'} onClick={() => setView('packages')}>
          <Package size={16}/>通知包<span>{state.packages.length}</span>
        </button>
        <button className={view === 'batches' ? 'nav active' : 'nav'} onClick={() => setView('batches')}>
          <History size={16}/>批次记录<span>{state.batches.length}</span>
        </button>
        <div className="nav-title with-action">
          分发渠道
          <button className="mini-add" title="新建渠道" onClick={() => setModal({type: 'addChannel'})}><Plus size={12}/></button>
        </div>
        {state.channels.map(c => (
          <button
            key={c.id}
            className={view === 'console' && c.id === channel?.id ? 'nav active' : 'nav'}
            onClick={() => {setChannelId(c.id); setView('console');}}
          >
            {c.kind === 'closed' ? <Lock size={14}/> : <Globe size={14}/>}
            {c.name}
            <span>{state.components.filter(x => x.channelId === c.id).length}</span>
          </button>
        ))}
        <div className="aside-bottom">
          <div className="mini-card">
            <Sparkles size={16}/>
            <div>
              <b>{lastBatch ? `最近批次 ${lastBatch.id} · ${lastBatch.status === 'frozen' ? '已冻结' : '被拒绝'}` : '尚无批次'}</b>
              <small>{state.packages.length} 个冻结包 · {state.batches.length} 个批次 · {state.components.length} 条登记</small>
            </div>
          </div>
          <div className="user"><div className="avatar">ZL</div><span>Zen Li · 合规</span></div>
        </div>
      </aside>

      <main>
        <header>
          <div>
            <div className="crumb">{header.crumb}</div>
            <h1>{header.title}{view === 'console' && channel && <> <KindBadge kind={channel.kind}/></>}</h1>
            <p>{header.desc}</p>
          </div>
          <div className="head-actions">
            {view === 'console' && (
              <>
                <button className="outline" disabled={!channelPkg} onClick={() => channelPkg && exportPkg(channelPkg)}>
                  <Download size={15}/>导出通知包
                </button>
                <button className="primary" onClick={() => setModal({type: 'addComponent'})}>
                  <Plus size={16}/>录入组件
                </button>
              </>
            )}
          </div>
        </header>

        {view === 'console' && channel && (
          <ConsoleView
            channel={channel}
            records={records}
            entries={entries}
            batches={channelBatches}
            pkg={channelPkg}
            onAdd={() => setModal({type: 'addComponent'})}
            onEdit={id => setModal({type: 'editComponent', id})}
            onRemove={id => setState(s => removeComponent(s, id))}
            onSubmit={() => setModal({type: 'submit'})}
            onExportPkg={exportPkg}
            onViewPackages={() => setView('packages')}
          />
        )}
        {view === 'packages' && <PackagesView packages={state.packages} channels={state.channels} onExport={exportPkg}/>}
        {view === 'batches' && <BatchesView batches={allBatchesDesc} packages={state.packages} onExport={exportPkg}/>}
      </main>

      {modal?.type === 'addComponent' && channel && (
        <ComponentModal channel={channel} onSave={saveComponent} onClose={() => setModal(null)}/>
      )}
      {modal?.type === 'editComponent' && editTarget && channel && (
        <ComponentModal channel={channel} initial={editTarget} onSave={saveComponent} onClose={() => setModal(null)}/>
      )}
      {modal?.type === 'addChannel' && (
        <ChannelModal
          onSave={(name: string, kind: ChannelKind) => {setState(s => addChannel(s, name, kind)); setModal(null);}}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'submit' && channel && (
        <SubmitModal
          channel={channel}
          recordCount={records.length}
          entries={entries}
          frozenPkg={channelPkg}
          onConfirm={doSubmit}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
