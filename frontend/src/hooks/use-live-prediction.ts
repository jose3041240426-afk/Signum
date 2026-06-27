import { useState, useEffect, useRef, useCallback } from "react";
import {
  connectWebSocket,
  disconnectWebSocket,
  sendLandmarks,
  type WSPredictionResult,
} from "@/services/websocket.service";
import {
  initMediaPipe,
  stopMediaPipe,
  type MediaPipeDetectionResult,
} from "@/services/mediapipe.service";
import { RandomForestPredictor, type PredictionResult } from "@/services/rf-inference";
import { db } from "@/lib/db";
import { feedCaptureFrame, isCapturing } from "@/services/capture-local.service";
import type { RefObject } from "react";

export interface LivePredictionData {
  letter: string;
  confidence: number;
  handDetected: boolean;
  word: string;
  wordConfidence: number;
  dynamicSign: string;
  dynamicConfidence: number;
  wsConnected: boolean;
  mediapipeReady: boolean;
  localModelReady: boolean;
}

const DEFAULT_PREDICTION: LivePredictionData = {
  letter: "",
  confidence: 0,
  handDetected: false,
  word: "",
  wordConfidence: 0,
  dynamicSign: "",
  dynamicConfidence: 0,
  wsConnected: false,
  mediapipeReady: false,
  localModelReady: false,
};

const BUFFER_SIZE = 5;

