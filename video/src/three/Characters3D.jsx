// Nhân vật 3D: thầy Đức và bạn Minh — dựng từ khối cơ bản, đổ bóng kiểu hoạt hình (toon).
// Khớp: vai, khuỷu tay, cổ. Dáng điệu giống bản 2D (cùng tên).
import React, { useMemo } from 'react';
import * as THREE from 'three';

const D = THREE.MathUtils.degToRad;

// a = tay phía trái màn hình, b = tay phía phải màn hình (khi nhân vật nhìn thẳng).
// sz: dang ngang (độ), sx: đưa ra trước (độ, âm = ra trước), ex: gập khuỷu (âm = gập ra trước)
const POSES = {
  'binh-thuong': { a: { sz: 7, sx: 0, ex: -12 }, b: { sz: 7, sx: 0, ex: -12 }, brow: 0, mouth: 'smile' },
  'giang-giai':  { a: { sz: 7, sx: 0, ex: -12 }, b: { sz: 22, sx: -48, ex: -62 }, brow: 0.6, mouth: 'smile', wiggle: true, tilt: -0.08 },
  'chi-bang':    { a: { sz: 7, sx: 0, ex: -12 }, b: { sz: 112, sx: -18, ex: -6 }, brow: 0.6, mouth: 'smile', turn: 0.35 },
  'suy-nghi':    { a: { sz: 10, sx: -20, ex: -70 }, b: { sz: 18, sx: -55, ex: -128 }, brow: -0.6, mouth: 'flat', tilt: 0.14, lookUp: true },
  'vui':         { a: { sz: 38, sx: -18, ex: -40 }, b: { sz: 38, sx: -18, ex: -40 }, brow: 1, mouth: 'big', bounce: true },
  'ngac-nhien':  { a: { sz: 48, sx: -28, ex: -58 }, b: { sz: 48, sx: -28, ex: -58 }, brow: 1.6, mouth: 'o' },
  'buon':        { a: { sz: 4, sx: 0, ex: -4 }, b: { sz: 4, sx: 0, ex: -4 }, brow: -1, mouth: 'frown', headDown: 0.22 },
  'gat-dau':     { a: { sz: 7, sx: 0, ex: -12 }, b: { sz: 7, sx: 0, ex: -12 }, brow: 0.5, mouth: 'smile', nod: true },
  'vay-tay':     { a: { sz: 7, sx: 0, ex: -12 }, b: { sz: 148, sx: -6, ex: -24 }, brow: 1, mouth: 'big', wave: true },
  'viet-bang':   { a: { sz: 7, sx: 0, ex: -12 }, b: { sz: 96, sx: -42, ex: -30 }, brow: 0, mouth: 'flat', wiggle: true, turn: 0.5 },
};

function toon(color) {
  return new THREE.MeshToonMaterial({ color });
}

function useMats(spec) {
  return useMemo(() => Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, toon(v)])), [JSON.stringify(spec)]);
}

function Limb({ len, r, mat }) {
  return (
    <mesh position={[0, -len / 2, 0]} castShadow material={mat}>
      <capsuleGeometry args={[r, len, 6, 14]} />
    </mesh>
  );
}

function Arm({ side, pose, frame, m, upper, lower, r, wave, wiggle }) {
  // side: -1 = trái màn hình, +1 = phải màn hình
  let { sz, sx, ex } = pose;
  if (wave) { sz += Math.sin(frame / 3.2) * 10; ex += Math.sin(frame / 3.2) * 22; }
  if (wiggle) { sx += Math.sin(frame / 7) * 7; ex += Math.sin(frame / 5) * 6; }
  return (
    <group rotation={[D(sx), 0, D(sz) * side]}>
      <Limb len={upper} r={r} mat={m.sleeve} />
      <group position={[0, -upper - r * 0.6, 0]} rotation={[D(ex), 0, 0]}>
        <Limb len={lower} r={r * 0.85} mat={m.skin} />
        <mesh position={[0, -lower - r * 0.9, 0]} castShadow material={m.skin}>
          <sphereGeometry args={[r * 1.25, 16, 12]} />
        </mesh>
      </group>
    </group>
  );
}

