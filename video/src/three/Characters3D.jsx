// Nhân vật 3D: thầy Đức và bạn Minh — tỉ lệ gần người thật, đồng phục học sinh Việt Nam.
// Khớp: vai, khuỷu tay, cổ. Dáng điệu dùng chung tên với bản 2D.
import React, { useMemo } from 'react';
import * as THREE from 'three';

const D = THREE.MathUtils.degToRad;

// a = tay phía trái màn hình, b = tay phía phải màn hình (khi nhân vật nhìn thẳng).
// sz: dang ngang (độ), sx: đưa ra trước (âm = ra trước), ex: gập khuỷu (âm = gập ra trước)
const POSES = {
  'binh-thuong': { a: { sz: 6, sx: 0, ex: -10 }, b: { sz: 6, sx: 0, ex: -10 }, brow: 0, mouth: 'smile' },
  'giang-giai':  { a: { sz: 6, sx: 0, ex: -10 }, b: { sz: 18, sx: -45, ex: -65 }, brow: 0.5, mouth: 'smile', wiggle: true, tilt: -0.06 },
  'chi-bang':    { a: { sz: 6, sx: 0, ex: -10 }, b: { sz: 105, sx: -20, ex: -8 }, brow: 0.5, mouth: 'smile', turn: 0.35 },
  'suy-nghi':    { a: { sz: 10, sx: -25, ex: -75 }, b: { sz: 16, sx: -50, ex: -135 }, brow: -0.6, mouth: 'flat', tilt: 0.12, lookUp: true },
  'vui':         { a: { sz: 26, sx: -14, ex: -40 }, b: { sz: 26, sx: -14, ex: -40 }, brow: 1, mouth: 'big', bounce: true },
  'ngac-nhien':  { a: { sz: 34, sx: -30, ex: -60 }, b: { sz: 34, sx: -30, ex: -60 }, brow: 1.5, mouth: 'o' },
  'buon':        { a: { sz: 3, sx: 0, ex: -4 }, b: { sz: 3, sx: 0, ex: -4 }, brow: -1, mouth: 'frown', headDown: 0.2 },
  'gat-dau':     { a: { sz: 6, sx: 0, ex: -10 }, b: { sz: 6, sx: 0, ex: -10 }, brow: 0.4, mouth: 'smile', nod: true },
  'vay-tay':     { a: { sz: 6, sx: 0, ex: -10 }, b: { sz: 145, sx: -6, ex: -24 }, brow: 1, mouth: 'big', wave: true },
  'viet-bang':   { a: { sz: 6, sx: 0, ex: -10 }, b: { sz: 92, sx: -42, ex: -30 }, brow: 0, mouth: 'flat', wiggle: true, turn: 0.5 },
};

const std = (color, rough = 0.75) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });

function useMats(spec) {
  return useMemo(() => Object.fromEntries(Object.entries(spec).map(([k, v]) =>
    [k, std(v, k === 'skin' ? 0.62 : k === 'shoes' ? 0.45 : k === 'eyeWhite' || k === 'pupil' ? 0.3 : 0.8)])), [JSON.stringify(spec)]);
}

function Capsule({ len, r, mat, y = -len / 2 - r, cast = true }) {
  return (
    <mesh position={[0, y, 0]} castShadow={cast} material={mat}>
      <capsuleGeometry args={[r, len, 6, 16]} />
    </mesh>
  );
}

// Tay: bắp tay (có tay áo ngắn hoặc dài), cẳng tay, bàn tay
function Arm({ side, pose, frame, m, upper, lower, r, wave, wiggle, shortSleeve }) {
  let { sz, sx, ex } = pose;
  if (wave) { sz += Math.sin(frame / 3.2) * 9; ex += Math.sin(frame / 3.2) * 20; }
  if (wiggle) { sx += Math.sin(frame / 7) * 6; ex += Math.sin(frame / 5) * 5; }
  return (
    <group rotation={[D(sx), 0, D(sz) * side]}>
      {/* vai áo */}
      <mesh position={[0, -0.01, 0]} castShadow material={m.sleeve}><sphereGeometry args={[r * 1.35, 16, 12]} /></mesh>
      {shortSleeve ? (
        <>
          <Capsule len={upper} r={r} mat={m.skin} />
          <mesh position={[0, -upper * 0.28, 0]} castShadow material={m.sleeve}><cylinderGeometry args={[r * 1.32, r * 1.38, upper * 0.62, 16]} /></mesh>
        </>
      ) : <Capsule len={upper} r={r * 1.12} mat={m.sleeve} />}
      <group position={[0, -upper - r * 1.4, 0]} rotation={[D(ex), 0, 0]}>
        <Capsule len={lower} r={r * 0.86} mat={shortSleeve ? m.skin : m.sleeve} />
        {!shortSleeve && <mesh position={[0, -lower - r * 0.9, 0]} material={m.cuff}><cylinderGeometry args={[r * 0.98, r * 0.98, r * 0.6, 14]} /></mesh>}
        {/* bàn tay */}
        <mesh position={[0, -lower - r * 2.1, 0.01]} scale={[0.9, 1.25, 0.55]} castShadow material={m.skin}><sphereGeometry args={[r * 1.05, 14, 12]} /></mesh>
      </group>
    </group>
  );
}

