// 界面层：分发渠道视图

import {useMemo, useState} from 'react';
import {Globe, Lock, Plus, Boxes, Layers, CheckCircle2} from 'lucide-react';
import {useStore} from '../state/store';
import type {Channel} from '../data/types';
import {Modal, Tag} from './widgets';

export function ChannelsView({
  selectedId,
  onSelect,
  onNewBatch,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onNewBatch: (channelId: string, basePackageId?: string) => void;
}) {
  const {state, addChannel} = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'open' | 'closed'>('closed');
  const [note, setNote] = useState('');

  const stats = useMemo(() => {
    const map = new Map<string, {batches: number; approved: number; latestPkg?: string}>();
    for (const c of state.channels) map.set(c.id, {batches: 0, approved: 0});
    for (const b of state.batches) {
      const s = map.get(b.channelId);
      if (!s) continue;
      s.batches += 1;
      if (b.status === 'approved') s.approved += 1;
    }
    for (const p of state.packages) {
      const s = map.get(p.channelId);
      if (s && (!s.latestPkg || p.seq > Number(s.latestPkg.slice(3)))) s.latestPkg = p.code;
    }
    return map;
  }, [state]);

  const submit = () => {
    if (!name.trim()) return;
    const c = addChannel({name, kind, note});
    setShowAdd(false);
    setName('');
    setNote('');
    onSelect(c.id);
  };

  return (
    <div className="nl-view">
      <div className="nl-list-head">
        <div>
          <h2>分发渠道</h2>
          <p>许可证义务按分发渠道核验；闭源渠道禁止 GPL 系列组件（规则 R3）</p>
        </div>
        <button className="nl-btn primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> 录入渠道
        </button>
      </div>

      <div className="nl-cards">
        {state.channels.map((c) => (
          <ChannelCard
            key={c.id}
            channel={c}
            active={c.id === selectedId}
            stat={stats.get(c.id)!}
            onClick={() => onSelect(c.id)}
            onAdjust={() => onNewBatch(c.id)}
          />
        ))}
      </div>

      {showAdd && (
        <Modal title="录入分发渠道" onClose={() => setShowAdd(false)}>
          <div className="nl-form">
            <label>
              渠道名称
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如 Aurora Desktop 安装包"
              />
            </label>
            <label>
              渠道形态
              <div className="nl-seg">
                <button
                  type="button"
                  className={kind === 'closed' ? 'active' : ''}
                  onClick={() => setKind('closed')}
                >
                  <Lock size={14} /> 闭源渠道
                </button>
                <button
                  type="button"
                  className={kind === 'open' ? 'active' : ''}
                  onClick={() => setKind('open')}
                >
                  <Globe size={14} /> 开源渠道
                </button>
              </div>
            </label>
            <label>
              备注
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="分发方式、是否随附源码等"
              />
            </label>
            <button className="nl-btn primary nl-block" onClick={submit} disabled={!name.trim()}>
              保存渠道
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ChannelCard({
  channel,
  stat,
  active,
  onClick,
  onAdjust,
}: {
  channel: Channel;
  stat: {batches: number; approved: number; latestPkg?: string};
  active: boolean;
  onClick: () => void;
  onAdjust: () => void;
}) {
  const closed = channel.kind === 'closed';
  return (
    <div className={active ? 'nl-card active' : 'nl-card'} onClick={onClick}>
      <div className="nl-card-top">
        <span className={`nl-channel-ic ${closed ? 'closed' : 'open'}`}>
          {closed ? <Lock size={16} /> : <Globe size={16} />}
        </span>
        <Tag tone={closed ? 'warn' : 'ok'}>{closed ? '闭源' : '开源'}</Tag>
      </div>
      <h3>{channel.name}</h3>
      <p className="nl-card-note">{channel.note || '无备注'}</p>
      <div className="nl-card-stats">
        <span>
          <Boxes size={12} /> {stat.batches} 个批次
        </span>
        <span>
          <CheckCircle2 size={12} /> {stat.approved} 次通过
        </span>
        <span>
          <Layers size={12} /> {stat.latestPkg ? `当前 ${stat.latestPkg}` : '无通知包'}
        </span>
      </div>
      <button
        className="nl-btn ghost mini"
        onClick={(e) => {
          e.stopPropagation();
          onAdjust();
        }}
      >
        为该渠道新建批次
      </button>
    </div>
  );
}
