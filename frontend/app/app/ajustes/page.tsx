"use client";
import { useEffect, useState } from "react";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { ELEVENLABS_VOICES } from "@/services/tts.service";

export default function AjustesPage() {
  const [isMirrored, setIsMirrored] = useState(true);
  const [autoAddConfidence, setAutoAddConfidence] = useState(55);
  const [autoAddStableFrames, setAutoAddStableFrames] = useState(6);
  const [ttsRate, setTtsRate] = useState(0.95);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [glassOpacity, setGlassOpacity] = useState(0.05);
  const [glassBorder, setGlassBorder] = useState(0);
  const [ttsProvider, setTtsProvider] = useState("native");
  const [elevenlabsVoiceId, setElevenlabsVoiceId] = useState("pNInz6obpgDQGcFmaJgB");
  const [voiceListVisible, setVoiceListVisible] = useState(false);
  const [voiceListAnimation, setVoiceListAnimation] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  // Load settings on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMirror = localStorage.getItem("isCameraMirrored");
      if (savedMirror !== null) setIsMirrored(savedMirror !== "false");

      const savedConf = localStorage.getItem("autoAddConfidence");
      if (savedConf) setAutoAddConfidence(parseInt(savedConf, 10));

      const savedFrames = localStorage.getItem("autoAddStableFrames");
      if (savedFrames) setAutoAddStableFrames(parseInt(savedFrames, 10));

      const savedRate = localStorage.getItem("ttsRate");
      if (savedRate) setTtsRate(parseFloat(savedRate));

      const savedPitch = localStorage.getItem("ttsPitch");
      if (savedPitch) setTtsPitch(parseFloat(savedPitch));

      const savedOpacity = localStorage.getItem("glassOpacity");
      if (savedOpacity) {
        setGlassOpacity(parseFloat(savedOpacity));
      } else {
        setGlassOpacity(0.05);
      }

      const savedBorder = localStorage.getItem("glassBorder");
      if (savedBorder) {
        setGlassBorder(parseInt(savedBorder, 10));
      }

      const savedProvider = localStorage.getItem("ttsProvider");
      if (savedProvider) setTtsProvider(savedProvider);

      const savedVoiceId = localStorage.getItem("elevenlabsVoiceId");
      if (savedVoiceId) setElevenlabsVoiceId(savedVoiceId);
    }
  }, []);

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("isCameraMirrored", String(isMirrored));
      localStorage.setItem("autoAddConfidence", String(autoAddConfidence));
      localStorage.setItem("autoAddStableFrames", String(autoAddStableFrames));
      localStorage.setItem("ttsRate", String(ttsRate));
      localStorage.setItem("ttsPitch", String(ttsPitch));
      localStorage.setItem("glassOpacity", String(glassOpacity));
      localStorage.setItem("glassBorder", String(glassBorder));
      localStorage.setItem("ttsProvider", ttsProvider);
      localStorage.setItem("elevenlabsVoiceId", elevenlabsVoiceId);

      // Disparar evento para actualizar layout.tsx de inmediato en la misma pestaña
      window.dispatchEvent(new Event("glassOpacityChange"));
      window.dispatchEvent(new Event("glassBorderChange"));
      
      setSavedMessage("¡Configuración guardada correctamente!");
      setTimeout(() => setSavedMessage(""), 3000);
    }
  };

  const handleReset = () => {
    setIsMirrored(true);
    setAutoAddConfidence(55);
    setAutoAddStableFrames(6);
    setTtsRate(0.95);
    setTtsPitch(1.0);
    setGlassOpacity(0.05);
    setGlassBorder(0);
    setTtsProvider("native");
    setElevenlabsVoiceId("pNInz6obpgDQGcFmaJgB");
    setVoiceListVisible(false);
    setVoiceListAnimation("");

    if (typeof window !== "undefined") {
      localStorage.removeItem("isCameraMirrored");
      localStorage.removeItem("autoAddConfidence");
      localStorage.removeItem("autoAddStableFrames");
      localStorage.removeItem("ttsRate");
      localStorage.removeItem("ttsPitch");
      localStorage.removeItem("glassOpacity");
      localStorage.removeItem("glassBorder");
      localStorage.removeItem("ttsProvider");
      localStorage.removeItem("elevenlabsVoiceId");

      // Disparar evento para actualizar layout.tsx de inmediato en la misma pestaña
      window.dispatchEvent(new Event("glassOpacityChange"));
      window.dispatchEvent(new Event("glassBorderChange"));
      
      setSavedMessage("Configuración restablecida a valores por defecto");
      setTimeout(() => setSavedMessage(""), 3000);
    }
  };

  return (
    <>
      <style>{`
        @keyframes alertSlideIn {
          0% { opacity: 0; transform: translateY(-8px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    <div className="stagger" style={{ maxWidth: "650px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, color: "#ffffff" }}>
          Ajustes
        </h2>
        <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
          Personaliza tu experiencia de traducción y voz en Signum
        </p>
      </div>

      <LiquidGlass style={{ padding: "2rem", display: "flex", flexDirection: "column", gap: "2rem" }}>
        
        {/* Sección Cámara */}
        <div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px", marginBottom: "1rem" }}>
            Configuración de Cámara
          </h3>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem" }}>Efecto Espejo</p>
              <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", opacity: 0.7 }}>Refleja horizontalmente la transmisión de la cámara</p>
            </div>
            <input 
              type="checkbox" 
              checked={isMirrored}
              onChange={(e) => setIsMirrored(e.target.checked)}
              style={{ width: "20px", height: "20px", cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Sección Auto-Añadir */}
        <div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px", marginBottom: "1.2rem" }}>
            Parámetros de Auto-Añadir
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Confianza Mínima: {autoAddConfidence}%</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Por defecto: 55%</span>
              </div>
              <input 
                type="range" 
                className="custom-slider"
                min="30" 
                max="95" 
                value={autoAddConfidence}
                onChange={(e) => setAutoAddConfidence(parseInt(e.target.value, 10))}
              />
              <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", opacity: 0.6 }}>Precisión requerida del modelo para registrar una seña.</p>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Fotogramas Estables: {autoAddStableFrames}</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Por defecto: 6</span>
              </div>
              <input 
                type="range" 
                className="custom-slider"
                min="2" 
                max="20" 
                value={autoAddStableFrames}
                onChange={(e) => setAutoAddStableFrames(parseInt(e.target.value, 10))}
              />
              <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", opacity: 0.6 }}>Frames consecutivos que la seña debe mantenerse para auto-añadirse.</p>
            </div>
          </div>
        </div>

        {/* Sección TTS */}
        <div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px", marginBottom: "1.2rem" }}>
            Texto a Voz (TTS)
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Velocidad: {ttsRate}x</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Por defecto: 0.95x</span>
              </div>
              <input 
                type="range" 
                className="custom-slider"
                min="0.5" 
                max="2" 
                step="0.05"
                value={ttsRate}
                onChange={(e) => setTtsRate(parseFloat(e.target.value))}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Tono (Pitch): {ttsPitch}</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Por defecto: 1.0</span>
              </div>
              <input 
                type="range" 
                className="custom-slider"
                min="0.5" 
                max="2" 
                step="0.05"
                value={ttsPitch}
                onChange={(e) => setTtsPitch(parseFloat(e.target.value))}
              />
            </div>

            {/* Proveedor TTS estilo glass-radio */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Motor de Voz</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Por defecto: Navegador</span>
              </div>
              <div className="glass-radio-group-2">
                <input
                  type="radio"
                  name="tts-provider"
                  id="tts-native"
                  checked={ttsProvider === "native"}
                  onChange={() => {
                    if (voiceListVisible) {
                      setVoiceListAnimation("accordion-close");
                    }
                    setTtsProvider("native");
                  }}
                />
                <label htmlFor="tts-native">Navegador</label>

                <input
                  type="radio"
                  name="tts-provider"
                  id="tts-elevenlabs"
                  checked={ttsProvider === "elevenlabs"}
                  onChange={() => {
                    setTtsProvider("elevenlabs");
                    setVoiceListVisible(true);
                    setVoiceListAnimation("accordion-open");
                  }}
                />
                <label htmlFor="tts-elevenlabs">ElevenLabs</label>

                <div className="glass-glider" />
              </div>
            </div>

            {/* Selector de voz ElevenLabs */}
            {voiceListVisible && (
              <div
                className={voiceListAnimation}
                onAnimationEnd={() => {
                  if (voiceListAnimation === "accordion-close") {
                    setVoiceListVisible(false);
                    setVoiceListAnimation("");
                  }
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Voz ElevenLabs</span>
                  <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Modelo multilingüe</span>
                </div>
                <p style={{ margin: "0 0 8px 0", fontSize: "0.75rem", opacity: 0.6 }}>
                  Voces con "(recomendado español)" se adaptan mejor al español latino con el modelo multilingüe.
                </p>
                <div className="voice-list">
                  {Object.entries(ELEVENLABS_VOICES).map(([id, name]) => (
                    <button
                      key={id}
                      className={`voice-option${id === elevenlabsVoiceId ? " selected" : ""}`}
                      onClick={() => setElevenlabsVoiceId(id)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sección Apariencia (Transparencia) */}
        <div>
          <h3 style={{ fontSize: "1.2rem", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px", marginBottom: "1.2rem" }}>
            Apariencia de la Interfaz
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Opacidad del Vidrio: {Math.round(glassOpacity * 100)}%</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Por defecto: 5%</span>
              </div>
              <input 
                type="range" 
                className="custom-slider"
                min="0.05" 
                max="0.95" 
                step="0.05"
                value={glassOpacity}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setGlassOpacity(v);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("glassOpacity", String(v));
                  }
                }}
                onPointerUp={() => {
                  window.dispatchEvent(new Event("glassOpacityChange"));
                }}
              />
              <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", opacity: 0.6 }}>Ajusta la opacidad del efecto de vidrio esmerilado en los paneles.</p>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Grosor del Borde: {glassBorder}px</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Por defecto: 0px</span>
              </div>
              <input
                type="range"
                className="custom-slider"
                min="0"
                max="10"
                step="1"
                value={glassBorder}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setGlassBorder(v);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("glassBorder", String(v));
                  }
                }}
                onPointerUp={() => {
                  window.dispatchEvent(new Event("glassBorderChange"));
                }}
              />
              <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", opacity: 0.6 }}>Controla el grosor del borde de los paneles de vidrio.</p>
            </div>
          </div>
        </div>

        {savedMessage && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "10px",
              background: "rgba(16,185,129,0.25)",
              color: "#065f46",
              fontSize: "0.9rem",
              fontWeight: 600,
              textAlign: "center",
              border: "1px solid rgba(16,185,129,0.4)",
              animation: "alertSlideIn 0.4s ease",
            }}
          >
            {savedMessage}
          </div>
        )}

        {/* Botones de acción */}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end", marginTop: "1rem" }}>
          <button
            onClick={handleReset}
            style={{
              padding: "10px 20px",
              borderRadius: "50px",
              border: "1px solid rgba(255,255,255,0.3)",
              background: "transparent",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
              fontSize: "0.9rem"
            }}
          >
            Restablecer
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: "10px 24px",
              borderRadius: "50px",
              border: "none",
              background: "#0f3a73",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(15, 58, 115, 0.3)",
              fontSize: "0.9rem"
            }}
          >
            Guardar Cambios
          </button>
        </div>

      </LiquidGlass>
    </div>
    </>
  );
}