function Face({ R, frame, talking, p, glasses, m }) {
  const blink = (frame % 101) > 97 || ((frame + 47) % 157) > 154;
  const open = talking ? Math.max(0, (Math.sin(frame * 1.25) + Math.sin(frame * 0.66 + 1.3)) / 2) : 0;
  const ez = R * 0.86;
  const ey = R * 0.08;
  const look = p.lookUp ? R * 0.05 : 0;
  const browY = R * 0.3 + p.brow * R * 0.05;
  const browTilt = p.brow < 0 ? 0.22 : p.brow > 1 ? -0.14 : 0;
  return (
    <group>
      {[-1, 1].map((k) => (
        <group key={k} position={[k * R * 0.34, ey, ez]}>
          <mesh scale={[1.25, blink ? 0.1 : 0.82, 0.45]} material={m.eyeWhite}><sphereGeometry args={[R * 0.13, 16, 12]} /></mesh>
          {!blink && <mesh position={[0, look, R * 0.05]} material={m.iris}><sphereGeometry args={[R * 0.085, 14, 10]} /></mesh>}
          {!blink && <mesh position={[0, look, R * 0.1]} material={m.pupil}><sphereGeometry args={[R * 0.045, 10, 8]} /></mesh>}
          {!blink && <mesh position={[R * 0.03, look + R * 0.03, R * 0.12]} material={m.eyeWhite}><sphereGeometry args={[R * 0.018, 8, 6]} /></mesh>}
          <mesh position={[0, browY - ey, R * 0.06]} rotation={[0, 0, browTilt * -k]} scale={[1, 0.35, 0.4]} material={m.brow}>
            <capsuleGeometry args={[R * 0.06, R * 0.22, 4, 8]} />
          </mesh>
          {glasses && (
            <mesh position={[0, 0, R * 0.13]} material={m.glasses}>
              <torusGeometry args={[R * 0.2, R * 0.022, 8, 28]} />
            </mesh>
          )}
        </group>
      ))}
      {glasses && <mesh position={[0, ey + R * 0.02, ez + R * 0.13]} rotation={[0, 0, Math.PI / 2]} material={m.glasses}><cylinderGeometry args={[R * 0.02, R * 0.02, R * 0.28, 8]} /></mesh>}
      {/* mũi */}
      <mesh position={[0, -R * 0.12, R * 0.97]} scale={[0.8, 1.1, 0.9]} material={m.skin}><sphereGeometry args={[R * 0.1, 12, 10]} /></mesh>
      {/* miệng */}
      <group position={[0, -R * 0.42, R * 0.9]}>
        {open > 0.12 ? (
          <mesh scale={[1, 0.3 + open * 0.75, 0.35]} material={m.mouth}><sphereGeometry args={[R * 0.13, 16, 12]} /></mesh>
        ) : p.mouth === 'o' ? (
          <mesh scale={[0.75, 1, 0.35]} material={m.mouth}><sphereGeometry args={[R * 0.1, 16, 12]} /></mesh>
        ) : p.mouth === 'big' ? (
          <mesh rotation={[0, 0, Math.PI]} scale={[1, 0.6, 0.35]} material={m.mouth}><sphereGeometry args={[R * 0.17, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        ) : p.mouth === 'flat' ? (
          <mesh material={m.lip}><boxGeometry args={[R * 0.24, R * 0.035, R * 0.04]} /></mesh>
        ) : (
          <mesh rotation={[0, 0, p.mouth === 'frown' ? 0 : Math.PI]} position={[0, p.mouth === 'frown' ? -R * 0.08 : R * 0.06, 0]} material={m.lip}>
            <torusGeometry args={[R * 0.12, R * 0.025, 8, 20, Math.PI]} />
          </mesh>
        )}
      </group>
    </group>
  );
}

// Thân người tỉ lệ thật (cao ~1,7 m khi scale = 1)
function Body({ frame, pose, talking, mirror, spec, glasses, hair, top, scale = 1, shortSleeve }) {
  const p = POSES[pose] || POSES['binh-thuong'];
  const m = useMats(spec);
  const breathe = Math.sin(frame / 20) * 0.006;
  const bounce = p.bounce ? Math.abs(Math.sin(frame / 5)) * 0.035 : 0;
  const nod = p.nod ? Math.sin(frame / 4) * 0.12 : 0;
  const R = 0.118; // bán kính đầu
  const armA = mirror ? p.b : p.a;
  const armB = mirror ? p.a : p.b;
  const turn = (p.turn || 0) * (mirror ? -1 : 1);
  return (
    <group scale={scale} position={[0, bounce, 0]} rotation={[0, turn * 0.45, 0]}>
      {/* chân + giày */}
      {[-1, 1].map((k) => (
        <group key={k} position={[k * 0.085, 0.86, 0]}>
          <Capsule len={0.72} r={0.068} mat={m.pants} />
          <mesh position={[0, -0.84, 0.045]} castShadow material={m.shoes} scale={[1, 0.55, 1.6]}><sphereGeometry args={[0.07, 16, 10]} /></mesh>
        </group>
      ))}
      {/* thắt lưng + thân áo */}
      <mesh position={[0, 0.9, 0]} material={m.belt}><cylinderGeometry args={[0.158, 0.158, 0.04, 20]} /></mesh>
      <group position={[0, 1.15 + breathe, 0]}>
        <mesh castShadow material={m.shirt} scale={[1, 1, 0.68]}><capsuleGeometry args={[0.16, 0.3, 8, 20]} /></mesh>
        {top?.({ m })}
        <group position={[-0.205, 0.17, 0]}><Arm side={-1} pose={armA} frame={frame} m={m} upper={0.2} lower={0.2} r={0.045}
          wave={mirror ? p.wave : false} wiggle={mirror ? p.wiggle : false} shortSleeve={shortSleeve} /></group>
        <group position={[0.205, 0.17, 0]}><Arm side={1} pose={armB} frame={frame} m={m} upper={0.2} lower={0.2} r={0.045}
          wave={!mirror ? p.wave : false} wiggle={!mirror ? p.wiggle : false} shortSleeve={shortSleeve} /></group>
        {/* cổ + đầu */}
        <mesh position={[0, 0.3, 0]} material={m.skin}><cylinderGeometry args={[0.048, 0.055, 0.11, 14]} /></mesh>
        <group position={[0, 0.47, 0.005]} rotation={[(p.headDown || 0) + nod, turn * 0.5, (p.tilt || 0) * (mirror ? -1 : 1)]}>
          <mesh castShadow material={m.skin} scale={[0.92, 1.12, 0.98]}><sphereGeometry args={[R, 32, 24]} /></mesh>
          {/* cằm thon */}
          <mesh position={[0, -R * 0.55, R * 0.25]} scale={[0.7, 0.55, 0.7]} material={m.skin}><sphereGeometry args={[R * 0.6, 16, 12]} /></mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * R * 0.92, -0.005, 0]} scale={[0.4, 0.9, 0.65]} material={m.skin}><sphereGeometry args={[R * 0.22, 12, 10]} /></mesh>
          ))}
          {hair({ m, R })}
          <Face R={R} frame={frame} talking={talking} p={p} glasses={glasses} m={m} />
        </group>
      </group>
    </group>
  );
}

