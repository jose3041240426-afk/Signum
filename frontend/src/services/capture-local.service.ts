import { db, type SignType } from "@/lib/db";

const REQUIRED_LETTER_SAMPLES = 50;
const REQUIRED_WORD_SAMPLES = 30;

export type CaptureStatus = "idle" | "capturing" | "done";

export interface CaptureState {
  isRecording: boolean;
  label: string;
  samplesCount: number;
  requiredSamples: number;
  status: CaptureStatus;
}

const DEFAULT_STATE: CaptureState = {
  isRecording: false,
  label: "",
  samplesCount: 0,
  requiredSamples: 0,
  status: "idle",
};

let currentCapture: {
  type: SignType;
  label: string;
  samples: number[][];
  required: number;
  onProgress: (count: number) => void;
  onComplete: () => void;
} | null = null;

export function startCapture(
  type: SignType,
  label: string,
  onProgress: (count: number) => void,
  onComplete: () => void,
): CaptureState {
  const required =
    type === "letter" ? REQUIRED_LETTER_SAMPLES : REQUIRED_WORD_SAMPLES;
  currentCapture = {
    type,
    label,
    samples: [],
    required,
    onProgress,
    onComplete,
  };
  return {
    isRecording: true,
    label,
    samplesCount: 0,
    requiredSamples: required,
    status: "capturing",
  };
}

export function feedCaptureFrame(landmarks: number[]): boolean {
  if (!currentCapture) return false;
  if (landmarks.length !== 63) return false;

  currentCapture.samples.push(landmarks);
  const count = currentCapture.samples.length;
  currentCapture.onProgress(count);

  if (count >= currentCapture.required) {
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

  await db.addSamples(records);
  onComplete();
  currentCapture = null;
}

export function cancelCapture(): void {
  currentCapture = null;
}

export function isCapturing(): boolean {
  return currentCapture !== null;
}

export function getCaptureLabel(): string {
  return currentCapture?.label ?? "";
}

export { DEFAULT_STATE };
