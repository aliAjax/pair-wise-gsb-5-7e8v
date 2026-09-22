// 判定层：纯工具函数 —— 确定性文本指纹（FNV-1a 32bit，无第三方依赖）

/** 归一化：统一换行、去掉逐行行首行尾空白与空行，避免换行/空格差异误判 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

/** 对许可证原文生成指纹；空文本返回空串 */
export function fingerprintOf(text: string): string {
  const norm = normalizeText(text);
  if (!norm) return '';
  let hash = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    hash ^= norm.charCodeAt(i);;
    // 32 位 FNV 质数乘法（Math.imul 保证溢出语义）
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return 'fnv1a-' + hash.toString(16).padStart(8, '0');
}

/** 数组去重保序 */
export function unique<T>(list: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of list) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/** 版权行清理：逐行 trim、去空行、去重保序（不同版权行全部保留） */
export function cleanCopyrights(raw: string | string[]): string[] {
  const lines = Array.isArray(raw) ? raw : raw.split('\n');
  return unique(
    lines
      .map((line) => line.replace(/\s+$/g, '').replace(/^\s+/g, ''))
      .filter((line) => line.length > 0),
  );
}

/** 时间戳 → 编号日期段，如 20260921 */
export function dayStamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}
