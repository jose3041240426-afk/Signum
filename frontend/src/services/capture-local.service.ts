import { db, type SignType } from "@/lib/db";

const REQUIRED_LETTER_SAMPLES = 50;
const REQUIRED_WORD_SAMPLES = 30;
const REQUIRED_DYNAMIC_SEQUENCES = 5;
const DYNAMIC_FRAMES_PER_SEQUENCE = 50;

export type CaptureStatus = "idle" | "capturing" | "done";

export interface CaptureState {
  isRecording: boolean;
  label: string;
  samplesCount: number;
  requiredSamples: number;
  status: CaptureStatus;
  isSampleRecording?: boolean;
  currentSampleFrames?: number;
}

const DEFAULT_STATE: CaptureState = {
  isRecording: false,
  label: "",
  samplesCount: 0,
  requiredSamples: 0,
  status: "idle",
  isSampleRecording: false,
  currentSampleFrames: 0,
};

let currentCapture: {
  type: SignType;
  label: string;
  samples: number[][];
  required: number;
  onProgress: (count: number, extraState?: Partial<CaptureState>) => void;
  onComplete: () => void;
  tempSampleBuffer?: number[][];
  isSampleRecording?: boolean;
} | null = null;

export function resampleSequence(sequence: number[][], targetLength: number = 50): number[] {
  const N = sequence.length;
  if (N === 0) return new Array(targetLength * 63).fill(0);
  if (N === 1) {
    // Duplicate the frame if only 1 is captured
    return new Array(targetLength).fill(sequence[0]).flat();
  }

  const resampled: number[][] = [];
  for (let j = 0; j < targetLength; j++) {
    const x = (j * (N - 1)) / (targetLength - 1);
    const i = Math.floor(x);
    const w = x - i;

    if (i >= N - 1) {
      resampled.push([...sequence[N - 1]]);
    } else {
      const f1 = sequence[i];
      const f2 = sequence[i + 1];
      const interpolatedFrame = new Array(63);
      for (let k = 0; k < 63; k++) {
        interpolatedFrame[k] = (1 - w) * f1[k] + w * f2[k];
      }
      resampled.push(interpolatedFrame);
    }
  }
  return resampled.flat();
}

export function startCapture(
  type: SignType,
  label: string,
  onProgress: (count: number, extraState?: Partial<CaptureState>) => void,
  onComplete: () => void,
): CaptureState {
  let required = REQUIRED_LETTER_SAMPLES;
  if (type === "word") required = REQUIRED_WORD_SAMPLES;
  if (type === "dynamic") required = REQUIRED_DYNAMIC_SEQUENCES;

  currentCapture = {
    type,
    label,
    samples: [],
    required,
    onProgress,
    onComplete,
    tempSampleBuffer: type === "dynamic" ? [] : undefined,
    isSampleRecording: false,
  };
  return {
    isRecording: true,
    label,
    samplesCount: 0,
    requiredSamples: required,
    status: "capturing",
    isSampleRecording: false,
    currentSampleFrames: 0,
  };
}

export function feedCaptureFrame(landmarks: number[]): boolean {
  if (!currentCapture) return false;
  if (landmarks.length !== 63) {
    console.warn(`[Capture] feedCaptureFrame rejected: landmarks.length=${landmarks.length}, expected 63`);
    return false;
  }

  if (currentCapture.type === "dynamic") {
    if (currentCapture.isSampleRecording && currentCapture.tempSampleBuffer) {
      currentCapture.tempSampleBuffer.push([...landmarks]);
      const frameCount = currentCapture.tempSampleBuffer.length;
      if (frameCount % 10 === 0) {
        console.log(`[Capture] Dynamic frame #${frameCount} recorded for '${currentCapture.label}'`);
      }
      currentCapture.onProgress(currentCapture.samples.length, {
        isSampleRecording: true,
        currentSampleFrames: frameCount,
      });
    }
    return false;
  } else {
    currentCapture.samples.push(landmarks);
    const count = currentCapture.samples.length;
    currentCapture.onProgress(count);

    if (count >= currentCapture.required) {
      finishCapture();
      return true;
    }
    return false;
  }
}

export function startManualSample(): boolean {
  if (!currentCapture || currentCapture.type !== "dynamic") {
    console.warn(`[Capture] startManualSample failed: currentCapture=${!!currentCapture}, type=${currentCapture?.type}`);
    return false;
  }
  currentCapture.isSampleRecording = true;
  currentCapture.tempSampleBuffer = [];
  console.log(`[Capture] Manual sample recording STARTED for '${currentCapture.label}' (sample #${currentCapture.samples.length + 1})`);
  currentCapture.onProgress(currentCapture.samples.length, {
    isSampleRecording: true,
    currentSampleFrames: 0,
  });
  return true;
}

export function stopManualSample(): boolean {
  if (
    !currentCapture ||
    currentCapture.type !== "dynamic" ||
    !currentCapture.isSampleRecording ||
    !currentCapture.tempSampleBuffer
  ) {
    console.warn(`[Capture] stopManualSample failed: capture=${!!currentCapture}, type=${currentCapture?.type}, recording=${currentCapture?.isSampleRecording}, buffer=${!!currentCapture?.tempSampleBuffer}`);
    return false;
  }

  currentCapture.isSampleRecording = false;
  const rawFrames = currentCapture.tempSampleBuffer;
  currentCapture.tempSampleBuffer = [];

  console.log(`[Capture] Manual sample STOPPED for '${currentCapture.label}': captured ${rawFrames.length} raw frames`);
  
  if (rawFrames.length === 0) {
    console.warn(`[Capture] WARNING: 0 frames captured! The sample will be empty.`);
  }

  const flattened = resampleSequence(rawFrames, DYNAMIC_FRAMES_PER_SEQUENCE);
  console.log(`[Capture] Resampled to ${flattened.length} features (expected ${DYNAMIC_FRAMES_PER_SEQUENCE * 63} = ${DYNAMIC_FRAMES_PER_SEQUENCE}x63)`);
  currentCapture.samples.push(flattened);

  const count = currentCapture.samples.length;
  console.log(`[Capture] Total samples collected: ${count}/${currentCapture.required}`);
  currentCapture.onProgress(count, {
    isSampleRecording: false,
    currentSampleFrames: 0,
  });

  if (count >= currentCapture.required) {
    console.log(`[Capture] All ${currentCapture.required} samples collected! Saving to DB...`);
    finishCapture();
    return true;
  }
  return false;
}

export async function finishCapture(): Promise<void> {
  if (!currentCapture) return;

  const { type, label, samples, onComplete } = currentCapture;
  const records = samples.map((landmarks) => ({
    label,
    type,
    landmarks,
  }));

  try {
    await db.addSamples(records);
    console.log(`[Signum] Guardadas ${records.length} muestras dinámicas de '${label}' con éxito.`);
  } catch (err) {
    console.error("[Signum] Error guardando muestras dinámicas en IndexedDB:", err);
  }
  
  onComplete();
  currentCapture = null;
}

export function cancelCapture(): void {
  currentCapture = null;
}

export function isCapturing(): boolean {
  return currentCapture !== null;
}

export function isSampleRecording(): boolean {
  return currentCapture?.isSampleRecording ?? false;
}

export function getCaptureLabel(): string {
  return currentCapture?.label ?? "";
}

export { DEFAULT_STATE };

