// 判定/表示层之间：冻结通知包的导出渲染（纯字符串生成，不触碰 DOM）

import type {Batch, Channel, NoticePackage} from '../data/types';

export interface ExportContext {
  pkg: NoticePackage;
  batch: Batch;
  channel: Channel;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

/** 导出 Markdown 通知文本（随通知包冻结，只读） */
export function renderNoticeMarkdown({pkg, batch, channel}: ExportContext): string {
  const lines: string[] = [];
  lines.push(`# 开源软件许可证通知 · ${pkg.code}`);
  lines.push('');
  lines.push(`- 分发渠道：${channel.name}（${channel.kind === 'closed' ? '闭源' : '开源'}）`);
  lines.push(`- 来源批次：${batch.code}`);
  lines.push(`- 批次原因：${batch.reason}`);
  lines.push(`- 冻结时间：${fmtTime(pkg.frozenAt)}`);
  lines.push(`- 整包指纹：\`${pkg.fingerprint}\``);
  lines.push(`- 组件数量：${pkg.items.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  pkg.items.forEach((item, i) => {
    lines.push(`## ${i + 1}. ${item.name} ${item.version}`);
    lines.push('');
    lines.push(`- 许可证：${item.license}`);
    lines.push(`- 文本指纹：\`${item.fingerprint}\``);
    lines.push(
      `- 许可证路径：${item.paths.map((p) => `\`${p}\``).join('、')}` +
        (item.mergedEntries > 1 ? `（由 ${item.mergedEntries} 条同版本录入合并）` : ''),
    );
    lines.push('- 版权声明：');
    for (const c of item.copyrights) lines.push(`  - ${c}`);
    lines.push('');
  });
  lines.push('---');
  lines.push('');
  lines.push('本通知包经核验台规则核验通过后冻结生成，内容不可修改；如需调整请新建批次。');
  return lines.join('\n');
}

/** 导出 JSON 机器可读清单 */
export function renderNoticeJSON({pkg, batch, channel}: ExportContext): string {
  return JSON.stringify(
    {
      packageCode: pkg.code,
      packageFingerprint: pkg.fingerprint,
      frozenAt: new Date(pkg.frozenAt).toISOString(),
      channel: {id: channel.id, name: channel.name, kind: channel.kind},
      batch: {code: batch.code, reason: batch.reason},
      components: pkg.items.map((it) => ({
        name: it.name,
        version: it.version,
        license: it.license,
        fingerprint: it.fingerprint,
        licensePaths: it.paths,
        copyrights: it.copyrights,
        mergedEntries: it.mergedEntries,
      })),
    },
    null,
    2,
  );
}
