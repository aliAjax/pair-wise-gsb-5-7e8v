// ---------- 种子数据（首次启动 / 数据损坏时使用） ----------
import {mergeComponents, packageFingerprint, validateEntries} from './engine';
import {CANONICAL_FINGERPRINTS, CANONICAL_LICENSES, withCopyright} from './canonical';
import type {AppState, Batch, Channel, ComponentRecord, NoticePackage} from './types';

const channels: Channel[] = [
  {id: 'ch-web', name: '官网下载站', kind: 'closed'},
  {id: 'ch-store', name: '应用商店分发', kind: 'closed'},
  {id: 'ch-oss', name: '开源镜像站', kind: 'open'},
];

// 一份被改动过正文的 MIT 文本（用于演示「文本指纹不一致」）
const CHART_JS_ALTERED = withCopyright('MIT', 'Copyright (c) 2014-2026 Chart.js Contributors').replace(
  'Permission is hereby granted, free of charge',
  'Permission is hereby granted, at no cost',
);

// 一份没有版权行的 MIT 文本（用于演示「缺版权行」）
const INTERNAL_UTILS_NO_COPYRIGHT = CANONICAL_LICENSES['MIT'].replace(/^Copyright.*$/m, '').replace(/\n{3,}/g, '\n\n');

const LEGACY_PARSER_GPL = `legacy-parser — 旧版解析器

Copyright (c) 2019 Legacy Parser Authors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.`;

const components: ComponentRecord[] = [
  // 官网下载站：全部合规，对应已冻结批次 B-0001 / 通知包 PKG-0001
  {id: 'cmp-react', channelId: 'ch-web', name: 'react', version: '18.3.1', license: 'MIT', licensePath: 'LICENSE',
    text: withCopyright('MIT', 'Copyright (c) Meta Platforms, Inc. and affiliates.')},
  {id: 'cmp-lodash-1', channelId: 'ch-web', name: 'lodash', version: '4.17.21', license: 'MIT', licensePath: 'LICENSE',
    text: withCopyright('MIT', 'Copyright OpenJS Foundation and other contributors <https://openjsf.org/>')},
  // 同包同版本第二条登记：不同路径、补充另一行版权 —— 合并后两行版权全部保留
  {id: 'cmp-lodash-2', channelId: 'ch-web', name: 'lodash', version: '4.17.21', license: 'MIT', licensePath: 'vendor/lodash/LICENSE',
    text: withCopyright('MIT', 'Copyright Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors')},
  {id: 'cmp-highlight', channelId: 'ch-web', name: 'highlight.js', version: '11.10.0', license: 'BSD-3-Clause', licensePath: 'LICENSE',
    text: withCopyright('BSD-3-Clause', 'Copyright (c) 2006, Ivan Sagalaev.')},
  // 应用商店分发：三条分别触发三条规则，对应被拒绝批次 B-0002
  {id: 'cmp-legacy-parser', channelId: 'ch-store', name: 'legacy-parser', version: '2.1.0', license: 'GPL-3.0', licensePath: 'COPYING',
    text: LEGACY_PARSER_GPL},
  {id: 'cmp-internal-utils', channelId: 'ch-store', name: 'internal-utils', version: '0.9.1', license: 'MIT', licensePath: 'LICENSE',
    text: INTERNAL_UTILS_NO_COPYRIGHT},
  {id: 'cmp-chartjs', channelId: 'ch-store', name: 'chart.js', version: '4.4.4', license: 'MIT', licensePath: 'LICENSE.md',
    text: CHART_JS_ALTERED},
  // 开源镜像站：尚未提交核验
  {id: 'cmp-dayjs', channelId: 'ch-oss', name: 'dayjs', version: '1.11.13', license: 'MIT', licensePath: 'LICENSE',
    text: withCopyright('MIT', 'Copyright (c) 2018-present, iamkun')},
];

function buildBatch(channelId: string, seq: number, reason: string, createdAt: string): Batch {
  const channel = channels.find(c => c.id === channelId)!;
  const entries = mergeComponents(components.filter(c => c.channelId === channelId));
  const violations = validateEntries(entries, channel, CANONICAL_FINGERPRINTS);
  return {
    id: `B-${String(seq).padStart(4, '0')}`,
    seq,
    channelId,
    channelName: channel.name,
    reason,
    createdAt,
    status: violations.length > 0 ? 'rejected' : 'frozen',
    entries,
    violations,
    packageFingerprint: packageFingerprint(entries),
  };
}

export function seedState(): AppState {
  const b1 = buildBatch('ch-web', 1, '首次核验', '2026-09-18T09:32:00.000Z');
  const b2 = buildBatch('ch-store', 2, '首次核验', '2026-09-19T16:05:00.000Z');
  const packages: NoticePackage[] = b1.status === 'frozen'
    ? [{
        id: 'PKG-0001',
        batchId: b1.id,
        channelId: b1.channelId,
        channelName: b1.channelName,
        frozenAt: b1.createdAt,
        reason: b1.reason,
        entries: b1.entries,
        fingerprint: b1.packageFingerprint,
      }]
    : [];
  return {version: 1, channels, components, packages, batches: [b1, b2]};
}
