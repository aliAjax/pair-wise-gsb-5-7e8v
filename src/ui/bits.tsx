// ---------- 界面共享小组件 ----------
import type {ReactNode} from 'react';
import {AlertTriangle, Copyright, Globe, Lock, Snowflake} from 'lucide-react';
import {RULE_LABEL} from '../engine';
import type {ChannelKind, NoticeEntry, RuleId, Violation} from '../types';

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function download(filename: string, text: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type: 'text/plain;charset=utf-8'}));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function KindBadge({kind}: {kind: ChannelKind}) {
  return kind === 'closed'
    ? <span className="kind closed"><Lock size={11}/>闭源渠道</span>
    : <span className="kind open"><Globe size={11}/>开源渠道</span>;
}

export function StatusPill({status}: {status: 'frozen' | 'rejected'}) {
  return status === 'frozen'
    ? <span className="pill teal"><Snowflake size={11}/>已冻结</span>
    : <span className="pill red"><AlertTriangle size={11}/>整批拒绝</span>;
}

export function RuleTag({rule}: {rule: RuleId}) {
  return <span className={`rule-tag ${rule}`}>{RULE_LABEL[rule]}</span>;
}

export function Mono({children}: {children: ReactNode}) {
  return <code className="mono">{children}</code>;
}

export function Empty({title, desc}: {title: string; desc: string}) {
  return <div className="empty"><b>{title}</b><p>{desc}</p></div>;
}

/** 违规清单：列出组件、版本、路径与规则 */
export function ViolationList({violations}: {violations: Violation[]}) {
  return (
    <div className="violation-list">
      {violations.map((v, i) => (
        <div className="violation" key={i}>
          <div className="violation-head">
            <RuleTag rule={v.rule}/>
            <b>{v.component} <span className="muted">@ {v.version}</span></b>
          </div>
          <div className="violation-paths">
            {v.paths.map(p => <Mono key={p}>{p}</Mono>)}
          </div>
          <p>{v.detail}</p>
        </div>
      ))}
    </div>
  );
}

/** 通知条目块：许可证、路径、指纹与全部版权行 */
export function EntryBlock({entry}: {entry: NoticeEntry}) {
  const mismatch = entry.fingerprints.length > 1;
  return (
    <div className="entry-block">
      <div className="entry-head">
        <b>{entry.name}</b>
        <span className="muted">@ {entry.version}</span>
        {entry.licenses.map(l => <span key={l} className="license-chip">{l}</span>)}
      </div>
      <div className="entry-meta">
        <span>路径 {entry.paths.map(p => <Mono key={p}>{p}</Mono>)}</span>
        <span className={mismatch ? 'fp bad' : 'fp'}>
          指纹 {entry.fingerprints.map(f => <Mono key={f}>{f}</Mono>)}
          {mismatch && <em>不一致</em>}
        </span>
      </div>
      <div className="cr-list">
        {entry.copyrightLines.length === 0 && <span className="cr-missing">未检测到版权行</span>}
        {entry.copyrightLines.map((c, i) => (
          <div className="cr-line" key={i}><Copyright size={11}/><span>{c}</span></div>
        ))}
      </div>
    </div>
  );
}
