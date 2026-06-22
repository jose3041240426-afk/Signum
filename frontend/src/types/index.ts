/* ============================================================
   Tipos centrales del proyecto Signum
   ============================================================ */

export type BackendStatus = "checking" | "online" | "offline";

export type PredictionMode = "letters" | "words" | "dynamic";

export interface PredictionData {
  letter: string;
  confidence: number;
  handDetected: boolean;
  modelLoaded: boolean;
  isRecording: boolean;
  recordingLetter: string;
  recordedSamplesCount: number;
  predictionMode: PredictionMode;
  word: string;
  wordConfidence: number;
  isRecordingWord: boolean;
  recordingWordName: string;
  wordRecordedSamplesCount: number;
  wordModelLoaded: boolean;
  dynamicSign: string;
  dynamicConfidence: number;
  isRecordingDynamic: boolean;
  recordingDynamicName: string;
  dynamicRecordedFrames: number;
  dynamicSequencesSaved: number;
  dynamicBufferLen: number;
  dynamicModelLoaded: boolean;
}

export interface HealthStatus {
  status: "ok";
  modelLoaded: boolean;
  wordModelLoaded: boolean;
  dynamicModelLoaded: boolean;
  cameraActive: boolean;
}

export interface CaptureState {
  isRecording: boolean;
  letter: string;
  samplesCount: number;
  isRecordingWord: boolean;
  wordName: string;
  wordSeqCount: number;
  isRecordingDynamic: boolean;
  dynamicName: string;
  dynamicFrameCount: number;
  dynamicSequencesSaved: number;
}

export interface TrainingState {
  isTraining: boolean;
  message: string;
  isTrainingWords: boolean;
  wordsMessage: string;
  isTrainingDynamic: boolean;
  dynamicMessage: string;
}
