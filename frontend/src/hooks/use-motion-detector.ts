import { useRef, useCallback, useState } from "react";

export interface MotionScore {
  score: number;
  frames: number;
  durationMs: number;
}

export interface UseMotionDetectorOptions {
  threshold?: number;
  minFrames?: number;
}

export function useMotionDetector(options: UseMotionDetectorOptions = {}) {
  const threshold = options.threshold ?? 0.015;
  const minFrames = options.minFrames ?? 5;

  const buffer = useRef<number[][]>([]);
  const [collecting, setCollecting] = useState(false);
  const [progress, setProgress] = useState(0);
  const collectingRef = useRef(false);
  const startedAt = useRef(0);
  const windowMs = useRef(3000);
  const tickHandle = useRef<number | null>(null);

  const pushLandmarks = useCallback((landmarks: number[]) => {
    if (!collectingRef.current) return;
    if (landmarks.length !== 63) return;
    buffer.current.push(landmarks);
  }, []);

  const start = useCallback((durationSec: number) => {
    buffer.current = [];
    windowMs.current = durationSec * 1000;
    startedAt.current = performance.now();
    collectingRef.current = true;
    setCollecting(true);
    setProgress(0);

    if (tickHandle.current !== null) {
      window.clearInterval(tickHandle.current);
    }
    tickHandle.current = window.setInterval(() => {
      if (!collectingRef.current) return;
      const elapsed = performance.now() - startedAt.current;
      const ratio = Math.min(1, elapsed / windowMs.current);
      setProgress(ratio);
    }, 50) as unknown as number;
  }, []);

  const stop = useCallback(() => {
    collectingRef.current = false;
    setCollecting(false);
    setProgress(0);
    if (tickHandle.current !== null) {
      window.clearInterval(tickHandle.current);
      tickHandle.current = null;
    }
  }, []);

  const computeMotionScore = useCallback((): MotionScore => {
    const frames = buffer.current;
    if (frames.length < minFrames) {
      return { score: 0, frames: frames.length, durationMs: 0 };
    }

    let totalVariance = 0;
    let count = 0;
    const dims = frames[0].length;
    const means = new Array<number>(dims).fill(0);

    for (const frame of frames) {
      for (let i = 0; i < dims; i++) {
        means[i] += frame[i];
      }
    }
    for (let i = 0; i < dims; i++) means[i] /= frames.length;

    for (const frame of frames) {
      for (let i = 0; i < dims; i++) {
        const diff = frame[i] - means[i];
        totalVariance += diff * diff;
        count++;
      }
    }
    const variance = count > 0 ? totalVariance / count : 0;
    const score = Math.sqrt(variance);

    const durationMs = performance.now() - startedAt.current;

    return { score, frames: frames.length, durationMs };
  }, [minFrames]);

  const clear = useCallback(() => {
    buffer.current = [];
  }, []);

  return {
    pushLandmarks,
    start,
    stop,
    clear,
    collecting,
    progress,
    computeMotionScore,
    threshold,
  };
}
