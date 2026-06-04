/* ============================================================
   Tipos centrales del proyecto Signum
   ============================================================ */

export type BackendStatus = "checking" | "online" | "offline";

export interface PredictionData {
  letter: string;
  confidence: number;
  handDetected: boolean;
  modelLoaded: boolean;
  isRecording: boolean;
  recordingLetter: string;
  recordedSamplesCount: number;
  word: string;
  wordConfidence: number;
  isRecordingWord: boolean;
  recordingWordName: string;
  wordRecordedSeqCount: number;
  wordModelLoaded: boolean;
}

export interface HealthStatus {
  status: "ok";
  modelLoaded: boolean;
  cameraActive: boolean;
}

export interface CaptureState {
  isRecording: boolean;
  letter: string;
  samplesCount: number;
  isRecordingWord: boolean;
  wordName: string;
  wordSeqCount: number;
}

export interface TrainingState {
  isTraining: boolean;
  message: string;
  isTrainingWords: boolean;
  wordsMessage: string;
}
