import React, { useRef, useMemo, useImperativeHandle, forwardRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface ShatterHandle {
  explode: (intensity: number, color: THREE.Color, origin: THREE.Vector3) => void;
}

// Custom Shader for Cyberpunk/Cubist look
const shardVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shardFragmentShader = `
  uniform sampler2D uTexture;
  uniform vec3 uFlashColor;
  uniform float uFlashIntensity;
  
  varying vec2 vUv;

  void main() {
    vec4 texColor = texture2D(uTexture, vUv);
    
    // Grayscale conversion (Luma)
    float gray = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));
    
    // Contrast Curve + Brightness adjustment
    // Increased brightness to 0.85 to make the artwork clearly visible while keeping contrast
    gray = smoothstep(0.1, 0.9, gray) * 0.85; 
    
    vec3 baseColor = vec3(gray);
    
    // Mix with flash color based on intensity
    vec3 finalColor = baseColor + (uFlashColor * uFlashIntensity);
    
    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// Interface for Physics State
interface ShardState {
  mesh: THREE.Mesh | null;
  homePos: THREE.Vector3;
  currentPos: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  rotVelocity: THREE.Vector3;
  flashIntensity: number;
  flashColor: THREE.Color;
}

// Helper to create a procedural Cubist texture if the image fails
// IMPROVED: Darker, sharper, more "Guernica-like" noise
const createFallbackTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Deep Black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, 1024, 512);

  // Sharp, high contrast shards
  for (let i = 0; i < 60; i++) {
    const shade = Math.floor(Math.random() * 255);
    ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
    
    ctx.beginPath();
    // Create sharp triangles
    ctx.moveTo(Math.random() * 1024, Math.random() * 512);
    ctx.lineTo(Math.random() * 1024, Math.random() * 512);
    ctx.lineTo(Math.random() * 1024, Math.random() * 512);
    ctx.fill();
    
    // White outlines for chaos
    if (Math.random() > 0.7) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
};

const ShatterBackground = forwardRef<ShatterHandle, {}>((props, ref) => {
  const { viewport } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const physicsRef = useRef<ShardState[]>([]);
  
  // Texture State
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('Anonymous');
    
    // Use local image for reliability
    const imageUrl = '/images/Guernica.png';

    loader.load(
      imageUrl,
      (tex) => {
        tex.wrapS = THREE.ClampToEdgeWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setTexture(tex);
      },
      undefined,
      (err) => {
        console.warn('Artwork load failed (even with proxy), using Noir fallback.', err);
        setTexture(createFallbackTexture());
      }
    );
  }, []);
  
  // Constants for generation
  const SEGMENTS_X = 8;
  const SEGMENTS_Y = 5;
  const JITTER = 0.6; 

  // 1. Generate Geometry & 2. Initialize Physics synchronously
  const shardsData = useMemo(() => {
    const width = 40; // Logical width
    const height = width / (viewport.width / viewport.height);
    
    const geo = new THREE.PlaneGeometry(width, height, SEGMENTS_X, SEGMENTS_Y);
    const posAttribute = geo.attributes.position;
    
    // Jitter vertices for irregular cubist look
    for (let i = 0; i < posAttribute.count; i++) {
      const x = posAttribute.getX(i);
      const y = posAttribute.getY(i);
      
      const isEdgeX = Math.abs(x - width/2) < 0.1 || Math.abs(x + width/2) < 0.1;
      const isEdgeY = Math.abs(y - height/2) < 0.1 || Math.abs(y + height/2) < 0.1;

      if (!isEdgeX && !isEdgeY) {
         const noiseX = (Math.random() - 0.5) * (width / SEGMENTS_X) * JITTER;
         const noiseY = (Math.random() - 0.5) * (height / SEGMENTS_Y) * JITTER;
         posAttribute.setX(i, x + noiseX);
         posAttribute.setY(i, y + noiseY);
      }
    }
    
    const nonIndexed = geo.toNonIndexed();
    const pos = nonIndexed.attributes.position;
    const uv = nonIndexed.attributes.uv;
    
    const generatedShards: { geometry: THREE.BufferGeometry, home: THREE.Vector3 }[] = [];
    
    for (let i = 0; i < pos.count; i += 3) {
      const v1 = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const v2 = new THREE.Vector3(pos.getX(i+1), pos.getY(i+1), pos.getZ(i+1));
      const v3 = new THREE.Vector3(pos.getX(i+2), pos.getY(i+2), pos.getZ(i+2));
      
      const centroid = new THREE.Vector3().add(v1).add(v2).add(v3).divideScalar(3);
      
      const shardGeo = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        v1.x - centroid.x, v1.y - centroid.y, v1.z - centroid.z,
        v2.x - centroid.x, v2.y - centroid.y, v2.z - centroid.z,
        v3.x - centroid.x, v3.y - centroid.y, v3.z - centroid.z,
      ]);
      
      const uvs = new Float32Array([
        uv.getX(i), uv.getY(i),
        uv.getX(i+1), uv.getY(i+1),
        uv.getX(i+2), uv.getY(i+2)
      ]);
      
      shardGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      shardGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      shardGeo.computeVertexNormals();
      
      generatedShards.push({ geometry: shardGeo, home: centroid });
    }

    // Initialize physics state synchronously so it's ready for the ref callback
    physicsRef.current = generatedShards.map(data => ({
      mesh: null,
      homePos: data.home,
      currentPos: data.home.clone(),
      velocity: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      rotVelocity: new THREE.Vector3(),
      flashIntensity: 0,
      flashColor: new THREE.Color(1,1,1)
    }));
    
    return generatedShards;
  }, [viewport.width, viewport.height]); 

  useImperativeHandle(ref, () => ({
    explode: (intensity, color, origin) => {
      physicsRef.current.forEach(shard => {
        // Map 2D origin from HUD (approx coords) to 3D Scene coords
        // Since HUD and Background use different cameras, we approximate the impact location relative to center
        // Or simply explode everything near the center for dramatic effect if precise mapping is off
        const dist = shard.currentPos.distanceTo(origin);
        // Increase radius of effect
        const radius = 15.0 * intensity; 
        
        if (dist < radius) {
          const force = (1 - dist / radius) * intensity;
          const dir = new THREE.Vector3().subVectors(shard.currentPos, origin).normalize();
          
          // Randomize direction slightly for chaos
          dir.x += (Math.random() - 0.5) * 0.5;
          dir.y += (Math.random() - 0.5) * 0.5;
          
          shard.velocity.add(dir.multiplyScalar(force * 12.0)); 
          shard.velocity.z += force * 15.0; // Explosion towards camera
          
          shard.rotVelocity.x += (Math.random() - 0.5) * force * 15;
          shard.rotVelocity.y += (Math.random() - 0.5) * force * 15;
          
          shard.flashIntensity = 1.0;
          shard.flashColor.copy(color);
        }
      });
    }
  }));

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1); 
    const time = state.clock.getElapsedTime();
    
    physicsRef.current.forEach((shard, i) => {
      if (!shard.mesh) return;

      // 1. Physics Integration
      shard.currentPos.add(shard.velocity.clone().multiplyScalar(dt));
      
      shard.rotation.x += shard.rotVelocity.x * dt;
      shard.rotation.y += shard.rotVelocity.y * dt;
      shard.rotation.z += shard.rotVelocity.z * dt;

      // 2. Spring force (Return to Home)
      const springK = 3.0; 
      const damping = 0.92; 
      
      const displacement = new THREE.Vector3().subVectors(shard.currentPos, shard.homePos);
      
      // Add breathing effect to home position
      const breathingZ = Math.sin(time * 0.5 + shard.homePos.x * 0.1) * 0.5;
      const targetPos = shard.homePos.clone();
      targetPos.z += breathingZ;

      const displacementToTarget = new THREE.Vector3().subVectors(shard.currentPos, targetPos);
      const force = displacementToTarget.multiplyScalar(-springK);
      
      shard.velocity.add(force.multiplyScalar(dt));
      shard.velocity.multiplyScalar(damping); 

      shard.rotVelocity.multiplyScalar(0.95);
      shard.rotation.x *= 0.95;
      shard.rotation.y *= 0.95;
      shard.rotation.z *= 0.95;

      // 3. Flash Decay
      if (shard.flashIntensity > 0) {
        shard.flashIntensity = THREE.MathUtils.lerp(shard.flashIntensity, 0, dt * 5);
        if (shard.flashIntensity < 0.01) shard.flashIntensity = 0;
        
        const mat = shard.mesh.material as THREE.ShaderMaterial;
        if (mat.uniforms) {
          mat.uniforms.uFlashIntensity.value = shard.flashIntensity;
          mat.uniforms.uFlashColor.value = shard.flashColor;
        }
      }

      // 4. Apply to Mesh
      shard.mesh.position.copy(shard.currentPos);
      shard.mesh.rotation.copy(shard.rotation);
    });
  });

  if (!texture) return null;

  return (
    <group ref={groupRef} scale={[1, 1, 1]}>
      {shardsData.map((shard, i) => (
        <mesh
          key={i}
          geometry={shard.geometry}
          ref={(el) => { 
            if (physicsRef.current[i]) {
              physicsRef.current[i].mesh = el; 
            }
          }}
        >
          <shaderMaterial
            vertexShader={shardVertexShader}
            fragmentShader={shardFragmentShader}
            uniforms={{
              uTexture: { value: texture },
              uFlashColor: { value: new THREE.Color(1, 1, 1) },
              uFlashIntensity: { value: 0.0 }
            }}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
});

export default ShatterBackground;