// 界面层：通知包列表与冻结详情（只读 + 导出 + 发起调整）

import {useMemo, useState} from 'react';
import {
  FileJson2,
  FileLock2,
  FileText,
  Fingerprint,
  GitBranch,
  History,
  Snowflake,
} from 'lucide-react';
import {useStore} from '../state/store';
import type {NoticePackage} from '../data/types';
import {Empty, LicenseTag, Tag, downloadFile, fmtDate} from './widgets';
import {renderNoticeJSON, renderNoticeMarkdown} from '../logic/export';

export function PackagesView({
  selectedId,
  onSelect,
  onAdjust,
}: {
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdjust: (channelId: string, basePackageId: string) => void;
}) {
  const {state} = useStore();

  // 每个渠道只冻结“当前包”——新版本号包即取代旧包；旧包仍可查
  const currentIds = useMemo(() => {
    const maxSeq = new Map<string, number>();
    for (const p of state.packages) {
      const cur = maxSeq.get(p.channelId) ?? 0;
      if (p.seq > cur) maxSeq.set(p.channelId, p.seq);
    }
    return new Set(
      state.packages
        .filter((p) => p.seq === (maxSeq.get(p.channelId) ?? -1))
        .map((p) => p.id),
    );
  }, [state.packages]);

  const packages = useMemo(
    () => [...state.packages].sort((a, b) => b.frozenAt - a.frozenAt),
    [state.packages],
  );
  const selected = selectedId ? state.packages.find((p) => p.id === selectedId) : undefined;

  return (
    <div className="nl-view">
      <div className="nl-list-head">
        <div>
          <h2>许可证通知包</h2>
          <p>核验通过即冻结：内容不可改；调整只新建带原因的批次，旧包永久可查</p>
        </div>
      </div>

      <div className="nl-split">
        <div className="nl-table-wrap">
          <table className="nl-table">
            <thead>
              <tr>
                <th>通知包</th>
                <th>渠道</th>
                <th>组件</th>
                <th>状态</th>
                <th>冻结时间</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => {
                const channel = state.channels.find((c) => c.id === p.channelId);
                const current = currentIds.has(p.id);
                return (
                  <tr
                    key={p.id}
                    className={selectedId === p.id ? 'nl-row-selected' : ''}
                    onClick={() => onSelect(p.id)}
                  >
                    <td className="nl-mono-name">
                      <Snowflake size={12} className="nl-snow" /> {p.code}
                    </td>
                    <td className="nl-muted">{channel?.name ?? '未知渠道'}</td>
                    <td>{p.items.length}</td>
                    <td>
                      {current ? <Tag tone="ok">当前冻结版本</Tag> : <Tag tone="muted">历史版本</Tag>}
                    </td>
                    <td className="nl-muted">{fmtDate(p.frozenAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {packages.length === 0 && <Empty>尚无冻结通知包——提交批次并通过核验后生成</Empty>}
        </div>

        {selected && <PackageDetail pkg={selected} current={currentIds.has(selected.id)} onAdjust={onAdjust} />}
      </div>
    </div>
  );
}

function PackageDetail({
  pkg,
  current,
  onAdjust,
}: {
  pkg: NoticePackage;
  current: boolean;
  onAdjust: (channelId: string, basePackageId: string) => void;
}) {
  const {state} = useStore();
  const channel = state.channels.find((c) => c.id === pkg.channelId);
  const batch = state.batches.find((b) => b.id === pkg.batchId);
  const ctx = channel && batch ? {pkg, batch, channel} : null;

  const exportMD = () => {
    if (ctx) downloadFile(`${pkg.code}-notice.md`, renderNoticeMarkdown(ctx), 'text/markdown;charset=utf-8');
  };
  const exportJSON = () => {
    if (ctx) downloadFile(`${pkg.code}-notice.json`, renderNoticeJSON(ctx), 'application/json;charset=utf-8');
  };

  return (
    <aside className="nl-detail">
      <div className="nl-detail-head">
        <span className="nl-frozen-badge">
          <FileLock2 size={15} /> 已冻结
        </span>
        <h3>{pkg.code}</h3>
        <p className="nl-muted">
          {channel?.name} · {fmtDate(pkg.frozenAt)}
        </p>
        {current ? <Tag tone="ok">当前冻结版本</Tag> : <Tag tone="muted">历史版本（仅供查询）</Tag>}
      </div>

      <div className="nl-detail-block">
        <label>来源批次 / 原因</label>
        <p className="nl-base-ref">
          <History size={12} /> {batch?.code ?? '—'}：{batch?.reason ?? '—'}
        </p>
      </div>

      <div className="nl-detail-block">
        <label>整包指纹</label>
        <p className="nl-fp-line">
          <Fingerprint size={13} /> <code>{pkg.fingerprint}</code>
        </p>
      </div>

      <div className="nl-detail-block">
        <label>组件通知项（{pkg.items.length}）</label>
        <div className="nl-frozen-items">
          {pkg.items.map((it) => (
            <div key={`${it.name}@${it.version}`} className="nl-frozen-item">
              <div className="nl-frozen-title">
                <b>{it.name}</b> <span className="nl-muted">{it.version}</span>{' '}
                <LicenseTag license={it.license} />
                {it.mergedEntries > 1 && <Tag tone="info">合并 {it.mergedEntries} 条</Tag>}
              </div>
              <div className="nl-paths">
                {it.paths.map((p) => (
                  <span key={p} className="nl-path-chip">
                    📄 {p}
                  </span>
                ))}
              </div>
              <ul className="nl-copy-list">
                {it.copyrights.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
              <div className="nl-frozen-fp">
                <Fingerprint size={11} /> {it.fingerprint}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="nl-export-row">
        <button className="nl-btn" onClick={exportMD} disabled={!ctx}>
          <FileText size={14} /> 导出 Markdown
        </button>
        <button className="nl-btn" onClick={exportJSON} disabled={!ctx}>
          <FileJson2 size={14} /> 导出 JSON
        </button>
        <button className="nl-btn primary" onClick={() => onAdjust(pkg.channelId, pkg.id)}>
          <GitBranch size={14} /> 新建调整批次
        </button>
      </div>
    </aside>
  );
}
