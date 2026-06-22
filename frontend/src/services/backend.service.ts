import { fetchJson } from "./api-client";
import type { PredictionData, HealthStatus } from "@/types";

function parsePrediction(raw: Record<string, unknown>): PredictionData {
  return {
    letter: String(raw.letter ?? ""),
    confidence: Number(raw.confidence ?? 0),
    handDetected: Boolean(raw.hand_detected),
    modelLoaded: Boolean(raw.model_loaded),
    isRecording: Boolean(raw.is_recording),
    recordingLetter: String(raw.recording_letter ?? ""),
    recordedSamplesCount: Number(raw.recorded_samples_count ?? 0),
    predictionMode: (String(raw.prediction_mode ?? "letters") as PredictionData["predictionMode"]),
    word: String(raw.word ?? ""),
    wordConfidence: Number(raw.word_confidence ?? 0),
    isRecordingWord: Boolean(raw.is_recording_word),
    recordingWordName: String(raw.recording_word_name ?? ""),
    wordRecordedSamplesCount: Number(raw.word_recorded_samples_count ?? 0),
    wordModelLoaded: Boolean(raw.word_model_loaded),
    dynamicSign: String(raw.dynamic_sign ?? ""),
    dynamicConfidence: Number(raw.dynamic_confidence ?? 0),
    isRecordingDynamic: Boolean(raw.is_recording_dynamic),
    recordingDynamicName: String(raw.recording_dynamic_name ?? ""),
    dynamicRecordedFrames: Number(raw.dynamic_recorded_frames ?? 0),
    dynamicSequencesSaved: Number(raw.dynamic_sequences_saved ?? 0),
    dynamicBufferLen: Number(raw.dynamic_buffer_len ?? 0),
    dynamicModelLoaded: Boolean(raw.dynamic_model_loaded),
  };
}

export async function checkHealth(): Promise<HealthStatus & { ok: boolean }> {
  try {
    const data = await fetchJson<HealthStatus>("/health");
    return { ...data, ok: true };
  } catch {
    return { status: "ok", modelLoaded: false, wordModelLoaded: false, dynamicModelLoaded: false, cameraActive: false, ok: false } as const;
  }
}

export async function getPrediction(): Promise<PredictionData> {
  const raw = await fetchJson<Record<string, unknown>>("/prediction");
  return parsePrediction(raw);
}

export async function stopCamera(): Promise<{ msg: string }> {
  return fetchJson<{ msg: string }>("/camera/stop", { method: "POST" });
}

export async function setPredictionMode(mode: string): Promise<{ msg: string; mode: string }> {
  return fetchJson<{ msg: string; mode: string }>(`/prediction_mode?mode=${encodeURIComponent(mode)}`, { method: "POST" });
}
