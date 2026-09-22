// 界面层：组件登记视图（组件主数据，可复用于批次录入；冻结通知包不受其后续修改影响）

import {useMemo, useState} from 'react';
import {PackagePlus, Pencil, Search, Trash2, Fingerprint} from 'lucide-react';
import {useStore, type SaveComponentInput} from '../state/store';
import type {ComponentRecord} from '../data/types';
import {Empty, LicenseTag, Modal, Tag} from './widgets';
import {cleanCopyrights, fingerprintOf} from '../logic/fingerprint';

const LICENSE_CHOICES = ['MIT', 'BSD-3-Clause', 'Apache-2.0', 'ISC', 'GPL-2.0', 'GPL-3.0', 'AGPL-3.0'];

export function ComponentsView() {
  const {state} = useStore();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<SaveComponentInput | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...state.components].sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        b.version.localeCompare(a.version),
    );
    return q
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.version.toLowerCase().includes(q) ||
            c.license.toLowerCase().includes(q),
        )
      : list;
  }, [state.components, query]);

  return (
    <div className="nl-view">
      <div className="nl-list-head">
        <div>
          <h2>组件登记</h2>
          <p>登记组件、版本、许可证路径、版权行与许可证原文；录入批次时可直接引用</p>
        </div>
        <div className="nl-head-tools">
          <div className="nl-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索组件 / 版本 / 许可证" />
          </div>
          <button className="nl-btn primary" onClick={() => setEditing({name: '', version: '', license: 'MIT', licensePath: '', copyrights: [], licenseText: ''})}>
            <PackagePlus size={15} /> 登记组件
          </button>
        </div>
      </div>

      <div className="nl-table-wrap">
        <table className="nl-table">
          <thead>
            <tr>
              <th>组件</th>
              <th>版本</th>
              <th>许可证</th>
              <th>许可证路径</th>
              <th>版权行</th>
              <th>文本指纹</th>
              <th className="nl-col-actions">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <ComponentRow key={c.id} c={c} onEdit={() => setEditing(toForm(c))} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty>没有匹配的组件登记记录</Empty>}
      </div>

      {editing && <ComponentEditor initial={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ComponentRow({c, onEdit}: {c: ComponentRecord; onEdit: () => void}) {
  const {removeComponent} = useStore();
  return (
    <tr>
      <td className="nl-mono-name">{c.name}</td>
      <td className="nl-muted">{c.version}</td>
      <td><LicenseTag license={c.license} /></td>
      <td className="nl-path">{c.licensePath}</td>
      <td>
        {c.copyrights.length > 0 ? (
          <span className="nl-copyright-count" title={c.copyrights.join('\n')}>
            {c.copyrights.length} 行
          </span>
        ) : (
          <Tag tone="bad">缺失</Tag>
        )}
      </td>
      <td>
        <span className="nl-fp" title={c.fingerprint}>
          <Fingerprint size={11} /> {c.fingerprint || '—'}
        </span>
      </td>
      <td className="nl-col-actions">
        <button className="nl-icon-btn" title="编辑" onClick={onEdit}><Pencil size={14} /></button>
        <button
          className="nl-icon-btn danger"
          title="删除登记"
          onClick={() => {
            if (confirm(`删除组件登记「${c.name}@${c.version}」？已冻结的通知包不受影响。`)) {
              removeComponent(c.id);
            }
          }}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

function toForm(c: ComponentRecord): SaveComponentInput {
  return {
    id: c.id,
    name: c.name,
    version: c.version,
    license: c.license,
    licensePath: c.licensePath,
    copyrights: c.copyrights,
    licenseText: c.licenseText,
  };
}

export function ComponentEditor({initial, onClose}: {initial: SaveComponentInput; onClose: () => void}) {
  const {saveComponent} = useStore();
  const [form, setForm] = useState<SaveComponentInput>(initial);
  const [copyrightText, setCopyrightText] = useState(initial.copyrights.join('\n'));

  const valid = form.name.trim() && form.version.trim() && form.licensePath.trim();
  const fp = useMemo(() => fingerprintOf(form.licenseText), [form.licenseText]);

  const save = () => {
    if (!valid) return;
    saveComponent({...form, copyrights: cleanCopyrights(copyrightText)});
    onClose();
  };

  return (
    <Modal title={form.id ? '编辑组件登记' : '登记组件'} onClose={onClose} wide>
      <div className="nl-form nl-grid-2">
        <label>
          组件名称
          <input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder="例如 react" />
        </label>
        <label>
          版本
          <input value={form.version} onChange={(e) => setForm({...form, version: e.target.value})} placeholder="例如 18.3.1" />
        </label>
        <label>
          许可证（SPDX）
          <select value={form.license} onChange={(e) => setForm({...form, license: e.target.value})}>
            {LICENSE_CHOICES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label>
          许可证路径
          <input
            value={form.licensePath}
            onChange={(e) => setForm({...form, licensePath: e.target.value})}
            placeholder="例如 node_modules/react/LICENSE"
          />
        </label>
        <label className="nl-span-2">
          版权行（每行一条，全部保留）
          <textarea
            rows={3}
            value={copyrightText}
            onChange={(e) => setCopyrightText(e.target.value)}
            placeholder={'Copyright (c) ...\nCopyright (c) ...'}
          />
        </label>
        <label className="nl-span-2">
          许可证原文（用于文本指纹比对）
          <textarea
            className="nl-code-input"
            rows={7}
            value={form.licenseText}
            onChange={(e) => setForm({...form, licenseText: e.target.value})}
            placeholder="粘贴 LICENSE 文件全文"
          />
        </label>
        <div className="nl-span-2 nl-fp-preview">
          <Fingerprint size={13} /> 当前指纹：<code>{fp || '（原文为空）'}</code>
          {form.id && <Tag tone="muted">修改登记不影响已冻结通知包（冻结的是批次快照）</Tag>}
        </div>
        <div className="nl-span-2 nl-modal-actions">
          <button className="nl-btn" onClick={onClose}>取消</button>
          <button className="nl-btn primary" onClick={save} disabled={!valid}>保存登记</button>
        </div>
      </div>
    </Modal>
  );
}
