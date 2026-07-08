"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Checkbox from "@/components/ui/checkbox";
import { useLivePrediction } from "@/hooks/use-live-prediction";
import { useCapture } from "@/hooks/use-capture";
import { useModelTraining } from "@/hooks/use-model-training";
import { useTTS } from "@/hooks/use-tts";
import { usePhraseBuilder } from "@/hooks/use-phrase-builder";
import { isNativeTTSAvailable } from "@/services/tts.service";
import type { RFModel } from "@/services/rf-inference";

export default function Home() {
  const [isMirrored, setIsMirrored] = useState(true);
  const [predictionMode, setPredictionMode] = useState("letters");
  const {
    letterToCapture,
    setLetterToCapture,
    wordToCapture,
    setWordToCapture,
    dynamicToCapture,
    setDynamicToCapture,
    captureState,
    registeredLetters,
    registeredWords,
    registeredDynamic,
    fetchRegisteredLetters,
    fetchRegisteredWords,
    fetchRegisteredDynamic,
    startLetterRecording,
    startWordRecording,
    startDynamicRecording,
    startManualSample,
    stopManualSample,
    stopRecording,
    removeLetter,
    removeWord,
    removeDynamic,
    captureActiveRef,
  } = useCapture();

  const {
    data: liveData,
    cameraOn,
    toggleCamera,
    videoRef,
    canvasRef,
    reloadModels,
    startAutoCapture,
    stopAutoCapture,
    classifyAuto,
  } = useLivePrediction(predictionMode, captureActiveRef, isMirrored);

  const {
    isTraining,
    trainingMessage,
    trainLetters,
    isTrainingWords,
    trainingWordsMessage,
    trainWords,
    isTrainingDynamic,
    trainingDynamicMessage,
    trainDynamic,
  } = useModelTraining();

  const {
    phrase,
    setPhrase,
    autoAddActive,
    setAutoAddActive,
    addLetter,
    addSpace,
    backspace,
    tryAutoAdd,
    resetStableCount,
  } = usePhraseBuilder();

  const { speak, speakPhrase, resetLastSpoken } = useTTS();

  const [statusMessage, setStatusMessage] = useState("Cargando...");
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [guideClosing, setGuideClosing] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const autoAddFrameRef = useRef(0);
  const prevCaptureDoneRef = useRef(false);
  const lastSpokenPredictionRef = useRef("");
  const [soundOnSeña, setSoundOnSeña] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState(0);
  const [autoDuration, setAutoDuration] = useState(3);
  const [autoMotionThreshold, setAutoMotionThreshold] = useState(0.015);
  const [autoInstantThreshold, setAutoInstantThreshold] = useState(0.025);
  const [autoLastResult, setAutoLastResult] = useState<{
    isDynamic: boolean;
    motionScore: number;
    prediction: string;
    confidence: number;
  } | null>(null);

  const handleCloseGuide = useCallback(() => {
    setGuideClosing(true);
    setTimeout(() => {
      setIsGuideOpen(false);
      setGuideClosing(false);
    }, 250);
  }, []);

  useEffect(() => {
    setTtsAvailable(isNativeTTSAvailable());
  }, []);

  useEffect(() => {
    if (liveData.localModelReady) {
      setStatusMessage("Prediccion local activa - Modelos cargados");
    } else {
      setStatusMessage("Modelos no encontrados. Entrena tu modelo.");
    }
  }, [liveData.localModelReady]);

  useEffect(() => {
    fetchRegisteredLetters();
    fetchRegisteredWords();
    fetchRegisteredDynamic();
  }, [fetchRegisteredLetters, fetchRegisteredWords, fetchRegisteredDynamic]);

  useEffect(() => {
    if (prevCaptureDoneRef.current && captureState.status === "done") return;
    if (captureState.status === "done" && !prevCaptureDoneRef.current) {
      prevCaptureDoneRef.current = true;
      const isLetter = captureState.label.length === 1;
      setStatusMessage(
        `Seña '${captureState.label}' registrada (${
          captureState.samplesCount || captureState.requiredSamples
        } muestras/frames)`,
      );
      fetchRegisteredLetters();
      fetchRegisteredWords();
      fetchRegisteredDynamic();
    }
    if (captureState.status !== "done") {
      prevCaptureDoneRef.current = false;
    }
  }, [captureState.status, captureState.label, captureState.samplesCount, captureState.requiredSamples, fetchRegisteredLetters, fetchRegisteredWords, fetchRegisteredDynamic]);

  useEffect(() => {
    if (
      captureState.isRecording &&
      predictionMode === "dynamic" &&
      !captureState.isSampleRecording &&
      captureState.samplesCount < captureState.requiredSamples
    ) {
      setAutoCountdown(3);
      let count = 3;
      const interval = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          clearInterval(interval);
          setAutoCountdown(0);
          startManualSample();
        } else {
          setAutoCountdown(count);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [captureState.isRecording, captureState.isSampleRecording, captureState.samplesCount, captureState.requiredSamples, predictionMode, startManualSample]);

  useEffect(() => {
    if (
      captureState.isRecording &&
      predictionMode === "dynamic" &&
      captureState.isSampleRecording
    ) {
      const timer = setTimeout(() => {
        stopManualSample();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [captureState.isRecording, captureState.isSampleRecording, predictionMode, stopManualSample]);

  useEffect(() => {
    if (!soundOnSeña || !liveData.handDetected) return;

    // Find the highest-confidence prediction across all models
    let currentPrediction = "";
    let currentConfidence = 0;

    if (liveData.letter && liveData.confidence >= 55 && liveData.confidence > currentConfidence) {
      currentPrediction = liveData.letter;
      currentConfidence = liveData.confidence;
    }
    if (liveData.word && liveData.wordConfidence >= 30 && liveData.wordConfidence > currentConfidence) {
      currentPrediction = liveData.word;
      currentConfidence = liveData.wordConfidence;
    }
    if (liveData.dynamicSign && liveData.dynamicConfidence >= 30 && liveData.dynamicConfidence > currentConfidence) {
      currentPrediction = liveData.dynamicSign;
      currentConfidence = liveData.dynamicConfidence;
    }

    if (!currentPrediction) return;

    if (currentPrediction !== lastSpokenPredictionRef.current) {
      lastSpokenPredictionRef.current = currentPrediction;
      speak(currentPrediction);
    }
  }, [
    liveData.letter,
    liveData.word,
    liveData.dynamicSign,
    liveData.handDetected,
    liveData.confidence,
    liveData.wordConfidence,
    liveData.dynamicConfidence,
    predictionMode,
    soundOnSeña,
    speak,
  ]);

  useEffect(() => {
    if (!liveData.handDetected) return;

    // Find best prediction among all three models
    let currentPrediction = "";
    let currentConfidence = 0;
    let isWord = false;

    if (liveData.letter && liveData.confidence >= 55 && liveData.confidence > currentConfidence) {
      currentPrediction = liveData.letter;
      currentConfidence = liveData.confidence;
    }
    if (liveData.word && liveData.wordConfidence >= 30 && liveData.wordConfidence > currentConfidence) {
      currentPrediction = liveData.word;
      currentConfidence = liveData.wordConfidence;
      isWord = true;
    }
    if (liveData.dynamicSign && liveData.dynamicConfidence >= 30 && liveData.dynamicConfidence > currentConfidence) {
      currentPrediction = liveData.dynamicSign;
      currentConfidence = liveData.dynamicConfidence;
      isWord = true;
    }

    if (autoAddActive && currentPrediction) {
      autoAddFrameRef.current += 1;
      if (autoAddFrameRef.current > 6) {
        addLetter(currentPrediction + (isWord ? " " : ""));
        autoAddFrameRef.current = 0;
      }
    }
  }, [
    liveData.letter,
    liveData.word,
    liveData.dynamicSign,
    liveData.handDetected,
    liveData.confidence,
    liveData.wordConfidence,
    liveData.dynamicConfidence,
    predictionMode,
    autoAddActive,
    addLetter,
  ]);

  const startLetterCapture = useCallback(async () => {
    if (!letterToCapture) return;
    try {
      await startLetterRecording(letterToCapture);
      setStatusMessage(`Registrando letra '${letterToCapture}'...`);
    } catch {
      setStatusMessage("Error al iniciar registro.");
    }
  }, [letterToCapture, startLetterRecording]);

  const startWordCapture = useCallback(async () => {
    if (!wordToCapture) return;
    try {
      await startWordRecording(wordToCapture);
      setStatusMessage(`Registrando palabra '${wordToCapture}'...`);
    } catch {
      setStatusMessage("Error al iniciar registro de palabra.");
    }
  }, [wordToCapture, startWordRecording]);

  const startDynamicCapture = useCallback(async () => {
    if (!dynamicToCapture) return;
    try {
      await startDynamicRecording(dynamicToCapture);
      setStatusMessage(`Registrando seña con movimiento '${dynamicToCapture}'...`);
    } catch {
      setStatusMessage("Error al iniciar registro de seña dinámica.");
    }
  }, [dynamicToCapture, startDynamicRecording]);

  const startDynamicLetterCapture = useCallback(async () => {
    if (!letterToCapture) return;
    try {
      await startDynamicRecording(letterToCapture);
      setStatusMessage(`Registrando seña dinámica '${letterToCapture}'...`);
    } catch {
      setStatusMessage("Error al iniciar registro de seña dinámica.");
    }
  }, [letterToCapture, startDynamicRecording]);

  const startDynamicWordCapture = useCallback(async () => {
    if (!wordToCapture) return;
    try {
      await startDynamicRecording(wordToCapture);
      setStatusMessage(`Registrando seña dinámica '${wordToCapture}'...`);
    } catch {
      setStatusMessage("Error al iniciar registro de seña dinámica.");
    }
  }, [wordToCapture, startDynamicRecording]);

  const handleTrain = useCallback(async () => {
    const model1 = await trainLetters();
    if (model1) setStatusMessage("Modelo de letras entrenado.");
    const model2 = await trainWords();
    if (model2) setStatusMessage("Modelo de palabras entrenado.");
    const model3 = await trainDynamic();
    if (model3) setStatusMessage("Modelo dinámico entrenado.");
    fetchRegisteredLetters();
    fetchRegisteredWords();
    fetchRegisteredDynamic();
    reloadModels();
  }, [trainLetters, trainWords, trainDynamic, fetchRegisteredLetters, fetchRegisteredWords, fetchRegisteredDynamic, reloadModels]);

  const handleRemoveLetter = useCallback(async (letter: string) => {
    await removeLetter(letter);
    reloadModels();
  }, [removeLetter, reloadModels]);

  const handleRemoveWord = useCallback(async (word: string) => {
    await removeWord(word);
    reloadModels();
  }, [removeWord, reloadModels]);

  const handleRemoveDynamic = useCallback(async (sign: string) => {
    await removeDynamic(sign);
    reloadModels();
  }, [removeDynamic, reloadModels]);

  const handleSpeakPhrase = useCallback(() => {
    const textToSpeak =
      phrase || liveData.letter || liveData.word || liveData.dynamicSign;
    if (textToSpeak) speakPhrase(textToSpeak);
  }, [phrase, liveData.letter, liveData.word, liveData.dynamicSign, speakPhrase]);

  const handleSetPredictionMode = useCallback(
    (mode: string) => {
      setPredictionMode(mode);
      resetLastSpoken();
      autoAddFrameRef.current = 0;
      lastSpokenPredictionRef.current = "";
      setAutoLastResult(null);
      stopAutoCapture();
    },
    [resetLastSpoken, stopAutoCapture],
  );

  const handleStartAuto = useCallback(() => {
    if (predictionMode !== "auto") return;
    setAutoLastResult(null);
    startAutoCapture(autoDuration, autoMotionThreshold, autoInstantThreshold);
  }, [predictionMode, autoDuration, autoMotionThreshold, autoInstantThreshold, startAutoCapture]);

  useEffect(() => {
    if (predictionMode !== "auto") return;
    if (liveData.autoState !== "idle") return;
    if (!liveData.handDetected) return;
    if (!cameraOn) return;
    handleStartAuto();
  }, [
    predictionMode,
    liveData.autoState,
    liveData.handDetected,
    cameraOn,
    handleStartAuto,
  ]);

  useEffect(() => {
    if (predictionMode !== "auto") return;
    if (liveData.autoState !== "classifying") return;
    const timer = window.setTimeout(() => {
      const result = classifyAuto();
      if (result) {
        setAutoLastResult({
          isDynamic: result.isDynamic,
          motionScore: result.motionScore,
          prediction: result.prediction,
          confidence: result.confidence,
        });
      }
    }, 60);
    return () => window.clearTimeout(timer);
  }, [liveData.autoState, predictionMode, classifyAuto]);

  const letter = liveData.letter;
  const word = liveData.word;
  const dynamicSign = liveData.dynamicSign;
  const confidence = liveData.confidence;
  const wordConfidence = liveData.wordConfidence;
  const dynamicConfidence = liveData.dynamicConfidence;

  return (
    <>
      <style>{`
        .guide-overlay > div {
          animation: guideSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .guide-overlay.closing > div {
          animation: guideSlideDown 0.35s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes guideSlideUp {
          from { transform: translateY(60px); }
          to { transform: translateY(0); }
        }
        @keyframes guideSlideDown {
          from { transform: translateY(0); }
          to { transform: translateY(60px); }
        }

        .guide-btn {
          position: relative;
          transition: all 0.3s ease-in-out;
          box-shadow: 0px 10px 20px rgba(0, 0, 0, 0.2);
          padding-block: 0.5rem;
          padding-inline: 1.25rem;
          background-color: rgb(0 107 179);
          border-radius: 9999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          gap: 10px;
          font-weight: bold;
          border: 3px solid #ffffff4d;
          outline: none;
          overflow: hidden;
          font-size: 15px;
          cursor: pointer;
        }

        .guide-btn:hover {
          transform: scale(1.05);
          border-color: #fff9;
        }

        .guide-btn:hover .guide-btn-icon {
          transform: translateX(4px);
        }

        .guide-btn-icon {
          width: 24px;
          height: 24px;
          transition: all 0.3s ease-in-out;
        }

        .guide-btn::before {
          content: "";
          position: absolute;
          width: 100px;
          height: 100%;
          background-image: linear-gradient(
            120deg,
            rgba(255, 255, 255, 0) 30%,
            rgba(255, 255, 255, 0.8),
            rgba(255, 255, 255, 0) 70%
          );
          top: 0;
          left: -100px;
          opacity: 0.6;
        }

        .guide-btn:hover::before {
          animation: guideShine 1.5s ease-out infinite;
        }

        @keyframes guideShine {
          0% { left: -100px; }
          60% { left: 100%; }
          to { left: 100%; }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
      <div
            onClick={(e) => e.stopPropagation()}
            style={{
        minHeight: "100vh",
        background: "transparent",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        fontFamily: "'Segoe UI', Roboto, system-ui, sans-serif",
        color: "#ffffff",
      }}
    >
      <header
        style={{
          textAlign: "center",
          marginBottom: "2rem",
          position: "relative",
          width: "100%",
          maxWidth: "1100px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#fff" }}
          >
            <path d="M18 11V6a2 2 0 0 0-4 0v5" />
            <path d="M14 10.5V5a2 2 0 0 0-4 0v6" />
            <path d="M10 10.5V4a2 2 0 0 0-4 0v7" />
            <path d="M6 11V8a2 2 0 0 0-4 0v10a8 8 0 0 0 8 8h1a8 8 0 0 0 8-8v-3.5a2.5 2 0 0 0-5 0V11" />
            <path d="M16 11l3-3" />
            <path d="M4 11l-2-2" />
            <path d="M10 2v2" />
          </svg>
          <h1
            style={{
              fontSize: "3.5rem",
              fontWeight: 800,
              margin: 0,
              letterSpacing: "1px",
              textShadow: "0 2px 10px rgba(0,0,0,0.1)",
            }}
          >
            SIGNUM
          </h1>
        </div>
        <p style={{ fontSize: "1.1rem", opacity: 0.9, marginTop: "0.5rem" }}>
          Conecta con el mundo usando Lengua de Señas Mexicana.
        </p>
        <div
          style={{
            fontSize: "0.85rem",
            opacity: 0.8,
            marginTop: "0.5rem",
          }}
        >
          {statusMessage}
        </div>
        {captureState.isRecording && (
          <div
            style={{
              fontSize: "0.9rem",
              color: "#fbbf24",
              marginTop: "6px",
              fontWeight: 600,
              background: "rgba(0,0,0,0.4)",
              padding: "6px 12px",
              borderRadius: "20px",
              display: "inline-block",
            }}
          >
            Registrando "{captureState.label}": {captureState.samplesCount}/{captureState.requiredSamples} muestras
            {captureState.isSampleRecording && (
              <span style={{ color: "#4ade80", marginLeft: "8px" }}>
                &bull; Grabando muestra... ({captureState.currentSampleFrames} frames)
              </span>
            )}
          </div>
        )}
        {liveData.localModelReady && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "#4ade80",
              marginTop: "4px",
            }}
          >
            Modelos locales cargados &bull; Prediccion en navegador
          </div>
        )}
      </header>

      <div
        style={{
          display: "flex",
          gap: "2rem",
          maxWidth: "1100px",
          width: "100%",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            flex: "1 1 500px",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            maxWidth: "600px",
          }}
        >
          <div
            style={{
              position: "relative",
              aspectRatio: "4/3",
              borderRadius: "20px",
              overflow: "hidden",
              border: "6px solid rgba(255, 255, 255, 0.8)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
              background: "#000",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "20px",
                left: "20px",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(4px)",
                padding: "8px 16px",
                borderRadius: "50px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.9rem",
                fontWeight: 600,
                zIndex: 10,
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: cameraOn ? "#4ade80" : "#ef4444",
                }}
              ></div>
              {cameraOn ? "Camara activa (MediaPipe)" : "Camara inactiva"}
            </div>

            {cameraOn ? (
              <>
                <video
                  ref={videoRef}
                  style={{
                    position: "absolute",
                    width: "1px",
                    height: "1px",
                    opacity: 0,
                    pointerEvents: "none",
                  }}
                  autoPlay
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              </>
            ) : (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#e2e8f0",
                  background: "#000000",
                }}
              >
                Camara apagada
              </div>
            )}

            <div
              style={{
                position: "absolute",
                bottom: "20px",
                left: "0",
                right: "0",
                display: "flex",
                justifyContent: "center",
                gap: "20px",
                zIndex: 10,
              }}
            >
              <button
                onClick={toggleCamera}
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(4px)",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M0 0h24v24H0z" fill="none" />
                  <path fill="currentColor" d="M8.75 12.75a3.25 3.25 0 1 1 6.5 0a3.25 3.25 0 0 1-6.5 0" />
                  <path fill="currentColor" d="M7.882 2h8.236l1.5 3H23v16H1V5h5.382zM6.75 12.75a5.25 5.25 0 1 0 10.5 0a5.25 5.25 0 0 0-10.5 0" />
                </svg>
              </button>
              <button
                onClick={() => setIsMirrored(!isMirrored)}
                title={isMirrored ? "Desactivar efecto espejo" : "Activar efecto espejo"}
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: isMirrored ? "rgba(59, 130, 246, 0.8)" : "rgba(0,0,0,0.6)",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(4px)",
                  transition: "background-color 0.3s ease",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M0 0h24v24H0z" fill="none" />
                  <path fill="currentColor" d="M13 2v20h-2V2zM9 4.64V18.5H1.3zm6 0l7.7 13.86H15z" />
                </svg>
              </button>
              <button
                onClick={handleSpeakPhrase}
                title="Reproducir frase actual"
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.6)",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backdropFilter: "blur(4px)",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M0 0h24v24H0z" fill="none" />
                  <g fill="none">
                    <path d="m12.593 23.258l-.011.002l-.071.035l-.02.004l-.014-.004l-.071-.035q-.016-.005-.024.005l-.004.01l-.017.428l.005.02l.01.013l.104.074l.015.004l.012-.004l.104-.074l.012-.016l.004-.017l-.017-.427q-.004-.016-.017-.018m.265-.113l-.013.002l-.185.093l-.01.01l-.003.011l.018.43l.005.012l.008.007l.201.093q.019.005.029-.008l.004-.014l-.034-.614q-.005-.018-.02-.022m-.715.002a.02.02 0 0 0-.027.006l-.006.014l-.034.614q.001.018.017.024l.015-.002l.201-.093l.01-.008l.004-.011l.017-.43l-.003-.012l-.01-.01z" />
                  </g>
                  <path fill="currentColor" d="M12 2.5a1.5 1.5 0 0 1 1.493 1.356L13.5 4v16a1.5 1.5 0 0 1-2.993.144L10.5 20V4A1.5 1.5 0 0 1 12 2.5m-4 3A1.5 1.5 0 0 1 9.5 7v10a1.5 1.5 0 0 1-3 0V7A1.5 1.5 0 0 1 8 5.5m8 0A1.5 1.5 0 0 1 17.5 7v10a1.5 1.5 0 0 1-3 0V7A1.5 1.5 0 0 1 16 5.5m-12 3A1.5 1.5 0 0 1 5.5 10v4a1.5 1.5 0 0 1-3 0v-4A1.5 1.5 0 0 1 4 8.5m16 0a1.5 1.5 0 0 1 1.493 1.356L21.5 10v4a1.5 1.5 0 0 1-2.993.144L18.5 14v-4A1.5 1.5 0 0 1 20 8.5" />
                </svg>
              </button>
            </div>
          </div>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.35)",
              backdropFilter: "blur(24px) saturate(180%)",
              borderRadius: "24px",
              border: "1px solid rgba(255, 255, 255, 0.6)",
              padding: "16px 24px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              color: "#1e293b",
              fontSize: "0.95rem",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "#3b82f6",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "bold",
                fontSize: "14px",
                flexShrink: 0,
              }}
            >
              i
            </div>
            <div>
              Colocate frente a la camara con buena iluminacion.
              <br />
              Asegurate de que tus manos sean visibles.{" "}
              {ttsAvailable
                ? "Voz nativa activa."
                : "Voz nativa no disponible en este navegador."}
            </div>
          </div>
        </div>

        <div
          style={{
            flex: "1 1 350px",
            background: "rgba(255, 255, 255, 0.35)",
            backdropFilter: "blur(24px) saturate(180%)",
            borderRadius: "24px",
            padding: "32px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            color: "#0f172a",
            border: "1px solid rgba(255, 255, 255, 0.6)",
            position: "relative",
            alignSelf: "flex-start",
          }}
        >
          <div className="glass-radio-group">
            <input
              type="radio"
              name="prediction-mode"
              id="mode-letters"
              checked={predictionMode === "letters"}
              onChange={() => handleSetPredictionMode("letters")}
            />
            <label htmlFor="mode-letters">Deletrear</label>

            <input
              type="radio"
              name="prediction-mode"
              id="mode-words"
              checked={predictionMode === "words"}
              onChange={() => handleSetPredictionMode("words")}
            />
            <label htmlFor="mode-words">Palabras</label>

            <input
              type="radio"
              name="prediction-mode"
              id="mode-dynamic"
              checked={predictionMode === "dynamic"}
              onChange={() => handleSetPredictionMode("dynamic")}
            />
            <label htmlFor="mode-dynamic">Movimiento</label>

            <div className="glass-glider" />
          </div>

          {captureState.isRecording && predictionMode === "dynamic" ? (
            <div
              key={`rec-${predictionMode}`}
              className="animate-step-1"
              style={{
                background: "rgba(15, 23, 42, 0.15)",
                borderRadius: "16px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                border: "2px dashed #0f3a73",
                color: "#0f172a"
              }}
            >
              <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#0f3a73" }}>
                Grabando LSM con Movimiento
              </div>
              <div style={{ fontSize: "1rem", fontWeight: 600 }}>
                Seña: <span style={{ color: "#7c3aed" }}>"{captureState.label}"</span>
              </div>
              <div style={{ fontSize: "0.95rem" }}>
                Progreso: <strong>{captureState.samplesCount} / {captureState.requiredSamples}</strong> muestras
              </div>

              <div
                style={{
                  width: "100%",
                  height: "8px",
                  background: "rgba(15, 58, 115, 0.15)",
                  borderRadius: "50px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(captureState.samplesCount / captureState.requiredSamples) * 100}%`,
                    height: "100%",
                    background: "#7c3aed",
                    borderRadius: "50px",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              {captureState.isSampleRecording ? (
                <div
                  style={{
                    width: "100%",
                    padding: "18px",
                    borderRadius: "12px",
                    background: "#ef4444",
                    color: "#fff",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    boxShadow: "0 4px 14px rgba(239, 68, 68, 0.3)",
                    fontSize: "1rem",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#fff",
                      animation: "pulse 1s ease-in-out infinite",
                    }}
                  />
                  Grabando muestra {captureState.samplesCount + 1}... ({captureState.currentSampleFrames || 0} frames)
                </div>
              ) : (
                <div
                  style={{
                    width: "100%",
                    padding: "18px",
                    borderRadius: "12px",
                    background: "rgba(124, 58, 237, 0.1)",
                    color: "#7c3aed",
                    fontWeight: 700,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "12px",
                    border: "1px solid rgba(124, 58, 237, 0.3)",
                    fontSize: "1rem",
                  }}
                >
                  {autoCountdown > 0 ? (
                    <>
                      <span>Preparate...</span>
                      <span
                        style={{
                          fontSize: "2rem",
                          fontWeight: 800,
                          minWidth: "32px",
                          textAlign: "center",
                        }}
                      >
                        {autoCountdown}
                      </span>
                    </>
                  ) : (
                    <span>Iniciando...</span>
                  )}
                </div>
              )}

              <button
                onClick={stopRecording}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "transparent",
                  color: "#ef4444",
                  border: "1px solid #ef4444",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  marginTop: "4px",
                  fontWeight: 600
                }}
              >
                Cancelar Grabación
              </button>
            </div>
          ) : (
            <>
              {/* Letters input - show in letters or dynamic mode */}
              {(predictionMode === "letters" || predictionMode === "dynamic") && (
                <div
                  key={`letters-${predictionMode}`}
                  className="animate-step-1"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    {predictionMode === "dynamic" ? "Letra a registrar con movimiento:" : "Letra a registrar:"}
                  </label>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <input
                      type="text"
                      value={letterToCapture}
                      onChange={(e) => {
                        setLetterToCapture(
                          e.target.value.toUpperCase().slice(0, 1),
                        );
                        setWordToCapture("");
                        setDynamicToCapture("");
                      }}
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "12px",
                        border: "none",
                        background: "#fff",
                        fontSize: "2rem",
                        fontWeight: 800,
                        textAlign: "center",
                        outline: "none",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                        color: "#0f172a"
                      }}
                    />
                    <button
                      onClick={predictionMode === "dynamic" ? startDynamicLetterCapture : startLetterCapture}
                      disabled={
                        captureState.isRecording || !letterToCapture || !cameraOn
                      }
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "12px",
                        border: "none",
                        background: "#0f3a73",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        opacity: (captureState.isRecording || !letterToCapture || !cameraOn) ? 0.5 : 1
                      }}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 12l3 3 5-5" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Words input - show in words or dynamic mode */}
              {(predictionMode === "words" || predictionMode === "dynamic") && (
                <div
                  key={`words-${predictionMode}`}
                  className={predictionMode === "dynamic" ? "animate-step-2" : "animate-step-1"}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                    {predictionMode === "dynamic" ? "Palabra a registrar con movimiento:" : "Palabra a registrar:"}
                  </label>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <input
                      type="text"
                      value={wordToCapture}
                      onChange={(e) => {
                        setWordToCapture(e.target.value.slice(0, 30));
                        setLetterToCapture("");
                        setDynamicToCapture("");
                      }}
                      placeholder="Ej. Amor, Hola, Gracias..."
                      style={{
                        flexGrow: 1,
                        padding: "16px",
                        borderRadius: "12px",
                        border: "none",
                        background: "#fff",
                        fontSize: "1.1rem",
                        outline: "none",
                        color: "#0f172a"
                      }}
                    />
                    <button
                      onClick={predictionMode === "dynamic" ? startDynamicWordCapture : startWordCapture}
                      disabled={
                        captureState.isRecording || !wordToCapture || !cameraOn
                      }
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: "12px",
                        border: "none",
                        background: "#0f3a73",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        opacity: (captureState.isRecording || !wordToCapture || !cameraOn) ? 0.5 : 1
                      }}
                    >
                      <svg
                        width="32"
                        height="32"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 12l3 3 5-5" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <div
            key={`transcripcion-${predictionMode}`}
            className={predictionMode === "dynamic" ? "animate-step-3" : "animate-step-2"}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              flexGrow: 1,
            }}
          >
            <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>
              Transcripcion:
            </label>
            <div
              style={{
                width: "100%",
                minHeight: "150px",
                padding: "20px",
                borderRadius: "16px",
                background: "#fff",
                fontSize: "1.2rem",
                color: phrase ? "#0f172a" : "#94a3b8",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ flexGrow: 1, wordBreak: "break-word" }}>
                {phrase || "La transcripcion aparecera aqui..."}
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginTop: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid #f1f5f9",
                  flexWrap: "wrap",
                  gap: "10px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.9rem",
                    color: "#64748b",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    flex: 1,
                    minWidth: 0,
                    marginRight: "10px"
                  }}
                >
                {letter && (
                  <span style={{ marginRight: "12px", color: "#3b82f6", fontWeight: 700 }}>
                    {letter} <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>({confidence}%)</span>
                  </span>
                )}
                {word && (
                  <span style={{ marginRight: "12px", color: "#f97316", fontWeight: 700 }}>
                    {word} <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>({wordConfidence}%)</span>
                  </span>
                )}
                {dynamicSign && (
                  <span style={{ marginRight: "12px", color: "#a855f7", fontWeight: 700 }}>
                    {dynamicSign} <span style={{ fontSize: "0.75rem", fontWeight: 400 }}>({dynamicConfidence}%)</span>
                  </span>
                )}
                {!letter && !word && !dynamicSign && (
                  <span style={{ color: "#94a3b8", fontWeight: 600 }}>—</span>
                )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
                    flexShrink: 0
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      marginRight: "10px",
                      cursor: "pointer",
                    }}
                  >
                    <Checkbox
                      checked={autoAddActive}
                      onChange={(e) => setAutoAddActive(e.target.checked)}
                    />
                    Auto-Anadir
                  </label>
                  <label
                    style={{
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      marginRight: "10px",
                      cursor: "pointer",
                    }}
                  >
                    <Checkbox
                      checked={soundOnSeña}
                      onChange={(e) => setSoundOnSeña(e.target.checked)}
                    />
                    Voz al detectar
                  </label>
                  <button
                    onClick={addSpace}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    _
                  </button>
                  <button
                    onClick={() => {
                    // Use the highest-confidence active prediction
                    let toAdd = "";
                    let addConfidence = 0;
                    if (letter && confidence >= 55) {
                      toAdd = letter;
                      addConfidence = confidence;
                    }
                    if (word && wordConfidence >= 30 && wordConfidence > addConfidence) {
                      toAdd = word;
                      addConfidence = wordConfidence;
                    }
                    if (dynamicSign && dynamicConfidence >= 30 && dynamicConfidence > addConfidence) {
                      toAdd = dynamicSign;
                    }
                    addLetter(toAdd);
                    if (toAdd) speak(toAdd.trim());
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#0f3a73",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    +
                  </button>
                  <button
                    onClick={backspace}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0",
                      background: "#f8fafc",
                      cursor: "pointer",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                    }}
                  >
                    &#9003;
                  </button>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleTrain}
            disabled={isTraining || isTrainingWords || isTrainingDynamic}
            style={{
              width: "100%",
              padding: "16px",
              borderRadius: "50px",
              border: "none",
              background: "#0f3a73",
              color: "#fff",
              fontSize: "1.1rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(15, 58, 115, 0.3)",
              marginTop: "10px",
            }}
          >
            Entrenar modelo
          </button>
          {(trainingMessage || trainingWordsMessage || trainingDynamicMessage) && (
            <div
              style={{
                fontSize: "0.85rem",
                color: "#fff",
                textAlign: "center",
                background: "rgba(0,0,0,0.3)",
                padding: "8px 16px",
                borderRadius: "8px",
              }}
            >
              {trainingMessage || trainingWordsMessage || trainingDynamicMessage}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <button
          onClick={() => setIsGuideOpen(true)}
          className="guide-btn"
        >
          Guia de Señas
          <svg className="guide-btn-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm4.28 10.28a.75.75 0 000-1.06l-3-3a.75.75 0 10-1.06 1.06l1.72 1.72H8.25a.75.75 0 000 1.5h5.69l-1.72 1.72a.75.75 0 101.06 1.06l3-3z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {(isGuideOpen || guideClosing) && (
        <div
          onClick={handleCloseGuide}
          className={guideClosing ? "guide-overlay closing" : "guide-overlay"}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(8px)",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(255, 255, 255, 0.35)",
              backdropFilter: "blur(24px) saturate(180%)",
              borderRadius: "24px",
              border: "1px solid rgba(255, 255, 255, 0.6)",
              padding: "32px",
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              color: "#0f172a",
              boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            }}
          >
            <button
              onClick={handleCloseGuide}
              title="Cerrar guia"
              style={{
                position: "absolute",
                top: "24px",
                right: "24px",
                background: "#0f3a73",
                border: "none",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                cursor: "pointer",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(15, 58, 115, 0.3)",
                transition: "transform 0.2s ease",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#0f3a73",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, letterSpacing: "0.5px" }}>
                  Guia de Señas
                </h2>
                <p style={{ fontSize: "0.9rem", color: "#475569", margin: "4px 0 0 0" }}>
                  Señas registradas en cada categoria
                </p>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.5)",
                  borderRadius: "16px",
                  padding: "20px",
                  border: "1px solid rgba(255, 255, 255, 0.6)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#3b82f6",
                      boxShadow: "0 0 8px rgba(59, 130, 246, 0.6)",
                    }}
                  />
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                    Letras
                  </h3>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "#3b82f6",
                      background: "rgba(59, 130, 246, 0.12)",
                      padding: "2px 10px",
                      borderRadius: "50px",
                    }}
                  >
                    {registeredLetters.length}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {registeredLetters.map((l) => (
                    <div
                      key={l}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 6px 6px 14px",
                        background: "#fff",
                        borderRadius: "50px",
                        border: "1px solid rgba(59, 130, 246, 0.3)",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <span style={{ fontWeight: 800, color: "#0f172a", fontSize: "1rem" }}>{l}</span>
                      <button
                        onClick={() => handleRemoveLetter(l)}
                        title="Eliminar seña"
                        style={{
                          border: "none",
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "#ef4444",
                          cursor: "pointer",
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          transition: "background 0.2s ease",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {registeredLetters.length === 0 && (
                    <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                      Ninguna letra registrada.
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.5)",
                  borderRadius: "16px",
                  padding: "20px",
                  border: "1px solid rgba(255, 255, 255, 0.6)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#f97316",
                      boxShadow: "0 0 8px rgba(249, 115, 22, 0.6)",
                    }}
                  />
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                    Palabras
                  </h3>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "#f97316",
                      background: "rgba(249, 115, 22, 0.12)",
                      padding: "2px 10px",
                      borderRadius: "50px",
                    }}
                  >
                    {registeredWords.length}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {registeredWords.map((w) => (
                    <div
                      key={w}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 6px 6px 14px",
                        background: "#fed7aa",
                        borderRadius: "50px",
                        border: "1px solid rgba(249, 115, 22, 0.4)",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <span style={{ color: "#9a3412", fontWeight: 700 }}>{w}</span>
                      <button
                        onClick={() => removeWord(w)}
                        title="Eliminar seña"
                        style={{
                          border: "none",
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "#ef4444",
                          cursor: "pointer",
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          transition: "background 0.2s ease",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {registeredWords.length === 0 && (
                    <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                      Ninguna palabra registrada.
                    </span>
                  )}
                </div>
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.5)",
                  borderRadius: "16px",
                  padding: "20px",
                  border: "1px solid rgba(255, 255, 255, 0.6)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: "#a855f7",
                      boxShadow: "0 0 8px rgba(168, 85, 247, 0.6)",
                    }}
                  />
                  <h3 style={{ fontSize: "1.3rem", fontWeight: 800, margin: 0, color: "#0f172a" }}>
                    Señas con Movimiento
                  </h3>
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: "#a855f7",
                      background: "rgba(168, 85, 247, 0.12)",
                      padding: "2px 10px",
                      borderRadius: "50px",
                    }}
                  >
                    {registeredDynamic.length}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {registeredDynamic.map((w) => (
                    <div
                      key={w}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 6px 6px 14px",
                        background: "#d8b4fe",
                        borderRadius: "50px",
                        border: "1px solid rgba(168, 85, 247, 0.4)",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
                      }}
                    >
                      <span style={{ color: "#581c87", fontWeight: 700 }}>{w}</span>
                      <button
                        onClick={() => removeDynamic(w)}
                        title="Eliminar seña"
                        style={{
                          border: "none",
                          background: "rgba(239, 68, 68, 0.1)",
                          color: "#ef4444",
                          cursor: "pointer",
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.9rem",
                          fontWeight: 700,
                          transition: "background 0.2s ease",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {registeredDynamic.length === 0 && (
                    <span style={{ color: "#94a3b8", fontSize: "0.9rem" }}>
                      Ninguna seña dinámica registrada.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