// Tóc ngắn rẽ ngôi: phủ đỉnh + sau đầu, mái hất sang một bên
function ShortHair({ m, R, fringe = 1, volume = 1 }) {
  return (
    <group>
      <mesh position={[0, R * 0.22, -R * 0.07]} scale={[0.98 * volume, 0.98 * volume, 1.03 * volume]} material={m.hair}>
        <sphereGeometry args={[R, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.44]} />
      </mesh>
      <mesh position={[0, -R * 0.05, -R * 0.35]} scale={[0.96, 0.95, 0.75]} material={m.hair}>
        <sphereGeometry args={[R, 24, 16, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.4]} />
      </mesh>
      {/* mái hất */}
      <mesh position={[-R * 0.18 * fringe, R * 0.72, R * 0.5]} rotation={[0.6, 0, 0.45 * fringe]} scale={[1.7, 0.42, 0.9]} material={m.hair}>
        <sphereGeometry args={[R * 0.38, 16, 10]} />
      </mesh>
      {/* tóc mai */}
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * R * 0.86, R * 0.18, R * 0.05]} scale={[0.25, 0.6, 0.5]} material={m.hair}><sphereGeometry args={[R * 0.45, 10, 8]} /></mesh>
      ))}
    </group>
  );
}

function Collar({ m, tie }) {
  return (
    <group>
      {[-1, 1].map((k) => (
        <mesh key={k} position={[k * 0.045, 0.235, 0.085]} rotation={[0.35, 0, k * 0.55]} material={m.collar}><boxGeometry args={[0.08, 0.045, 0.012]} /></mesh>
      ))}
      {tie && (
        <group>
          <mesh position={[0, 0.215, 0.105]} material={m.tie}><boxGeometry args={[0.038, 0.03, 0.02]} /></mesh>
          <mesh position={[0, 0.07, 0.107]} rotation={[0.02, 0, 0]} material={m.tie}><boxGeometry args={[0.045, 0.26, 0.01]} /></mesh>
          <mesh position={[0, -0.065, 0.107]} rotation={[0, 0, Math.PI / 4]} material={m.tie}><boxGeometry args={[0.032, 0.032, 0.01]} /></mesh>
        </group>
      )}
      {/* hàng cúc */}
      {[0.12, 0.02, -0.08, -0.18].map((y) => (
        <mesh key={y} position={[tie ? 0.03 : 0, y, 0.107]} material={m.button}><sphereGeometry args={[0.006, 8, 6]} /></mesh>
      ))}
    </group>
  );
}

