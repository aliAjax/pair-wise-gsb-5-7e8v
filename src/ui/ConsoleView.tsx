// ---------- 核验台视图：登记 → 合并预览 → 提交核验 → 冻结/拒绝 ----------
import {AlertTriangle, Check, Download, FileCode2, GitMerge, Pencil, Plus, ShieldCheck, Snowflake, Trash2} from 'lucide-react';
import {RULES, extractCopyrightLines, textFingerprint} from '../engine';
import type {Batch, Channel, ComponentRecord, NoticeEntry, NoticePackage} from '../types';
import {Empty, EntryBlock, Mono, StatusPill, ViolationList, fmtTime} from './bits';

interface Props {
  channel: Channel;
  records: ComponentRecord[];
  entries: NoticeEntry[];
  batches: Batch[];       // 该渠道批次，新的在前
  pkg: NoticePackage | null; // 该渠道最新冻结包
  onAdd(): void;
  onEdit(id: string): void;
  onRemove(id: string): void;
  onSubmit(): void;
  onExportPkg(pkg: NoticePackage): void;
  onViewPackages(): void;
}

export default function ConsoleView(p: Props) {
  const last = p.batches[0];
  const totalCr = p.entries.reduce((n, e) => n + e.copyrightLines.length, 0);
  const badKeys = new Set((last?.violations ?? []).map(v => `${v.component}@${v.version}`));
  const passRate = last && last.entries.length > 0
    ? Math.round((last.entries.length - badKeys.size) / last.entries.length * 100)
    : null;

  return (
    <>
      <section className="hero">
        <div>
          <span className="tag">CHANNEL · {p.channel.kind === 'closed' ? '闭源分发' : '开源分发'}</span>
          <h2>{!last ? '尚未提交核验' : last.status === 'frozen' ? `${p.pkg?.id ?? ''} 已冻结` : `${last.id} 被整批拒绝`}</h2>
          <p>
            {!last && '登记组件与许可证文本后提交核验，全部通过即冻结通知包。'}
            {last?.status === 'frozen' && `批次 ${last.id} 通过 ${RULES.length} 条规则核验，通知包已冻结，可导出分发。`}
            {last?.status === 'rejected' && <><b className="warning">{last.violations.length} 条违规</b>待处理，修正登记后重新提交，旧批次保留可查。</>}
          </p>
        </div>
        <div className="scan-score">
          <div className="score-ring" style={{borderColor: passRate === null ? '#496267' : passRate === 100 ? '#39b294' : '#c9815a', borderLeftColor: '#496267'}}>
            <strong>{passRate === null ? '—' : passRate}<small>{passRate === null ? '' : '%'}</small></strong>
          </div>
          <div>
            <span>最近批次通过率</span>
            <b>{!last ? '未核验' : last.status === 'frozen' ? '全部通过' : '存在违规'}</b>
            <small>{last ? `${last.id} · ${fmtTime(last.createdAt)}` : '提交后生成首个批次'}</small>
          </div>
        </div>
      </section>

      <section className="summary">
        <div><span>登记组件</span><b>{p.records.length}</b><small>原始录入记录</small></div>
        <div><span>合并条目</span><b>{p.entries.length}</b><small>同包同版本已合并</small></div>
        <div><span>版权行</span><b className="teal">{totalCr}</b><small>合并后全部保留</small></div>
        <div><span>最近判定</span>{last
          ? <b className={last.status === 'frozen' ? 'teal' : 'red'}>{last.status === 'frozen' ? '通过' : '拒绝'}</b>
          : <b>—</b>}<small>{last ? last.id : '暂无批次'}</small></div>
      </section>

      <section className="workspace">
        <div className="table-pane">
          <div className="pane-head">
            <div><h2>组件登记</h2><p>录入组件、版本与许可证路径</p></div>
            <button className="primary" onClick={p.onAdd}><Plus size={15}/>录入组件</button>
          </div>
          {p.records.length === 0
            ? <Empty title="尚未登记组件" desc="点击「录入组件」添加组件、版本、许可证与文本。"/>
            : (
              <div className="table comp-table">
                <div className="tr th">
                  <span>组件 / 版本</span><span>许可证</span><span>路径</span><span>版权行</span><span>文本指纹</span><span></span>
                </div>
                {p.records.map(r => {
                  const cr = extractCopyrightLines(r.text).length;
                  return (
                    <div className="tr" key={r.id}>
                      <span className="dep-name"><span className="pkg-dot"/>{r.name}<small className="ver">@ {r.version}</small></span>
                      <span><i className="license-chip">{r.license}</i></span>
                      <span><Mono>{r.licensePath}</Mono></span>
                      <span className={cr === 0 ? 'cr-count bad' : 'cr-count'}>{cr === 0 ? '缺失' : `${cr} 行`}</span>
                      <span><Mono>{textFingerprint(r.text)}</Mono></span>
                      <span className="row-actions">
                        <button className="icon-btn" title="编辑" onClick={() => p.onEdit(r.id)}><Pencil size={13}/></button>
                        <button className="icon-btn danger" title="删除" onClick={() => p.onRemove(r.id)}><Trash2 size={13}/></button>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
        </div>

        <div className="side-stack">
          <div className="side-card">
            <div className="side-head"><ShieldCheck size={16}/><h3>提交核验</h3></div>
            <ul className="rule-list">
              {RULES.map(r => (
                <li key={r.id}>
                  <span className={`rule-dot ${r.id}`}/>
                  <div><b>{r.label}</b><small>{r.desc}</small></div>
                </li>
              ))}
            </ul>
            <p className="side-note">任一规则命中即<b>整批拒绝</b>；全部通过则<b>冻结通知包</b>并导出。</p>
            <button className="primary full" disabled={p.records.length === 0} onClick={p.onSubmit}>
              <GitMerge size={15}/>合并并提交核验
            </button>
            {p.records.length === 0 && <small className="hint">请先录入组件</small>}
          </div>

          <div className="side-card">
            <div className="side-head"><FileCode2 size={16}/><h3>最近批次</h3>{last && <StatusPill status={last.status}/>}</div>
            {!last && <Empty title="暂无批次" desc="提交核验后生成首个批次记录。"/>}
            {last && (
              <>
                <div className="batch-meta">
                  <div><label>批次</label><b>{last.id}</b></div>
                  <div><label>时间</label><b>{fmtTime(last.createdAt)}</b></div>
                  <div className="wide"><label>原因</label><b>{last.reason}</b></div>
                </div>
                {last.status === 'rejected' && <ViolationList violations={last.violations}/>}
                {last.status === 'frozen' && p.pkg && (
                  <div className="frozen-box">
                    <div className="frozen-row"><Snowflake size={14}/><b>{p.pkg.id}</b><Mono>{p.pkg.fingerprint}</Mono></div>
                    <p>{p.pkg.entries.length} 个条目 · {p.pkg.entries.reduce((n, e) => n + e.copyrightLines.length, 0)} 行版权 · 已冻结不可改</p>
                    <div className="frozen-actions">
                      <button className="outline sm" onClick={() => p.onExportPkg(p.pkg!)}><Download size={13}/>导出 NOTICE</button>
                      <button className="outline sm" onClick={p.onViewPackages}>查看通知包</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="merge-pane">
        <div className="pane-head">
          <div><h2>合并预览</h2><p>同包同版本合并为一条通知条目，版权行全部保留</p></div>
          <span className="merge-count">{p.records.length} 条登记 → {p.entries.length} 个条目</span>
        </div>
        {p.entries.length === 0
          ? <Empty title="无合并结果" desc="登记组件后此处展示合并后的通知条目。"/>
          : (
            <div className="entry-grid">
              {p.entries.map(e => (
                <div className="entry-card" key={e.key}>
                  <EntryBlock entry={e}/>
                  <div className="entry-foot">
                    {e.componentIds.length > 1
                      ? <span className="merged-flag"><GitMerge size={11}/>合并 {e.componentIds.length} 条登记</span>
                      : <span className="muted">单条登记</span>}
                    {e.fingerprints.length === 1 && e.copyrightLines.length > 0
                      ? <span className="ok-flag"><Check size={11}/>指纹一致 · 版权完整</span>
                      : <span className="warn-flag"><AlertTriangle size={11}/>待核验处理</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
      </section>
    </>
  );
}