function Face({ R, frame, talking, p, glasses, m, cheeks }) {
  const blink = (frame % 101) > 97 || ((frame + 47) % 157) > 154;
  const open = talking ? Math.max(0, (Math.sin(frame * 1.25) + Math.sin(frame * 0.66 + 1.3)) / 2) : 0;
  const ez = R * 0.86;
  const ey = R * 0.12;
  const look = p.lookUp ? 0.035 : 0;
  const browY = R * 0.36 + p.brow * 0.022;
  const browTilt = p.brow < 0 ? 0.25 : p.brow > 1 ? -0.15 : 0;
  return (
    <group>
      {[-1, 1].map((k) => (
        <group key={k} position={[k * R * 0.36, ey, ez]}>
          <mesh scale={[1, blink ? 0.12 : 1.15, 0.6]} material={m.eyeWhite}><sphereGeometry args={[R * 0.17, 16, 12]} /></mesh>
          {!blink && <mesh position={[k * -0.004, look + 0.004, R * 0.09]} material={m.pupil}><sphereGeometry args={[R * 0.095, 14, 10]} /></mesh>}
          {!blink && <mesh position={[0.012, look + 0.022, R * 0.14]} material={m.eyeWhite}><sphereGeometry args={[R * 0.03, 8, 6]} /></mesh>}
          <mesh position={[0, browY - ey, R * 0.05]} rotation={[0, 0, browTilt * k * -1]} material={m.brow}>
            <boxGeometry args={[R * 0.34, R * 0.07, R * 0.06]} />
          </mesh>
          {glasses && (
            <mesh position={[0, 0, R * 0.12]} material={m.glasses}>
              <torusGeometry args={[R * 0.25, R * 0.03, 8, 28]} />
            </mesh>
          )}
        </group>
      ))}
      {glasses && <mesh position={[0, ey + 0.01, ez + R * 0.12]} rotation={[0, 0, Math.PI / 2]} material={m.glasses}><cylinderGeometry args={[R * 0.025, R * 0.025, R * 0.24, 8]} /></mesh>}
      {/* mũi */}
      <mesh position={[0, -R * 0.08, R * 0.98]} material={m.nose}><sphereGeometry args={[R * 0.09, 12, 10]} /></mesh>
      {/* má hồng */}
      {cheeks && [-1, 1].map((k) => (
        <mesh key={k} position={[k * R * 0.55, -R * 0.2, R * 0.78]} scale={[1, 0.6, 0.3]} material={m.cheek}><sphereGeometry args={[R * 0.13, 12, 8]} /></mesh>
      ))}
      {/* miệng */}
      <group position={[0, -R * 0.36, R * 0.9]}>
        {open > 0.12 ? (
          <mesh scale={[1, 0.35 + open * 0.9, 0.4]} material={m.mouth}><sphereGeometry args={[R * 0.16, 16, 12]} /></mesh>
        ) : p.mouth === 'o' ? (
          <mesh scale={[0.8, 1.1, 0.4]} material={m.mouth}><sphereGeometry args={[R * 0.12, 16, 12]} /></mesh>
        ) : p.mouth === 'big' ? (
          <mesh rotation={[0, 0, Math.PI]} scale={[1, 0.75, 0.4]} material={m.mouth}><sphereGeometry args={[R * 0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
        ) : p.mouth === 'flat' ? (
          <mesh material={m.mouth}><boxGeometry args={[R * 0.26, R * 0.04, R * 0.04]} /></mesh>
        ) : (
          <mesh rotation={[0, 0, p.mouth === 'frown' ? 0 : Math.PI]} position={[0, p.mouth === 'frown' ? -R * 0.1 : R * 0.08, 0]} material={m.mouth}>
            <torusGeometry args={[R * 0.15, R * 0.03, 8, 20, Math.PI]} />
          </mesh>
        )}
      </group>
    </group>
  );
}

function Body({ frame, pose, talking, mirror, spec, glasses, hair, extra, cheeks, scale = 1 }) {
  const p = POSES[pose] || POSES['binh-thuong'];
  const m = useMats(spec);
  const breathe = Math.sin(frame / 20) * 0.012;
  const bounce = p.bounce ? Math.abs(Math.sin(frame / 5)) * 0.06 : 0;
  const nod = p.nod ? Math.sin(frame / 4) * 0.14 : 0;
  const R = 0.3;
  // mirror: đảo trái/phải để cử chỉ hướng vào giữa khung hình
  const armA = mirror ? p.b : p.a;
  const armB = mirror ? p.a : p.b;
  const turn = (p.turn || 0) * (mirror ? -1 : 1);
  return (
    <group scale={scale} position={[0, bounce, 0]} rotation={[0, turn * 0.5, 0]}>
      {/* chân */}
      {[-1, 1].map((k) => (
        <group key={k} position={[k * 0.11, 0.86, 0]}>
          <Limb len={0.66} r={0.085} mat={m.pants} />
          <mesh position={[0, -0.8, 0.05]} castShadow material={m.shoes}><boxGeometry args={[0.17, 0.09, 0.3]} /></mesh>
        </group>
      ))}
      {/* thân */}
      <group position={[0, 1.18 + breathe, 0]}>
        <mesh castShadow material={m.shirt} scale={[1, 1, 0.78]}><capsuleGeometry args={[0.235, 0.38, 8, 20]} /></mesh>
        {extra?.({ m })}
        {/* tay */}
        <group position={[-0.29, 0.25, 0]}><Arm side={-1} pose={armA} frame={frame} m={m} upper={0.27} lower={0.25} r={0.062}
          wave={mirror ? p.wave : false} wiggle={mirror ? p.wiggle : false} /></group>
        <group position={[0.29, 0.25, 0]}><Arm side={1} pose={armB} frame={frame} m={m} upper={0.27} lower={0.25} r={0.062}
          wave={!mirror ? p.wave : false} wiggle={!mirror ? p.wiggle : false} /></group>
        {/* cổ + đầu */}
        <mesh position={[0, 0.4, 0]} material={m.skin}><cylinderGeometry args={[0.07, 0.08, 0.14, 12]} /></mesh>
        <group position={[0, 0.72, 0]} rotation={[(p.headDown || 0) + nod, turn * 0.6, (p.tilt || 0) * (mirror ? -1 : 1)]}>
          <mesh castShadow material={m.skin} scale={[1, 1.06, 0.98]}><sphereGeometry args={[R, 32, 24]} /></mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * R * 0.98, -0.01, 0]} scale={[0.5, 1, 0.7]} material={m.skin}><sphereGeometry args={[R * 0.2, 12, 10]} /></mesh>
          ))}
          {hair({ m, R })}
          <Face R={R} frame={frame} talking={talking} p={p} glasses={glasses} m={m} cheeks={cheeks} />
        </group>
      </group>
    </group>
  );
}

