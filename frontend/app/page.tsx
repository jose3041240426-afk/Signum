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
  const [predictionMode, setPredictionMode] = useState("letters");
  const {
    letterToCapture,
    setLetterToCapture,
    wordToCapture,
    setWordToCapture,
    captureState,
    registeredLetters,
    registeredWords,
    fetchRegisteredLetters,
    fetchRegisteredWords,
    startLetterRecording,
    startWordRecording,
    stopRecording,
    removeLetter,
    removeWord,
    captureActiveRef,
  } = useCapture();

  const {
    data: liveData,
    cameraOn,
    toggleCamera,
    videoRef,
    canvasRef,
    reloadModels,
  } = useLivePrediction(predictionMode, captureActiveRef);

  const {
    isTraining,
    trainingMessage,
    trainLetters,
    isTrainingWords,
    trainingWordsMessage,
    trainWords,
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
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const autoAddFrameRef = useRef(0);
  const prevCaptureDoneRef = useRef(false);
  const lastSpokenPredictionRef = useRef("");
  const [soundOnSeña, setSoundOnSeña] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true);

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
  }, [fetchRegisteredLetters, fetchRegisteredWords]);

  useEffect(() => {
    if (prevCaptureDoneRef.current && captureState.status === "done") return;
    if (captureState.status === "done" && !prevCaptureDoneRef.current) {
      prevCaptureDoneRef.current = true;
      const isLetter = captureState.label.length === 1;
      setStatusMessage(
        `${isLetter ? "Letra" : "Palabra"} '${captureState.label}' registrada (${
          captureState.samplesCount || captureState.requiredSamples
        } muestras)`,
      );
      if (isLetter) fetchRegisteredLetters();
      else fetchRegisteredWords();
    }
    if (captureState.status !== "done") {
      prevCaptureDoneRef.current = false;
    }
  }, [captureState.status, captureState.label, captureState.samplesCount, captureState.requiredSamples, fetchRegisteredLetters, fetchRegisteredWords]);

  useEffect(() => {
    if (!soundOnSeña || !liveData.handDetected) return;

    const currentPrediction =
      predictionMode === "letters"
        ? liveData.letter
        : predictionMode === "words"
          ? liveData.word
          : liveData.dynamicSign;

    if (!currentPrediction) return;

    const conf =
      predictionMode === "letters"
        ? liveData.confidence
        : predictionMode === "words"
          ? liveData.wordConfidence
          : liveData.dynamicConfidence;

    const threshold = predictionMode === "letters" ? 55 : 30;
    if (conf < threshold) return;

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

    const currentPrediction =
      predictionMode === "letters"
        ? liveData.letter
        : predictionMode === "words"
          ? liveData.word
          : liveData.dynamicSign;

    if (autoAddActive && currentPrediction) {
      autoAddFrameRef.current += 1;
      if (autoAddFrameRef.current > 6) {
        const conf =
          predictionMode === "letters"
            ? liveData.confidence
            : predictionMode === "words"
              ? liveData.wordConfidence
              : liveData.dynamicConfidence;
        const threshold = predictionMode === "letters" ? 55 : 30;
        if (conf > threshold) {
          addLetter(
            currentPrediction + (predictionMode === "words" ? " " : ""),
          );
          autoAddFrameRef.current = 0;
        }
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

  const handleTrain = useCallback(async () => {
    const model1 = await trainLetters();
    if (model1) setStatusMessage("Modelo de letras entrenado.");
    const model2 = await trainWords();
    if (model2) setStatusMessage("Modelo de palabras entrenado.");
    fetchRegisteredLetters();
    fetchRegisteredWords();
    reloadModels();
  }, [trainLetters, trainWords, fetchRegisteredLetters, fetchRegisteredWords, reloadModels]);

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
    },
    [resetLastSpoken],
  );

  const letter = liveData.letter;
  const word = liveData.word;
  const dynamicSign = liveData.dynamicSign;
  const confidence = liveData.confidence;
  const wordConfidence = liveData.wordConfidence;
  const dynamicConfidence = liveData.dynamicConfidence;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(to bottom, #0a2540, #4a90e2)",
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
          Conecta con el mundo usando Lengua de Senas Mexicana.
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
              fontSize: "0.85rem",
              color: "#fbbf24",
              marginTop: "4px",
            }}
          >
            Registrando "{captureState.label}":{" "}
            {captureState.samplesCount}/{captureState.requiredSamples} muestras
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
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: isMirrored ? "none" : "scaleX(-1)",
                    transition: "transform 0.3s ease",
                  }}
                />
              </>
            ) : (
              <div
                style={{
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
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
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
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="4 4" />
                  <polyline points="2 8 8 12 2 16" />
                  <polyline points="22 8 16 12 22 16" />
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
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
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
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0",
              background: "rgba(15, 23, 42, 0.15)",
              borderRadius: "14px",
              padding: "4px",
            }}
          >
            <button
              onClick={() => handleSetPredictionMode("letters")}
              style={{
                flex: 1,
                padding: "10px 16px",
                border: "none",
                borderRadius: "10px",
                background:
                  predictionMode === "letters" ? "#065f46" : "transparent",
                color: predictionMode === "letters" ? "#fff" : "#475569",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 700,
                transition: "all 0.2s",
              }}
            >
              Deletrear
            </button>
            <button
              onClick={() => handleSetPredictionMode("words")}
              style={{
                flex: 1,
                padding: "10px 16px",
                border: "none",
                borderRadius: "10px",
                background:
                  predictionMode === "words" ? "#065f46" : "transparent",
                color: predictionMode === "words" ? "#fff" : "#475569",
                cursor: "pointer",
                fontSize: "0.95rem",
                fontWeight: 700,
                transition: "all 0.2s",
              }}
            >
              Palabras
            </button>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>
              Letra a registrar:
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
                }}
              />
              <button
                onClick={startLetterCapture}
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

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>
              Palabra a registrar:
            </label>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                type="text"
                value={wordToCapture}
                onChange={(e) => {
                  setWordToCapture(e.target.value.slice(0, 30));
                  setLetterToCapture("");
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
                }}
              />
              <button
                onClick={startWordCapture}
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

          <div
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
                }}
              >
                <div
                  style={{
                    fontSize: "0.9rem",
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  Detectando:{" "}
                  <span
                    style={{
                      color:
                        predictionMode === "words" ? "#f97316" : "#3b82f6",
                      fontWeight: 800,
                    }}
                  >
                    {predictionMode === "words"
                      ? word || "-"
                      : letter || "-"}
                  </span>
                  {predictionMode === "letters" && letter && (
                    <span
                      style={{
                        marginLeft: "8px",
                        color: confidence > 55 ? "#4ade80" : "#ef4444",
                      }}
                    >
                      ({confidence}%)
                    </span>
                  )}
                  {predictionMode === "words" && word && (
                    <span
                      style={{
                        marginLeft: "8px",
                        color: wordConfidence > 30 ? "#4ade80" : "#ef4444",
                      }}
                    >
                      ({wordConfidence}%)
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    alignItems: "center",
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
                      const toAdd = predictionMode === "words"
                        ? word || ""
                        : letter || "";
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
            disabled={isTraining || isTrainingWords}
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
          {(trainingMessage || trainingWordsMessage) && (
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
              {trainingMessage || trainingWordsMessage}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "2rem", textAlign: "center" }}>
        <button
          onClick={() => setIsGuideOpen(true)}
          style={{
            padding: "10px 24px",
            borderRadius: "50px",
            border: "2px solid rgba(255,255,255,0.5)",
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          Guia de Senas
        </button>
      </div>

      {isGuideOpen && (
        <div
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
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              borderRadius: "24px",
              padding: "32px",
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative",
              color: "#000",
            }}
          >
            <button
              onClick={() => setIsGuideOpen(false)}
              style={{
                position: "absolute",
                top: "24px",
                right: "24px",
                background: "#0f3a73",
                border: "none",
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                cursor: "pointer",
                color: "#fff",
              }}
            >
              X
            </button>
            <h2
              style={{
                fontSize: "2rem",
                fontWeight: 800,
                marginBottom: "8px",
              }}
            >
              Guia de Senas
            </h2>
            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: 800,
                marginTop: "20px",
              }}
            >
              Letras ({registeredLetters.length})
            </h3>
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "10px",
              }}
            >
              {registeredLetters.map((l) => (
                <span
                  key={l}
                  style={{
                    padding: "8px 16px",
                    background: "#e2e8f0",
                    borderRadius: "8px",
                    fontWeight: "bold",
                  }}
                >
                  {l}
                </span>
              ))}
              {registeredLetters.length === 0 && (
                <span style={{ color: "#94a3b8" }}>
                  Ninguna letra registrada.
                </span>
              )}
            </div>
            <h3
              style={{
                fontSize: "1.3rem",
                fontWeight: 800,
                marginTop: "20px",
              }}
            >
              Palabras ({registeredWords.length})
            </h3>
            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "10px",
              }}
            >
              {registeredWords.map((w) => (
                <span
                  key={w}
                  style={{
                    padding: "8px 16px",
                    background: "#fed7aa",
                    color: "#9a3412",
                    borderRadius: "8px",
                    fontWeight: "bold",
                  }}
                >
                  {w}
                </span>
              ))}
              {registeredWords.length === 0 && (
                <span style={{ color: "#94a3b8" }}>
                  Ninguna palabra registrada.
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
