// Nhân vật hoạt hình: thầy Đức và bạn Minh.
// Vẽ bằng SVG, khung 400 x 720. Mỗi dáng điệu điều khiển góc tay, lông mày, miệng, đầu.
import React from 'react';
import { interpolate } from 'remotion';
import { C } from './theme.js';

// Góc tay (độ) [vai, khuỷu] cho tay trái (L) và tay phải (R) theo dáng điệu.
// 0 = buông thẳng xuống; số dương = đưa ra phía trước/lên.
const POSES = {
  'binh-thuong': { L: [8, 6], R: [-8, -6], brow: 0, mouth: 'smile', head: 0 },
  'giang-giai':  { L: [8, 6], R: [-55, -70], brow: 1, mouth: 'smile', head: -2, wiggle: 'R' },
  'chi-bang':    { L: [8, 6], R: [-125, -10], brow: 1, mouth: 'smile', head: -4 },
  'suy-nghi':    { L: [8, 6], R: [-35, -140], brow: -1, mouth: 'flat', head: 6, lookUp: true },
  'vui':         { L: [40, 40], R: [-40, -40], brow: 2, mouth: 'big', head: 0, bounce: true },
  'ngac-nhien':  { L: [55, 60], R: [-55, -60], brow: 3, mouth: 'o', head: 0 },
  'buon':        { L: [4, 2], R: [-4, -2], brow: -2, mouth: 'frown', head: 8 },
  'gat-dau':     { L: [8, 6], R: [-8, -6], brow: 1, mouth: 'smile', head: 0, nod: true },
  'vay-tay':     { L: [8, 6], R: [-150, -30], brow: 2, mouth: 'big', head: -3, wave: 'R' },
  'viet-bang':   { L: [8, 6], R: [-110, -40], brow: 0, mouth: 'flat', head: -6, wiggle: 'R' },
};

function useAnim(frame, pose, talking) {
  const p = POSES[pose] || POSES['binh-thuong'];
  const blink = (frame % 97) > 93 || ((frame + 41) % 151) > 148;
  const mouthOpen = talking ? ((Math.sin(frame * 1.3) + Math.sin(frame * 0.7 + 1)) > 0.15) : false;
  const breathe = Math.sin(frame / 18) * 2;
  let head = p.head;
  if (p.nod) head += Math.sin(frame / 4) * 6;
  let rArm = [...p.R];
  let lArm = [...p.L];
  if (p.wave === 'R') rArm[1] += Math.sin(frame / 3) * 25;
  if (p.wiggle === 'R') rArm[0] += Math.sin(frame / 6) * 6;
  const bounce = p.bounce ? Math.abs(Math.sin(frame / 5)) * -10 : 0;
  return { p, blink, mouthOpen, breathe, head, rArm, lArm, bounce };
}

function Arm({ x, y, angles, sleeve, skin, upper = 120, lower = 110, w = 34 }) {
  const [a, b] = angles;
  return (
    <g transform={`translate(${x} ${y}) rotate(${a})`}>
      <rect x={-w / 2} y={0} width={w} height={upper} rx={w / 2} fill={sleeve} />
      <g transform={`translate(0 ${upper - 8}) rotate(${b})`}>
        <rect x={-w / 2 + 3} y={0} width={w - 6} height={lower} rx={(w - 6) / 2} fill={skin} />
        <circle cx={0} cy={lower} r={w / 2 - 1} fill={skin} />
      </g>
    </g>
  );
}

