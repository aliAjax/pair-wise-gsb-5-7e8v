// 判定层：核验规则引擎（纯函数，与存储、界面无关）

import type {
  Channel,
  EntryInput,
  MergedItem,
  NoticePackage,
  Violation,
} from '../data/types';
import {cleanCopyrights, fingerprintOf, unique} from './fingerprint';

/** GPL 系列（强传染性）：MIT / BSD / Apache 等宽松许可不在此列 */
export function isCopyleft(license: string): boolean {
  return /(^|[^A-Za-z])GPL(-| |\d)|AGPL/i.test(license);
}

export const RULES: Record<Violation['ruleId'], string> = {
  R1: 'R1 缺少版权行：每个组件必须保留至少一行版权声明',
  R2: 'R2 许可证文本指纹不一致：同包同版本的许可证原文必须一致',
  R3: 'R3 GPL 进入闭源渠道：强传染性许可证不得用于闭源分发',
};

/** 分组键：同包（同渠道同一批次）同版本 */
export function groupKey(e: Pick<EntryInput, 'name' | 'version'>): string {
  return `${e.name}@${e.version}`;
}

/** 合并结果（通过）或违规列表（拒绝），二者互斥 */
export interface VerifyResult {
  items: MergedItem[];
  violations: Violation[];
  passed: boolean;
}

/**
 * 核验一批录入：
 * 1. 同包同版本合并；版权行全部保留（去重保序）。
 * 2. 缺版权行 → R1；同组文本指纹不一致 → R2；
 *    闭源渠道出现 GPL 系列 → R3。
 * 3. 任一违规 → 整批拒绝。
 */
export function verifyEntries(
  entries: EntryInput[],
  channel: Channel,
): VerifyResult {
  const violations: Violation[] = [];
  const groups = new Map<string, EntryInput[]>();

  for (const e of entries) {
    const key = groupKey(e);
    const list = groups.get(key) ?? [];
    list.push(e);
    groups.set(key, list);
  }

  const items: MergedItem[] = [];

  for (const [key, list] of groups) {
    const [name, version] = splitKey(key);
    const paths = unique(list.map((e) => e.licensePath));
    const copyrights = cleanCopyrights(list.flatMap((e) => e.copyrights));
    const fingerprints = unique(list.map((e) => fingerprintOf(e.licenseText)));
    const licenses = unique(list.map((e) => e.license));

    // R1：合并后仍无任何版权行
    if (copyrights.length === 0) {
      violations.push({
        ruleId: 'R1',
        rule: RULES.R1,
        component: name,
        version,
        paths,
        detail:
          list.length > 1
            ? `${list.length} 条同包同版本录入合并后仍没有任何版权行`
            : '录入未包含版权声明行',
      });
    }

    // R2：同组出现两种及以上许可证文本指纹（空文本视为缺失也参与比对）
    if (fingerprints.length > 1) {
      const byFp = fingerprints
        .map((fp) => `${fp || '(空文本)'}`)
        .join(' vs ');
      violations.push({
        ruleId: 'R2',
        rule: RULES.R2,
        component: name,
        version,
        paths,
        detail: `同包同版本检测到 ${fingerprints.length} 种指纹：${byFp}`,
      });
    }

    // R3：闭源渠道禁止 GPL 系列（以 SPDX 标识为准）
    const copyleftLicenses = licenses.filter((l) => isCopyleft(l));
    if (channel.kind === 'closed' && copyleftLicenses.length > 0) {
      violations.push({
        ruleId: 'R3',
        rule: RULES.R3,
        component: name,
        version,
        paths,
        detail: `渠道「${channel.name}」为闭源渠道，组件声明 ${copyleftLicenses.join('、')}`,
      });
    }

    items.push({
      name,
      version,
      // 声明不一致时保留首条；R2 已要求整批打回，正常不会走到这里
      license: licenses[0],
      paths,
      copyrights,
      fingerprint: fingerprints[0] ?? '',
      mergedEntries: list.length,
    });
  }

  items.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

  return {items, violations, passed: violations.length === 0};
}

/** 由合并项确定性计算整包指纹 */
export function packageFingerprintOf(items: MergedItem[]): string {
  const payload = items
    .map(
      (it) =>
        `${groupKey(it)}|${it.license}|${it.fingerprint}|` +
        `p=${it.paths.join(',')}|c=${it.copyrights.join(' // ')}`,
    )
    .join('\n');
  return fingerprintOf(payload);
}

/** 从合并项冻结出通知包内容（编号在存储层分配） */
export function buildPackageDraft(
  channel: Channel,
  items: MergedItem[],
  frozenAt: number,
): Omit<NoticePackage, 'id' | 'code' | 'seq' | 'batchId'> {
  return {
    channelId: channel.id,
    items,
    fingerprint: packageFingerprintOf(items),
    frozenAt,
  };
}

function splitKey(key: string): [string, string] {
  const at = key.lastIndexOf('@');
  return [key.slice(0, at), key.slice(at + 1)];
}
