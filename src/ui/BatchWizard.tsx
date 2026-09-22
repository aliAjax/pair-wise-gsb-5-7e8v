// 界面层：新建批次 / 调整批次（录入 → 实时预检 → 提交核验 → 整批通过或整批拒绝）

import {useMemo, useState} from 'react';
import {
  ArrowLeft,
  Ban,
  CheckCircle2,
  CopyPlus,
  Fingerprint,
  GitBranch,
  Plus,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {useStore, type SubmitBatchInput} from '../state/store';
import type {ComponentRecord, EntryInput, MergedItem, Violation} from '../data/types';
import {verifyEntries, RULES} from '../logic/rules';
import {cleanCopyrights, fingerprintOf} from '../logic/fingerprint';
import {LicenseTag, Tag} from './widgets';

type Row = Omit<EntryInput, 'id'>;

const LICENSE_CHOICES = ['MIT', 'BSD-3-Clause', 'Apache-2.0', 'ISC', 'GPL-2.0', 'GPL-3.0', 'AGPL-3.0'];

function emptyRow(): Row {
  return {name: '', version: '', license: 'MIT', licensePath: '', copyrights: [], licenseText: ''};
}

export function BatchWizard({
  channelId,
  basePackageId,
  onCancel,
  onDone,
}: {
  channelId?: string;
  basePackageId?: string;
  onCancel: () => void;
  onDone: (result: {passed: boolean; batchId: string; packageId?: string}) => void;
}) {
  const {state, submitBatch} = useStore();

  const basePackage = basePackageId ? state.packages.find((p) => p.id === basePackageId) : undefined;
  const [channelIdState, setChannelIdState] = useState(
    channelId ?? basePackage?.channelId ?? state.channels[0]?.id ?? '',
  );
  const [reason, setReason] = useState(basePackage ? '' : '初次建立：');
  const [rows, setRows] = useState<Row[]>(() =>
    basePackage
      ? basePackage.items.map((it): Row => ({
          name: it.name,
          version: it.version,
          license: it.license,
          licensePath: it.paths[0] ?? '',
          copyrights: it.copyrights,
          licenseText: '',
        }))
      : [emptyRow()],
  );

  const channel = state.channels.find((c) => c.id === channelIdState);
  const isAdjust = Boolean(basePackage);

  const patchRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? {...r, ...patch} : r)));

  const pickComponent = (i: number, comp: ComponentRecord | '') => {
    if (!comp) return;
    patchRow(i, {
      name: comp.name,
      version: comp.version,
      license: comp.license,
      licensePath: comp.licensePath,
      copyrights: [...comp.copyrights],
      licenseText: comp.licenseText,
    });
  };

  const filledRows = rows.filter((r) => r.name.trim() && r.version.trim());
  const preview = useMemo(
    () => (channel ? verifyEntries(filledRows as EntryInput[], channel) : null),
    [filledRows, channel],
  );

  const canSubmit =
    channel &&
    reason.trim() &&
    filledRows.length > 0 &&
    rows.every((r) => (!r.name.trim() && !r.version.trim()) || (r.name.trim() && r.version.trim()));

  const submit = () => {
    if (!canSubmit || !channel) return;
    const payload: SubmitBatchInput = {
      channelId: channel.id,
      reason,
      basePackageId: basePackage?.id,
      entries: filledRows.map((r) => ({
        ...r,
        name: r.name.trim(),
        version: r.version.trim(),
        licensePath: r.licensePath.trim(),
        copyrights: cleanCopyrights(r.copyrights),
      })),
    };
    onDone(submitBatch(payload));
  };

  return (
    <div className="nl-view">
      <button className="nl-link-btn" onClick={onCancel}>
        <ArrowLeft size={14} /> 返回
      </button>

      <div className="nl-wizard-head">
        <div>
          <h2>{isAdjust ? '调整通知包（新建批次）' : '新建核验批次'}</h2>
          <p>
            同包同版本自动合并，版权行逐行全部保留；命中任一规则即整批拒绝。
            批次提交后不可修改，调整只能新建批次。
          </p>
        </div>
        {isAdjust && (
          <Tag tone="warn">
            <GitBranch size={12} /> 基于 {basePackage!.code} 调整，原批次保留可查
          </Tag>
        )}
      </div>

      <div className="nl-form nl-wizard-meta">
        <label>
          分发渠道
          <select
            value={channelIdState}
            onChange={(e) => setChannelIdState(e.target.value)}
            disabled={isAdjust || Boolean(channelId)}
          >
            {state.channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}（{c.kind === 'closed' ? '闭源' : '开源'}）
              </option>
            ))}
          </select>
        </label>
        <label className="nl-reason">
          {isAdjust ? '调整原因（必填）' : '批次原因（必填）'}
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={isAdjust ? '例如：升级 react 至 18.3.2，移除 legacy-parser' : '例如：初次建立：v2.0 发布'}
          />
        </label>
      </div>

      <div className="nl-rows">
        {rows.map((row, i) => (
          <IntakeRow
            key={i}
            index={i}
            row={row}
            components={state.components}
            onPatch={(patch) => patchRow(i, patch)}
            onPick={(comp) => pickComponent(i, comp)}
            onRemove={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
            canRemove={rows.length > 1}
          />
        ))}
      </div>

      <button className="nl-btn dashed nl-block" onClick={() => setRows((rs) => [...rs, emptyRow()])}>
        <Plus size={14} /> 添加一条录入
      </button>

      {channel && filledRows.length > 0 && preview && (
        <PreviewPanel result={preview} />
      )}

      <div className="nl-wizard-actions">
        <button className="nl-btn" onClick={onCancel}>取消</button>
        <button className="nl-btn primary" disabled={!canSubmit} onClick={submit}>
          <ShieldAlert size={15} /> 提交整批核验
        </button>
      </div>

      <div className="nl-rules-foot">
        {Object.values(RULES).map((r) => (
          <code key={r}>{r}</code>
        ))}
      </div>
    </div>
  );
}

