// Video giấu mặt: chỉ có giọng thầy Đức + đồ hoạ chuyển động.
import React from 'react';
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from './theme.js';
import { Rich } from './RichText.jsx';
import { Icon } from './Icons.jsx';
import { sec2f } from './timeline.js';
import { BoardText, Sound } from './Video.jsx';

const SYMBOLS = ['π', '√x', 'x²', '∑', '△', '∞', '÷', '≈', 'f(x)', 'a+b', '%', '∠'];

function Background({ frame, width, height, s }) {
  // Giấy kẻ ô + ký hiệu Toán trôi chậm, rất mờ
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <AbsoluteFill style={{
        backgroundImage: 'linear-gradient(rgba(19,41,75,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(19,41,75,.05) 1px, transparent 1px)',
        backgroundSize: `${48 * s}px ${48 * s}px`,
      }} />
      {SYMBOLS.map((sym, i) => {
        const x = ((i * 0.618 * width + frame * (0.25 + (i % 3) * 0.1) * s) % (width + 200)) - 100;
        const y = (((i * 137) % 100) / 100) * height * 0.9 + Math.sin(frame / 60 + i) * 14 * s;
        return (
          <div key={i} style={{ position: 'absolute', left: x, top: y, fontSize: (40 + (i % 4) * 14) * s, fontWeight: 700,
            color: i % 2 ? C.gold : C.navy, opacity: 0.07, fontFamily: 'Georgia, serif', transform: `rotate(${(i % 5 - 2) * 8}deg)` }}>{sym}</div>
        );
      })}
    </AbsoluteFill>
  );
}

function VoiceBadge({ frame, talking, s }) {
  const bars = [0, 1, 2, 3, 4].map((k) => talking ? 0.35 + 0.65 * Math.abs(Math.sin(frame * 0.35 + k * 1.3)) : 0.25);
  return (
    <div style={{ position: 'absolute', top: 28 * s, right: 32 * s, display: 'flex', alignItems: 'center', gap: 12 * s,
      background: C.navy, color: '#fff', borderRadius: 999, padding: `${10 * s}px ${22 * s}px ${10 * s}px ${14 * s}px`, zIndex: 5,
      boxShadow: '0 8px 20px rgba(19,41,75,.25)' }}>
      <div style={{ width: 44 * s, height: 44 * s, borderRadius: '50%', background: C.gold, display: 'grid', placeItems: 'center' }}>
        <svg viewBox="0 0 24 24" width={24 * s} height={24 * s}><rect x="9" y="3" width="6" height="12" rx="3" fill={C.navy} /><path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke={C.navy} strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
      </div>
      <span style={{ fontSize: 28 * s, fontWeight: 700 }}>Thầy Đức</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 * s, height: 30 * s }}>
        {bars.map((h, k) => <div key={k} style={{ width: 5 * s, height: 30 * s * h, borderRadius: 3, background: C.gold }} />)}
      </div>
    </div>
  );
}

function Logo({ s }) {
  return (
    <div style={{ position: 'absolute', top: 28 * s, left: 32 * s, display: 'flex', alignItems: 'center', gap: 12 * s, zIndex: 5 }}>
      <Img src={staticFile('logo-mark.svg')} style={{ width: 54 * s, height: 54 * s }} />
      <span style={{ fontSize: 30 * s, fontWeight: 700, color: C.navy }}>Trí Đức <span style={{ color: C.gold }}>Math</span></span>
    </div>
  );
}

// Cụm chữ lớn + biểu tượng cho câu đang đọc (cảnh mo-dau / giang)
function KeyPhrase({ scene, t, fps, s, vertical }) {
  const withChu = scene.lines.filter((l) => l.chu);
  const cur = [...withChu].reverse().find((l) => t >= l.start - 0.15) ?? null;
  if (!cur) return null;
  const local = (t - (cur.start - 0.15)) * fps;
  const pop = spring({ frame: local, fps, config: { damping: 15, mass: 0.7 } });
  const draw = interpolate(local, [0, 24], [0, 1], { extrapolateRight: 'clamp' });
  const under = interpolate(local, [8, 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div key={`${cur.si}-${cur.li}`} style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center',
      gap: 56 * s, opacity: pop, transform: `translateY(${(1 - pop) * 30}px)` }}>
      {cur.bieu_tuong && <Icon name={cur.bieu_tuong} size={(vertical ? 280 : 240) * s} progress={draw} />}
      <div style={{ position: 'relative', maxWidth: (vertical ? 900 : 1000) * s, textAlign: vertical ? 'center' : 'left' }}>
        <div style={{ fontSize: (vertical ? 92 : 96) * s, fontWeight: 700, color: C.navy, lineHeight: 1.18 }}><Rich text={cur.chu} /></div>
        <div style={{ height: 14 * s, marginTop: 14 * s, width: `${under * 70}%`, background: C.gold, borderRadius: 8,
          marginLeft: vertical ? 'auto' : 0, marginRight: vertical ? 'auto' : 0 }} />
      </div>
    </div>
  );
}

