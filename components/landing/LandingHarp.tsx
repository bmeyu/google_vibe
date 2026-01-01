import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import HandTracker from '../guernica/HandTracker';
import { Results, Landmark } from '../../types';

type ExperienceType = 'starry-night' | 'tree-of-life' | 'guernica';

const HARP_IMAGE = '/images/harp.png';
const ARTWORKS = [
  { id: 'starry-night', image: '/images/StarryNight.jpg', title: 'STARRY STRINGS' },
  { id: 'tree-of-life', image: '/images/TreeOfLife.png', title: 'TREE OF LIFE' },
  { id: 'guernica', image: '/images/Guernica.png', title: 'GUERNICA SHATTERED' },
];

const lerp = (start: number, end: number, t: number) => start * (1 - t) + end * t;

const getHandState = (landmarks: Landmark[]) => {
  const wrist = landmarks[0];
  const indexBase = landmarks[5];
  const pinkyBase = landmarks[17];
  if (!wrist || !indexBase || !pinkyBase) return 'unknown';

  const palmWidth = Math.hypot(indexBase.x - pinkyBase.x, indexBase.y - pinkyBase.y);
  if (palmWidth === 0) return 'unknown';

  const tips = [4, 8, 12, 16, 20]
    .map((idx) => landmarks[idx])
    .filter(Boolean);

  const avgTipDist = tips.reduce((sum, tip) => {
    return sum + Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  }, 0) / tips.length;

  const ratio = avgTipDist / palmWidth;

  if (ratio > 2.4) return 'open';
  if (ratio < 1.6) return 'fist';
  return 'unknown';
};

const HarpBackdrop: React.FC = () => {
  const texture = useTexture(HARP_IMAGE);
  const { viewport } = useThree();

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <mesh position={[0, 0, -3]}>
      <planeGeometry args={[viewport.width, viewport.height]} />
      <meshBasicMaterial map={texture} transparent opacity={0.65} />
    </mesh>
  );
};

const HarpParticles: React.FC = () => {
  const texture = useTexture(HARP_IMAGE);
  const basePositionsRef = useRef<Float32Array | null>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    const image = texture.image as HTMLImageElement | undefined;
    if (!image?.width) return;

    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    const positions: number[] = [];
    const step = 10;
    const scale = 3.2;
    const aspect = canvas.width / canvas.height;

    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const idx = (y * canvas.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        const brightness = (r + g + b) / 3;

        if (a > 25 && brightness > 110) {
          const nx = ((x / canvas.width) - 0.5) * scale * aspect;
          const ny = (0.5 - (y / canvas.height)) * scale;
          const nz = (Math.random() - 0.5) * 0.1;
          positions.push(nx, ny, nz);

        }
      }
    }

    const targetCount = 100;
    const totalPoints = positions.length / 3;
    const stride = Math.max(1, Math.floor(totalPoints / targetCount));
    const sampledPositions: number[] = [];
    for (let i = 0; i < totalPoints && sampledPositions.length / 3 < targetCount; i += stride) {
      sampledPositions.push(
        positions[i * 3],
        positions[i * 3 + 1],
        positions[i * 3 + 2]
      );
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(sampledPositions), 3));
    setGeometry(nextGeometry);
    basePositionsRef.current = new Float32Array(sampledPositions);

    return () => {
      nextGeometry.dispose();
    };
  }, [texture]);

  useFrame(() => {
    if (!geometry || !basePositionsRef.current) return;
  });

  return (
    <>
      {geometry && (
        <points geometry={geometry}>
          <pointsMaterial
            color="#cfe9ff"
            size={0.018}
            transparent
            opacity={0.75}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}
    </>
  );
};

