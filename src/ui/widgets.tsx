// 界面层：通用小组件与展示辅助（不含判定规则）

import type {ReactNode} from 'react';
import {X} from 'lucide-react';

export function fmtDate(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours(),
  )}:${p(d.getMinutes())}`;
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="nl-backdrop" onMouseDown={onClose}>
      <div className={wide ? 'nl-modal wide' : 'nl-modal'} onMouseDown={(e) => e.stopPropagation()}>
        <div className="nl-modal-head">
          <h2>{title}</h2>
          <button className="nl-icon-btn" onClick={onClose} aria-label="关闭">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Tag({tone, children}: {tone: 'ok' | 'bad' | 'info' | 'muted' | 'warn'; children: ReactNode}) {
  return <span className={`nl-tag ${tone}`}>{children}</span>;
}

export function Empty({children}: {children: ReactNode}) {
  return <div className="nl-empty">{children}</div>;
}

const tones: Record<string, string> = {
  MIT: '#2eab8e',
  'BSD-3-Clause': '#5b8dd9',
  'Apache-2.0': '#9a74d6',
  'GPL-3.0': '#e08063',
  'GPL-2.0': '#e08063',
  'AGPL-3.0': '#d9576b',
  ISC: '#4fb3a8',
};

export function LicenseTag({license}: {license: string}) {
  const color = tones[license] || '#8a989d';
  const copyleft = /GPL|AGPL/i.test(license);
  return (
    <span className="nl-license" style={{color, background: color + '1a', borderColor: color + '33'}}>
      {copyleft && <i className="nl-license-dot" style={{background: color}} />}
      {license}
    </span>
  );
}

/** 触发浏览器下载（界面层唯一触碰 DOM 下载 API 的地方） */
export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], {type: mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