function StepCards({ scene, sceneFrame, sceneLen, s, vertical }) {
  const items = scene.noi_dung || [];
  const at = (i) => sceneLen * (0.06 + 0.72 * (i / Math.max(1, items.length)));
  const active = items.reduce((acc, _, i) => (sceneFrame >= at(i) ? i : acc), -1);
  const big = items.length <= 4;
  return (
    <div style={{ width: '100%', maxWidth: (vertical ? 960 : 1500) * s, display: 'flex', flexDirection: 'column', gap: 22 * s }}>
      {scene.tieu_de && <div style={{ fontSize: (vertical ? 66 : 64) * s, fontWeight: 700, color: C.navy, marginBottom: 10 * s }}><Rich text={scene.tieu_de} /></div>}
      {items.map((it, i) => {
        const o = interpolate(sceneFrame, [at(i), at(i) + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const on = i === active;
        return (
          <div key={i} style={{ opacity: o, transform: `translateX(${(1 - o) * -40}px)`, display: 'flex', alignItems: 'center', gap: 26 * s,
            background: on ? C.navy : '#fff', color: on ? '#fff' : C.ink, borderRadius: 22 * s, padding: `${(big ? 26 : 18) * s}px ${30 * s}px`,
            boxShadow: on ? '0 14px 30px rgba(19,41,75,.25)' : '0 4px 12px rgba(0,0,0,.06)', border: `2px solid ${on ? C.navy : '#e6e1d3'}` }}>
            <div style={{ flex: 'none', width: 66 * s, height: 66 * s, borderRadius: '50%', display: 'grid', placeItems: 'center',
              background: on ? C.gold : C.navy, color: on ? C.navy : '#fff', fontSize: 34 * s, fontWeight: 700 }}>{i + 1}</div>
            <div style={{ fontSize: (big ? 48 : 40) * s, fontWeight: on ? 700 : 500, lineHeight: 1.3 }}><Rich text={it} /></div>
          </div>
        );
      })}
    </div>
  );
}

function Chalkboard({ scene, sceneFrame, sceneLen, s, vertical, width, height, hasHost }) {
  const rect = vertical
    ? { left: 50 * s, top: 190 * s, width: width - 100 * s, height: height * (hasHost ? 0.42 : 0.56) }
    : hasHost
      ? { left: 560 * s, top: 130 * s, width: width - 620 * s, height: height - 380 * s }
      : { left: 180 * s, top: 140 * s, width: width - 360 * s, height: height - 400 * s };
  return (
    <>
      <div style={{ position: 'absolute', ...rect, background: C.board, borderRadius: 18 * s, border: `${16 * s}px solid ${C.boardEdge}`,
        boxShadow: '0 22px 50px rgba(0,0,0,.28)' }} />
      <BoardText scene={scene} sceneFrame={sceneFrame} sceneLen={sceneLen} k={rect.width / 1000} opacity={1}
        style={{ position: 'absolute', left: rect.left + 16 * s, top: rect.top + 16 * s, width: rect.width - 32 * s, height: rect.height - 32 * s,
          padding: `${34 * s}px ${44 * s}px` }} />
    </>
  );
}

function TitleCard({ scene, kb, sceneFrame, fps, s, vertical }) {
  const pop = spring({ frame: sceneFrame, fps, config: { damping: 14 } });
  return (
    <div style={{ transform: `scale(${pop})`, background: C.navy, color: '#fff', borderRadius: 30 * s, padding: `${46 * s}px ${64 * s}px`,
      textAlign: 'center', maxWidth: (vertical ? 960 : 1300) * s, boxShadow: '0 24px 60px rgba(19,41,75,.35)' }}>
      <div style={{ fontSize: 32 * s, letterSpacing: 3 * s, color: C.gold, fontWeight: 600, textTransform: 'uppercase' }}>{kb.phuong_phap}</div>
      <div style={{ fontSize: (vertical ? 84 : 92) * s, fontWeight: 700, lineHeight: 1.12, marginTop: 18 * s }}>{scene.tieu_de || kb.tieu_de}</div>
      {scene.phu_de && <div style={{ fontSize: 44 * s, marginTop: 20 * s, opacity: 0.85 }}>{scene.phu_de}</div>}
    </div>
  );
}

function OutroCard({ sceneFrame, s }) {
  const o = interpolate(sceneFrame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ opacity: o, background: C.navy, color: '#fff', borderRadius: 30 * s, padding: `${46 * s}px ${70 * s}px`, textAlign: 'center' }}>
      <Img src={staticFile('logo-mark.svg')} style={{ width: 130 * s, height: 130 * s }} />
      <div style={{ fontSize: 72 * s, fontWeight: 700, marginTop: 16 * s }}>Học thật, <span style={{ color: C.gold }}>hiểu sâu.</span></div>
      <div style={{ fontSize: 44 * s, marginTop: 14 * s, opacity: 0.9 }}>Luyện đề miễn phí tại triducmath.vn</div>
    </div>
  );
}