function Mouth({ type, open, cx, cy, s = 1 }) {
  if (open) return <ellipse cx={cx} cy={cy + 4 * s} rx={14 * s} ry={10 * s} fill="#7a2d2d" />;
  switch (type) {
    case 'big': return <path d={`M${cx - 20 * s} ${cy - 2} Q${cx} ${cy + 22 * s} ${cx + 20 * s} ${cy - 2} Z`} fill="#7a2d2d" />;
    case 'o': return <ellipse cx={cx} cy={cy + 4} rx={9 * s} ry={12 * s} fill="#7a2d2d" />;
    case 'flat': return <path d={`M${cx - 13 * s} ${cy + 3} L${cx + 13 * s} ${cy + 3}`} stroke="#7a2d2d" strokeWidth={5} strokeLinecap="round" />;
    case 'frown': return <path d={`M${cx - 15 * s} ${cy + 10} Q${cx} ${cy - 4} ${cx + 15 * s} ${cy + 10}`} stroke="#7a2d2d" strokeWidth={5} fill="none" strokeLinecap="round" />;
    default: return <path d={`M${cx - 16 * s} ${cy} Q${cx} ${cy + 14 * s} ${cx + 16 * s} ${cy}`} stroke="#7a2d2d" strokeWidth={5} fill="none" strokeLinecap="round" />;
  }
}

function Eyes({ cx, cy, gap, blink, lookUp, brow, glasses }) {
  const dy = lookUp ? -5 : 0;
  const browY = cy - 26 - brow * 3;
  const tilt = brow < 0 ? 6 : brow > 1 ? -4 : 0;
  return (
    <g>
      {[-1, 1].map((k) => (
        <g key={k}>
          {blink
            ? <path d={`M${cx + k * gap - 10} ${cy} L${cx + k * gap + 10} ${cy}`} stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
            : <g><ellipse cx={cx + k * gap} cy={cy} rx={11} ry={13} fill="#fff" /><circle cx={cx + k * gap + 2} cy={cy + 2 + dy} r={6.5} fill={C.ink} /></g>}
          <path d={`M${cx + k * gap - 14} ${browY + k * tilt * -0.5 + (k > 0 ? tilt : 0) * 0} L${cx + k * gap + 14} ${browY - k * tilt * 0.5}`}
            stroke="#2b2018" strokeWidth={6} strokeLinecap="round" />
          {glasses && <rect x={cx + k * gap - 20} y={cy - 17} width={40} height={32} rx={10} fill="none" stroke={C.navy} strokeWidth={4} />}
        </g>
      ))}
      {glasses && <path d={`M${cx - gap + 20} ${cy - 3} L${cx + gap - 20} ${cy - 3}`} stroke={C.navy} strokeWidth={4} />}
    </g>
  );
}

export function ThayDuc({ frame, pose = 'binh-thuong', talking = false, height = 640, flip = false }) {
  const a = useAnim(frame, pose, talking);
  const skin = '#f2c9a0';
  return (
    <svg viewBox="0 0 400 720" height={height} style={{ overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }}>
      <g transform={`translate(0 ${a.bounce})`}>
        {/* chân */}
        <rect x={148} y={520} width={46} height={180} rx={14} fill="#2b3a55" />
        <rect x={206} y={520} width={46} height={180} rx={14} fill="#2b3a55" />
        <rect x={138} y={690} width={62} height={24} rx={12} fill="#1b2230" />
        <rect x={200} y={690} width={62} height={24} rx={12} fill="#1b2230" />
        {/* thân: áo sơ mi xanh nhạt, cà vạt navy */}
        <g transform={`translate(0 ${a.breathe})`}>
          <rect x={118} y={290} width={164} height={250} rx={40} fill="#cfe1f3" />
          <path d="M200 296 L188 318 L200 470 L212 318 Z" fill={C.navy} />
          <path d="M172 292 L200 322 L228 292" fill="#fff" />
          <Arm x={128} y={310} angles={a.lArm} sleeve="#cfe1f3" skin={skin} />
          <Arm x={272} y={310} angles={a.rArm} sleeve="#cfe1f3" skin={skin} />
          {/* đầu */}
          <g transform={`rotate(${a.head} 200 260)`}>
            <rect x={182} y={250} width={36} height={40} fill={skin} />
            <ellipse cx={200} cy={190} rx={78} ry={88} fill={skin} />
            <ellipse cx={122} cy={196} rx={12} ry={18} fill={skin} />
            <ellipse cx={278} cy={196} rx={12} ry={18} fill={skin} />
            {/* tóc ngắn, rẽ ngôi */}
            <path d="M122 172 Q118 96 200 92 Q284 92 280 176 Q262 128 214 124 Q170 140 128 176 Z" fill="#20170f" />
            <Eyes cx={200} cy={196} gap={34} blink={a.blink} lookUp={a.p.lookUp} brow={a.p.brow} glasses />
            <path d="M196 210 Q200 228 206 224" stroke="#c99b74" strokeWidth={4} fill="none" strokeLinecap="round" />
            <Mouth type={a.p.mouth} open={a.mouthOpen} cx={200} cy={246} />
          </g>
        </g>
      </g>
    </svg>
  );
}