export function ThayDuc3D({ frame, pose, talking, mirror = false }) {
  return (
    <Body frame={frame} pose={pose} talking={talking} mirror={mirror} glasses scale={1.08}
      spec={{ skin: '#f0c49b', shirt: '#cfe1f3', sleeve: '#cfe1f3', pants: '#2b3a55', shoes: '#1b2230', tie: '#13294B',
        eyeWhite: '#ffffff', pupil: '#1b2230', brow: '#2a1e14', glasses: '#13294B', nose: '#e8b58c', mouth: '#7a2d2d',
        cheek: '#f2a99b', hair: '#1f160e' }}
      extra={({ m }) => (
        <group>
          <mesh position={[0, 0.1, 0.2]} material={m.tie}><boxGeometry args={[0.07, 0.36, 0.03]} /></mesh>
          <mesh position={[0, -0.12, 0.2]} rotation={[0, 0, Math.PI / 4]} material={m.tie}><boxGeometry args={[0.07, 0.07, 0.03]} /></mesh>
          <mesh position={[0, 0.29, 0.17]} rotation={[0, 0, Math.PI]} material={m.shirt}><coneGeometry args={[0.12, 0.1, 3]} /></mesh>
        </group>
      )}
      hair={({ m, R }) => (
        <group>
          <mesh position={[0, R * 0.24, -R * 0.06]} scale={[1.06, 0.92, 1.04]} material={m.hair}>
            <sphereGeometry args={[R, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
          </mesh>
          <mesh position={[-R * 0.3, R * 0.72, R * 0.42]} rotation={[0.5, 0, 0.35]} scale={[1.6, 0.45, 0.8]} material={m.hair}>
            <sphereGeometry args={[R * 0.34, 16, 10]} />
          </mesh>
        </group>
      )} />
  );
}

export function Minh3D({ frame, pose, talking, mirror = true }) {
  return (
    <Body frame={frame + 23} pose={pose} talking={talking} mirror={mirror} cheeks scale={0.92}
      spec={{ skin: '#f6d1aa', shirt: '#ffffff', sleeve: '#ffffff', pants: '#26407a', shoes: '#f1f1f1', bag: '#1F7A7A', strap: '#16595a',
        eyeWhite: '#ffffff', pupil: '#1b2230', brow: '#24170c', glasses: '#000', nose: '#efbf96', mouth: '#7a2d2d',
        cheek: '#f3a9a0', hair: '#1a120a' }}
      extra={({ m }) => (
        <group>
          <mesh position={[0, 0.02, -0.24]} castShadow material={m.bag} scale={[1, 1, 0.6]}><capsuleGeometry args={[0.2, 0.25, 6, 16]} /></mesh>
          {[-1, 1].map((k) => (
            <mesh key={k} position={[k * 0.15, 0.05, 0.16]} material={m.strap}><boxGeometry args={[0.05, 0.5, 0.03]} /></mesh>
          ))}
        </group>
      )}
      hair={({ m, R }) => (
        <group>
          <mesh position={[0, R * 0.22, -R * 0.05]} scale={[1.08, 0.95, 1.06]} material={m.hair}>
            <sphereGeometry args={[R, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
          </mesh>
          {[[-0.5, 0.85, 0.35, -0.5], [-0.15, 0.95, 0.45, -0.15], [0.2, 0.95, 0.42, 0.2], [0.52, 0.82, 0.3, 0.55], [0, 1.0, -0.1, 0]].map(([x, y, z, rz], i) => (
            <mesh key={i} position={[x * R, y * R, z * R]} rotation={[0.6, 0, rz]} material={m.hair}>
              <coneGeometry args={[R * 0.2, R * 0.45, 10]} />
            </mesh>
          ))}
        </group>
      )} />
  );
}
