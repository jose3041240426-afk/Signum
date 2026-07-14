"use client";
import { useEffect, useState } from "react";
import { LiquidGlass } from "@/components/ui/LiquidGlass";

export default function AjustesPage() {
  const [isMirrored, setIsMirrored] = useState(true);
  const [autoAddConfidence, setAutoAddConfidence] = useState(55);
  const [autoAddStableFrames, setAutoAddStableFrames] = useState(6);
  const [ttsRate, setTtsRate] = useState(0.95);
  const [ttsPitch, setTtsPitch] = useState(1.0);
  const [glassOpacity, setGlassOpacity] = useState(0.05);
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

      // Disparar evento para actualizar layout.tsx de inmediato en la misma pestaña
      window.dispatchEvent(new Event("glassOpacityChange"));
      
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

    if (typeof window !== "undefined") {
      localStorage.removeItem("isCameraMirrored");
      localStorage.removeItem("autoAddConfidence");
      localStorage.removeItem("autoAddStableFrames");
      localStorage.removeItem("ttsRate");
      localStorage.removeItem("ttsPitch");
      localStorage.removeItem("glassOpacity");

      // Disparar evento para actualizar layout.tsx de inmediato en la misma pestaña
      window.dispatchEvent(new Event("glassOpacityChange"));
      
      setSavedMessage("Configuración restablecida a valores por defecto");
      setTimeout(() => setSavedMessage(""), 3000);
    }
  };

  return (
    <div style={{ maxWidth: "650px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div>
        <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, background: "linear-gradient(to right, #fff, #93c5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Ajustes
        </h2>
        <p style={{ fontSize: "0.9rem", opacity: 0.7, marginTop: "4px" }}>
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
                min="30" 
                max="95" 
                value={autoAddConfidence}
                onChange={(e) => setAutoAddConfidence(parseInt(e.target.value, 10))}
                style={{ width: "100%", accentColor: "#3b82f6", cursor: "pointer" }}
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
                min="2" 
                max="20" 
                value={autoAddStableFrames}
                onChange={(e) => setAutoAddStableFrames(parseInt(e.target.value, 10))}
                style={{ width: "100%", accentColor: "#3b82f6", cursor: "pointer" }}
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
                min="0.5" 
                max="2" 
                step="0.05"
                value={ttsRate}
                onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#10b981", cursor: "pointer" }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>Tono (Pitch): {ttsPitch}</span>
                <span style={{ fontSize: "0.8rem", opacity: 0.7 }}>Por defecto: 1.0</span>
              </div>
              <input 
                type="range" 
                min="0.5" 
                max="2" 
                step="0.05"
                value={ttsPitch}
                onChange={(e) => setTtsPitch(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#10b981", cursor: "pointer" }}
              />
            </div>
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
                min="0.05" 
                max="0.95" 
                step="0.05"
                value={glassOpacity}
                onChange={(e) => setGlassOpacity(parseFloat(e.target.value))}
                style={{ width: "100%", accentColor: "#f59e0b", cursor: "pointer" }}
              />
              <p style={{ margin: "4px 0 0 0", fontSize: "0.75rem", opacity: 0.6 }}>Ajusta la opacidad del efecto de vidrio esmerilado en los paneles.</p>
            </div>
          </div>
        </div>

        {savedMessage && (
          <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(16,185,129,0.2)", color: "#a7f3d0", fontSize: "0.85rem", textAlign: "center", border: "1px solid rgba(16,185,129,0.3)" }}>
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
  );
}
