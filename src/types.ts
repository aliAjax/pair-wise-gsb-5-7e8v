// ---------- 数据模型（纯数据，不含判定逻辑） ----------

export type ChannelKind = 'open' | 'closed';

/** 分发渠道 */
export interface Channel {
  id: string;
  name: string;
  kind: ChannelKind; // open=开源渠道 closed=闭源渠道
}

/** 组件登记记录（原始录入） */
export interface ComponentRecord {
  id: string;
  channelId: string;
  name: string;
  version: string;
  license: string;      // SPDX 风格标识，如 MIT / GPL-3.0
  licensePath: string;  // 许可证文件在包内的路径
  text: string;         // 许可证文本原文
}

/** 通知条目：同包同版本合并后的结果，版权行全部保留 */
export interface NoticeEntry {
  key: string;            // name@version
  name: string;
  version: string;
  licenses: string[];       // 出现的许可证标识（去重）
  paths: string[];          // 合并的所有许可证路径（去重）
  copyrightLines: string[]; // 合并的全部版权行（去重、保留全部不同行）
  fingerprints: string[];   // 出现的文本指纹（去重；>1 即不一致）
  componentIds: string[];   // 来源登记记录
}

export type RuleId = 'missing-copyright' | 'fingerprint-mismatch' | 'gpl-closed-channel';

/** 违规项：定位到组件、版本、路径与规则 */
export interface Violation {
  rule: RuleId;
  component: string;
  version: string;
  paths: string[];
  detail: string;
}

export type BatchStatus = 'frozen' | 'rejected';

/** 批次：一次核验的不可变快照；通过则冻结，拒绝则整批记录违规 */
export interface Batch {
  id: string;        // B-0001
  seq: number;
  channelId: string;
  channelName: string; // 快照，渠道改名不影响旧批次
  reason: string;      // 新建批次的原因（调整必填）
  createdAt: string;   // ISO 时间
  status: BatchStatus;
  entries: NoticeEntry[];
  violations: Violation[];
  packageFingerprint: string;
}

/** 冻结的通知包（仅由通过的批次产生，1:1） */
export interface NoticePackage {
  id: string; // PKG-0001
  batchId: string;
  channelId: string;
  channelName: string;
  frozenAt: string;
  reason: string;
  entries: NoticeEntry[];
  fingerprint: string;
}

/** 应用持久化状态：渠道、组件、通知包、批次四者一致 */
export interface AppState {
  version: 1;
  channels: Channel[];
  components: ComponentRecord[];
  packages: NoticePackage[];
  batches: Batch[];
}
