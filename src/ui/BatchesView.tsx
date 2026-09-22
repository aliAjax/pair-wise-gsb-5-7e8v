// 界面层：批次列表与批次详情（历史批次永久可查，快照只读）

import {useMemo, useState} from 'react';
import {Ban, CheckCircle2, FileLock2, GitBranch, PackageCheck, Search} from 'lucide-react';
import {useStore} from '../state/store';
import type {Batch} from '../data/types';
import {Empty, LicenseTag, Tag, fmtDate} from './widgets';
import {fingerprintOf} from '../logic/fingerprint';

export function BatchesView({
  selectedId,
  onSelect,
  onOpenPackage,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onOpenPackage: (packageId: string) => void;
}) {
  const {state} = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all');

  const batches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...state.batches]
      .sort((a, b) => b.createdAt - a.createdAt)
      .filter((b) => (filter === 'all' ? true : b.status === filter))
      .filter((b) => {
        if (!q) return true;
        const channel = state.channels.find((c) => c.id === b.channelId)?.name ?? '';
        return (
          b.code.toLowerCase().includes(q) ||
          b.reason.toLowerCase().includes(q) ||
          channel.toLowerCase().includes(q)
        );
      });
  }, [state, query, filter]);

  const selected = selectedId ? state.batches.find((b) => b.id === selectedId) : undefined;

  return (
    <div className="nl-view">
      <div className="nl-list-head">
        <div>
          <h2>核验批次</h2>
          <p>每次提交（含拒绝）都保留；调整通知包只会产生带原因的新批次，旧批可查</p>
        </div>
        <div className="nl-head-tools">
          <div className="nl-search">
            <Search size={14} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索批次 / 渠道 / 原因" />
          </div>
          <div className="nl-filter">
            <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>全部</button>
            <button className={filter === 'approved' ? 'active' : ''} onClick={() => setFilter('approved')}>通过</button>
            <button className={filter === 'rejected' ? 'active' : ''} onClick={() => setFilter('rejected')}>拒绝</button>
          </div>
        </div>
      </div>

      <div className="nl-split">
        <div className="nl-table-wrap">
          <table className="nl-table">
            <thead>
              <tr>
                <th>批次</th>
                <th>渠道</th>
                <th>录入</th>
                <th>结果</th>
                <th>时间</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => {
                const channel = state.channels.find((c) => c.id === b.channelId);
                return (
                  <tr
                    key={b.id}
                    className={selectedId === b.id ? 'nl-row-selected' : ''}
                    onClick={() => onSelect(b.id)}
                  >
                    <td className="nl-mono-name">{b.code}</td>
                    <td className="nl-muted">{channel?.name ?? '未知渠道'}</td>
                    <td>{b.entries.length} 条</td>
                    <td>
                      {b.status === 'approved' ? (
                        <Tag tone="ok">
                          <CheckCircle2 size={11} /> 通过
                        </Tag>
                      ) : (
                        <Tag tone="bad">
                          <Ban size={11} /> 拒绝 · {b.violations.length} 违规
                        </Tag>
                      )}
                    </td>
                    <td className="nl-muted">{fmtDate(b.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {batches.length === 0 && <Empty>没有符合条件的批次</Empty>}
        </div>

        {selected && <BatchDetail batch={selected} onOpenPackage={onOpenPackage} />}
      </div>
    </div>
  );
}

function BatchDetail({batch, onOpenPackage}: {batch: Batch; onOpenPackage: (id: string) => void}) {
  const {state} = useStore();
  const channel = state.channels.find((c) => c.id === batch.channelId);
  const pkg = batch.packageId ? state.packages.find((p) => p.id === batch.packageId) : undefined;
  const basePkg = batch.basePackageId ? state.packages.find((p) => p.id === batch.basePackageId) : undefined;
  const baseBatch = basePkg ? state.batches.find((b) => b.id === basePkg.batchId) : undefined;

  return (
    <aside className="nl-detail">
      <div className="nl-detail-head">
        <span className={`nl-status-badge ${batch.status}`}>
          {batch.status === 'approved' ? <CheckCircle2 size={15} /> : <Ban size={15} />}
          {batch.status === 'approved' ? '核验通过' : '整批拒绝'}
        </span>
        <h3>{batch.code}</h3>
        <p className="nl-muted">
          {channel?.name} · {fmtDate(batch.createdAt)}
        </p>
      </div>

      <div className="nl-detail-block">
        <label>批次原因</label>
        <p>{batch.reason}</p>
        {basePkg && (
          <p className="nl-base-ref">
            <GitBranch size={12} /> 调整自 {basePkg.code}
            {baseBatch ? `（原批次 ${baseBatch.code}）` : ''}，旧批保持不变
          </p>
        )}
      </div>

      {batch.violations.length > 0 && (
        <div className="nl-detail-block">
          <label>违规明细（组件 / 版本 / 路径 / 规则）</label>
          <div className="nl-violation-list">
            {batch.violations.map((v, i) => (
              <div key={i} className="nl-violation">
                <Tag tone="bad">{v.ruleId}</Tag>
                <div>
                  <b>
                    {v.component} {v.version}
                  </b>
                  <p>{v.rule}</p>
                  <p className="nl-detail">{v.detail}</p>
                  <p className="nl-paths">{v.paths.map((p) => `📄 ${p}`).join('　')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="nl-detail-block">
        <label>录入快照（{batch.entries.length} 条，只读）</label>
        <div className="nl-snapshot-list">
          {batch.entries.map((e) => (
            <div key={e.id} className="nl-snapshot">
              <div>
                <b>{e.name}</b> <span className="nl-muted">{e.version}</span>{' '}
                <LicenseTag license={e.license} />
              </div>
              <div className="nl-path">{e.licensePath}</div>
              <div className="nl-snapshot-copy">
                版权行 {e.copyrights.length} 条 · 指纹 {fingerprintOf(e.licenseText) || '空文本'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pkg && (
        <button className="nl-btn primary nl-block" onClick={() => onOpenPackage(pkg.id)}>
          <FileLock2 size={15} /> 查看冻结通知包 {pkg.code}
        </button>
      )}
      {!pkg && batch.status === 'rejected' && (
        <div className="nl-rejected-note">
          <PackageCheck size={14} /> 拒绝批次不生成通知包；修正后请重新提交批次
        </div>
      )}
    </aside>
  );
}
