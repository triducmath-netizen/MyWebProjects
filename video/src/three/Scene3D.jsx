// Lớp học 3D + đặt nhân vật + camera cho khổ ngang và khổ dọc.
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { ThayDuc3D, Minh3D } from './Characters3D.jsx';

export function layoutFor(vertical) {
  return vertical
    ? { cam: { pos: [0, 1.95, 6.3], look: [0, 1.85, 0], fov: 46 },
        board: { c: [0, 3.05, -1.7], w: 2.6, h: 1.5 },
        duc: [-0.72, 0.25], minh: [0.75, 0.4] }
    : { cam: { pos: [0, 1.6, 5.6], look: [0, 1.35, 0], fov: 36 },
        board: { c: [0, 1.75, -1.7], w: 3.0, h: 1.75 },
        duc: [-2.35, 0.2], minh: [2.35, 0.35] };
}

// Toạ độ màn hình (px) của mặt bảng để đặt chữ lên đúng chỗ.
export function boardRect(layout, width, height) {
  const cam = new THREE.PerspectiveCamera(layout.cam.fov, width / height, 0.1, 100);
  cam.position.set(...layout.cam.pos);
  cam.lookAt(new THREE.Vector3(...layout.cam.look));
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  const { c, w, h } = layout.board;
  const pts = [[-w / 2, h / 2], [w / 2, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2]].map(([dx, dy]) => {
    const v = new THREE.Vector3(c[0] + dx, c[1] + dy, c[2] + 0.03).project(cam);
    return [(v.x + 1) / 2 * width, (1 - v.y) / 2 * height];
  });
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
}

// Đặt camera ngay trong lúc dựng (không dùng effect) để mọi khung hình đều đúng góc,
// khớp với boardRect() dùng để đặt chữ lên bảng.
function CameraRig({ layout }) {
  const { camera, size } = useThree();
  camera.position.set(...layout.cam.pos);
  camera.fov = layout.cam.fov;
  camera.aspect = size.width / size.height;
  camera.lookAt(new THREE.Vector3(...layout.cam.look));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return null;
}

const T = (c) => new THREE.MeshToonMaterial({ color: c });

function Classroom({ layout, showBoard }) {
  const mats = useMemo(() => ({
    wall: T('#efe8d8'), wall2: T('#e4dcc8'), floor: T('#c9a77c'), plank: T('#bb966a'), base: T('#8a6a3b'),
    frame: T('#8A6A3B'), board: T('#1E3A34'), win: T('#bfe0f0'), winFrame: T('#ffffff'), pot: T('#C9A23F'),
    leaf: T('#2f8a5a'), shelf: T('#9b7448'), book1: T('#13294B'), book2: T('#C9A23F'), book3: T('#1F7A7A'), book4: T('#b8463c'),
  }), []);
  const { c, w, h } = layout.board;
  return (
    <group>
      {/* sàn gỗ */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={mats.floor}><planeGeometry args={[30, 30]} /></mesh>
      {Array.from({ length: 14 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[-6.5 + i, 0.001, 0]} material={mats.plank}><planeGeometry args={[0.03, 30]} /></mesh>
      ))}
      {/* tường */}
      <mesh position={[0, 3, -1.8]} receiveShadow material={mats.wall}><planeGeometry args={[30, 6]} /></mesh>
      <mesh position={[0, 0.45, -1.79]} material={mats.wall2}><planeGeometry args={[30, 0.9]} /></mesh>
      <mesh position={[0, 0.06, -1.76]} material={mats.base}><boxGeometry args={[30, 0.12, 0.06]} /></mesh>
      {/* bảng */}
      {showBoard && (
        <group position={c}>
          <mesh position={[0, 0, -0.03]} castShadow material={mats.frame}><boxGeometry args={[w + 0.16, h + 0.16, 0.06]} /></mesh>
          <mesh position={[0, 0, 0.005]} material={mats.board}><planeGeometry args={[w, h]} /></mesh>
          <mesh position={[0, -h / 2 - 0.1, 0.06]} material={mats.frame}><boxGeometry args={[w * 0.9, 0.04, 0.12]} /></mesh>
        </group>
      )}
      {/* cửa sổ */}
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (c[0] + w / 2 + 1.25), 2.0, -1.77]}>
          <mesh material={mats.winFrame}><boxGeometry args={[1.25, 1.25, 0.04]} /></mesh>
          <mesh position={[0, 0, 0.025]} material={mats.win}><planeGeometry args={[1.1, 1.1]} /></mesh>
          <mesh position={[0, 0, 0.03]} material={mats.winFrame}><boxGeometry args={[0.05, 1.1, 0.02]} /></mesh>
          <mesh position={[0, 0, 0.03]} material={mats.winFrame}><boxGeometry args={[1.1, 0.05, 0.02]} /></mesh>
        </group>
      ))}
      {/* chậu cây */}
      <group position={[-(c[0] + w / 2 + 2.2), 0, -1.1]}>
        <mesh position={[0, 0.25, 0]} castShadow material={mats.pot}><cylinderGeometry args={[0.22, 0.17, 0.5, 18]} /></mesh>
        {[[0, 0.8, 0, 0.32], [0.18, 0.66, 0.05, 0.24], [-0.17, 0.7, 0.02, 0.24]].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} castShadow material={mats.leaf}><sphereGeometry args={[r, 16, 12]} /></mesh>
        ))}
      </group>
      {/* kệ sách */}
      <group position={[c[0] + w / 2 + 2.3, 0, -1.45]}>
        <mesh position={[0, 0.65, 0]} castShadow material={mats.shelf}><boxGeometry args={[0.9, 1.3, 0.35]} /></mesh>
        {[0.95, 0.45].map((y) => [mats.book1, mats.book2, mats.book3, mats.book4, mats.book1].map((mt, i) => (
          <mesh key={`${y}-${i}`} position={[-0.32 + i * 0.16, y, 0.12]} material={mt}><boxGeometry args={[0.12, 0.34 - (i % 2) * 0.06, 0.2]} /></mesh>
        )))}
      </group>
    </group>
  );
}

export function Scene3D({ layout, frame, ducPose, minhPose, ducTalking, minhTalking, showBoard }) {
  return (
    <>
      <CameraRig layout={layout} />
      <color attach="background" args={['#efe8d8']} />
      <hemisphereLight args={['#fff8ee', '#b89b78', 0.9]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 6, 5]} intensity={1.6} castShadow
        shadow-mapSize-width={1024} shadow-mapSize-height={1024}
        shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-2} />
      <Classroom layout={layout} showBoard={showBoard} />
      <group position={[layout.duc[0], 0, layout.duc[1]]} rotation={[0, 0.28, 0]}>
        <ThayDuc3D frame={frame} pose={ducPose} talking={ducTalking} />
      </group>
      <group position={[layout.minh[0], 0, layout.minh[1]]} rotation={[0, -0.32, 0]}>
        <Minh3D frame={frame} pose={minhPose} talking={minhTalking} mirror />
      </group>
    </>
  );
}
