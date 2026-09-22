// 数据层：许可证通知包核验台的领域模型（仅类型，不含任何判定逻辑）

/** 分发渠道形态：开源渠道允许强传染性许可证；闭源渠道禁用 */
export type ChannelKind = 'open' | 'closed';

/** 分发渠道 */
export interface Channel {
  id: string;
  name: string;
  kind: ChannelKind;
  note: string;
  createdAt: number;
}

/** 组件登记记录（组件主数据，按 名称@版本 唯一） */
export interface ComponentRecord {
  id: string;
  name: string;
  version: string;
  license: string;
  /** 仓库内许可证文件路径 */
  licensePath: string;
  /** 版权行（逐行保留） */
  copyrights: string[];
  /** 许可证原文（用于生成文本指纹） */
  licenseText: string;
  /** 许可证文本指纹 */
  fingerprint: string;
  updatedAt: number;
}

/** 一次批次录入的原始条目（快照，提交后不可变） */
export interface EntryInput {
  id: string;
  name: string;
  version: string;
  license: string;
  licensePath: string;
  copyrights: string[];
  licenseText: string;
}

/** 规则编号：R1 缺版权行 / R2 文本指纹不一致 / R3 GPL 进入闭源渠道 */
export type RuleId = 'R1' | 'R2' | 'R3';

/** 核验违规明细（整批拒绝时逐条列出） */
export interface Violation {
  ruleId: RuleId;
  rule: string;
  component: string;
  version: string;
  /** 命中规则的全部许可证路径 */
  paths: string[];
  detail: string;
}

/** 同包同版本合并后的通知项（冻结内容） */
export interface MergedItem {
  name: string;
  version: string;
  license: string;
  /** 合并后的全部许可证路径（去重保序） */
  paths: string[];
  /** 合并后的全部版权行（去重保序，一行不漏） */
  copyrights: string[];
  fingerprint: string;
  /** 由多少条录入合并而来 */
  mergedEntries: number;
}

/** 冻结的许可证通知包 */
export interface NoticePackage {
  id: string;
  /** 通知包编号，如 NP-001 */
  code: string;
  channelId: string;
  /** 该渠道内第几个包（从 1 起） */
  seq: number;
  batchId: string;
  items: MergedItem[];
  /** 整包指纹 */
  fingerprint: string;
  frozenAt: number;
}

export type BatchStatus = 'approved' | 'rejected';

/** 核验批次：调整必须新建批次并填写原因，历史批次永久可查 */
export interface Batch {
  id: string;
  /** 批次编号，如 B-20260921-001 */
  code: string;
  channelId: string;
  /** 本批原因（初次建立 / 调整原因） */
  reason: string;
  /** 调整所基于的旧通知包；初次建立时为空 */
  basePackageId?: string;
  entries: EntryInput[];
  status: BatchStatus;
  violations: Violation[];
  /** 通过时生成的冻结通知包 */
  packageId?: string;
  createdAt: number;
}

/** 持久化根状态：渠道、组件、批次、通知包放在同一事务里保存 */
export interface AppState {
  channels: Channel[];
  components: ComponentRecord[];
  batches: Batch[];
  packages: NoticePackage[];
}
