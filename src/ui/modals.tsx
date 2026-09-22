// ---------- 弹窗：录入/编辑组件、新建渠道、提交核验 ----------
import {useMemo, useState} from 'react';
import {AlertTriangle, FileText, GitMerge, Globe, Lock, Snowflake} from 'lucide-react';
import {RULES, extractCopyrightLines, textFingerprint} from '../engine';
import {CANONICAL_LICENSES, LICENSE_OPTIONS, withCopyright} from '../canonical';
import type {Channel, ChannelKind, ComponentRecord, NoticeEntry, NoticePackage} from '../types';
import {Mono} from './bits';

function ModalShell({title, onClose, children, wide}: {title: string; onClose(): void; children: React.ReactNode; wide?: boolean}) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className={wide ? 'modal wide' : 'modal'} onClick={e => e.stopPropagation()}>
        <div className="modal-head"><h2>{title}</h2><button onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  );
}

// ----- 录入 / 编辑组件 -----
export function ComponentModal({channel, initial, onSave, onClose}: {
  channel: Channel;
  initial?: ComponentRecord;
  onSave(rec: Omit<ComponentRecord, 'id' | 'channelId'>): void;
  onClose(): void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [version, setVersion] = useState(initial?.version ?? '');
  const [license, setLicense] = useState(initial?.license ?? 'MIT');
  const [path, setPath] = useState(initial?.licensePath ?? 'LICENSE');
  const [text, setText] = useState(initial?.text ?? '');
  const crCount = useMemo(() => extractCopyrightLines(text).length, [text]);
  const fp = useMemo(() => textFingerprint(text), [text, ]);
  const canonical = CANONICAL_LICENSES[license];
  const valid = name.trim() && version.trim() && path.trim() && text.trim();

  return (
    <ModalShell title={initial ? '编辑组件' : `录入组件 · ${channel.name}`} onClose={onClose} wide>
      <div className="form-grid">
        <label>组件名称<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="例如 lodash"/></label>
        <label>版本<input value={version} onChange={e => setVersion(e.target.value)} placeholder="例如 4.17.21"/></label>
        <label>许可证
          <select value={license} onChange={e => setLicense(e.target.value)}>
            {LICENSE_OPTIONS.map(l => <option key={l}>{l}</option>)}
          </select>
        </label>
        <label>许可证路径<input value={path} onChange={e => setPath(e.target.value)} placeholder="LICENSE"/></label>
      </div>
      <label className="text-label">许可证文本
        <textarea rows={9} value={text} onChange={e => setText(e.target.value)} placeholder="粘贴包内许可证文件原文…"/>
      </label>
      <div className="text-facts">
        <span className={crCount === 0 ? 'fact bad' : 'fact'}>{crCount === 0 ? '未检测到版权行' : `检测到 ${crCount} 行版权`}</span>
        <span className="fact">指纹 <Mono>{fp}</Mono></span>
        {canonical
          ? <button className="outline sm" onClick={() => setText(withCopyright(license, extractCopyrightLines(text)[0] ?? 'Copyright (c) <year> <copyright holders>'))}><FileText size={13}/>填入 {license} 标准文本</button>
          : <span className="fact warn"><AlertTriangle size={11}/>该许可证未收录标准文本，跳过指纹比对</span>}
      </div>
      <button className="primary full" disabled={!valid} onClick={() => valid && onSave({name: name.trim(), version: version.trim(), license, licensePath: path.trim(), text})}>
        {initial ? '保存修改' : '加入登记'}
      </button>
    </ModalShell>
  );
}

// ----- 新建渠道 -----
export function ChannelModal({onSave, onClose}: {onSave(name: string, kind: ChannelKind): void; onClose(): void}) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ChannelKind>('closed');
  return (
    <ModalShell title="新建分发渠道" onClose={onClose}>
      <label>渠道名称<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="例如 OEM 预装"/></label>
      <div className="radio-row">
        <button className={kind === 'closed' ? 'radio-card active' : 'radio-card'} onClick={() => setKind('closed')}>
          <Lock size={16}/><b>闭源渠道</b><small>GPL 类许可证将被拒绝</small>
        </button>
        <button className={kind === 'open' ? 'radio-card active' : 'radio-card'} onClick={() => setKind('open')}>
          <Globe size={16}/><b>开源渠道</b><small>不限制 copyleft</small>
        </button>
      </div>
      <button className="primary full" disabled={!name.trim()} onClick={() => name.trim() && onSave(name.trim(), kind)}>创建渠道</button>
    </ModalShell>
  );
}

// ----- 提交核验 -----
export function SubmitModal({channel, recordCount, entries, frozenPkg, onConfirm, onClose}: {
  channel: Channel;
  recordCount: number;
  entries: NoticeEntry[];
  frozenPkg: NoticePackage | null; // 已有冻结包 → 本次属调整，原因必填
  onConfirm(reason: string): void;
  onClose(): void;
}) {
  const [reason, setReason] = useState('');
  const adjusting = frozenPkg !== null;
  const needReason = adjusting && !reason.trim();
  const crTotal = entries.reduce((n, e) => n + e.copyrightLines.length, 0);
  return (
    <ModalShell title={`提交核验 · ${channel.name}`} onClose={onClose}>
      <div className="submit-stats">
        <div><b>{recordCount}</b><span>登记记录</span></div>
        <GitMerge size={14} className="arrow"/>
        <div><b>{entries.length}</b><span>合并条目</span></div>
        <div><b>{crTotal}</b><span>版权行</span></div>
      </div>
      <ul className="rule-list in-modal">
        {RULES.map(r => (
          <li key={r.id}><span className={`rule-dot ${r.id}`}/><div><b>{r.label}</b><small>{r.desc}</small></div></li>
        ))}
      </ul>
      {adjusting && (
        <div className="adjust-note">
          <Snowflake size={14}/>
          <p>该渠道已冻结 <b>{frozenPkg.id}</b>。本次提交只<b>新建批次</b>，旧批次与旧包保留可查，请填写调整原因。</p>
        </div>
      )}
      <label>批次原因{adjusting && <em>（必填）</em>}
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder={adjusting ? '例如：升级 lodash 至 4.17.21 并补充版权行' : '首次核验'}/>
      </label>
      <button className="primary full" disabled={needReason} onClick={() => onConfirm(reason)}>
        提交核验{adjusting ? '并新建批次' : ''}
      </button>
    </ModalShell>
  );
}