function IntakeRow({
  index,
  row,
  components,
  onPatch,
  onPick,
  onRemove,
  canRemove,
}: {
  index: number;
  row: Row;
  components: ComponentRecord[];
  onPatch: (patch: Partial<Row>) => void;
  onPick: (comp: ComponentRecord | '') => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [copyrightText, setCopyrightText] = useState(row.copyrights.join('\n'));
  const fp = fingerprintOf(row.licenseText);
  const incomplete = Boolean(row.name.trim() || row.version.trim()) &&
    (!row.name.trim() || !row.version.trim() || !row.licensePath.trim());

  return (
    <div className="nl-row-card">
      <div className="nl-row-head">
        <span className="nl-row-idx">#{index + 1}</span>
        <select
          className="nl-row-pick"
          value=""
          onChange={(e) => onPick(components.find((c) => c.id === e.target.value) ?? '')}
        >
          <option value="">从组件登记引用…</option>
          {components.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}@{c.version}（{c.license}）
            </option>
          ))}
        </select>
        <button className="nl-icon-btn danger" disabled={!canRemove} onClick={onRemove} title="删除该条">
          <Trash2 size={14} />
        </button>
      </div>
      <div className="nl-row-grid">
        <label>
          组件
          <input value={row.name} onChange={(e) => onPatch({name: e.target.value})} placeholder="组件名" />
        </label>
        <label>
          版本
          <input value={row.version} onChange={(e) => onPatch({version: e.target.value})} placeholder="1.0.0" />
        </label>
        <label>
          许可证
          <select value={row.license} onChange={(e) => onPatch({license: e.target.value})}>
            {LICENSE_CHOICES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <label className="nl-col-span2">
          许可证路径
          <input
            value={row.licensePath}
            onChange={(e) => onPatch({licensePath: e.target.value})}
            placeholder="仓库中的 LICENSE 文件路径"
          />
        </label>
        <label className="nl-col-span2">
          版权行（每行一条）
          <textarea
            rows={2}
            value={copyrightText}
            onChange={(e) => {
              setCopyrightText(e.target.value);
              onPatch({copyrights: cleanCopyrights(e.target.value)});
            }}
            placeholder="Copyright (c) ..."
          />
        </label>
        <label className="nl-col-span2">
          许可证原文
          <textarea
            rows={4}
            className="nl-code-input"
            value={row.licenseText}
            onChange={(e) => onPatch({licenseText: e.target.value})}
            placeholder="粘贴许可证全文，用于文本指纹比对"
          />
        </label>
      </div>
      <div className="nl-row-foot">
        <span className="nl-fp">
          <Fingerprint size={11} /> {fp || '空文本'}
        </span>
        <LicenseTag license={row.license} />
        {copyrightText.trim() === '' && row.name.trim() && <Tag tone="bad">无版权行（R1）</Tag>}
        {incomplete && <Tag tone="warn">字段未填全</Tag>}
      </div>
    </div>
  );
}

function PreviewPanel({
  result,
}: {
  result: {items: MergedItem[]; violations: Violation[]; passed: boolean};
}) {
  return (
    <div className={`nl-preview ${result.passed ? 'ok' : 'bad'}`}>
      <div className="nl-preview-head">
        {result.passed ? (
          <>
            <CheckCircle2 size={16} /> <b>预检通过</b>
            <span>合并为 {result.items.length} 个组件通知项，提交后将冻结通知包</span>
          </>
        ) : (
          <>
            <Ban size={16} /> <b>预检不通过 · 提交将整批拒绝</b>
            <span>{result.violations.length} 条违规</span>
          </>
        )}
      </div>

      {!result.passed && (
        <div className="nl-violation-list">
          {result.violations.map((v, i) => (
            <div key={i} className="nl-violation">
              <Tag tone="bad">{v.ruleId}</Tag>
              <div>
                <b>
                  {v.component} {v.version}
                </b>
                <p>{v.rule}</p>
                <p className="nl-detail">{v.detail}</p>
                <p className="nl-paths">路径：{v.paths.join('、') || '—'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="nl-merge-preview">
        {result.items.map((it) => {
          const itemViolations = result.violations.filter(
            (v) => v.component === it.name && v.version === it.version,
          );
          return (
            <div key={`${it.name}@${it.version}`} className="nl-merge-item">
              <div className="nl-merge-main">
                <b>
                  {it.name} <span className="nl-muted">{it.version}</span>
                </b>
                <LicenseTag license={it.license} />
                {it.mergedEntries > 1 && (
                  <Tag tone="info">
                    <CopyPlus size={11} /> 合并 {it.mergedEntries} 条
                  </Tag>
                )}
              </div>
              <div className="nl-merge-meta">
                <span>路径：{it.paths.join('、') || '—'}</span>
                <span>
                  版权行 {it.copyrights.length} 条（全部保留）：
                  {it.copyrights.length > 0 ? (
                    <ul>
                      {it.copyrights.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  ) : (
                    <em className="nl-bad-text">缺失</em>
                  )}
                </span>
              </div>
              {itemViolations.length > 0 && (
                <div className="nl-merge-bad">
                  命中规则：{itemViolations.map((v) => v.ruleId).join('、')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