function Subtitle({ line, s, vertical, hasHost }) {
  return (
    <div style={{ position: 'absolute', left: vertical ? 40 * s : (hasHost ? 600 : 200) * s, right: vertical ? 40 * s : (hasHost ? 80 : 200) * s, bottom: (vertical ? 120 : 50) * s,
      display: 'flex', justifyContent: 'center', zIndex: 10 }}>
      <div style={{ background: 'rgba(13,30,56,.9)', color: '#fff', borderRadius: 16 * s, padding: `${14 * s}px ${28 * s}px`,
        fontSize: (vertical ? 48 : 42) * s, lineHeight: 1.35, textAlign: 'center' }}>{line.cau}</div>
    </div>
  );
}

// ---------- Thầy Đức (ảnh kiểu Pixar do AI vẽ) ----------
const FALLBACK = ['giang-giai', 'binh-thuong', 'vui', 'chi-bang', 'vay-tay', 'suy-nghi', 'viet-bang', 'ngac-nhien'];

function choosePose(scene, line) {
  if (line?.dieu_bo) return line.dieu_bo;
  if (!line) return { 'mo-dau': 'binh-thuong', 'ket-thuc': 'vay-tay', bang: 'chi-bang', 'tong-ket': 'vui', 'vi-du': 'chi-bang' }[scene.loai] ?? 'giang-giai';
  if (scene.loai === 'mo-dau' && line.li === 0) return 'vay-tay';
  if (scene.loai === 'ket-thuc') return 'vay-tay';
  if (/\?\s*$/.test(line.cau)) return 'suy-nghi';
  if (scene.loai === 'bang') return line.li % 2 ? 'giang-giai' : 'chi-bang';
  if (scene.loai === 'vi-du') return line.li % 2 ? 'viet-bang' : 'chi-bang';
  if (scene.loai === 'tong-ket') return line.li === scene.lines.length - 1 ? 'vui' : 'giang-giai';
  return line.li % 3 === 2 ? 'vui' : 'giang-giai';
}

function resolvePose(poses, want) {
  if (poses[want]) return want;
  return FALLBACK.find((p) => poses[p]) ?? Object.keys(poses)[0];
}