export function ThayDuc3D({ frame, pose, talking, mirror = false }) {
  return (
    <Body frame={frame} pose={pose} talking={talking} mirror={mirror} glasses scale={1.06}
      spec={{ skin: '#e9b993', shirt: '#cfe0f1', sleeve: '#cfe0f1', cuff: '#c3d6ea', collar: '#dae8f6', pants: '#2b3448', shoes: '#1b1b1f', belt: '#2a2a2a',
        tie: '#13294B', button: '#f4f4f4', eyeWhite: '#fbfbfb', iris: '#3a2618', pupil: '#0e0a08', brow: '#22180f', glasses: '#1a2236',
        mouth: '#6e2a2a', lip: '#a3574f', hair: '#1b130c' }}
      top={({ m }) => <Collar m={m} tie />}
      hair={({ m, R }) => <ShortHair m={m} R={R} fringe={1} volume={1.02} />} />
  );
}

export function Minh3D({ frame, pose, talking, mirror = true }) {
  return (
    <Body frame={frame + 23} pose={pose} talking={talking} mirror={mirror} scale={0.93} shortSleeve
      spec={{ skin: '#efc4a0', shirt: '#f7f7f5', sleeve: '#f7f7f5', cuff: '#ececec', collar: '#ffffff', pants: '#1f2f5c', shoes: '#141414', belt: '#1a1a1a',
        tie: '#1b2f6b', button: '#e6e6e6', badge: '#1F7A7A', eyeWhite: '#fbfbfb', iris: '#2e1d12', pupil: '#0b0806', brow: '#1d140b',
        glasses: '#000', mouth: '#6e2a2a', lip: '#b0605a', hair: '#150e08' }}
      top={({ m }) => (
        <group>
          <Collar m={m} tie />
          {/* phù hiệu trường trên túi áo */}
          <mesh position={[-0.075, 0.1, 0.103]} material={m.badge}><boxGeometry args={[0.05, 0.022, 0.006]} /></mesh>
          <mesh position={[-0.075, 0.05, 0.1]} material={m.collar}><boxGeometry args={[0.06, 0.06, 0.006]} /></mesh>
        </group>
      )}
      hair={({ m, R }) => <ShortHair m={m} R={R} fringe={-1} volume={1.05} />} />
  );
}
