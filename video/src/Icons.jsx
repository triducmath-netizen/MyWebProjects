// Biểu tượng minh hoạ (nét vẽ đơn giản, màu thương hiệu) cho video giấu mặt.
import React from 'react';

const P = {
  sach: <><path d="M10 14h18a6 6 0 0 1 6 6v32a5 5 0 0 0-5-5H10z" /><path d="M54 14H36a6 6 0 0 0-6 6v32a5 5 0 0 1 5-5h19z" /></>,
  mat: <><path d="M6 32s10-16 26-16 26 16 26 16-10 16-26 16S6 32 6 32z" /><circle cx="32" cy="32" r="7" /></>,
  nao: <><path d="M24 12a8 8 0 0 0-8 8 8 8 0 0 0-4 14 8 8 0 0 0 6 12 8 8 0 0 0 14 4V16a8 8 0 0 0-8-4z" /><path d="M40 12a8 8 0 0 1 8 8 8 8 0 0 1 4 14 8 8 0 0 1-6 12 8 8 0 0 1-14 4" /><path d="M32 22h-6M32 34h-8M38 28h-6" /></>,
  but: <><path d="M44 8l12 12L24 52H12V40z" /><path d="M38 14l12 12" /></>,
  lich: <><rect x="10" y="14" width="44" height="40" rx="5" /><path d="M10 26h44M22 8v10M42 8v10" /><path d="M20 36h6M30 36h6M40 36h6M20 45h6M30 45h6" /></>,
  'dong-ho': <><circle cx="32" cy="34" r="22" /><path d="M32 22v12l8 6M26 8h12" /></>,
  'bong-den': <><path d="M22 40a16 16 0 1 1 20 0v6H22z" /><path d="M24 52h16M27 58h10M32 18v6M24 28l4 3" /></>,
  'muc-tieu': <><circle cx="32" cy="32" r="22" /><circle cx="32" cy="32" r="13" /><circle cx="32" cy="32" r="4" /></>,
  'dau-hoi': <><path d="M22 22a10 10 0 1 1 14 9c-3 2-4 4-4 8" /><circle cx="32" cy="50" r="1.5" /></>,
  'dau-tich': <><circle cx="32" cy="32" r="24" /><path d="M20 33l8 8 16-17" /></>,
  'dau-x': <><circle cx="32" cy="32" r="24" /><path d="M23 23l18 18M41 23L23 41" /></>,
  'bieu-do': <><path d="M10 54h44M10 54V10" /><path d="M18 44l10-12 9 7 15-18" /><path d="M44 21h8v8" /></>,
  'lap-lai': <><path d="M48 24a18 18 0 0 0-32 4M16 40a18 18 0 0 0 32-4" /><path d="M48 12v12H36M16 52V40h12" /></>,
  'ngoi-sao': <path d="M32 8l7 15 16 2-12 11 3 16-14-8-14 8 3-16L9 25l16-2z" />,
  ngu: <><path d="M44 10a22 22 0 1 0 10 32A18 18 0 0 1 44 10z" /><path d="M14 12h8l-8 8h8" /></>,
  'trai-tim': <path d="M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z" />,
};

export const ICON_NAMES = Object.keys(P);

export function Icon({ name, size = 160, color = '#13294B', accent = '#C9A23F', progress = 1 }) {
  const shape = P[name] || P['bong-den'];
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ overflow: 'visible' }}>
      <circle cx="32" cy="32" r="31" fill={accent} opacity={0.16} />
      <g fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={240} strokeDashoffset={240 * (1 - progress)}>
        {shape}
      </g>
    </svg>
  );
}
