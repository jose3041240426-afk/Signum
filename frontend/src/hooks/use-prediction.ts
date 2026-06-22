import { useState, useEffect } from "react";
import { getPrediction } from "@/services/backend.service";
import type { PredictionData } from "@/types";

const DEFAULT_PREDICTION: PredictionData = {
  letter: "",
  confidence: 0,
  handDetected: false,
  modelLoaded: false,
  isRecording: false,
  recordingLetter: "",
  recordedSamplesCount: 0,
  predictionMode: "letters",
  word: "",
  wordConfidence: 0,
  isRecordingWord: false,
  recordingWordName: "",
  wordRecordedSamplesCount: 0,
  wordModelLoaded: false,
  dynamicSign: "",
  dynamicConfidence: 0,
  isRecordingDynamic: false,
  recordingDynamicName: "",
  dynamicRecordedFrames: 0,
  dynamicSequencesSaved: 0,
  dynamicBufferLen: 0,
  dynamicModelLoaded: false,
};

export function usePrediction(backendStatus: "checking" | "online" | "offline") {
  const [data, setData] = useState<PredictionData>(DEFAULT_PREDICTION);
  const [cameraOn, setCameraOn] = useState(true);

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | null = null;

    if (backendStatus === "online" && cameraOn) {
      id = setInterval(async () => {
        try {
          const next = await getPrediction();
          setData((prev) => ({ ...prev, ...next }));
        } catch {
          /* silent */
        }
      }, 100);
    }

    return () => {
      if (id) clearInterval(id);
    };
  }, [backendStatus, cameraOn]);

  const toggleCamera = async () => {
    if (cameraOn) {
      try {
        await fetch("http://localhost:8000/camera/stop", { method: "POST" });
      } catch {
        /* no-op */
      }
    }
    setCameraOn((prev) => !prev);
  };

  return { data, cameraOn, toggleCamera };
}
