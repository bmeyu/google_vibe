import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Line, Ring } from '@react-three/drei';
import * as THREE from 'three';
import { DRUMS, COLORS } from './constants';
import { DrumTypeEnum as DrumType, Landmark, Results } from '../../types';
import { playSound } from '../../utils/audioService';

interface DrumSystemProps {
  handResults: React.MutableRefObject<Results | null>;
  onHit: (type: DrumType, position: THREE.Vector3) => void;
}

// -----------------------------------------------------------------------------
// Component: Neon Drum
// Uses additive blending to create a "Glow" effect without post-processing
// -----------------------------------------------------------------------------
const NeonDrum: React.FC<{
  config: typeof DRUMS[0];
  isHit: boolean;
}> = ({ config, isHit }) => {
  const groupRef = useRef<THREE.Group>(null);
  const coreMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const glowMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const fillMaterial = useRef<THREE.MeshBasicMaterial>(null);

  useFrame((state, delta) => {
    if (groupRef.current && fillMaterial.current) {
      // 1. Scale Pulse on Hit
      const targetScale = isHit ? 1.15 : 1.0;
      groupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), delta * 20);
      
      // 2. Flash Effect (Fill opacity decays)
      const targetOpacity = isHit ? 0.6 : 0.0;
      fillMaterial.current.opacity = THREE.MathUtils.lerp(fillMaterial.current.opacity, targetOpacity, delta * 15);
      
      // 3. Jitter rotation on hit
      if (isHit) {
        groupRef.current.rotation.z = (Math.random() - 0.5) * 0.1;
      } else {
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, 0, delta * 5);
      }
    }
  });

  return (
    <group position={config.position} ref={groupRef}>
      {/* Outer Glow (Atmosphere) */}
      <Ring args={[config.radius * 0.95, config.radius * 1.15, 32]}>
         <meshBasicMaterial 
           ref={glowMaterial}
           color={config.color} 
           transparent 
           opacity={0.3} 
           blending={THREE.AdditiveBlending} 
           side={THREE.DoubleSide}
         />
      </Ring>

      {/* Core Neon Line */}
      <Ring args={[config.radius * 0.95, config.radius * 1.0, 32]}>
        <meshBasicMaterial 
          ref={coreMaterial}
          color={config.color} 
          transparent 
          opacity={0.9} 
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </Ring>
      
      {/* Hit Flash Fill (Inner Circle) */}
      <mesh>
        <circleGeometry args={[config.radius * 0.95, 32]} />
        <meshBasicMaterial 
          ref={fillMaterial}
          color={config.color} 
          transparent 
          opacity={0.0} 
          blending={THREE.AdditiveBlending} // Super bright flash
        />
      </mesh>
    </group>
  );
};

// -----------------------------------------------------------------------------
// Component: Cyberpunk Hand Visualizer
// Electric blue lines + Glowing Index Finger "Drumstick"
// -----------------------------------------------------------------------------
const HandVisualizer: React.FC<{ landmarks: Landmark[] }> = ({ landmarks }) => {
  const { viewport } = useThree();

  // Map normalized coordinates to viewport
  const points = useMemo(() => {
    return landmarks.map(l => {
      const x = (1 - l.x) * viewport.width - viewport.width / 2;
      const y = (1 - l.y) * viewport.height - viewport.height / 2;
      return new THREE.Vector3(x, y, 0);
    });
  }, [landmarks, viewport]);

  const connections = [
    [0, 1, 2, 3, 4], // Thumb
    [0, 5, 6, 7, 8], // Index
    [0, 9, 10, 11, 12], // Middle
    [0, 13, 14, 15, 16], // Ring
    [0, 17, 18, 19, 20], // Pinky
    [5, 9, 13, 17, 0], // Palm
  ];

  // The Index Tip is landmark 8
  const indexTipPos = points[8];

  return (
    <group>
      {/* Skeleton Lines */}
      {connections.map((path, i) => (
        <Line
          key={i}
          points={path.map(idx => points[idx])}
          color={COLORS.ELECTRIC_BLUE}
          lineWidth={2}
          transparent
          opacity={0.4} // Semi-transparent as requested
          blending={THREE.AdditiveBlending}
        />
      ))}

      {/* The "Drumstick" - Glowing Index Tip */}
      <group position={indexTipPos}>
        {/* Core Dot */}
        <mesh>
          <circleGeometry args={[0.3, 16]} />
          <meshBasicMaterial color={COLORS.ELECTRIC_BLUE} transparent opacity={1} blending={THREE.AdditiveBlending} />
        </mesh>
        {/* Glow Halo */}
        <mesh>
          <circleGeometry args={[0.6, 16]} />
          <meshBasicMaterial color={COLORS.ELECTRIC_BLUE} transparent opacity={0.3} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
    </group>
  );
};

// -----------------------------------------------------------------------------
// Component: Main System
// -----------------------------------------------------------------------------
const DrumSystem: React.FC<DrumSystemProps> = ({ handResults, onHit }) => {
  const [hitStates, setHitStates] = React.useState<Record<string, boolean>>({});
  const lastHitTime = useRef<Record<string, number>>({});
  const { viewport } = useThree();

  useFrame(() => {
    if (!handResults.current || !handResults.current.multiHandLandmarks) return;

    const hands = handResults.current.multiHandLandmarks;
    const newHitStates: Record<string, boolean> = { ...hitStates };
    let changed = false;
    const now = Date.now();

    // Reset hit states if enough time passed
    DRUMS.forEach(drum => {
      if (hitStates[drum.id] && now - (lastHitTime.current[drum.id] || 0) > 150) {
        newHitStates[drum.id] = false;
        changed = true;
      }
    });

    // Collision Detection Logic
    hands.forEach(landmarks => {
      const tip = landmarks[8]; // Index Finger Tip
      
      const handX = (1 - tip.x) * viewport.width - viewport.width / 2;
      const handY = (1 - tip.y) * viewport.height - viewport.height / 2;

      DRUMS.forEach(drum => {
        const dx = handX - drum.position[0];
        const dy = handY - drum.position[1];
        const dist = Math.sqrt(dx * dx + dy * dy);

        // FORGIVING HITBOX: Radius * 1.5
        if (dist < drum.radius * 1.5) {
          // Debounce: prevent triggering multiple times per hit
          if (!hitStates[drum.id] && now - (lastHitTime.current[drum.id] || 0) > 200) {
            newHitStates[drum.id] = true;
            lastHitTime.current[drum.id] = now;
            changed = true;
            
            playSound(drum.hitSound);
            onHit(drum.id, new THREE.Vector3(drum.position[0], drum.position[1], drum.position[2]));
          }
        }
      });
    });

    if (changed) {
      setHitStates(newHitStates);
    }
  });

  return (
    <>
      {DRUMS.map(drum => (
        <NeonDrum key={drum.id} config={drum} isHit={!!hitStates[drum.id]} />
      ))}
      
      {handResults.current?.multiHandLandmarks?.map((landmarks, i) => (
        <HandVisualizer key={i} landmarks={landmarks} />
      ))}
    </>
  );
};

export default DrumSystem;