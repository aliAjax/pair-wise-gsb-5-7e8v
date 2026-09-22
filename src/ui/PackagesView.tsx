// ---------- 通知包视图：已冻结包的查询与导出 ----------
import {ChevronDown, Download, Package, Snowflake} from 'lucide-react';
import {useState} from 'react';
import type {Channel, NoticePackage} from '../types';
import {Empty, EntryBlock, KindBadge, Mono, fmtTime} from './bits';

interface Props {
  packages: NoticePackage[];
  channels: Channel[];
  onExport(pkg: NoticePackage): void;
}

export default function PackagesView({packages, channels, onExport}: Props) {
  const [open, setOpen] = useState<string | null>(packages[packages.length - 1]?.id ?? null);
  if (packages.length === 0) {
    return (
      <section className="page-card">
        <Empty title="暂无冻结通知包" desc="在核验台提交核验，全部通过后通知包将冻结并出现在这里。"/>
      </section>
    );
  }
  return (
    <section className="pkg-list">
      {[...packages].reverse().map(pkg => {
        const channel = channels.find(c => c.id === pkg.channelId);
        const expanded = open === pkg.id;
        const crTotal = pkg.entries.reduce((n, e) => n + e.copyrightLines.length, 0);
        return (
          <div className="pkg-card" key={pkg.id}>
            <button className="pkg-head" onClick={() => setOpen(expanded ? null : pkg.id)}>
              <span className="pkg-icon"><Package size={18}/></span>
              <div className="pkg-title">
                <b>{pkg.id}</b>
                <span className="pill teal sm"><Snowflake size={10}/>已冻结</span>
                {channel && <KindBadge kind={channel.kind}/>}
              </div>
              <div className="pkg-meta">
                <span>{pkg.channelName}</span>
                <span>{pkg.entries.length} 条目 · {crTotal} 行版权</span>
                <span>冻结于 {fmtTime(pkg.frozenAt)}</span>
                <span>来源批次 {pkg.batchId}</span>
              </div>
              <ChevronDown size={16} className={expanded ? 'chev open' : 'chev'}/>
            </button>
            {expanded && (
              <div className="pkg-body">
                <div className="pkg-facts">
                  <div><label>包指纹</label><Mono>{pkg.fingerprint}</Mono></div>
                  <div><label>调整原因</label><b>{pkg.reason}</b></div>
                  <button className="outline sm" onClick={() => onExport(pkg)}><Download size={13}/>导出 NOTICE</button>
                </div>
                {pkg.entries.map(e => <EntryBlock key={e.key} entry={e}/>)}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
