import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Results, Landmark } from '../../types';

interface HandTrackerProps {
  onResults: (results: Results) => void;
  className?: string;
}

// Hand skeleton connections for neon visualization
const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],       // Index
  [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
  [0, 13], [13, 14], [14, 15], [15, 16], // Ring
  [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [5, 9], [9, 13], [13, 17],            // Palm
];

// Fingertip indices
const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

const NEON_COLOR = '#00ffff';

const HandTracker: React.FC<HandTrackerProps> = ({ onResults, className }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestResultsRef = useRef<Results | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Draw hand skeleton with neon effect
  const drawHandSkeleton = useCallback((
    ctx: CanvasRenderingContext2D,
    landmarks: Landmark[],
    w: number,
    h: number
  ) => {
    ctx.save();
    ctx.strokeStyle = NEON_COLOR;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = NEON_COLOR;
    ctx.lineCap = 'round';

    // Draw connections
    HAND_CONNECTIONS.forEach(([start, end]) => {
      const p1 = landmarks[start];
      const p2 = landmarks[end];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
      }
    });

    // Draw joints
    ctx.fillStyle = NEON_COLOR;
    landmarks.forEach((lm, idx) => {
      const isFingerTip = FINGERTIP_INDICES.includes(idx);
      const radius = isFingerTip ? 5 : 3;
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, radius, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, []);

  useEffect(() => {
    let camera: any = null;
    let hands: any = null;
    let active = true;

    const setupMediaPipe = async () => {
      if (!window.Hands) {
        setTimeout(setupMediaPipe, 500);
        return;
      }

      try {
        hands = new window.Hands({
          locateFile: (file: string) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 0, // OPTIMIZATION: Use Lite model for high FPS
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        hands.onResults((results: Results) => {
          latestResultsRef.current = results;
          onResults(results);
        });

        if (videoRef.current) {
          camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (!active || !videoRef.current || !hands) return;
              try {
                await hands.send({ image: videoRef.current });
              } catch {
                // Ignore send errors when MediaPipe is tearing down.
              }
            },
            width: 640,
            height: 480,
          });
          await camera.start();
          setIsLoaded(true);
        }
      } catch (err) {
        console.error("Failed to initialize MediaPipe", err);
        setError("Camera Error");
      }
    };

    setupMediaPipe();

    return () => {
      active = false;
      if (camera) camera.stop();
      if (hands) hands.close();
      hands = null;
    };
  }, [onResults]);

  // Render loop for skeleton drawing
  useEffect(() => {
    let animationId: number;
    let active = true;

    const renderSkeleton = () => {
      if (!active) return;

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');

      if (canvas && ctx) {
        // Resize canvas if needed
        const container = canvas.parentElement;
        if (container && (canvas.width !== container.clientWidth || canvas.height !== container.clientHeight)) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
        }

        // Clear and draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const results = latestResultsRef.current;
        if (results?.multiHandLandmarks) {
          results.multiHandLandmarks.forEach(landmarks => {
            drawHandSkeleton(ctx, landmarks, canvas.width, canvas.height);
          });
        }
      }

      animationId = requestAnimationFrame(renderSkeleton);
    };

    renderSkeleton();

    return () => {
      active = false;
      cancelAnimationFrame(animationId);
    };
  }, [drawHandSkeleton]);

  return (
    <div className={`relative overflow-hidden bg-gray-900 ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover transform -scale-x-100 opacity-80"
        playsInline
        muted
      />

      {/* Skeleton overlay canvas - mirrored to match video */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none transform -scale-x-100"
      />

      {!isLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-cyan-500 font-mono text-sm animate-pulse">
            Initializing Camera...
          </div>
        </div>
      )}

      {error && (
         <div className="absolute inset-0 flex items-center justify-center text-red-600 bg-black font-mono text-xs p-2 text-center">
         {error}
       </div>
      )}
    </div>
  );
};

export default HandTracker;
