"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Checkbox from "@/components/ui/checkbox";
import { useBackend } from "@/hooks/use-backend";
import { useLivePrediction } from "@/hooks/use-live-prediction";
import { usePrediction } from "@/hooks/use-prediction";
import { useCapture } from "@/hooks/use-capture";
import { useModelTraining } from "@/hooks/use-model-training";
import { useTTS } from "@/hooks/use-tts";
import { usePhraseBuilder } from "@/hooks/use-phrase-builder";
import { isNativeTTSAvailable } from "@/services/tts.service";
import { fetchJson } from "@/services/api-client";
import { ENV } from "@/lib/env";

const BACKEND = ENV.BACKEND_URL;

export default function Home() {
  const { status: backendStatus, modelLoaded, message: backendMessage, setMessage: setBackendMessage } = useBackend();
  const [predictionMode, setPredictionMode] = useState("letters");
  const { data: liveData, cameraOn, toggleCamera, videoRef, canvasRef } = useLivePrediction(predictionMode);
  const { data: serverData } = usePrediction(backendStatus);

  const prediction = backendStatus === "online" || liveData.localModelReady
    ? {
        letter: liveData.letter || serverData.letter,
        confidence: liveData.confidence || serverData.confidence,
        handDetected: liveData.handDetected || serverData.handDetected,
        modelLoaded: modelLoaded || liveData.localModelReady || serverData.modelLoaded,
        isRecording: serverData.isRecording,
        recordingLetter: serverData.recordingLetter,
        recordedSamplesCount: serverData.recordedSamplesCount,
        predictionMode: predictionMode as "letters" | "words" | "dynamic",
        word: liveData.word || serverData.word,
        wordConfidence: liveData.wordConfidence || serverData.wordConfidence,
        isRecordingWord: serverData.isRecordingWord,
        recordingWordName: serverData.recordingWordName,
        wordRecordedSamplesCount: serverData.wordRecordedSamplesCount,
        wordModelLoaded: serverData.wordModelLoaded,
        dynamicSign: liveData.dynamicSign || serverData.dynamicSign,
        dynamicConfidence: liveData.dynamicConfidence || serverData.dynamicConfidence,
        isRecordingDynamic: serverData.isRecordingDynamic,
        recordingDynamicName: serverData.recordingDynamicName,
        dynamicRecordedFrames: serverData.dynamicRecordedFrames,
        dynamicSequencesSaved: serverData.dynamicSequencesSaved,
        dynamicBufferLen: serverData.dynamicBufferLen,
        dynamicModelLoaded: serverData.dynamicModelLoaded,
      }
    : {
        letter: "",
        confidence: 0,
        handDetected: false,
        modelLoaded: false,
        isRecording: false,
        recordingLetter: "",
        recordedSamplesCount: 0,
        predictionMode: predictionMode as "letters" | "words" | "dynamic",
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

  const [statusMessage, setStatusMessage] = useState("Conectando...");
  const [letterToCapture, setLetterToCapture] = useState("");
  const [wordToCapture, setWordToCapture] = useState("");

  const { isTraining, trainingMessage, trainLetters, isTrainingWords, trainingWordsMessage, trainWords } = useModelTraining();
  const { fetchRegisteredLetters, fetchRegisteredWords, startLetterRecording, startWordRecording, stopWordRecording, registeredLetters, registeredWords } = useCapture();
  const { phrase, setPhrase, autoAddActive, setAutoAddActive, addLetter, addSpace, backspace, clear, tryAutoAdd, resetStableCount } = usePhraseBuilder();
  const { speakPhrase, resetLastSpoken } = useTTS();

  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const prevIsRecordingRef = useRef(false);
  const prevIsRecordingWordRef = useRef(false);
  const autoAddFrameRef = useRef(0);

  useEffect(() => {
    setTtsAvailable(isNativeTTSAvailable());
  }, []);

  useEffect(() => {
    if (liveData.localModelReady) {
      setStatusMessage("Prediccion local activa - Modelos cargados en el navegador");
    } else if (backendStatus === "online") {
      if (modelLoaded) {
        setStatusMessage("Servidor en linea - Haz senas LSM");
      } else {
        setStatusMessage("Modelo no encontrado. Entrena tu modelo.");
      }
    } else {
      setStatusMessage("Sin conexion. Ejecuta el backend en tu computadora.");
    }
  }, [backendStatus, modelLoaded, liveData.localModelReady]);

  useEffect(() => {
    if (!prediction.handDetected) return;

    const currentPrediction = predictionMode === "letters" ? prediction.letter
      : predictionMode === "words" ? prediction.word
      : prediction.dynamicSign;

    if (autoAddActive && currentPrediction) {
      autoAddFrameRef.current += 1;
      if (autoAddFrameRef.current > 6) {
        const conf = predictionMode === "letters" ? prediction.confidence : predictionMode === "words" ? prediction.wordConfidence : prediction.dynamicConfidence;
        const threshold = predictionMode === "letters" ? 55 : 30;
        if (conf > threshold) {
          addLetter(currentPrediction + (predictionMode === "words" ? " " : ""));
          autoAddFrameRef.current = 0;
        }
      }
    }
  }, [prediction.letter, prediction.word, prediction.dynamicSign, prediction.handDetected, prediction.confidence, prediction.wordConfidence, prediction.dynamicConfidence, predictionMode, autoAddActive, addLetter]);

  useEffect(() => {
    if (prevIsRecordingRef.current && !prediction.isRecording && prediction.recordedSamplesCount >= 50) {
      setStatusMessage(`Letra '${prediction.recordingLetter}' grabada correctamente.`);
      fetchRegisteredLetters();
    }
    if (prevIsRecordingWordRef.current && !prediction.isRecordingWord && prediction.wordRecordedSamplesCount > 0) {
      setStatusMessage(`Palabra '${prediction.recordingWordName}' grabada correctamente.`);
      fetchRegisteredWords();
    }
    prevIsRecordingRef.current = prediction.isRecording;
    prevIsRecordingWordRef.current = prediction.isRecordingWord;
  }, [prediction.isRecording, prediction.isRecordingWord, prediction.recordedSamplesCount, prediction.wordRecordedSamplesCount, prediction.recordingLetter, prediction.recordingWordName, fetchRegisteredLetters, fetchRegisteredWords]);

  const startLetterCapture = useCallback(async () => {
    if (!letterToCapture) return;
    try {
      await startLetterRecording(letterToCapture);
      setStatusMessage(`Grabando letra '${letterToCapture}'...`);
    } catch {
      setStatusMessage("Error al iniciar grabacion.");
    }
  }, [letterToCapture, startLetterRecording]);

  const startWordCapture = useCallback(async () => {
    if (!wordToCapture) return;
    try {
      await startWordRecording(wordToCapture);
      setStatusMessage(`Grabando palabra '${wordToCapture}'...`);
    } catch {
      setStatusMessage("Error al iniciar grabacion de palabra.");
    }
  }, [wordToCapture, startWordRecording]);

  const handleTrain = useCallback(async () => {
    const ok1 = await trainLetters();
    if (ok1) setStatusMessage("Modelo de letras entrenado.");
    const ok2 = await trainWords();
    if (ok2) setStatusMessage("Modelo de palabras entrenado.");
    fetchRegisteredLetters();
    fetchRegisteredWords();
  }, [trainLetters, trainWords, fetchRegisteredLetters, fetchRegisteredWords]);

  const handleSpeakPhrase = useCallback(() => {
    const textToSpeak = phrase || prediction.letter || prediction.word || prediction.dynamicSign;
    if (textToSpeak) speakPhrase(textToSpeak);
  }, [phrase, prediction.letter, prediction.word, prediction.dynamicSign, speakPhrase]);

  const handleSetPredictionMode = useCallback(async (mode: string) => {
    setPredictionMode(mode);
    resetLastSpoken();
    autoAddFrameRef.current = 0;
    try {
      await fetchJson<{ msg: string; mode: string }>(`/prediction_mode?mode=${encodeURIComponent(mode)}`, { method: "POST" });
    } catch {}
  }, [resetLastSpoken]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #0a2540, #4a90e2)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "2rem",
      fontFamily: "'Segoe UI', Roboto, system-ui, sans-serif",
      color: "#ffffff",
    }}>
      <header style={{ textAlign: "center", marginBottom: "2rem", position: "relative", width: "100%", maxWidth: "1100px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#fff" }}>
            <path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10.5V5a2 2 0 0 0-4 0v6"/><path d="M10 10.5V4a2 2 0 0 0-4 0v7"/><path d="M6 11V8a2 2 0 0 0-4 0v10a8 8 0 0 0 8 8h1a8 8 0 0 0 8-8v-3.5a2.5 2.5 0 0 0-5 0V11"/><path d="M16 11l3-3"/><path d="M4 11l-2-2"/><path d="M10 2v2"/>
          </svg>
          <h1 style={{ fontSize: "3.5rem", fontWeight: 800, margin: 0, letterSpacing: "1px", textShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>SIGNUM</h1>
        </div>
        <p style={{ fontSize: "1.1rem", opacity: 0.9, marginTop: "0.5rem" }}>
          Conecta con el mundo usando Lengua de Senas Mexicana.
        </p>
        <div style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: "0.5rem" }}>{statusMessage}</div>
        {liveData.wsConnected && <div style={{ fontSize: "0.75rem", color: "#4ade80", marginTop: "4px" }}>WebSocket conectado &bull; Backend en linea</div>}
        {liveData.localModelReady && <div style={{ fontSize: "0.75rem", color: "#4ade80", marginTop: "4px" }}>Modelos locales cargados &bull; Prediccion en navegador</div>}
      </header>

      <div style={{ display: "flex", gap: "2rem", maxWidth: "1100px", width: "100%", flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ flex: "1 1 500px", display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "600px" }}>
          <div style={{
            position: "relative",
            aspectRatio: "4/3",
            borderRadius: "20px",
            overflow: "hidden",
            border: "6px solid rgba(255, 255, 255, 0.8)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            background: "#000"
          }}>
            <div style={{
              position: "absolute", top: "20px", left: "20px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
              padding: "8px 16px", borderRadius: "50px", display: "flex", alignItems: "center", gap: "8px",
              fontSize: "0.9rem", fontWeight: 600, zIndex: 10
            }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: cameraOn ? "#4ade80" : "#ef4444" }}></div>
              {cameraOn ? "Camara activa (MediaPipe)" : "Camara inactiva"}
            </div>

            {cameraOn ? (
              <>
                <video ref={videoRef} style={{ display: "none" }} playsInline muted />
                <canvas ref={canvasRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </>
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e8f0", background: "#000000" }}>
                Camara apagada
              </div>
            )}

            <div style={{
              position: "absolute", bottom: "20px", left: "0", right: "0",
              display: "flex", justifyContent: "center", gap: "20px", zIndex: 10
            }}>
              <button
                onClick={toggleCamera}
                style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>
              <button
                onClick={handleSpeakPhrase}
                title="Reproducir frase actual"
                style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
            </div>
          </div>

          <div style={{
            background: "rgba(255, 255, 255, 0.35)",
            backdropFilter: "blur(24px) saturate(180%)",
            borderRadius: "24px",
            border: "1px solid rgba(255, 255, 255, 0.6)",
            padding: "16px 24px",
            display: "flex", alignItems: "center", gap: "16px", color: "#1e293b", fontSize: "0.95rem"
          }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#3b82f6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px", flexShrink: 0 }}>i</div>
            <div>
              Colocate frente a la camara con buena iluminacion.<br/>
              Asegurate de que tus manos sean visibles. {ttsAvailable ? "Voz nativa activa." : "Voz nativa no disponible en este navegador."}
            </div>
          </div>
        </div>

        <div style={{
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
          position: "relative"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", background: "rgba(15, 23, 42, 0.15)", borderRadius: "14px", padding: "4px" }}>
            <button onClick={() => handleSetPredictionMode("letters")} style={{ flex: 1, padding: "10px 16px", border: "none", borderRadius: "10px", background: predictionMode === "letters" ? "#065f46" : "transparent", color: predictionMode === "letters" ? "#fff" : "#475569", cursor: "pointer", fontSize: "0.95rem", fontWeight: 700, transition: "all 0.2s" }}>
              Deletrear
            </button>
            <button onClick={() => handleSetPredictionMode("words")} style={{ flex: 1, padding: "10px 16px", border: "none", borderRadius: "10px", background: predictionMode === "words" ? "#065f46" : "transparent", color: predictionMode === "words" ? "#fff" : "#475569", cursor: "pointer", fontSize: "0.95rem", fontWeight: 700, transition: "all 0.2s" }}>
              Palabras
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>Letra a registrar:</label>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                type="text"
                value={letterToCapture}
                onChange={(e) => { setLetterToCapture(e.target.value.toUpperCase().slice(0, 1)); setWordToCapture(""); }}
                style={{ width: "60px", height: "60px", borderRadius: "12px", border: "none", background: "#fff", fontSize: "2rem", fontWeight: 800, textAlign: "center", outline: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
              />
              <button onClick={startLetterCapture} disabled={prediction.isRecording || !letterToCapture} style={{ width: "60px", height: "60px", borderRadius: "12px", border: "none", background: "#0f3a73", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>Palabra a registrar:</label>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                type="text"
                value={wordToCapture}
                onChange={(e) => { setWordToCapture(e.target.value.slice(0, 30)); setLetterToCapture(""); }}
                placeholder="Ej. Amor, Hola, Gracias..."
                style={{ flexGrow: 1, padding: "16px", borderRadius: "12px", border: "none", background: "#fff", fontSize: "1.1rem", outline: "none" }}
              />
              <button onClick={startWordCapture} disabled={prediction.isRecordingWord || !wordToCapture} style={{ width: "60px", height: "60px", borderRadius: "12px", border: "none", background: "#0f3a73", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", flexGrow: 1 }}>
            <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>Transcripcion:</label>
            <div style={{
              width: "100%", minHeight: "150px", padding: "20px", borderRadius: "16px", background: "#fff",
              fontSize: "1.2rem", color: phrase ? "#0f172a" : "#94a3b8", display: "flex", flexDirection: "column"
            }}>
              <div style={{ flexGrow: 1, wordBreak: "break-word" }}>
                {phrase || "La transcripcion aparecera aqui..."}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: 600 }}>
                  Detectando: <span style={{ color: predictionMode === "words" ? "#f97316" : "#3b82f6", fontWeight: 800 }}>
                    {predictionMode === "words" ? (prediction.word || "-") : (prediction.letter || "-")}
                  </span>
                  {predictionMode === "letters" && prediction.letter && <span style={{ marginLeft: "8px", color: prediction.confidence > 55 ? "#4ade80" : "#ef4444" }}>({prediction.confidence}%)</span>}
                  {predictionMode === "words" && prediction.word && <span style={{ marginLeft: "8px", color: prediction.wordConfidence > 30 ? "#4ade80" : "#ef4444" }}>({prediction.wordConfidence}%)</span>}
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px", marginRight: "10px", cursor: "pointer" }}>
                    <Checkbox checked={autoAddActive} onChange={(e) => setAutoAddActive(e.target.checked)} />
                    Auto-Anadir
                  </label>
                  <button onClick={addSpace} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>_</button>
                  <button onClick={() => addLetter(predictionMode === "words" ? (prediction.word || "") : (prediction.letter || ""))} style={{ padding: "6px 10px", borderRadius: "8px", border: "none", background: "#0f3a73", color: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>+</button>
                  <button onClick={backspace} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>&#9003;</button>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleTrain}
            disabled={isTraining || isTrainingWords}
            style={{
              width: "100%", padding: "16px", borderRadius: "50px", border: "none", background: "#0f3a73", color: "#fff",
              fontSize: "1.1rem", fontWeight: 700, cursor: "pointer",
              boxShadow: "0 8px 20px rgba(15, 58, 115, 0.3)", marginTop: "10px"
            }}>
            Entrenar modelo
          </button>
          {(trainingMessage || trainingWordsMessage) && (
            <div style={{ fontSize: "0.85rem", color: "#fff", textAlign: "center", background: "rgba(0,0,0,0.3)", padding: "8px 16px", borderRadius: "8px" }}>
              {trainingMessage || trainingWordsMessage}
            </div>
          )}
        </div>
      </div>

      {isGuideOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center",
          background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(8px)", padding: "20px"
        }}>
          <div style={{
            background: "rgba(255, 255, 255, 0.95)", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "800px",
            maxHeight: "90vh", overflowY: "auto", position: "relative", color: "#000"
          }}>
            <button onClick={() => setIsGuideOpen(false)} style={{ position: "absolute", top: "24px", right: "24px", background: "#0f3a73", border: "none", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", color: "#fff" }}>X</button>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px" }}>Guia de Senas</h2>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: "20px" }}>Letras ({registeredLetters.length})</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
              {registeredLetters.map(l => <span key={l} style={{ padding: "8px 16px", background: "#e2e8f0", borderRadius: "8px", fontWeight: "bold" }}>{l}</span>)}
              {registeredLetters.length === 0 && <span style={{ color: "#94a3b8" }}>Ninguna letra entrenada.</span>}
            </div>
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: "20px" }}>Palabras ({registeredWords.length})</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
              {registeredWords.map(w => <span key={w} style={{ padding: "8px 16px", background: "#fed7aa", color: "#9a3412", borderRadius: "8px", fontWeight: "bold" }}>{w}</span>)}
              {registeredWords.length === 0 && <span style={{ color: "#94a3b8" }}>Ninguna palabra entrenada.</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
