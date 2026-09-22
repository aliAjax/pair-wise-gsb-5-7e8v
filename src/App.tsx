// 界面层：应用外壳与导航（数据来自状态层，判定全部在 logic 层完成）

import {useMemo, useState} from 'react';
import {
  AlertTriangle,
  Ban,
  Boxes,
  FileLock2,
  Globe,
  Layers,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {StoreProvider, useStore} from './state/store';
import {ChannelsView} from './ui/ChannelsView';
import {ComponentsView} from './ui/ComponentsView';
import {BatchesView} from './ui/BatchesView';
import {PackagesView} from './ui/PackagesView';
import {BatchWizard} from './ui/BatchWizard';

type View = 'channels' | 'components' | 'batches' | 'packages';

interface WizardIntent {
  channelId?: string;
  basePackageId?: string;
}

function Shell() {
  const {state, resetDemo} = useStore();
  const [view, setView] = useState<View>('channels');
  const [selected, setSelected] = useState<Partial<Record<View, string>>>({});
  const [wizard, setWizard] = useState<WizardIntent | null>(null);

  const rejected = useMemo(
    () => state.batches.filter((b) => b.status === 'rejected').length,
    [state.batches],
  );

  const nav = [
    {key: 'channels' as const, icon: Globe, label: '分发渠道', count: state.channels.length},
    {key: 'components' as const, icon: Boxes, label: '组件登记', count: state.components.length},
    {key: 'packages' as const, icon: FileLock2, label: '通知包', count: state.packages.length},
    {key: 'batches' as const, icon: Layers, label: '核验批次', count: state.batches.length, danger: rejected},
  ];

  const select = (v: View) => (id: string) => setSelected((s) => ({...s, [v]: id}));

  const startWizard = (channelId?: string, basePackageId?: string) =>
    setWizard({channelId, basePackageId});

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <div className="brand-icon"><ShieldCheck size={18} /></div>
          <div>
            <b>License Lens</b>
            <small>NOTICE DESK</small>
          </div>
        </div>
        <div className="nav-title">NOTICE CONSOLE</div>
        {nav.map((n) => (
          <button
            key={n.key}
            className={view === n.key && !wizard ? 'nav active' : 'nav'}
            onClick={() => {
              setWizard(null);
              setView(n.key);
            }}
          >
            <n.icon size={16} /> {n.label}
            <span>
              {n.danger ? <b className="nav-danger"><Ban size={10} /> {n.danger}</b> : null}
              {n.count}
            </span>
          </button>
        ))}

        <div className="aside-bottom">
          <div className="mini-card">
            <AlertTriangle size={16} />
            <div>
              <b>核验规则</b>
              <small>R1 缺版权行 · R2 指纹不一致 · R3 GPL 入闭源渠道</small>
            </div>
          </div>
          <button
            className="nav reset"
            onClick={() => {
              if (confirm('重置为演示数据？当前录入的渠道、组件、批次与通知包将被覆盖。')) {
                resetDemo();
                setSelected({});
                setWizard(null);
                setView('channels');
              }
            }}
          >
            <RotateCcw size={14} /> 重置演示数据
          </button>
        </div>
      </aside>

      <main>
        <header className="nl-header">
          <div>
            <div className="crumb">NOTICE CONSOLE / <b>{sectionName(view, wizard)}</b></div>
            <h1>许可证通知包核验台</h1>
            <p>录入分发渠道与组件，规则核验通过后整包冻结导出；调整只新建带原因批次。</p>
          </div>
          {view !== 'batches' && !wizard && (
            <button className="primary" onClick={() => startWizard()}>
              <Layers size={15} /> 新建核验批次
            </button>
          )}
        </header>

        {wizard ? (
          <BatchWizard
            channelId={wizard.channelId}
            basePackageId={wizard.basePackageId}
            onCancel={() => setWizard(null)}
            onDone={(res) => {
              setWizard(null);
              setView('batches');
              setSelected((s) => ({...s, batches: res.batchId}));
              if (res.packageId) {
                setSelected((s) => ({...s, packages: res.packageId}));
              }
            }}
          />
        ) : view === 'channels' ? (
          <ChannelsView
            selectedId={selected.channels}
            onSelect={select('channels')}
            onNewBatch={(channelId) => startWizard(channelId)}
          />
        ) : view === 'components' ? (
          <ComponentsView />
        ) : view === 'packages' ? (
          <PackagesView
            selectedId={selected.packages}
            onSelect={select('packages')}
            onAdjust={(channelId, basePackageId) => startWizard(channelId, basePackageId)}
          />
        ) : (
          <BatchesView
            selectedId={selected.batches}
            onSelect={select('batches')}
            onOpenPackage={(packageId) => {
              setSelected((s) => ({...s, packages: packageId}));
              setView('packages');
            }}
          />
        )}
      </main>
    </div>
  );
}

function sectionName(view: View, wizard: WizardIntent | null): string {
  if (wizard) return wizard.basePackageId ? 'ADJUST BATCH' : 'NEW BATCH';
  return {channels: 'CHANNELS', components: 'COMPONENTS', packages: 'NOTICE PACKAGES', batches: 'BATCHES'}[view];
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
