"use client";
import { useEffect, useState, useRef } from "react";
import Checkbox from "@/components/ui/checkbox";

const BACKEND = "http://localhost:8000";

export default function Home() {
  const [letter, setLetter] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [handDetected, setHandDetected] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [backendStatus, setBackendStatus] = useState("checking"); // 'checking' | 'online' | 'offline'
  const [statusMessage, setStatusMessage] = useState("Conectando...");
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLetter, setRecordingLetter] = useState("");
  const [recordedSamplesCount, setRecordedSamplesCount] = useState(0);
  const [letterToCapture, setLetterToCapture] = useState("");
  const [cameraOn, setCameraOn] = useState(true);

  // Word recording states
  const [isRecordingWord, setIsRecordingWord] = useState(false);
  const [recordingWordName, setRecordingWordName] = useState("");
  const [wordRecordedSamplesCount, setWordRecordedSamplesCount] = useState(0);
  const [wordToCapture, setWordToCapture] = useState("");
  const [wordPrediction, setWordPrediction] = useState("");
  const [wordConfidence, setWordConfidence] = useState(0);
  const [wordModelLoaded, setWordModelLoaded] = useState(false);
  const [isTrainingWords, setIsTrainingWords] = useState(false);
  const [trainingWordsMessage, setTrainingWordsMessage] = useState("");
  const [registeredWords, setRegisteredWords] = useState<string[]>([]);
  
  // Prediction mode — controls which model runs (letters only or words only)
  const [predictionMode, setPredictionMode] = useState("letters"); // "letters" | "words"
  
  // Training states
  const [isTraining, setIsTraining] = useState(false);
  const [trainingMessage, setTrainingMessage] = useState("");

  // Guide states
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [registeredLetters, setRegisteredLetters] = useState<string[]>([]);

  const fetchRegisteredLetters = async () => {
    try {
      const res = await fetch(`${BACKEND}/registered_letters`);
      if (res.ok) {
        const data = await res.json();
        setRegisteredLetters(data.registered);
      }
    } catch { /* silent */ }
  };

  const fetchRegisteredWords = async () => {
    try {
      const res = await fetch(`${BACKEND}/registered_words`);
      if (res.ok) {
        const data = await res.json();
        setRegisteredWords(data.registered);
      }
    } catch { /* silent */ }
  };

  // Phrase builder states
  const [phrase, setPhrase] = useState("");
  const [autoAddActive, setAutoAddActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const enableAudio = () => {
    setAudioEnabled(true);
    // Play a short silent audio to unlock the browser's audio context
    const audio = new Audio("data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA");
    audio.play().catch(()=>{});
  };

  const lastAddedLetterRef = useRef("");
  const stableCountRef = useRef(0);
const lastSpokenLetterRef = useRef("");
  const lastSpokenWordRef = useRef("");
  const speakingRef = useRef(false);
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const prefetchingRef = useRef<Set<string>>(new Set());
  const prevIsRecordingWordRef = useRef(false);
  const prevIsRecordingRef = useRef(false);

  const prefetchAudio = async (text: string) => {
    const key = text.trim().toLowerCase();
    if (audioCacheRef.current.has(key) || prefetchingRef.current.has(key)) return;
    prefetchingRef.current.add(key);
    try {
      const res = await fetch(`${BACKEND}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        audioCacheRef.current.set(key, URL.createObjectURL(blob));
      }
    } catch { /* silent */ }
    prefetchingRef.current.delete(key);
  };

  const speakLetter = async (text: string) => {
    if (speakingRef.current) return;
    speakingRef.current = true;
    try {
      const key = text.trim().toLowerCase();
      let audioUrl = audioCacheRef.current.get(key);
      if (!audioUrl) {
        const res = await fetch(`${BACKEND}/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const blob = await res.blob();
          audioUrl = URL.createObjectURL(blob);
          audioCacheRef.current.set(key, audioUrl);
        } else {
          speakingRef.current = false;
          return;
        }
      }
      const audio = new Audio(audioUrl);
      audio.onended = () => { speakingRef.current = false; };
      audio.onerror = () => { speakingRef.current = false; };
      audio.play().catch(() => { speakingRef.current = false; });
    } catch {
      speakingRef.current = false;
    }
  };

  // Check backend health and poll predictions/recording status
  useEffect(() => {
    let intervalId: any = null;
    let healthIntervalId: any = null;

    async function checkHealth() {
      try {
        const res = await fetch(`${BACKEND}/health`);
        if (res.ok) {
          const data = await res.json();
          setBackendStatus("online");
          setModelLoaded(data.model_loaded);
          if (data.model_loaded) {
            setStatusMessage("");
          } else {
            setStatusMessage("Modelo no encontrado. Entrena tu modelo.");
          }
          return true;
        }
      } catch (e) {
        setBackendStatus("offline");
        setStatusMessage("Sin conexión. Ejecuta el backend en tu computadora.");
      }
      return false;
    }

    // Check health on mount and start polling if online
    checkHealth().then((online) => {
      if (online) {
        intervalId = setInterval(async () => {
          try {
            const res = await fetch(`${BACKEND}/prediction`);
                if (res.ok) {
                  const data = await res.json();
                  setHandDetected(data.hand_detected);
                  setModelLoaded(data.model_loaded);
                  setIsRecording(data.is_recording);
                  setRecordingLetter(data.recording_letter);
                  setRecordedSamplesCount(data.recorded_samples_count);
                  // Detect word recording completion (transition true→false with samples captured)
                  if (prevIsRecordingWordRef.current && !data.is_recording_word && data.word_recorded_samples_count > 0) {
                    setStatusMessage(`✅ Palabra '${data.recording_word_name}' grabada correctamente (${data.word_recorded_samples_count} muestras).`);
                    fetchRegisteredWords();
                  }
                  // Detect letter recording completion
                  if (prevIsRecordingRef.current && !data.is_recording && data.recorded_samples_count >= 50) {
                    setStatusMessage(`✅ Letra '${data.recording_letter}' grabada correctamente (${data.recorded_samples_count} muestras).`);
                    fetchRegisteredLetters();
                  }
                  prevIsRecordingWordRef.current = data.is_recording_word;
                  prevIsRecordingRef.current = data.is_recording;

                  setIsRecordingWord(data.is_recording_word);
                  setRecordingWordName(data.recording_word_name);
                  setWordRecordedSamplesCount(data.word_recorded_samples_count);
                  setWordModelLoaded(data.word_model_loaded);
                  setWordPrediction(data.word || "");
                  setWordConfidence(Math.round(data.word_confidence || 0));
                  if (data.prediction_mode) setPredictionMode(data.prediction_mode);

                  if (data.is_recording_word) {
                    setStatusMessage(`Grabando palabra '${data.recording_word_name}': ${data.word_recorded_samples_count}/50 muestras`);
                  } else if (data.is_recording) {
                // Currently recording samples
                setLetter("");
                setConfidence(0);
                setStatusMessage(`Grabando muestras para la letra '${data.recording_letter}': ${data.recorded_samples_count}/50`);
        } else if (data.hand_detected && (data.letter || data.word)) {
          setLetter(data.letter);
          setConfidence(Math.round(data.confidence));

          // Pre-fetch audio as soon as we detect, before threshold
          prefetchAudio(data.letter);
          prefetchAudio(data.word);

          if (data.letter !== lastSpokenLetterRef.current && data.confidence > 55 && !data.is_recording) {
            lastSpokenLetterRef.current = data.letter;
            speakLetter(data.letter);
          }

          if (data.word && data.word !== lastSpokenWordRef.current && data.word_confidence > 30 && !data.is_recording_word) {
            lastSpokenWordRef.current = data.word;
            speakLetter(data.word);
          }

          // Auto-add feature: if a sign is held stable for 6 frames (approx 0.6s)
          if (autoAddActive) {
            if (predictionMode === "words" && data.word) {
              if (data.word === lastAddedLetterRef.current) {
                stableCountRef.current = 0;
              } else {
                stableCountRef.current += 1;
                if (stableCountRef.current > 6 && data.word_confidence > 30) {
                  setPhrase((prev) => prev + data.word + " ");
                  lastAddedLetterRef.current = data.word;
                  stableCountRef.current = 0;
                }
              }
            } else if (predictionMode === "letters" && data.letter) {
              if (data.letter === lastAddedLetterRef.current) {
                stableCountRef.current = 0;
              } else {
                stableCountRef.current += 1;
                if (stableCountRef.current > 6 && data.confidence > 55) {
                  setPhrase((prev) => prev + data.letter);
                  lastAddedLetterRef.current = data.letter;
                  stableCountRef.current = 0;
                }
              }
            }
          }
        } else {
          setLetter("");
          setConfidence(0);
          stableCountRef.current = 0;
          lastSpokenLetterRef.current = "";
          lastSpokenWordRef.current = "";
        }
            }
          } catch (e) {
            setBackendStatus("offline");
            setStatusMessage("Conexión perdida.");
          }
        }, 100);
      }
    });

    // Check health periodically
    healthIntervalId = setInterval(checkHealth, 3000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (healthIntervalId) clearInterval(healthIntervalId);
    };
  }, [autoAddActive]);

  const startRecording = async () => {
    if (!letterToCapture) return;
    try {
      const res = await fetch(`${BACKEND}/recording/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letter: letterToCapture }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        setStatusMessage(`Error: ${err.detail || "No se pudo iniciar la grabación"}`);
        return;
      }
      setIsRecording(true);
    } catch {
      setStatusMessage("Error de conexión al iniciar grabación.");
    }
  };

  const startRecordingWord = async () => {
    if (!wordToCapture) return;
    try {
      const res = await fetch(`${BACKEND}/recording_word/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word_name: wordToCapture }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }));
        setStatusMessage(`Error: ${err.detail || "No se pudo iniciar la grabación de palabra"}`);
        return;
      }
      setIsRecordingWord(true);
      setStatusMessage(`Grabando palabra '${wordToCapture}': acerca la mano a la cámara...`);
    } catch {
      setStatusMessage("Error de conexión al iniciar grabación de palabra.");
    }
  };

  const stopRecording = async () => {
    try {
      if (isRecordingWord) {
        await fetch(`${BACKEND}/stop_capture_word`, { method: "POST" });
        setIsRecordingWord(false);
        fetchRegisteredWords();
      } else {
        await fetch(`${BACKEND}/recording/stop`, { method: "POST" });
        setIsRecording(false);
        fetchRegisteredLetters();
      }
    } catch { /* silent */ }
  };


  const trainModel = async () => {
    setIsTraining(true);
    setTrainingMessage("Entrenando modelo de letras...");
    try {
      await fetch(`${BACKEND}/train`, { method: "POST" });
    } catch { /* silent */ }
    setIsTraining(false);
    fetchRegisteredLetters();
  };

  const trainWordModel = async () => {
    setIsTrainingWords(true);
    setTrainingWordsMessage("Entrenando modelo de palabras...");
    try {
      await fetch(`${BACKEND}/train_word`, { method: "POST" });
    } catch { /* silent */ }
    setIsTrainingWords(false);
    fetchRegisteredWords();
  };

  const deleteWord = async (word: string) => {
    try {
      await fetch(`${BACKEND}/registered_words/${encodeURIComponent(word)}`, {
        method: "DELETE"
      });
      fetchRegisteredWords();
    } catch { /* silent */ }
  };

  const addLetterToPhrase = () => setPhrase((prev) => prev + (wordPrediction || letter));
  const addSpaceToPhrase = () => setPhrase((prev) => prev + " ");
  const deleteLastChar = () => setPhrase((prev) => prev.slice(0, -1));
  const clearPhrase = () => setPhrase("");

  const speakPhrase = async () => {
    const textToSpeak = phrase || letter || wordPrediction;
    if (!textToSpeak) return;
    try {
      const res = await fetch(`${BACKEND}/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSpeak }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        audio.play();
      }
    } catch { /* silent */ }
  };

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
      {/* Header */}
      <header style={{ textAlign: "center", marginBottom: "2rem", position: "relative", width: "100%", maxWidth: "1100px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
          {/* Hand Icon SVG */}
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "#fff" }}>
            <path d="M18 11V6a2 2 0 0 0-4 0v5"/>
            <path d="M14 10.5V5a2 2 0 0 0-4 0v6"/>
            <path d="M10 10.5V4a2 2 0 0 0-4 0v7"/>
            <path d="M6 11V8a2 2 0 0 0-4 0v10a8 8 0 0 0 8 8h1a8 8 0 0 0 8-8v-3.5a2.5 2.5 0 0 0-5 0V11"/>
            <path d="M16 11l3-3"/>
            <path d="M4 11l-2-2"/>
            <path d="M10 2v2"/>
          </svg>
          <h1 style={{ fontSize: "3.5rem", fontWeight: 800, margin: 0, letterSpacing: "1px", textShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>SIGNUM</h1>
        </div>
        <p style={{ fontSize: "1.1rem", opacity: 0.9, marginTop: "0.5rem" }}>
          Conecta con el mundo usando Lengua de Señas Mexicana.
        </p>
        <div style={{ fontSize: "0.85rem", opacity: 0.8, marginTop: "0.5rem" }}>{statusMessage}</div>
        
        <button
          onClick={() => {
            setIsGuideOpen(true);
            fetchRegisteredLetters();
            fetchRegisteredWords();
          }}
          style={{
            position: "absolute", right: "0", top: "50%", transform: "translateY(-50%)",
            padding: "8px 16px", background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)",
            borderRadius: "50px", cursor: "pointer", fontSize: "0.9rem", fontWeight: 600,
            backdropFilter: "blur(10px)", display: "none", alignItems: "center", gap: "8px", transition: "background 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.3)"}
          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
        >
          📚 Guía
        </button>
      </header>

      {/* Main Content */}
      <div style={{ display: "flex", gap: "2rem", maxWidth: "1100px", width: "100%", flexWrap: "wrap", justifyContent: "center" }}>
        
        {/* Left Column - Camera */}
        <div style={{ flex: "1 1 500px", display: "flex", flexDirection: "column", gap: "1rem", maxWidth: "600px" }}>
          {/* Camera Container */}
          <div style={{ 
            position: "relative", 
            aspectRatio: "4/3", 
            borderRadius: "20px", 
            overflow: "hidden", 
            border: "6px solid rgba(255, 255, 255, 0.8)",
            boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
            background: "#000"
          }}>
            {/* Status Badge */}
            <div style={{
              position: "absolute", top: "20px", left: "20px", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
              padding: "8px 16px", borderRadius: "50px", display: "flex", alignItems: "center", gap: "8px",
              fontSize: "0.9rem", fontWeight: 600, zIndex: 10
            }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: backendStatus === 'online' && cameraOn ? "#4ade80" : "#ef4444" }}></div>
              {backendStatus === 'online' && cameraOn ? "Cámara activa" : "Cámara inactiva"}
            </div>

            {/* Video Feed */}
            {backendStatus === "online" && cameraOn ? (
              <img
                src={`${BACKEND}/video_feed`}
                alt="Camera Stream"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => {
                  setBackendStatus("offline");
                  setStatusMessage("Fallo al cargar el stream de video.");
                }}
              />
            ) : (
               <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e2e8f0", background: "#000000" }}>
                  Sin conexión o cámara apagada
               </div>
            )}

            {/* Controls Overlay */}
            <div style={{
              position: "absolute", bottom: "20px", left: "0", right: "0",
              display: "flex", justifyContent: "center", gap: "20px", zIndex: 10
            }}>
              {/* Camera Toggle Button */}
              <button 
                onClick={async () => {
                  if (cameraOn) {
                    try {
                      await fetch(`${BACKEND}/camera/stop`, { method: 'POST' });
                      setCameraOn(false);
                    } catch {}
                  } else {
                    setCameraOn(true);
                  }
                }}
                style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </button>



              {/* Mic / Speak Button */}
              <button 
                onClick={() => {
                  enableAudio();
                  speakPhrase();
                }}
                title="Reproducir frase actual"
                style={{ width: "50px", height: "50px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </button>
            </div>
          </div>

          {/* Info Box */}
          <div style={{
            background: "rgba(255, 255, 255, 0.35)",
            backdropFilter: "blur(24px) saturate(180%)",
            WebkitBackdropFilter: "blur(24px) saturate(180%)",
            borderRadius: "24px",
            border: "1px solid rgba(255, 255, 255, 0.6)",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
            padding: "16px 24px",
            display: "flex", alignItems: "center", gap: "16px", color: "#1e293b", fontSize: "0.95rem"
          }}>
            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#3b82f6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px", flexShrink: 0 }}>i</div>
            <div>
              Colócate frente a la cámara con buena iluminación.<br/>
              Asegúrate de que tus manos y rostro sean visibles.
            </div>
          </div>
        </div>

        {/* Right Column - Controls */}
        <div style={{
          flex: "1 1 350px",
          background: "rgba(255, 255, 255, 0.35)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          borderRadius: "24px",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          color: "#0f172a",
          border: "1px solid rgba(255, 255, 255, 0.6)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
          position: "relative"
        }}>
          
          {/* Prediction Mode Toggle — choose what to detect */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", background: "rgba(15, 23, 42, 0.15)", borderRadius: "14px", padding: "4px", marginBottom: "0" }}>
            <button
              onClick={() => {
                setPredictionMode("letters");
                fetch(`${BACKEND}/prediction_mode?mode=letters`, { method: "POST" }).catch(() => {});
              }}
              style={{
                flex: 1, padding: "10px 16px", border: "none", borderRadius: "10px",
                background: predictionMode === "letters" ? "#065f46" : "transparent",
                color: predictionMode === "letters" ? "#fff" : "#475569",
                cursor: "pointer", fontSize: "0.95rem", fontWeight: 700,
                transition: "all 0.2s"
              }}>
              🔤 Deletrear
            </button>
            <button
              onClick={() => {
                setPredictionMode("words");
                fetch(`${BACKEND}/prediction_mode?mode=words`, { method: "POST" }).catch(() => {});
              }}
              style={{
                flex: 1, padding: "10px 16px", border: "none", borderRadius: "10px",
                background: predictionMode === "words" ? "#065f46" : "transparent",
                color: predictionMode === "words" ? "#fff" : "#475569",
                cursor: "pointer", fontSize: "0.95rem", fontWeight: 700,
                transition: "all 0.2s"
              }}>
              📖 Palabras
            </button>
          </div>

          {/* Letter Input Row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>Letra a registrar:</label>
            <div style={{ display: "flex", gap: "12px" }}>
              <input 
                type="text" 
                value={letterToCapture}
                onChange={(e) => { setLetterToCapture(e.target.value.toUpperCase().slice(0, 1)); setWordToCapture(""); }}
                style={{ width: "60px", height: "60px", borderRadius: "12px", border: "none", background: "#fff", fontSize: "2rem", fontWeight: 800, textAlign: "center", outline: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
              />
              <button 
                onClick={startRecording}
                disabled={isRecording || !letterToCapture}
                style={{ width: "60px", height: "60px", borderRadius: "12px", border: "none", background: "#0f3a73", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 18.5v-13L19.423 12zM5 17l11.85-5L5 7v3.885L9.846 12L5 13.116zm0 0V7z"/></svg>
              </button>
            </div>
          </div>

          {/* Word Input Area */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>Palabra a registrar:</label>
            <div style={{ display: "flex", gap: "12px" }}>
              <input 
                type="text" 
                value={wordToCapture}
                onChange={(e) => { setWordToCapture(e.target.value.slice(0, 30)); setLetterToCapture(""); }}
                placeholder="Ej. Amor, Hola, Gracias..."
                style={{ flexGrow: 1, padding: "16px", borderRadius: "12px", border: "none", background: "#fff", fontSize: "1.1rem", outline: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
              />
              <button 
                onClick={startRecordingWord}
                disabled={isRecordingWord || !wordToCapture}
                style={{ width: "60px", height: "60px", borderRadius: "12px", border: "none", background: "#0f3a73", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", flexShrink: 0 }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 18.5v-13L19.423 12zM5 17l11.85-5L5 7v3.885L9.846 12L5 13.116zm0 0V7z"/></svg>
              </button>
            </div>
          </div>

          {/* Transcription Area */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", flexGrow: 1 }}>
            <label style={{ fontWeight: 700, fontSize: "1.05rem" }}>Transcripción:</label>
            <div style={{ 
              width: "100%", height: "100%", minHeight: "150px", padding: "20px", borderRadius: "16px", background: "#fff", border: "none", 
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)", fontSize: "1.2rem", color: phrase ? "#0f172a" : "#94a3b8", display: "flex", flexDirection: "column"
            }}>
              <div style={{ flexGrow: 1, wordBreak: "break-word" }}>
                {phrase || "La transcripción aparecerá aquí..."}
              </div>
              
              {/* Live predictions overlay/footer in the transcription box */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: "0.9rem", color: "#64748b", fontWeight: 600 }}>
                  Detectando: <span style={{ color: predictionMode === "words" ? "#f97316" : "#3b82f6", fontWeight: 800 }}>
                    {predictionMode === "words" ? (wordPrediction || "—") : (letter || "—")}
                  </span>
                  {predictionMode === "letters" && letter && <span style={{ marginLeft: "8px", color: confidence > 55 ? "#4ade80" : "#ef4444" }}>({confidence}%)</span>}
                  {predictionMode === "words" && wordPrediction && <span style={{ marginLeft: "8px", color: wordConfidence > 30 ? "#4ade80" : "#ef4444" }}>({wordConfidence}%)</span>}
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "4px", marginRight: "10px", cursor: "pointer" }}>
                    <Checkbox checked={autoAddActive} onChange={(e) => setAutoAddActive(e.target.checked)} />
                    Auto-Añadir
                  </label>
                  <button onClick={addSpaceToPhrase} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>_</button>
                  <button onClick={addLetterToPhrase} style={{ padding: "6px 10px", borderRadius: "8px", border: "none", background: "#0f3a73", color: "#fff", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>+</button>
                  <button onClick={deleteLastChar} style={{ padding: "6px 10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>⌫</button>
                </div>
              </div>
            </div>
          </div>

          {/* Upload Button */}
          <button 
            onClick={() => { trainModel(); trainWordModel(); }}
            disabled={isTraining || isTrainingWords}
            style={{ 
              width: "100%", padding: "16px", borderRadius: "50px", border: "none", background: "#0f3a73", color: "#fff", 
              fontSize: "1.1rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 8px 20px rgba(15, 58, 115, 0.3)", marginTop: "10px"
            }}>
            Entrenar modelo
          </button>
          
          {/* Status Overlay */}
          {(isRecording || isRecordingWord || isTraining || isTrainingWords) && (
            <div style={{
              position: "absolute", bottom: "100px", left: "20px", right: "20px",
              textAlign: "center", color: "#fff", fontWeight: 600, background: "rgba(15, 58, 115, 0.95)",
              padding: "16px", borderRadius: "12px", backdropFilter: "blur(8px)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)"
            }}>
              <div>
                 {isRecording && `Grabando letra: ${recordedSamplesCount}/50`}
                {isRecordingWord && `Grabando palabra: ${wordRecordedSamplesCount}/50 muestras`}
                {isTraining && `Entrenando modelo de letras...`}
                {isTrainingWords && `Entrenando modelo de palabras...`}
              </div>
              {(isRecording || isRecordingWord) && (
                <button
                  onClick={stopRecording}
                  style={{
                    padding: "6px 16px", background: "#ef4444", color: "#fff", border: "none",
                    borderRadius: "20px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 700,
                    boxShadow: "0 4px 10px rgba(239,68,68,0.3)", transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "#dc2626"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "#ef4444"}
                >
                  ⏹ Detener Grabación
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Guide Modal */}
      {isGuideOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center",
          background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(8px)", padding: "20px"
        }}>
          <div style={{
            background: "rgba(255, 255, 255, 0.95)", borderRadius: "24px", padding: "32px", width: "100%", maxWidth: "800px",
            maxHeight: "90vh", overflowY: "auto", position: "relative", color: "#000"
          }}>
            <button onClick={() => setIsGuideOpen(false)} style={{ position: "absolute", top: "24px", right: "24px", background: "#0f3a73", border: "none", width: "36px", height: "36px", borderRadius: "50%", cursor: "pointer", color: "#fff" }}>✕</button>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px" }}>Guía de Señas</h2>
            <p style={{ color: "#64748b", marginBottom: "24px", fontSize: "1rem" }}>Letras y palabras actualmente registradas en el modelo.</p>
            
            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: "20px" }}>Letras ({registeredLetters.length})</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
              {registeredLetters.map(l => <span key={l} style={{ padding: "8px 16px", background: "#e2e8f0", borderRadius: "8px", fontWeight: "bold" }}>{l}</span>)}
              {registeredLetters.length === 0 && <span style={{ color: "#94a3b8" }}>Ninguna letra entrenada.</span>}
            </div>

            <h3 style={{ fontSize: "1.3rem", fontWeight: 800, marginTop: "20px" }}>Palabras ({registeredWords.length})</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
              {registeredWords.map(w => (
                <span key={w} style={{ padding: "8px 16px", background: "#fed7aa", color: "#9a3412", borderRadius: "8px", fontWeight: "bold" }}>
                  {w} <button onClick={() => deleteWord(w)} style={{ border: "none", background: "none", cursor: "pointer", color: "red", fontWeight: "bold" }}>✕</button>
                </span>
              ))}
              {registeredWords.length === 0 && <span style={{ color: "#94a3b8" }}>Ninguna palabra entrenada.</span>}
            </div>

            <button onClick={async () => {
              const res = await fetch(`${BACKEND}/debug/words_files`);
              const data = await res.json();
              console.log('Debug word files:', data);
              alert('Word files:\n' + (data.files || []).join('\n'));
            }} style={{ marginTop: '12px', padding: '8px 16px', background: '#0f3a73', color: '#fff', border: 'none', borderRadius: '6px' }}>Mostrar archivos .npy de palabras</button>
          </div>
        </div>
      )}
    </div>
  );
}