export function useLivePrediction(
  mode: string = "letters",
  captureActiveRef?: RefObject<boolean>,
) {
  const [data, setData] = useState<LivePredictionData>(DEFAULT_PREDICTION);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef(mode);
  const lastPredictionRef = useRef("");
  const rfLetter = useRef<RandomForestPredictor>(new RandomForestPredictor());
  const rfWord = useRef<RandomForestPredictor>(new RandomForestPredictor());
  const localReadyRef = useRef(false);
  const predictionBuffer = useRef<PredictionResult[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastValidLandmarks = useRef<number[]>([]);
  const noDetectionFrames = useRef(0);

  modeRef.current = mode;

  useEffect(() => {
    modeRef.current = mode;
    predictionBuffer.current = [];
  }, [mode]);

  async function loadLocalModels(): Promise<boolean> {
    let letterReady = false;
    let wordReady = false;

    try {
      const letterModel = await db.getModel("rf-letter");
      if (letterModel?.data) {
        rfLetter.current["model"] = letterModel.data as any;
        letterReady = true;
      }
    } catch {}

    try {
      const wordModel = await db.getModel("rf-word");
      if (wordModel?.data) {
        rfWord.current["model"] = wordModel.data as any;
        wordReady = true;
      }
    } catch {}

    if (!letterReady) {
      try {
        await rfLetter.current.load("/models/modelo_letras.json");
        letterReady = true;
      } catch {}
    }

    if (!wordReady) {
      try {
        await rfWord.current.load("/models/modelo_palabras.json");
        wordReady = true;
      } catch {}
    }

    return letterReady || wordReady;
  }

  useEffect(() => {
    let alive = true;
    console.log("[Signum] Cargando modelos locales...");
    loadLocalModels().then((ready) => {
      if (alive) {
        localReadyRef.current = ready;
        setData((prev) => ({ ...prev, localModelReady: ready }));
        console.log(
          ready
            ? "[Signum] Modelos locales cargados exitosamente"
            : "[Signum] No se pudieron cargar modelos locales",
        );
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const smoothPredict = (label: string, confidence: number): PredictionResult | null => {
    const buf = predictionBuffer.current;
    buf.push({ label, confidence });
    if (buf.length > BUFFER_SIZE) buf.shift();

    if (buf.length < 2) return null;

    const counts: Record<string, { count: number; totalConf: number }> = {};
    for (const p of buf) {
      if (!counts[p.label]) counts[p.label] = { count: 0, totalConf: 0 };
      counts[p.label].count += 1;
      counts[p.label].totalConf += p.confidence;
    }
    let best = label;
    let bestCount = 0;
    for (const [key, c] of Object.entries(counts)) {
      if (c.count > bestCount) {
        best = key;
        bestCount = c.count;
      }
    }
    return {
      label: best,
      confidence:
        Math.round((counts[best].totalConf / counts[best].count) * 10) / 10,
    };
  };

  const handleMediaPipeResult = useCallback(
    (result: MediaPipeDetectionResult) => {
      let landmarksToUse = result.landmarks;

      if (!result.handDetected || result.landmarks.length !== 63) {
        noDetectionFrames.current += 1;
        if (noDetectionFrames.current <= 3 && lastValidLandmarks.current.length === 63) {
          landmarksToUse = lastValidLandmarks.current;
        } else {
          setData((prev) => ({ ...prev, handDetected: false }));
          return;
        }
      } else {
        noDetectionFrames.current = 0;
        lastValidLandmarks.current = result.landmarks;
      }

      if (captureActiveRef?.current || isCapturing()) {
        feedCaptureFrame(landmarksToUse);
      }

      if (localReadyRef.current) {
        const predictor =
          modeRef.current === "words"
            ? rfWord.current
            : rfLetter.current;
        const pred = predictor.predict(landmarksToUse);
        if (pred) {
          const smoothed = smoothPredict(pred.label, pred.confidence);
          if (smoothed) {
            const isLetterMode = modeRef.current === "letters";
            const isWordMode = modeRef.current === "words";

            setData((prev) => ({
              ...prev,
              letter: isLetterMode ? smoothed.label : prev.letter,
              confidence: isLetterMode ? smoothed.confidence : prev.confidence,
              word: isWordMode ? smoothed.label : prev.word,
              wordConfidence: isWordMode ? smoothed.confidence : prev.wordConfidence,
              handDetected: true,
            }));
          }
        }
      }

      sendLandmarks(landmarksToUse, modeRef.current);
    },
    [captureActiveRef],
  );

  const handleWSPrediction = useCallback(
    (result: WSPredictionResult) => {
      if (localReadyRef.current) return;

      setData((prev) => ({
        ...prev,
        letter: result.letter || prev.letter,
        confidence: result.confidence || prev.confidence,
        handDetected: result.hand_detected,
        word: result.word || prev.word,
        wordConfidence: result.word_confidence || prev.wordConfidence,
        dynamicSign: result.dynamic_sign || prev.dynamicSign,
        dynamicConfidence: result.dynamic_confidence || prev.dynamicConfidence,
      }));
    },
    [],
  );

  const handleWSStatus = useCallback((connected: boolean) => {
    setData((prev) => ({ ...prev, wsConnected: connected }));
  }, []);

  useEffect(() => {
    connectWebSocket(handleWSPrediction, handleWSStatus, mode);
    return () => {
      disconnectWebSocket();
    };
  }, [handleWSPrediction, handleWSStatus, mode]);

  useEffect(() => {
    if (!cameraOn || !videoRef.current || !canvasRef.current) {
      setData((prev) => ({ ...prev, mediapipeReady: false }));
      return;
    }

    let mounted = true;

    initMediaPipe(
      videoRef.current,
      canvasRef.current,
      (result) => {
        if (mounted) {
          handleMediaPipeResult(result);
          setData((prev) => ({
            ...prev,
            handDetected: result.handDetected,
            mediapipeReady: true,
          }));
        }
      },
      streamRef.current,
    ).catch(() => {
      if (mounted) setData((prev) => ({ ...prev, mediapipeReady: false }));
    });

    return () => {
      mounted = false;
      stopMediaPipe();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOn, handleMediaPipeResult]);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      setCameraOn(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 800, height: 600, facingMode: "user" },
        });
        streamRef.current = stream;
        setCameraOn(true);
      } catch {
        console.error("[Signum] Permiso de camara denegado");
      }
    }
  }, [cameraOn]);

  const reloadModels = useCallback(async () => {
    const ready = await loadLocalModels();
    localReadyRef.current = ready;
    setData((prev) => ({ ...prev, localModelReady: ready }));
  }, []);

  return {
    data,
    cameraOn,
    toggleCamera,
    videoRef,
    canvasRef,
    reloadModels,
  };
}
