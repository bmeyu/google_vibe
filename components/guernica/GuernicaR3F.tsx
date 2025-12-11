import React, { useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import * as THREE from 'three';
import HandTracker from './HandTracker';
import DrumSystem from './DrumSystem';
import ShatterBackground, { ShatterHandle } from './ShatterBackground';
import { Results, DrumTypeEnum as DrumType } from '../../types';
import { COLORS } from './constants';

// Error Boundary for Canvas errors
interface ErrorBoundaryProps {
  fallback: React.ReactNode;
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export const GuernicaR3F: React.FC = () => {
  const handResultsRef = useRef<Results | null>(null);
  const shatterRef = useRef<ShatterHandle>(null);

  // Callback from MediaPipe
  const onHandResults = useCallback((results: Results) => {
    handResultsRef.current = results;
  }, []);

  // Callback from Drums
  const handleHit = useCallback((type: DrumType, position: THREE.Vector3) => {
    let colorHex = COLORS.SNARE_WHITE;
    let intensity = 1.0;

    switch (type) {
      case DrumType.KICK:
        colorHex = COLORS.KICK_RED;
        intensity = 2.0;
        break;
      case DrumType.SNARE:
        colorHex = COLORS.KICK_RED;
        intensity = 1.5;
        break;
      case DrumType.CYMBAL_L:
      case DrumType.CYMBAL_R:
        colorHex = COLORS.CYMBAL_BLUE;
        intensity = 0.8;
        break;
    }

    const color = new THREE.Color(colorHex);
    shatterRef.current?.explode(intensity, color, position);
  }, []);

  return (
    <div className="w-full h-screen relative bg-black overflow-hidden font-sans select-none">

      {/* LAYER 0: Background Art */}
      <div className="absolute inset-0 z-0">
        <ErrorBoundary fallback={<div className="w-full h-full flex items-center justify-center text-red-500 font-mono">ARTWORK_LOAD_FAIL</div>}>
          <Canvas>
            <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={20} />
            <color attach="background" args={['#050505']} />
            <ambientLight intensity={1} />
            <ShatterBackground ref={shatterRef} />
          </Canvas>
        </ErrorBoundary>
      </div>

      {/* Title - Top Left */}
      <div className="absolute top-6 left-8 pointer-events-none z-20 opacity-60">
        <h1 className="text-white font-mono text-2xl tracking-[0.3em] uppercase">Guernica - Drum Mode</h1>
        <p className="text-gray-500 text-xs mt-1 tracking-wider">PICASSO 1937</p>
      </div>

      {/* LAYER 1: HUD / Camera Preview */}
      <div className="absolute top-6 right-6 z-30 flex flex-col items-end gap-2 group">
        <div className="relative w-80 h-60 rounded-xl overflow-hidden shadow-2xl backdrop-blur-sm bg-black/30 border border-cyan-500/30 shadow-[0_0_30px_rgba(0,255,255,0.15)]">
          {/* Webcam Feed */}
          <HandTracker
            onResults={onHandResults}
            className="absolute inset-0 w-full h-full"
          />

          {/* Drums Overlay */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            <Canvas gl={{ alpha: true }}>
              <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={25} />
              <DrumSystem handResults={handResultsRef} onHit={handleHit} />
            </Canvas>
          </div>

          {/* Label */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
            <span className="px-4 py-1.5 bg-cyan-500/20 backdrop-blur-md text-cyan-400 text-[10px] font-bold tracking-widest uppercase rounded-full border border-cyan-500/30">
              Drum Mode Active
            </span>
          </div>
        </div>
        <div className="text-cyan-500/40 text-[9px] tracking-widest uppercase pr-3 font-mono">Touch Drums to Play</div>
      </div>

      {/* Instructions - Bottom Center */}
      <div className="absolute bottom-10 left-0 right-0 pointer-events-none z-20 flex justify-center px-4">
        <div className="bg-black/60 backdrop-blur-md border border-gray-700/50 px-10 py-5 rounded-xl text-center shadow-2xl max-w-lg">
          <h3 className="text-gray-300 font-mono text-lg tracking-wide mb-2">GUERNICA SHATTERED</h3>
          <p className="text-gray-500 text-sm font-light leading-relaxed">
            <span className="text-cyan-400">Touch the drums</span> with your fingers to create beats.<br/>
            <span className="text-gray-600 text-xs">All drums trigger explosion | Different drums have different colors</span>
          </p>
        </div>
      </div>

    </div>
  );
};

export default GuernicaR3F;
