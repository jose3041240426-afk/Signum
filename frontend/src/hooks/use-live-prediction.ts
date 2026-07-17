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
  setMirrored,
  type MediaPipeDetectionResult,
} from "@/services/mediapipe.service";
import { RandomForestPredictor, type PredictionResult } from "@/services/rf-inference";
import { db } from "@/lib/db";
import { feedCaptureFrame, isCapturing, resampleSequence } from "@/services/capture-local.service";
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
  autoState: AutoState;
  autoProgress: number;
  autoResult: AutoResult | null;
}

export type AutoState =
  | "idle"
  | "waiting_hand"
  | "waiting_motion"
  | "capturing"
  | "classifying";

export interface AutoResult {
  isDynamic: boolean;
  motionScore: number;
  prediction: string;
  confidence: number;
  frames: number;
  letterPrediction?: string;
  letterConfidence?: number;
  wordPrediction?: string;
  wordConfidence?: number;
  dynamicPrediction?: string;
  dynamicConfidence?: number;
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
  autoState: "idle",
  autoProgress: 0,
  autoResult: null,
};

const BUFFER_SIZE = 5;
const DYNAMIC_FRAMES_PER_SEQUENCE = 50;

export function useLivePrediction(
  mode: string = "letters",
  captureActiveRef?: RefObject<boolean>,
  isMirrored: boolean = true,
) {
  const [data, setData] = useState<LivePredictionData>(DEFAULT_PREDICTION);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef(mode);
  const lastPredictionRef = useRef("");
  const rfLetter = useRef<RandomForestPredictor>(new RandomForestPredictor());
  const rfWord = useRef<RandomForestPredictor>(new RandomForestPredictor());
  const rfDynamic = useRef<RandomForestPredictor>(new RandomForestPredictor());
  const localReadyRef = useRef(false);
  const predictionBuffer = useRef<PredictionResult[]>([]);
  const letterPredictionBuffer = useRef<PredictionResult[]>([]);
  const wordPredictionBuffer = useRef<PredictionResult[]>([]);
  const dynamicPredictionBuffer = useRef<PredictionResult[]>([]);
  const dynamicBuffer = useRef<number[][]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastValidLandmarks = useRef<number[]>([]);
  const noDetectionFrames = useRef(0);
  const autoBuffer = useRef<number[][]>([]);
  const autoStateRef = useRef<AutoState>("idle");
  const autoStartRef = useRef<number>(0);
  const autoDurationMsRef = useRef<number>(3000);
  const autoMotionThresholdRef = useRef<number>(0.015);
  const autoInstantThresholdRef = useRef<number>(0.025);
  const autoMaxWaitMsRef = useRef<number>(1500);
  const autoMinFramesRef = useRef<number>(8);
  const autoTickRef = useRef<number | null>(null);
  const lastAutoLandmarksRef = useRef<number[] | null>(null);
  const autoMotionDetectedRef = useRef<boolean>(false);

  const lastMotionLandmarksRef = useRef<number[] | null>(null);
  const lastSignificantMotionTimeRef = useRef<number>(0);
  const MOTION_THRESHOLD = 0.018;
  const MOTION_TIMEOUT_MS = 500;

  modeRef.current = mode;

  useEffect(() => {
    modeRef.current = mode;
    predictionBuffer.current = [];
    letterPredictionBuffer.current = [];
    wordPredictionBuffer.current = [];
    dynamicPredictionBuffer.current = [];
    dynamicBuffer.current = [];
  }, [mode]);

  useEffect(() => {
    setMirrored(isMirrored);
  }, [isMirrored]);

  async function loadLocalModels(): Promise<boolean> {
    let letterReady = false;
    let wordReady = false;
    let dynamicReady = false;

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
        console.log(`[Prediction] Loaded local word model with ${wordModel.classes?.length || 0} classes`);
      }
    } catch {}

    try {
      const dynamicModel = await db.getModel("rf-dynamic");
      if (dynamicModel?.data) {
        rfDynamic.current["model"] = dynamicModel.data as any;
        dynamicReady = true;
        console.log(`[Prediction] Loaded local dynamic model with ${dynamicModel.classes?.length || 0} classes and ${(dynamicModel.data as any).nFeatures} features`);
      }
    } catch (err) {
      console.warn(`[Prediction] Error loading dynamic model from DB:`, err);
    }

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

    if (!dynamicReady) {
      try {
        await rfDynamic.current.load("/models/modelo_dinamico.json");
        dynamicReady = true;
      } catch {}
    }

    return letterReady || wordReady || dynamicReady;
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

  const smoothPredictWithBuffer = (
    buffer: React.MutableRefObject<PredictionResult[]>,
    label: string,
    confidence: number,
  ): PredictionResult | null => {
    const buf = buffer.current;
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

  const smoothPredictDynamic = (label: string, confidence: number): PredictionResult | null => {
    const buf = dynamicPredictionBuffer.current;
    buf.push({ label, confidence });
    if (buf.length > BUFFER_SIZE) buf.shift();

    if (buf.length < 2) return null;

    const counts: Record<string, { count: number; totalConf: number }> = {};
    for (const p of buf) {
      if (!counts[p.label]) counts[p.label] = { count: 0, totalConf: 0 };
      counts[p.label].count += 1;
      counts[p.label].totalConf += p.confidence;
    }

    let bestLabel = "";
    let maxCount = 0;
    for (const [lbl, data] of Object.entries(counts)) {
      if (data.count > maxCount) {
        maxCount = data.count;
        bestLabel = lbl;
      }
    }

    if (maxCount >= Math.ceil(BUFFER_SIZE * 0.4)) { // Slightly lower threshold for dynamic
      return { label: bestLabel, confidence: counts[bestLabel].totalConf / maxCount };
    }
    return null;
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

      const prevMotionLms = lastMotionLandmarksRef.current;
      if (prevMotionLms && prevMotionLms.length === 63) {
        let motionDelta = 0;
        for (let i = 0; i < 63; i++) {
          const diff = landmarksToUse[i] - prevMotionLms[i];
          motionDelta += diff * diff;
        }
        motionDelta = Math.sqrt(motionDelta / 63);
        if (motionDelta > MOTION_THRESHOLD) {
          lastSignificantMotionTimeRef.current = performance.now();
        }
      }
      lastMotionLandmarksRef.current = landmarksToUse;

      if (autoStateRef.current !== "idle") {
        const now = performance.now();

        if (autoStateRef.current === "waiting_hand") {
          autoStateRef.current = "waiting_motion";
          autoStartRef.current = now;
          autoBuffer.current = [];
          lastAutoLandmarksRef.current = landmarksToUse;
          autoMotionDetectedRef.current = false;
          setData((prev) => ({
            ...prev,
            autoState: "waiting_motion",
            autoProgress: 0,
            handDetected: true,
            mediapipeReady: true,
          }));
        } else if (autoStateRef.current === "waiting_motion") {
          autoBuffer.current.push(landmarksToUse);
          if (autoBuffer.current.length > 60) {
            autoBuffer.current.shift();
          }

          const prevLms = lastAutoLandmarksRef.current;
          if (prevLms && prevLms.length === 63) {
            let instantDelta = 0;
            for (let i = 0; i < 63; i++) {
              const diff = landmarksToUse[i] - prevLms[i];
              instantDelta += diff * diff;
            }
            instantDelta = Math.sqrt(instantDelta / 63);
            if (instantDelta > autoInstantThresholdRef.current) {
              autoMotionDetectedRef.current = true;
              autoStateRef.current = "capturing";
              autoStartRef.current = now;
              setData((prev) => ({
                ...prev,
                autoState: "capturing",
                autoProgress: 0,
              }));
            }
          }
          lastAutoLandmarksRef.current = landmarksToUse;

          const waited = now - autoStartRef.current;
          if (!autoMotionDetectedRef.current && waited >= autoMaxWaitMsRef.current && autoBuffer.current.length >= autoMinFramesRef.current) {
            autoStateRef.current = "classifying";
            setData((prev) => ({
              ...prev,
              autoState: "classifying",
              autoProgress: 1,
              handDetected: true,
              mediapipeReady: true,
            }));
          } else {
            setData((prev) => ({
              ...prev,
              autoProgress: Math.min(1, waited / autoMaxWaitMsRef.current),
              handDetected: true,
              mediapipeReady: true,
            }));
          }
        } else if (autoStateRef.current === "capturing") {
          autoBuffer.current.push(landmarksToUse);
          const elapsed = now - autoStartRef.current;
          const progress = Math.min(1, elapsed / autoDurationMsRef.current);
          setData((prev) => ({
            ...prev,
            autoProgress: progress,
            handDetected: true,
            mediapipeReady: true,
          }));
          if (elapsed >= autoDurationMsRef.current) {
            autoStateRef.current = "classifying";
            setData((prev) => ({
              ...prev,
              autoState: "classifying",
              autoProgress: 1,
              handDetected: true,
              mediapipeReady: true,
            }));
          }
        }
        return;
      }

      if (localReadyRef.current) {
        let letterSmoothed: PredictionResult | null = null;
        let wordSmoothed: PredictionResult | null = null;
        let dynamicSmoothed: PredictionResult | null = null;

        // Always predict letters
        const letterPred = rfLetter.current.predict(landmarksToUse);
        if (letterPred) {
          letterSmoothed = smoothPredictWithBuffer(
            letterPredictionBuffer,
            letterPred.label,
            letterPred.confidence,
          );
        }

        // Always predict words
        const wordPred = rfWord.current.predict(landmarksToUse);
        if (wordPred) {
          wordSmoothed = smoothPredictWithBuffer(
            wordPredictionBuffer,
            wordPred.label,
            wordPred.confidence,
          );
        }

        // Always maintain and predict dynamic
        dynamicBuffer.current.push(landmarksToUse);
        const MAX_DYNAMIC_BUFFER = 90;
        if (dynamicBuffer.current.length > MAX_DYNAMIC_BUFFER) {
          dynamicBuffer.current.shift();
        }

        if (dynamicBuffer.current.length >= 30) {
          const scales = [30, 45, 60, 75, 90];
          let bestPred: PredictionResult | null = null;

          if (!rfDynamic.current["model"]) {
            if (dynamicBuffer.current.length % 30 === 0)
              console.warn(
                "[Prediction] Dynamic prediction skipped: No dynamic model loaded.",
              );
          } else {
            for (const scale of scales) {
              if (dynamicBuffer.current.length >= scale) {
                const slice = dynamicBuffer.current.slice(
                  dynamicBuffer.current.length - scale,
                );
                const resampled = resampleSequence(
                  slice,
                  DYNAMIC_FRAMES_PER_SEQUENCE,
                );

                const expectedFeatures = rfDynamic.current["model"]?.nFeatures;
                if (resampled.length !== expectedFeatures) {
                  console.warn(
                    `[Prediction] Feature mismatch! Model expects ${expectedFeatures}, got ${resampled.length}.`,
                  );
                  continue;
                }

                const pred = rfDynamic.current.predict(resampled);
                if (
                  pred &&
                  (!bestPred || pred.confidence > bestPred.confidence)
                ) {
                  bestPred = pred;
                }
              }
            }
          }

          if (bestPred && bestPred.confidence >= 0.4) {
            dynamicSmoothed = smoothPredictDynamic(
              bestPred.label,
              bestPred.confidence,
            );
          }
        }

        const isStatic = (performance.now() - lastSignificantMotionTimeRef.current) > MOTION_TIMEOUT_MS;

        if (isStatic) {
          dynamicSmoothed = null;
          if (letterSmoothed && wordSmoothed) {
            if (wordSmoothed.confidence > letterSmoothed.confidence) {
              letterSmoothed = null;
            } else {
              wordSmoothed = null;
            }
          }
        } else {
          letterSmoothed = null;
          wordSmoothed = null;
        }

        setData((prev) => ({
          ...prev,
          letter: letterSmoothed ? letterSmoothed.label : "",
          confidence: letterSmoothed
            ? letterSmoothed.confidence
            : 0,
          word: wordSmoothed ? wordSmoothed.label : "",
          wordConfidence: wordSmoothed
            ? wordSmoothed.confidence
            : 0,
          dynamicSign: dynamicSmoothed
            ? dynamicSmoothed.label
            : "",
          dynamicConfidence: dynamicSmoothed
            ? dynamicSmoothed.confidence
            : 0,
          handDetected: true,
          mediapipeReady: true,
        }));
      } else {
        setData((prev) => ({
          ...prev,
          handDetected: result.handDetected,
          mediapipeReady: true,
        }));
      }

      sendLandmarks(landmarksToUse, modeRef.current);
    },
    [captureActiveRef],
  );

  // Store handleMediaPipeResult in a ref so the camera useEffect doesn't
  // re-trigger when the callback identity changes.
  const handleMediaPipeResultRef = useRef(handleMediaPipeResult);
  handleMediaPipeResultRef.current = handleMediaPipeResult;

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
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      return;
    }

    let mounted = true;
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;

    navigator.mediaDevices.getUserMedia({
      video: { width: 800, height: 600, facingMode: "user" },
    }).then((stream) => {
      if (!mounted) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      setCameraError(null);

      initMediaPipe(
        videoEl,
        canvasEl,
        (result) => {
          if (mounted) {
            handleMediaPipeResultRef.current(result);
          }
        },
        stream,
      ).catch((error) => {
        console.error("[Signum] initMediaPipe failed:", error);
        if (mounted) setData((prev) => ({ ...prev, mediapipeReady: false }));
      });
    }).catch((err) => {
      console.error("[Signum] Permiso de camara denegado:", err);
      if (mounted) {
        setCameraOn(false);
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          setCameraError("Bloqueaste el acceso a la camara. Haz clic en el icono de camara en la barra del navegador y permite el acceso, luego recarga la pagina.");
        } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
          setCameraError("No se encontro ninguna camara conectada al dispositivo.");
        } else if (err?.name === "NotReadableError") {
          setCameraError("La camara esta siendo usada por otra aplicacion. Cierrala e intenta de nuevo.");
        } else {
          setCameraError("No se pudo acceder a la camara. Verifica los permisos e intenta de nuevo.");
        }
      }
    });

    return () => {
      mounted = false;
      stopMediaPipe();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraOn]); // Only depends on cameraOn now

  const toggleCamera = useCallback(() => {
    setCameraOn((prev) => !prev);
  }, []);

  const reloadModels = useCallback(async () => {
    const ready = await loadLocalModels();
    localReadyRef.current = ready;
    setData((prev) => ({ ...prev, localModelReady: ready }));
  }, []);

  const startAutoCapture = useCallback((durationSec: number, motionThreshold: number = 0.015, instantThreshold?: number) => {
    autoBuffer.current = [];
    autoDurationMsRef.current = Math.max(500, durationSec * 1000);
    autoMotionThresholdRef.current = motionThreshold;
    autoInstantThresholdRef.current = instantThreshold ?? Math.max(0.01, motionThreshold * 1.6);
    autoStateRef.current = "waiting_hand";
    autoMotionDetectedRef.current = false;
    lastAutoLandmarksRef.current = null;
    setData((prev) => ({
      ...prev,
      autoState: "waiting_hand",
      autoProgress: 0,
      autoResult: null,
    }));
  }, []);

  const stopAutoCapture = useCallback(() => {
    autoStateRef.current = "idle";
    lastAutoLandmarksRef.current = null;
    autoMotionDetectedRef.current = false;
    if (autoTickRef.current !== null) {
      window.clearInterval(autoTickRef.current);
      autoTickRef.current = null;
    }
  }, []);

  const classifyAuto = useCallback((): AutoResult | null => {
    const frames = autoBuffer.current;
    if (frames.length < autoMinFramesRef.current) {
      autoStateRef.current = "idle";
      setData((prev) => ({
        ...prev,
        autoState: "idle",
        autoProgress: 0,
      }));
      return null;
    }

    // 1) Global motion score over the whole window
    const dims = frames[0].length;
    const means = new Array<number>(dims).fill(0);
    for (const frame of frames) {
      for (let i = 0; i < dims; i++) means[i] += frame[i];
    }
    for (let i = 0; i < dims; i++) means[i] /= frames.length;

    let totalSq = 0;
    let count = 0;
    for (const frame of frames) {
      for (let i = 0; i < dims; i++) {
        const diff = frame[i] - means[i];
        totalSq += diff * diff;
        count++;
      }
    }
    const variance = count > 0 ? totalSq / count : 0;
    const motionScore = Math.sqrt(variance);

    // 2) Peak instantaneous motion (ignore the initial still pose)
    let peakInstantMotion = 0;
    for (let f = 1; f < frames.length; f++) {
      let delta = 0;
      for (let i = 0; i < dims; i++) {
        const diff = frames[f][i] - frames[f - 1][i];
        delta += diff * diff;
      }
      peakInstantMotion = Math.max(peakInstantMotion, Math.sqrt(delta / dims));
    }

    // If we saw clear motion at any point, treat it as dynamic
    const isDynamic =
      autoMotionDetectedRef.current ||
      motionScore > autoMotionThresholdRef.current ||
      peakInstantMotion > autoInstantThresholdRef.current;

    // Always try all models regardless of motion
    let letterPrediction = "";
    let letterConfidence = 0;
    let wordPrediction = "";
    let wordConfidence = 0;
    let dynamicPrediction = "";
    let dynamicConfidence = 0;

    // Static models from middle frame
    const centroid = frames[Math.floor(frames.length / 2)];
    const letterPred = rfLetter.current.predict(centroid);
    if (letterPred) {
      letterPrediction = letterPred.label;
      letterConfidence = letterPred.confidence;
    }
    const wordPred = rfWord.current.predict(centroid);
    if (wordPred) {
      wordPrediction = wordPred.label;
      wordConfidence = wordPred.confidence;
    }

    // Dynamic model
    if (isDynamic) {
      const slice = frames.slice(-Math.min(frames.length, 90));
      const resampled = resampleSequence(slice, DYNAMIC_FRAMES_PER_SEQUENCE);
      const expected = rfDynamic.current["model"]?.nFeatures;
      if (expected && resampled.length === expected) {
        const pred = rfDynamic.current.predict(resampled);
        if (pred) {
          dynamicPrediction = pred.label;
          dynamicConfidence = pred.confidence;
        }
      }
    } else {
      // Try dynamic even without motion if we have enough frames
      const slice = frames.slice(-Math.min(frames.length, 90));
      if (slice.length >= DYNAMIC_FRAMES_PER_SEQUENCE) {
        const resampled = resampleSequence(slice, DYNAMIC_FRAMES_PER_SEQUENCE);
        const expected = rfDynamic.current["model"]?.nFeatures;
        if (expected && resampled.length === expected) {
          const pred = rfDynamic.current.predict(resampled);
          if (pred) {
            dynamicPrediction = pred.label;
            dynamicConfidence = pred.confidence;
          }
        }
      }
    }

    // Pick the best overall prediction as the primary one
    let prediction = "";
    let confidence = 0;

    if (isDynamic && dynamicPrediction) {
      prediction = dynamicPrediction;
      confidence = dynamicConfidence;
    } else if (letterPrediction && (!wordPrediction || letterConfidence >= wordConfidence)) {
      prediction = letterPrediction;
      confidence = letterConfidence;
    } else if (wordPrediction) {
      prediction = wordPrediction;
      confidence = wordConfidence;
    }

    const result: AutoResult = {
      isDynamic,
      motionScore,
      prediction,
      confidence,
      frames: frames.length,
      letterPrediction,
      letterConfidence,
      wordPrediction,
      wordConfidence,
      dynamicPrediction,
      dynamicConfidence,
    };

    autoBuffer.current = [];
    autoStateRef.current = "idle";
    lastAutoLandmarksRef.current = null;
    autoMotionDetectedRef.current = false;

    const bestStaticPrediction =
      letterPrediction && wordPrediction
        ? wordConfidence > letterConfidence
          ? { label: wordPrediction, confidence: wordConfidence }
          : { label: letterPrediction, confidence: letterConfidence }
        : letterPrediction
          ? { label: letterPrediction, confidence: letterConfidence }
          : wordPrediction
            ? { label: wordPrediction, confidence: wordConfidence }
            : null;

    if (isDynamic) {
      lastSignificantMotionTimeRef.current = performance.now();
    }

    setData((prev) => ({
      ...prev,
      autoState: "idle",
      autoProgress: 0,
      autoResult: result,
      letter: !isDynamic && bestStaticPrediction?.label === letterPrediction ? letterPrediction : "",
      confidence: !isDynamic && bestStaticPrediction?.label === letterPrediction ? letterConfidence : 0,
      word: !isDynamic && bestStaticPrediction?.label === wordPrediction ? wordPrediction : "",
      wordConfidence: !isDynamic && bestStaticPrediction?.label === wordPrediction ? wordConfidence : 0,
      dynamicSign: isDynamic && dynamicPrediction ? dynamicPrediction : "",
      dynamicConfidence: isDynamic && dynamicPrediction ? dynamicConfidence : 0,
    }));

    return result;
  }, []);

  useEffect(() => {
    return () => {
      if (autoTickRef.current !== null) {
        window.clearInterval(autoTickRef.current);
        autoTickRef.current = null;
      }
    };
  }, []);

  return {
    data,
    cameraOn,
    cameraError,
    toggleCamera,
    videoRef,
    canvasRef,
    reloadModels,
    startAutoCapture,
    stopAutoCapture,
    classifyAuto,
  };
}
