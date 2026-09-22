// 数据层：演示种子数据（仅声明，不包含任何判定逻辑）

import type {Channel, ComponentRecord, EntryInput} from './types';
import {fingerprintOf} from '../logic/fingerprint';

const now = Date.parse('2026-09-21T09:00:00+08:00');
let cid = 0;
const uid = (p: string) => `${p}-seed-${++cid}`;

const MIT_TEXT = `MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

// 与 MIT_TEXT 有实质差异的另一份 MIT 文本（用于触发 R2 指纹不一致）
const MIT_TEXT_VARIANT = `The MIT License (MIT)

Copyright (c) Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL DAMAGES.`;

const BSD3_TEXT = `BSD 3-Clause License

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED.`;

const GPL3_TEXT = `GNU GENERAL PUBLIC LICENSE
Version 3, 29 June 2007

Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.

The GNU General Public License is a free, copyleft license for software
and other kinds of works. The licenses for most software and other
practical works are designed to take away your freedom to share and
change the works. By contrast, the GNU General Public License is intended
to guarantee your freedom to share and change all versions of a program--
to make sure it remains free software for all its users.

When you convey a covered work, you may not impose any further
restrictions on the exercise of the rights granted or affirmed under this
License.`;

export const seedChannels: Channel[] = [
  {
    id: 'ch-seed-cli',
    name: 'Aurora CLI 命令行',
    kind: 'open',
    note: 'GitHub Release 开源分发，源码随包提供',
    createdAt: now - 86400000 * 12,
  },
  {
    id: 'ch-seed-web',
    name: 'Aurora Web 商业版',
    kind: 'closed',
    note: '闭源 SaaS / 安装包渠道，不提供应用源码',
    createdAt: now - 86400000 * 10,
  },
];

function component(
  name: string,
  version: string,
  license: string,
  licensePath: string,
  copyrights: string[],
  licenseText: string,
): ComponentRecord {
  return {
    id: uid('cmp'),
    name,
    version,
    license,
    licensePath,
    copyrights,
    licenseText,
    fingerprint: fingerprintOf(licenseText),
    updatedAt: now - 86400000 * 9,
  };
}

export const seedComponents: ComponentRecord[] = [
  component('react', '18.3.1', 'MIT', 'node_modules/react/LICENSE', [
    'Copyright (c) Meta Platforms, Inc. and affiliates.',
  ], MIT_TEXT),
  component('lodash', '4.17.21', 'MIT', 'node_modules/lodash/LICENSE', [
    'Copyright OpenJS Foundation and other contributors <https://openjsf.org/>',
  ], MIT_TEXT),
  component('highlight.js', '11.10.0', 'BSD-3-Clause', 'node_modules/highlight.js/LICENSE', [
    'Copyright (c) 2006, Ivan Sagalaev.',
  ], BSD3_TEXT),
  component('readline-kit', '2.1.0', 'GPL-3.0', 'vendor/readline-kit/COPYING', [
    'Copyright (c) 2017-2024 Stéphane Rivière',
  ], GPL3_TEXT),
  component('tiny-util', '1.2.0', 'MIT', 'node_modules/tiny-util/LICENSE', [], MIT_TEXT),
  component('libxml-lite', '2.9.14', 'MIT', 'node_modules/libxml-lite/LICENSE', [
    'Copyright (c) 2024 LibXML Lite contributors',
  ], MIT_TEXT),
];

type SeedEntrySpec =
  | {use: ComponentRecord; path?: string; copyrights?: string[]; text?: string}
  | Omit<EntryInput, 'id'>;

export interface SeedBatchSpec {
  channelId: string;
  reason: string;
  createdAt: number;
  entries: SeedEntrySpec[];
}

export const seedBatches: SeedBatchSpec[] = [
  {
    channelId: 'ch-seed-cli',
    reason: '初次建立：Aurora CLI v3.2 发布前录入全部第三方组件',
    createdAt: now - 86400000 * 2,
    entries: [
      // 同包同版本两条录入：指纹一致 → 合并，两条版权行、两个路径全部保留
      {use: seedComponents[0]},
      {
        use: seedComponents[0],
        path: 'third_party/react/LICENSE',
        copyrights: ['Copyright (c) 2013-present, Facebook, Inc.'],
      },
      {use: seedComponents[1]},
      {use: seedComponents[3]}, // GPL 用于开源渠道 → 合规
    ],
  },
  {
    channelId: 'ch-seed-web',
    reason: '初次建立：Aurora Web 商业版打包核验（演示三类违规整批拒绝）',
    createdAt: now - 86400000,
    entries: [
      // R1：无版权行
      {use: seedComponents[4]},
      // R2：同包同版本两份不同 MIT 文本
      {use: seedComponents[5]},
      {
        use: seedComponents[5],
        path: 'vendor/libxml-lite/LICENSE',
        text: MIT_TEXT_VARIANT,
      },
      // R3：GPL 进入闭源渠道
      {use: seedComponents[3]},
    ],
  },
];

/** 把种子条目的宽松描述物化成不可变录入快照 */
export function toEntryInput(spec: SeedEntrySpec): EntryInput {
  if ('use' in spec) {
    const c = spec.use;
    const text = spec.text ?? c.licenseText;
    return {
      id: uid('ent'),
      name: c.name,
      version: c.version,
      license: c.license,
      licensePath: spec.path ?? c.licensePath,
      copyrights: spec.copyrights ?? c.copyrights,
      licenseText: text,
    };
  }
  return {id: uid('ent'), ...spec};
}
