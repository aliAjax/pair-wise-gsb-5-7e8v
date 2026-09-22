// ---------- 批次记录视图：全部批次（含旧批）可查 ----------
import {useState} from 'react';
import {Download, History} from 'lucide-react';
import type {Batch, NoticePackage} from '../types';
import {Empty, EntryBlock, Mono, StatusPill, ViolationList, fmtTime} from './bits';

interface Props {
  batches: Batch[];          // 全部批次，新的在前
  packages: NoticePackage[];
  onExport(pkg: NoticePackage): void;
}

export default function BatchesView({batches, packages, onExport}: Props) {
  const [selected, setSelected] = useState<string | null>(batches[0]?.id ?? null);
  const current = batches.find(b => b.id === selected) ?? null;
  const pkg = current ? packages.find(p => p.batchId === current.id) ?? null : null;

  if (batches.length === 0) {
    return (
      <section className="page-card">
        <Empty title="暂无批次" desc="每次提交核验都会生成一个不可变批次，旧批次保留可查。"/>
      </section>
    );
  }

  return (
    <section className="workspace batches-ws">
      <div className="table-pane">
        <div className="pane-head">
          <div><h2>批次记录</h2><p>每次核验生成一个批次，旧批次保留可查</p></div>
        </div>
        <div className="table batch-table">
          <div className="tr th"><span>批次</span><span>渠道</span><span>时间</span><span>状态</span><span>结果</span></div>
          {batches.map(b => (
            <button className={b.id === selected ? 'tr selected' : 'tr'} key={b.id} onClick={() => setSelected(b.id)}>
              <span className="dep-name">{b.id}</span>
              <span className="muted">{b.channelName}</span>
              <span className="muted">{fmtTime(b.createdAt)}</span>
              <span><StatusPill status={b.status}/></span>
              <span className="muted">{b.status === 'frozen' ? `${b.entries.length} 条目` : `${b.violations.length} 条违规`}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="side-stack">
        {current && (
          <div className="side-card">
            <div className="side-head"><History size={16}/><h3>{current.id}</h3><StatusPill status={current.status}/></div>
            <div className="batch-meta">
              <div><label>渠道</label><b>{current.channelName}</b></div>
              <div><label>时间</label><b>{fmtTime(current.createdAt)}</b></div>
              <div className="wide"><label>原因</label><b>{current.reason}</b></div>
              <div className="wide"><label>包指纹</label><Mono>{current.packageFingerprint}</Mono></div>
            </div>
            {current.status === 'rejected' && (
              <>
                <p className="side-note">命中 {current.violations.length} 条规则，<b>整批拒绝</b>：</p>
                <ViolationList violations={current.violations}/>
              </>
            )}
            {current.status === 'frozen' && (
              <>
                <p className="side-note">全部规则通过，通知包已冻结：</p>
                <div className="frozen-box">
                  {current.entries.map(e => <EntryBlock key={e.key} entry={e}/>)}
                  {pkg && (
                    <div className="frozen-actions">
                      <button className="outline sm" onClick={() => onExport(pkg)}><Download size={13}/>导出 {pkg.id}</button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