export function Minh({ frame, pose = 'binh-thuong', talking = false, height = 560, flip = false }) {
  const a = useAnim(frame + 17, pose, talking);
  const skin = '#f5d0aa';
  return (
    <svg viewBox="0 0 400 720" height={height} style={{ overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }}>
      <g transform={`translate(0 ${a.bounce})`}>
        {/* chân: quần xanh đồng phục */}
        <rect x={152} y={520} width={42} height={175} rx={14} fill="#26407a" />
        <rect x={206} y={520} width={42} height={175} rx={14} fill="#26407a" />
        <rect x={142} y={688} width={58} height={24} rx={12} fill="#f4f4f4" stroke="#c9c9c9" strokeWidth={3} />
        <rect x={202} y={688} width={58} height={24} rx={12} fill="#f4f4f4" stroke="#c9c9c9" strokeWidth={3} />
        <g transform={`translate(0 ${a.breathe})`}>
          {/* balo */}
          <rect x={104} y={318} width={44} height={150} rx={18} fill={C.teal} />
          {/* áo trắng đồng phục */}
          <rect x={126} y={300} width={148} height={236} rx={38} fill="#ffffff" stroke="#e3e3e3" strokeWidth={3} />
          <path d="M176 302 L200 330 L224 302" fill="#eef2f7" />
          <rect x={232} y={360} width={26} height={30} rx={4} fill="#eef2f7" />
          <Arm x={134} y={318} angles={a.lArm} sleeve="#ffffff" skin={skin} upper={110} lower={100} w={30} />
          <Arm x={266} y={318} angles={a.rArm} sleeve="#ffffff" skin={skin} upper={110} lower={100} w={30} />
          {/* đầu */}
          <g transform={`rotate(${a.head} 200 270)`}>
            <rect x={184} y={262} width={32} height={40} fill={skin} />
            <ellipse cx={200} cy={200} rx={76} ry={82} fill={skin} />
            <ellipse cx={124} cy={206} rx={11} ry={16} fill={skin} />
            <ellipse cx={276} cy={206} rx={11} ry={16} fill={skin} />
            {/* tóc dựng, mái lòa xòa */}
            <path d="M124 196 Q112 112 196 104 Q290 100 278 196 Q270 150 240 146 L232 120 L214 148 L196 122 L180 150 L162 128 L154 158 Q136 168 124 196 Z" fill="#1d140c" />
            <Eyes cx={200} cy={206} gap={32} blink={a.blink} lookUp={a.p.lookUp} brow={a.p.brow} />
            <circle cx={150} cy={232} r={10} fill="#f3a9a0" opacity={0.5} />
            <circle cx={250} cy={232} r={10} fill="#f3a9a0" opacity={0.5} />
            <Mouth type={a.p.mouth} open={a.mouthOpen} cx={200} cy={248} s={0.9} />
          </g>
        </g>
      </g>
    </svg>
  );
}

export const POSE_NAMES = Object.keys(POSES);
export const lerp = interpolate;