const GlassOrbs: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null);
  const orbData = useMemo(() => {
    return new Array(18).fill(0).map(() => ({
      position: [
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 3,
        (Math.random() - 0.5) * 4,
      ] as [number, number, number],
      scale: 0.05 + Math.random() * 0.08,
      speed: 0.2 + Math.random() * 0.3,
    }));
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.children.forEach((child, idx) => {
        const data = orbData[idx];
        child.position.y += Math.sin(t * data.speed + idx) * 0.0005;
      });
    }
  });

  return (
    <group ref={groupRef}>
      {orbData.map((orb, idx) => (
        <mesh key={idx} position={orb.position} scale={orb.scale}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            color="#cfe9ff"
            transparent
            opacity={0.35}
            roughness={0.1}
            metalness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
};

const createSnowflakeTexture = () => {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';

  const armLength = size * 0.28;
  for (let i = 0; i < 6; i += 1) {
    ctx.save();
    ctx.rotate((Math.PI / 3) * i);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -armLength);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -armLength * 0.55);
    ctx.lineTo(armLength * 0.18, -armLength * 0.7);
    ctx.moveTo(0, -armLength * 0.55);
    ctx.lineTo(-armLength * 0.18, -armLength * 0.7);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -armLength * 0.25);
    ctx.lineTo(armLength * 0.12, -armLength * 0.35);
    ctx.moveTo(0, -armLength * 0.25);
    ctx.lineTo(-armLength * 0.12, -armLength * 0.35);
    ctx.stroke();
    ctx.restore();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const SnowField: React.FC = () => {
  const pointsRef = useRef<THREE.Points>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const textureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    if (!textureRef.current) {
      textureRef.current = createSnowflakeTexture();
    }

    const count = 220;
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = Math.random() * 6;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 7;
      speeds[i] = 0.08 + Math.random() * 0.18;
    }

    const nextGeometry = new THREE.BufferGeometry();
    nextGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    nextGeometry.setAttribute('speed', new THREE.BufferAttribute(speeds, 1));
    setGeometry(nextGeometry);

    return () => {
      nextGeometry.dispose();
    };
  }, []);

  useFrame((_, delta) => {
    if (!geometry) return;
    const positions = geometry.attributes.position.array as Float32Array;
    const speeds = geometry.attributes.speed.array as Float32Array;
    for (let i = 0; i < speeds.length; i += 1) {
      positions[i * 3 + 1] -= speeds[i] * delta;
      positions[i * 3] += Math.sin((positions[i * 3 + 2] + i) * 0.6) * 0.0015;
      if (positions[i * 3 + 1] < -3) {
        positions[i * 3 + 1] = 3;
      }
    }
    geometry.attributes.position.needsUpdate = true;
  });

  return (
    <>
      {geometry && (
        <points ref={pointsRef} geometry={geometry}>
          <pointsMaterial
            map={textureRef.current || undefined}
            transparent
            opacity={0.7}
            depthWrite={false}
            size={0.08}
            sizeAttenuation
            color="#f4fbff"
            alphaTest={0.2}
          />
        </points>
      )}
    </>
  );
};

