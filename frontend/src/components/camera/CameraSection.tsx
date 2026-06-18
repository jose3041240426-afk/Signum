"use client";
import { CameraFeed } from "./CameraFeed";
import { CyberCard } from "../prediction/CyberCard";
import { WordOverlay } from "../prediction/WordOverlay";
import { ProgressBar } from "../ui/progress-bar";
import type { PredictionData } from "@/types";

interface CameraSectionProps {
  backendStatus: "checking" | "online" | "offline";
  cameraOn: boolean;
  prediction: PredictionData;
}

export function catheterCameraSection({ backendStatus, cameraOn, prediction }: CameraSectionProps) {
  const showOverlays = prediction.handDetected && !prediction.isRecording && !prediction.isRecordingWord;

  return (
    <div className="relative">
      <CameraFeed cameraOn={cameraOn} backendStatus={backendStatus} />
      {backendStatus === "online" && cameraOn && (
        <>
          <CyberCard letter={prediction.letter} confidence={prediction.confidence} visible={showOverlays} />
          <WordOverlay word={prediction.word} confidence={prediction.wordConfidence} visible={showOverlays} />
          {prediction.isRecording && (
            <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-green-200 bg-green-50 p-4 text-green-800 shadow-lg">
              <div className="mb-2 flex items-center justify-between font-bold">
                <span>CAPTURANDO LETRA &apos;{prediction.recordingLetter}&apos;</span>
                <span>{prediction.recordedSamplesCount}/100 Muestras</span>
              </div>
              <ProgressBar progress={prediction.recordedSamplesCount} total={100} />
            </div>
          )}
          {prediction.isRecordingWord && (
            <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-orange-200 bg-orange-50 p-4 text-orange-800 shadow-lg">
              <div className="mb-2 flex items-center justify-between font-bold">
                <span>CAPTURANDO PALABRA &apos;{prediction.recordingWordName}&apos;</span>
                <span>{prediction.wordRecordedSeqCount}/3 Secuencias</span>
              </div>
              <ProgressBar progress={prediction.wordRecordedSeqCount} total={3} />
            </div>
          )}
          {!prediction.modelLoaded && !prediction.isRecording && !prediction.isRecordingWord && (
            <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow">
              <b>Modelo Signum no entrenado en el servidor.</b> Escribe la letra a capturar a insists, haz la seña con la mano y entrena tu red directamente desde esta pagina.
            </div>
          )}
        </>
      )}
    </div>
  );
}
