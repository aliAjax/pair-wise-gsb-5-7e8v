// ---------- 判定引擎（纯函数，不依赖界面与存储） ----------
import type {Channel, ComponentRecord, NoticeEntry, RuleId, Violation} from './types';

export const RULES: {id: RuleId; label: string; pass: string; desc: string}[] = [
  {id: 'missing-copyright', label: '缺版权行', pass: '版权行完整', desc: '许可证文本中未检测到任何版权行（Copyright / ©）'},
  {id: 'fingerprint-mismatch', label: '文本指纹不一致', pass: '文本指纹一致', desc: '同包同版本文本不一致，或与收录的标准许可证文本指纹不符'},
  {id: 'gpl-closed-channel', label: 'GPL 用于闭源渠道', pass: '无 GPL 用于闭源渠道', desc: 'GPL 类强 copyleft 许可证不得随闭源渠道分发'},
];

export const RULE_LABEL: Record<RuleId, string> = {
  'missing-copyright': '缺版权行',
  'fingerprint-mismatch': '文本指纹不一致',
  'gpl-closed-channel': 'GPL 用于闭源渠道',
};

/** 统一换行符 */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * 判断一行是否为版权行：
 * - 「Copyright」开头（排除 license/notice 等正文句）；
 * - 「(c)」「©」开头且含年份（排除许可证条款编号如 "(c) You must..."）。
 */
export function isCopyrightLine(line: string): boolean {
  const t = line.trim();
  if (/^copyright(?!\s+(license|notice|law|statement)s?\b)/i.test(t)) return true;
  return /^(\(c\)|©)/i.test(t) && /\b(19|20)\d{2}\b/.test(t);
}

/** 提取文本中的全部版权行（去空白、保持出现顺序） */
export function extractCopyrightLines(text: string): string[] {
  return normalizeText(text)
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && isCopyrightLine(l));
}

/** 许可证正文：剔除版权行后折叠空白 —— 版权行因持有者而异，正文必须一致 */
export function licenseBody(text: string): string {
  return normalizeText(text)
    .split('\n')
    .filter(l => !isCopyrightLine(l))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** FNV-1a 32 位哈希，输出 8 位十六进制 */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 单份许可证文本的指纹（基于剔除版权行后的正文） */
export function textFingerprint(text: string): string {
  return 'fnv1a:' + fnv1a(licenseBody(text));
}

/** 整个通知包的指纹：由条目名、版本、文本指纹与版权行共同决定 */
export function packageFingerprint(entries: NoticeEntry[]): string {
  const material = entries
    .map(e => `${e.name}@${e.version}|${e.licenses.join(',')}|${e.fingerprints.join(',')}|${e.copyrightLines.join('|')}`)
    .sort()
    .join('\n');
  return 'fnv1a:' + fnv1a(material);
}

/** 同包同版本合并：路径与指纹去重，版权行全部保留（去重完全相同行） */
export function mergeComponents(records: ComponentRecord[]): NoticeEntry[] {
  const map = new Map<string, NoticeEntry>();
  for (const r of records) {
    const name = r.name.trim();
    const version = r.version.trim();
    const key = `${name}@${version}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {key, name, version, licenses: [], paths: [], copyrightLines: [], fingerprints: [], componentIds: []};
      map.set(key, entry);
    }
    if (!entry.licenses.includes(r.license)) entry.licenses.push(r.license);
    const path = r.licensePath.trim() || 'LICENSE';
    if (!entry.paths.includes(path)) entry.paths.push(path);
    for (const line of extractCopyrightLines(r.text)) {
      if (!entry.copyrightLines.includes(line)) entry.copyrightLines.push(line);
    }
    const fp = textFingerprint(r.text);
    if (!entry.fingerprints.includes(fp)) entry.fingerprints.push(fp);
    entry.componentIds.push(r.id);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** GPL 类强 copyleft：GPL-* 与 AGPL-*（LGPL 为弱 copyleft，不触发） */
export function isStrongCopyleft(license: string): boolean {
  return /^(a?gpl)/i.test(license.trim());
}

/**
 * 核验一批合并条目。任一违规即整批拒绝。
 * canonical: 已收录标准许可证指纹表（未收录的许可证跳过指纹比对）。
 */
export function validateEntries(
  entries: NoticeEntry[],
  channel: Channel,
  canonical: Record<string, string>,
): Violation[] {
  const violations: Violation[] = [];
  for (const e of entries) {
    if (e.copyrightLines.length === 0) {
      violations.push({
        rule: 'missing-copyright',
        component: e.name,
        version: e.version,
        paths: e.paths,
        detail: '许可证文本中未检测到版权行（Copyright / ©）',
      });
    }
    if (e.fingerprints.length > 1) {
      violations.push({
        rule: 'fingerprint-mismatch',
        component: e.name,
        version: e.version,
        paths: e.paths,
        detail: `同包同版本出现 ${e.fingerprints.length} 个不同文本指纹：${e.fingerprints.join('、')}`,
      });
    }
    for (const license of e.licenses) {
      const expected = canonical[license];
      if (expected && e.fingerprints.length === 1 && e.fingerprints[0] !== expected) {
        violations.push({
          rule: 'fingerprint-mismatch',
          component: e.name,
          version: e.version,
          paths: e.paths,
          detail: `与 ${license} 标准文本指纹不符（应为 ${expected}，实为 ${e.fingerprints[0]}）`,
        });
      }
      if (channel.kind === 'closed' && isStrongCopyleft(license)) {
        violations.push({
          rule: 'gpl-closed-channel',
          component: e.name,
          version: e.version,
          paths: e.paths,
          detail: `${license} 属强 copyleft，禁止随闭源渠道「${channel.name}」分发`,
        });
      }
    }
  }
  return violations;
}

/** 导出 NOTICE 通知包文本 */
export function buildNoticeExport(pkg: {
  id: string;
  batchId: string;
  channelName: string;
  frozenAt: string;
  reason: string;
  fingerprint: string;
  entries: NoticeEntry[];
}, channelKind: Channel['kind']): string {
  const lines: string[] = [
    '='.repeat(64),
    'NOTICE · 许可证通知包',
    '='.repeat(64),
    `通知包: ${pkg.id}`,
    `来源批次: ${pkg.batchId}`,
    `分发渠道: ${pkg.channelName}（${channelKind === 'closed' ? '闭源分发' : '开源分发'}）`,
    `冻结时间: ${pkg.frozenAt}`,
    `调整原因: ${pkg.reason}`,
    `包指纹: ${pkg.fingerprint}`,
    `条目数: ${pkg.entries.length} · 版权行: ${pkg.entries.reduce((n, e) => n + e.copyrightLines.length, 0)}`,
    '',
    '本通知包已通过 License Lens 核验：',
    ...RULES.map(r => `  [通过] ${r.pass}`),
    '-'.repeat(64),
    '',
  ];
  pkg.entries.forEach((e, i) => {
    lines.push(`[${i + 1}] ${e.name} @ ${e.version}`);
    lines.push(`    许可证: ${e.licenses.join('、')}`);
    lines.push(`    许可证路径: ${e.paths.join('、')}`);
    lines.push(`    文本指纹: ${e.fingerprints.join('、')}`);
    lines.push('    版权行:');
    for (const c of e.copyrightLines) lines.push(`      ${c}`);
    lines.push('');
  });
  lines.push('-'.repeat(64));
  lines.push('由 License Lens 许可证通知包核验台生成');
  return lines.join('\n');
}