function Host({ host, scene, cur, t, fps, frame, s, vertical, width, height }) {
  // Dáng theo câu đang đọc; giữa hai câu giữ dáng của câu vừa đọc xong
  const lastLine = [...scene.lines].reverse().find((l) => l.start <= t) ?? null;
  const line = cur ?? lastLine;
  const pose = resolvePose(host.poses, choosePose(scene, line));
  const since = line ? (t - line.start) * fps : (t - scene.start) * fps;
  const pop = spring({ frame: Math.max(0, since), fps, config: { damping: 16, mass: 0.6 } });
  const bob = Math.sin(frame / 22) * 6 * s;
  const sway = Math.sin(frame / 37) * 0.8;
  const talk = cur ? 1 + 0.008 * Math.sin(frame * 0.9) : 1;
  const h = vertical ? height * 0.4 : height * 0.8;
  // Không đặt zIndex/isolation ở đây để mix-blend-mode "multiply" hoà nền trắng của ảnh vào nền video
  return (
    <div style={{ position: 'absolute', bottom: vertical ? 70 * s : 0, left: vertical ? -10 * s : 20 * s,
      height: h, width: vertical ? width * 0.55 : width * 0.3, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      {/* nền giấy mềm sau nhân vật: che ký hiệu trôi để ảnh không bị lẫn */}
      <div style={{ position: 'absolute', left: '8%', right: '8%', top: '4%', bottom: 0, borderRadius: '45% 45% 12% 12%',
        background: `radial-gradient(ellipse at 50% 55%, ${C.paper} 62%, rgba(246,244,238,0) 78%)` }} />
      <Img key={pose} src={staticFile(host.poses[pose])}
        style={{ height: '100%', width: 'auto', objectFit: 'contain', mixBlendMode: 'multiply',
          opacity: 0.6 + 0.4 * pop, transform: `translateY(${bob + (1 - pop) * 14 * s}px) rotate(${sway}deg) scale(${talk * (0.97 + 0.03 * pop)})`,
          transformOrigin: '50% 100%' }} />
    </div>
  );
}

export function FacelessVideo({ kichBan, tl, lines, cur, scene, sceneFrame, sceneLen, nhac, amThanh, fontFamily, host }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const vertical = height > width;
  const s = vertical ? width / 1080 : height / 1080;
  const hasHost = !!(host && host.poses && Object.keys(host.poses).length);
  const t = frame / fps;
  const fade = interpolate(sceneFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });
  const progress = Math.min(1, t / tl.total);
  const showTitle = scene.loai === 'mo-dau' && (t - scene.start) < Math.max(3.2, (scene.lines[1]?.start ?? scene.end) - scene.start);

  let main = null;
  if (scene.loai === 'mo-dau') {
    main = showTitle
      ? <TitleCard scene={scene} kb={kichBan} sceneFrame={sceneFrame} fps={fps} s={s} vertical={vertical} />
      : <KeyPhrase scene={scene} t={t} fps={fps} s={s} vertical={vertical} />;
  } else if (scene.loai === 'giang') {
    main = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: vertical ? 'center' : 'flex-start', gap: 40 * s }}>
        {scene.tieu_de && <div style={{ fontSize: 40 * s, fontWeight: 700, color: C.teal, letterSpacing: 2 * s, textTransform: 'uppercase' }}>{scene.tieu_de}</div>}
        <KeyPhrase scene={scene} t={t} fps={fps} s={s} vertical={vertical} />
      </div>
    );
  } else if (scene.loai === 'bang' || scene.loai === 'tong-ket') {
    main = <StepCards scene={scene} sceneFrame={sceneFrame} sceneLen={sceneLen} s={s} vertical={vertical} />;
  } else if (scene.loai === 'ket-thuc') {
    main = <OutroCard sceneFrame={sceneFrame} s={s} />;
  }

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <Background frame={frame} width={width} height={height} s={s} />
      <Logo s={s} />
      <VoiceBadge frame={frame} talking={!!cur} s={s} />
      {scene.loai === 'vi-du'
        ? <div style={{ opacity: fade }}><Chalkboard scene={scene} sceneFrame={sceneFrame} sceneLen={sceneLen} s={s} vertical={vertical} width={width} height={height} hasHost={hasHost} /></div>
        : (
          <AbsoluteFill style={{ opacity: fade, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: vertical
              ? `${200 * s}px ${60 * s}px ${(hasHost ? 900 : 360) * s}px`
              : `${130 * s}px ${200 * s}px ${220 * s}px ${(hasHost ? 640 : 200) * s}px` }}>
            {main}
          </AbsoluteFill>
        )}
      {hasHost && <Host host={host} scene={scene} cur={cur} t={t} fps={fps} frame={frame} s={s} vertical={vertical} width={width} height={height} />}
      {cur && <Subtitle line={cur} s={s} vertical={vertical} hasHost={hasHost} />}
      <div style={{ position: 'absolute', left: 0, bottom: 0, height: 8 * s, width: `${progress * 100}%`, background: C.gold, zIndex: 11 }} />
      <Sound kichBan={kichBan} lines={lines} tl={tl} nhac={nhac} amThanh={amThanh} fps={fps} />
    </AbsoluteFill>
  );
}
