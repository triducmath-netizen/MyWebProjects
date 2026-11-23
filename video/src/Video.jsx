import React from 'react';
import { AbsoluteFill, Audio, Img, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { loadFont } from '@remotion/google-fonts/BeVietnamPro';
import { C } from './theme.js';
import { ThayDuc, Minh } from './characters.jsx';
import { Rich } from './RichText.jsx';
import { buildTimeline, sec2f } from './timeline.js';
import { ThreeCanvas } from '@remotion/three';
import { Scene3D, layoutFor, boardRect } from './three/Scene3D.jsx';

function Logo({ s }) {
  return (
    <div style={{ position: 'absolute', top: 28 * s, left: 32 * s, display: 'flex', alignItems: 'center', gap: 12 * s, zIndex: 5,
      background: 'rgba(255,255,255,.82)', borderRadius: 14 * s, padding: `${8 * s}px ${16 * s}px ${8 * s}px ${10 * s}px` }}>
      <Img src={staticFile('logo-mark.svg')} style={{ width: 50 * s, height: 50 * s }} />
      <span style={{ fontSize: 28 * s, fontWeight: 700, color: C.navy }}>Trí Đức <span style={{ color: C.gold }}>Math</span></span>
    </div>
  );
}

function Sound({ kichBan, lines, tl, nhac, amThanh, fps }) {
  return (
    <>
      {amThanh && lines.map((l) => (
        <Sequence key={`${l.si}-${l.li}`} from={sec2f(l.start)} durationInFrames={sec2f(l.dur) + 3}>
          <Audio src={staticFile(`am-thanh/${kichBan.slug}/c${l.si}-l${l.li}.mp3`)} />
        </Sequence>
      ))}
      {nhac && (
        <Audio src={staticFile(nhac)} loop
          volume={(f) => {
            const tt = f / fps;
            const talking = lines.some((l) => tt >= l.start - 0.2 && tt < l.start + l.dur + 0.2);
            const endFade = interpolate(tt, [tl.total - 2.5, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (talking ? 0.07 : 0.2) * endFade;
          }} />
      )}
    </>
  );
}

const { fontFamily } = loadFont('normal', { weights: ['500', '600', '700'], subsets: ['vietnamese', 'latin'] });

// Props: { kichBan, durations: [[giây,...] mỗi cảnh], nhac: 'nhac/x.mp3' | null, amThanh: true/false }
export function TriDucVideo({ kichBan, durations, nhac, amThanh, kieu }) {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const vertical = height > width;
  const tl = buildTimeline(kichBan, durations);
  const t = frame / fps;
  const scene = tl.scenes.find((s) => t >= s.start && t < s.end) ?? tl.scenes.at(-1);
  const lines = tl.scenes.flatMap((s) => s.lines);
  const cur = lines.find((l) => t >= l.start && t < l.start + l.dur);
  // Dáng điệu gần nhất của mỗi nhân vật (giữ nguyên khi người kia nói)
  const lastOf = (who) => [...lines].reverse().find((l) => l.nguoi === who && l.start <= t);
  const poseDuc = lastOf('duc')?.dieu_bo ?? 'binh-thuong';
  const poseMinh = lastOf('minh')?.dieu_bo ?? 'binh-thuong';
  const listenerNod = cur && (Math.floor(t * 0.6) % 4 === 0);

  const sceneFrame = frame - sec2f(scene.start);
  const sceneLen = sec2f(scene.end - scene.start);
  const fadeIn = interpolate(sceneFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  const s = vertical ? width / 1080 : height / 1080; // tỉ lệ cỡ chữ
  const charH = vertical ? 760 : 640;
  const is3d = (kieu ?? '3d') === '3d';
  const showBoard = scene.loai !== 'mo-dau' && scene.loai !== 'ket-thuc';
  const ducPose = cur?.nguoi === 'duc' ? cur.dieu_bo ?? poseDuc : (listenerNod ? 'gat-dau' : poseDuc);
  const minhPose = cur?.nguoi === 'minh' ? cur.dieu_bo ?? poseMinh : poseMinh;
  const layout3d = is3d ? layoutFor(vertical) : null;
  const rect3d = is3d ? boardRect(layout3d, width, height) : null;

  if (is3d) {
    return (
      <AbsoluteFill style={{ fontFamily }}>
        <ThreeCanvas width={width} height={height} shadows gl={{ antialias: true }} camera={{ fov: layout3d.cam.fov, position: layout3d.cam.pos }}>
          <Scene3D layout={layout3d} frame={frame} ducPose={ducPose} minhPose={minhPose}
            ducTalking={cur?.nguoi === 'duc'} minhTalking={cur?.nguoi === 'minh'} showBoard />
        </ThreeCanvas>
        <Logo s={s} />
        {showBoard && <Board scene={scene} sceneFrame={sceneFrame} sceneLen={sceneLen} vertical={vertical} s={s} opacity={fadeIn} rect={rect3d} />}
        {scene.loai === 'mo-dau' && <TitleCard scene={scene} sceneFrame={sceneFrame} s={s} vertical={vertical} kb={kichBan} />}
        {scene.loai === 'ket-thuc' && <OutroCard sceneFrame={sceneFrame} s={s} />}
        {cur && <Subtitle line={cur} s={s} vertical={vertical} />}
        <Sound kichBan={kichBan} lines={lines} tl={tl} nhac={nhac} amThanh={amThanh} fps={fps} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ fontFamily, background: `linear-gradient(180deg, ${C.paper} 0%, #e9e4d6 100%)` }}>
      {/* sàn lớp học */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: vertical ? '30%' : '22%', background: '#d9cfb8' }} />
      {/* logo góc */}
      <div style={{ position: 'absolute', top: 28 * s, left: 32 * s, display: 'flex', alignItems: 'center', gap: 12 * s, zIndex: 5 }}>
        <Img src={staticFile('logo-mark.svg')} style={{ width: 54 * s, height: 54 * s }} />
        <span style={{ fontSize: 30 * s, fontWeight: 700, color: C.navy }}>Trí Đức <span style={{ color: C.gold }}>Math</span></span>
      </div>

      {/* BẢNG */}
      {scene.loai !== 'mo-dau' && scene.loai !== 'ket-thuc' && (
        <Board scene={scene} sceneFrame={sceneFrame} sceneLen={sceneLen} vertical={vertical} s={s} opacity={fadeIn} />
      )}

      {/* NHÂN VẬT */}
      <div style={{ position: 'absolute', bottom: vertical ? 180 * s : 40 * s, left: vertical ? -40 * s : 20 * s }}>
        <ThayDuc frame={frame} pose={cur?.nguoi === 'duc' ? cur.dieu_bo ?? poseDuc : (listenerNod ? 'gat-dau' : poseDuc)}
          talking={cur?.nguoi === 'duc'} height={charH * s} />
      </div>
      <div style={{ position: 'absolute', bottom: vertical ? 180 * s : 40 * s, right: vertical ? -30 * s : 30 * s }}>
        <Minh frame={frame} pose={cur?.nguoi === 'minh' ? cur.dieu_bo ?? poseMinh : poseMinh}
          talking={cur?.nguoi === 'minh'} height={charH * 0.86 * s} flip />
      </div>

      {/* THẺ MỞ ĐẦU / KẾT THÚC */}
      {scene.loai === 'mo-dau' && <TitleCard scene={scene} sceneFrame={sceneFrame} s={s} vertical={vertical} kb={kichBan} />}
      {scene.loai === 'ket-thuc' && <OutroCard sceneFrame={sceneFrame} s={s} />}

      {/* PHỤ ĐỀ */}
      {cur && <Subtitle line={cur} s={s} vertical={vertical} />}

      {/* ÂM THANH */}
      {amThanh && lines.map((l) => (
        <Sequence key={`${l.si}-${l.li}`} from={sec2f(l.start)} durationInFrames={sec2f(l.dur) + 3}>
          <Audio src={staticFile(`am-thanh/${kichBan.slug}/c${l.si}-l${l.li}.mp3`)} />
        </Sequence>
      ))}
      {nhac && (
        <Audio src={staticFile(nhac)} loop
          volume={(f) => {
            const tt = f / fps;
            const talking = lines.some((l) => tt >= l.start - 0.2 && tt < l.start + l.dur + 0.2);
            const endFade = interpolate(tt, [tl.total - 2.5, tl.total], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            return (talking ? 0.07 : 0.2) * endFade;
          }} />
      )}
    </AbsoluteFill>
  );
}

function Board({ scene, sceneFrame, sceneLen, vertical, s, opacity, rect }) {
  if (rect) {
    // Bản 3D: chỉ vẽ chữ, nằm đúng trên mặt bảng 3D
    const k = rect.width / (vertical ? 980 : 1000);
    return <BoardText scene={scene} sceneFrame={sceneFrame} sceneLen={sceneLen} k={k} opacity={opacity}
      style={{ position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
        padding: `${34 * k}px ${44 * k}px` }} />;
  }
  return <Board2D scene={scene} sceneFrame={sceneFrame} sceneLen={sceneLen} vertical={vertical} s={s} opacity={opacity} />;
}

function BoardText({ scene, sceneFrame, sceneLen, k, opacity, style }) {
  const items = scene.loai === 'vi-du' ? (scene.loi_giai || []) : (scene.noi_dung || []);
  const shown = (i) => {
    const at = scene.loai === 'vi-du'
      ? sceneLen * (0.35 + 0.5 * (i / Math.max(1, items.length)))
      : sceneLen * (0.08 + 0.7 * (i / Math.max(1, items.length)));
    return interpolate(sceneFrame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  };
  return (
    <div style={{ ...style, opacity, color: '#f3f1e8', display: 'flex', flexDirection: 'column', gap: 20 * k, overflow: 'hidden',
      textShadow: '0 1px 0 rgba(0,0,0,.25)' }}>
      {scene.tieu_de && <div style={{ fontSize: 56 * k, fontWeight: 700, color: C.gold, lineHeight: 1.2 }}><Rich text={scene.tieu_de} /></div>}
      {scene.de_bai && <div style={{ fontSize: 44 * k, lineHeight: 1.45 }}><Rich text={scene.de_bai} /></div>}
      {items.map((it, i) => (
        <div key={i} style={{ fontSize: (scene.loai === 'vi-du' ? 46 : 44) * k, lineHeight: 1.4, opacity: shown(i),
          transform: `translateY(${(1 - shown(i)) * 16}px)`, display: 'flex', gap: 16 * k }}>
          {scene.loai !== 'vi-du' && <span style={{ color: C.gold, fontWeight: 700 }}>{i + 1}.</span>}
          <Rich text={it} />
        </div>
      ))}
      {!scene.tieu_de && !items.length && !scene.de_bai && (
        <div style={{ margin: 'auto', fontSize: 70 * k, color: 'rgba(243,241,232,.35)', fontWeight: 700 }}>Học thật, hiểu sâu.</div>
      )}
    </div>
  );
}

function Board2D({ scene, sceneFrame, sceneLen, vertical, s, opacity }) {
  const items = scene.loai === 'vi-du' ? (scene.loi_giai || []) : (scene.noi_dung || []);
  // Hiện dần các dòng trong 75% đầu cảnh
  const shown = (i) => {
    const at = scene.loai === 'vi-du'
      ? sceneLen * (0.35 + 0.5 * (i / Math.max(1, items.length)))
      : sceneLen * (0.08 + 0.7 * (i / Math.max(1, items.length)));
    return interpolate(sceneFrame, [at, at + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  };
  const box = vertical
    ? { left: 50 * s, right: 50 * s, top: 130 * s, height: 760 * s }
    : { left: 470 * s, right: 420 * s, top: 110 * s, bottom: 300 * s };
  return (
    <div style={{ position: 'absolute', ...box, opacity, background: C.board, border: `${14 * s}px solid ${C.boardEdge}`,
      borderRadius: 18 * s, boxShadow: '0 18px 40px rgba(0,0,0,.25)', padding: `${34 * s}px ${44 * s}px`, color: '#f3f1e8',
      display: 'flex', flexDirection: 'column', gap: 22 * s, overflow: 'hidden' }}>
      {scene.tieu_de && <div style={{ fontSize: 52 * s, fontWeight: 700, color: C.gold, lineHeight: 1.2 }}><Rich text={scene.tieu_de} /></div>}
      {scene.de_bai && <div style={{ fontSize: 40 * s, lineHeight: 1.45 }}><Rich text={scene.de_bai} /></div>}
      {items.map((it, i) => (
        <div key={i} style={{ fontSize: (scene.loai === 'vi-du' ? 42 : 40) * s, lineHeight: 1.4, opacity: shown(i),
          transform: `translateY(${(1 - shown(i)) * 16}px)`, display: 'flex', gap: 16 * s }}>
          {scene.loai !== 'vi-du' && <span style={{ color: C.gold, fontWeight: 700 }}>{i + 1}.</span>}
          <Rich text={it} />
        </div>
      ))}
      {!scene.tieu_de && !items.length && !scene.de_bai && (
        <div style={{ margin: 'auto', fontSize: 64 * s, color: 'rgba(243,241,232,.35)', fontWeight: 700 }}>Học thật, hiểu sâu.</div>
      )}
    </div>
  );
}

function Subtitle({ line, s, vertical }) {
  const who = line.nguoi === 'duc' ? 'Thầy Đức' : 'Minh';
  return (
    <div style={{ position: 'absolute', left: vertical ? 40 * s : 220 * s, right: vertical ? 40 * s : 220 * s,
      bottom: vertical ? 90 * s : 36 * s, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
      <div style={{ background: 'rgba(13,30,56,.88)', color: '#fff', borderRadius: 16 * s, padding: `${14 * s}px ${26 * s}px`,
        fontSize: (vertical ? 46 : 40) * s, lineHeight: 1.35, textAlign: 'center', maxWidth: '100%' }}>
        <span style={{ color: line.nguoi === 'duc' ? C.gold : '#7fd1c7', fontWeight: 700 }}>{who}: </span>{line.cau}
      </div>
    </div>
  );
}

function TitleCard({ scene, sceneFrame, s, vertical, kb }) {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: sceneFrame, fps, config: { damping: 14 } });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: vertical ? 220 * s : 130 * s, display: 'flex', justifyContent: 'center', zIndex: 6 }}>
      <div style={{ transform: `scale(${pop})`, background: C.navy, color: '#fff', borderRadius: 28 * s,
        padding: `${40 * s}px ${60 * s}px`, textAlign: 'center', maxWidth: vertical ? '88%' : '62%', boxShadow: '0 20px 50px rgba(19,41,75,.35)' }}>
        <div style={{ fontSize: 30 * s, letterSpacing: 3 * s, color: C.gold, fontWeight: 600, textTransform: 'uppercase' }}>{kb.phuong_phap}</div>
        <div style={{ fontSize: (vertical ? 72 : 76) * s, fontWeight: 700, lineHeight: 1.15, marginTop: 16 * s }}>{scene.tieu_de || kb.tieu_de}</div>
        {scene.phu_de && <div style={{ fontSize: 40 * s, marginTop: 18 * s, opacity: 0.85 }}>{scene.phu_de}</div>}
      </div>
    </div>
  );
}

function OutroCard({ sceneFrame, s }) {
  const o = interpolate(sceneFrame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 150 * s, display: 'flex', justifyContent: 'center', opacity: o, zIndex: 6 }}>
      <div style={{ background: C.navy, color: '#fff', borderRadius: 28 * s, padding: `${40 * s}px ${64 * s}px`, textAlign: 'center' }}>
        <Img src={staticFile('logo-mark.svg')} style={{ width: 110 * s, height: 110 * s }} />
        <div style={{ fontSize: 64 * s, fontWeight: 700, marginTop: 14 * s }}>Học thật, <span style={{ color: C.gold }}>hiểu sâu.</span></div>
        <div style={{ fontSize: 40 * s, marginTop: 12 * s, opacity: 0.9 }}>Luyện đề miễn phí tại triducmath.vn</div>
      </div>
    </div>
  );
}

export function videoDuration(kichBan, durations) {
  return Math.max(30, sec2f(buildTimeline(kichBan, durations).total));
}