const ArtworkCards: React.FC<{
  onSelect: (id: ExperienceType) => void;
  isActive: boolean;
  selectTrigger: boolean;
}> = ({ onSelect, isActive, selectTrigger }) => {
  const { camera } = useThree();
  const textures = useTexture(ARTWORKS.map((art) => art.image));
  const cardRefs = useRef<THREE.Mesh[]>([]);
  const [selectedId, setSelectedId] = useState<ExperienceType | null>(null);
  const lastSelectRef = useRef(0);

  useEffect(() => {
    textures.forEach((texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
    });
  }, [textures]);

  useEffect(() => {
    if (!selectTrigger || !isActive) return;
    const now = performance.now();
    if (now - lastSelectRef.current < 1500) return;
    lastSelectRef.current = now;

    let nearest: { id: ExperienceType; distance: number } | null = null;
    cardRefs.current.forEach((card, idx) => {
      const dist = card.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position);
      const id = ARTWORKS[idx].id as ExperienceType;
      if (!nearest || dist < nearest.distance) {
        nearest = { id, distance: dist };
      }
    });

    if (nearest) {
      setSelectedId(nearest.id);
      setTimeout(() => onSelect(nearest.id), 300);
    }
  }, [selectTrigger, isActive, onSelect]);

  return (
    <>
      {ARTWORKS.map((art, idx) => {
        const angle = (idx / ARTWORKS.length) * Math.PI * 2;
        const radius = 2.2;
        const position: [number, number, number] = [
          Math.cos(angle) * radius,
          0.15 + Math.sin(angle * 2) * 0.25,
          Math.sin(angle) * radius,
        ];
        const isSelected = selectedId === art.id;

        return (
          <mesh
            key={art.id}
            ref={(node) => {
              if (node) cardRefs.current[idx] = node;
            }}
            position={position}
            scale={isSelected ? 1.05 : 0.85}
            onClick={() => onSelect(art.id as ExperienceType)}
          >
            <planeGeometry args={[1.2, 0.8]} />
            <meshBasicMaterial
              map={textures[idx]}
              transparent
              opacity={0.92}
              side={THREE.DoubleSide}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </>
  );
};

const SceneContent: React.FC<{
  selectTrigger: boolean;
  onSelect: (view: ExperienceType) => void;
  handResultsRef: React.MutableRefObject<Results | null>;
}> = ({ selectTrigger, onSelect, handResultsRef }) => {
  const orbitGroupRef = useRef<THREE.Group>(null);
  const rotationOffsetRef = useRef(0);
  const rotationVelocityRef = useRef(0);
  const lastWristXRef = useRef<number | null>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const landmarks = handResultsRef.current?.multiHandLandmarks?.[0];
    if (landmarks?.[0]) {
      const wristX = landmarks[0].x;
      if (lastWristXRef.current !== null) {
        const dx = wristX - lastWristXRef.current;
        if (dx > 0.002) {
          rotationVelocityRef.current += dx * 1.4;
        }
      }
      lastWristXRef.current = wristX;
    }

    rotationVelocityRef.current *= 0.9;
    rotationOffsetRef.current += rotationVelocityRef.current;
    if (orbitGroupRef.current) {
      orbitGroupRef.current.rotation.y = t * 0.05 + rotationOffsetRef.current;
    }
  });

  return (
    <>
      <group
        ref={orbitGroupRef}
        rotation={[0, 0, 0]}
      >
        <SnowField />
        <GlassOrbs />
        <ArtworkCards onSelect={onSelect} isActive={true} selectTrigger={selectTrigger} />
      </group>
      <group rotation={[0, 0, 0]}>
        <HarpBackdrop />
        <HarpParticles />
      </group>
    </>
  );
};

const LandingHarpScene: React.FC<{ onSelect: (view: ExperienceType) => void }> = ({ onSelect }) => {
  const handResultsRef = useRef<Results | null>(null);
  const [isFist, setIsFist] = useState(false);
  const lastGestureRef = useRef<{ open: number; fist: number }>({ open: 0, fist: 0 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioArmedRef = useRef(false);

  useEffect(() => {
    const audio = new Audio('/audio/box.mp3');
    audio.loop = true;
    audio.volume = 0.5;
    const handleTimeUpdate = () => {
      if (audio.currentTime >= 10) {
        audio.currentTime = 0;
        audio.play().catch(() => undefined);
      }
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current = audio;

    const handleFirstInteraction = () => {
      if (!audioRef.current || audioArmedRef.current) return;
      audioArmedRef.current = true;
      audioRef.current.play().catch(() => undefined);
    };

    window.addEventListener('pointerdown', handleFirstInteraction, { once: true });

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      window.removeEventListener('pointerdown', handleFirstInteraction);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const results = handResultsRef.current;
      const landmarks = results?.multiHandLandmarks?.[0];
      if (!landmarks) return;

      const handState = getHandState(landmarks);
      const now = performance.now();

      if (handState === 'fist' && now - lastGestureRef.current.fist > 400) {
        lastGestureRef.current.fist = now;
        setIsFist(true);
      } else {
        setIsFist(false);
      }

    }, 60);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full">
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }}>
        <color attach="background" args={['#02040b']} />
        <ambientLight intensity={0.8} />
        <pointLight position={[2, 2, 4]} intensity={1.2} color="#8ac7ff" />
        <pointLight position={[-3, -2, 2]} intensity={0.6} color="#3c6dd8" />

        <SceneContent
          selectTrigger={isFist}
          onSelect={onSelect}
          handResultsRef={handResultsRef}
        />
      </Canvas>

      <div className="absolute top-6 right-6 z-30 w-64 h-44 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm bg-black/30 border border-cyan-500/30">
        <HandTracker
          onResults={(results) => (handResultsRef.current = results)}
          className="w-full h-full"
        />
      </div>
    </div>
  );
};

export default LandingHarpScene;
