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
import { useTTS } from "./use-tts";

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

export function useLivePrediction(mode: string = "letters") {
  const [data, setData] = useState<LivePredictionData>(DEFAULT_PREDICTION);
  const [cameraOn, setCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef(mode);
  const { speak, resetLastSpoken } = useTTS();
  const lastPredictionRef = useRef("");
  const rfLetter = useRef<RandomForestPredictor>(new RandomForestPredictor());
  const rfWord = useRef<RandomForestPredictor>(new RandomForestPredictor());
  const localReadyRef = useRef(false);
  const predictionBuffer = useRef<PredictionResult[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  modeRef.current = mode;

  useEffect(() => {
    modeRef.current = mode;
    predictionBuffer.current = [];
  }, [mode]);

  // Load local models
  useEffect(() => {
    let alive = true;
    console.log("[Signum] Cargando modelos locales...");
    Promise.all([
      rfLetter.current.load("/models/modelo_letras.json"),
      rfWord.current.load("/models/modelo_palabras.json"),
    ])
      .then(() => {
        if (alive) {
          localReadyRef.current = true;
          setData((prev) => ({ ...prev, localModelReady: true }));
          console.log("[Signum] Modelos locales cargados exitosamente");
        }
      })
      .catch((err) => {
        console.error("[Signum] Error al cargar modelos locales:", err);
        if (alive) {
          localReadyRef.current = false;
        }
      });
    return () => { alive = false; };
  }, []);

  const smoothPredict = (label: string, confidence: number): PredictionResult => {
    const buf = predictionBuffer.current;
    buf.push({ label, confidence });
    if (buf.length > BUFFER_SIZE) buf.shift();

    const counts: Record<string, { count: number; totalConf: number }> = {};
    for (const p of buf) {
      if (!counts[p.label]) counts[p.label] = { count: 0, totalConf: 0 };
      counts[p.label].count += 1;
      counts[p.label].totalConf += p.confidence;
    }
    let best = label;
    let bestCount = 0;
    for (const [lbl, c] of Object.entries(counts)) {
      if (c.count > bestCount) {
        best = lbl;
        bestCount = c.count;
      }
    }
    return { label: best, confidence: Math.round(counts[best].totalConf / counts[best].count * 10) / 10 };
  };

  const handleMediaPipeResult = useCallback(
    (result: MediaPipeDetectionResult) => {
      if (!result.handDetected || result.landmarks.length !== 63) return;

      if (localReadyRef.current) {
        const predictor = modeRef.current === "words" ? rfWord.current : rfLetter.current;
        const pred = predictor.predict(result.landmarks);
        if (pred) {
          const smoothed = smoothPredict(pred.label, pred.confidence);
          const isLetterMode = modeRef.current === "letters";
          const isWordMode = modeRef.current === "words";

          setData((prev) => ({
            ...prev,
            letter: isLetterMode ? smoothed.label : prev.letter,
            confidence: isLetterMode ? smoothed.confidence : prev.confidence,
            word: isWordMode ? smoothed.label : prev.word,
            wordConfidence: isWordMode ? smoothed.confidence : prev.wordConfidence,
          }));

          if (smoothed.label !== lastPredictionRef.current) {
            lastPredictionRef.current = smoothed.label;
            if (isLetterMode && smoothed.confidence > 55) speak(smoothed.label);
            if (isWordMode && smoothed.confidence > 30) speak(smoothed.label);
          }
        }
      }

      sendLandmarks(result.landmarks, modeRef.current);
    },
    [speak],
  );

  const handleWSPrediction = useCallback(
    (result: WSPredictionResult) => {
      // Only use WS predictions if local models aren't ready
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

      if (modeRef.current === "letters" && result.letter && result.confidence > 55) {
        if (result.letter !== lastPredictionRef.current) {
          lastPredictionRef.current = result.letter;
          speak(result.letter);
        }
      }
      if (modeRef.current === "words" && result.word && result.word_confidence > 30) {
        if (result.word !== lastPredictionRef.current) {
          lastPredictionRef.current = result.word;
          speak(result.word);
        }
      }
    },
    [speak],
  );

  const handleWSStatus = useCallback((connected: boolean) => {
    setData((prev) => ({ ...prev, wsConnected: connected }));
  }, []);

  useEffect(() => {
    connectWebSocket(handleWSPrediction, handleWSStatus, mode);
    return () => { disconnectWebSocket(); };
  }, [handleWSPrediction, handleWSStatus, mode]);

  useEffect(() => {
    if (!cameraOn || !videoRef.current || !canvasRef.current) {
      setData((prev) => ({ ...prev, mediapipeReady: false }));
      return;
    }

    let mounted = true;

    initMediaPipe(videoRef.current, canvasRef.current, (result) => {
      if (mounted) {
        handleMediaPipeResult(result);
        setData((prev) => ({
          ...prev,
          handDetected: result.handDetected,
          mediapipeReady: true,
        }));
      }
    }, streamRef.current).catch(() => {
      if (mounted) setData((prev) => ({ ...prev, mediapipeReady: false }));
    });

    return () => {
      mounted = false;
      stopMediaPipe();
    };
  }, [cameraOn, handleMediaPipeResult]);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      // Turning off
      setCameraOn(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      resetLastSpoken();
    } else {
      // Turning on — request camera with user gesture
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
        });
        streamRef.current = stream;
        setCameraOn(true);
        resetLastSpoken();
      } catch {
        console.error("[Signum] Permiso de camara denegado");
      }
    }
  }, [cameraOn, resetLastSpoken]);

  return {
    data,
    cameraOn,
    toggleCamera,
    videoRef,
    canvasRef,
  };
}
