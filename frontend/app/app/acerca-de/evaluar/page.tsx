"use client";
import { useState } from "react";
import { LiquidGlass } from "@/components/ui/LiquidGlass";
import { saveEvaluation } from "@/services/auth.service";

export default function EvaluarPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    resolucion: "",
    iluminacion: "",
    distancia: "",
    p4_uso_frecuente: null as number | null,
    p5_complicado: null as number | null,
    p6_facil_interactuar: null as number | null,
    p7_necesita_ayuda: null as number | null,
    p8_traduccion_natural: null as number | null,
    voz_satisfaccion: null as number | null,
    esfuerzo_mental: "",
    dispositivo: "",
    navegador: "",
    experiencia_previa: "",
    problemas: "",
    sugerencias: "",
    experiencia_general: null as number | null,
    recomendaria: "",
    facil_aprender: null as number | null,
    util_educativo: null as number | null,
    funcion_mas_util: "",
    senas_dificiles: "",
  });

  const update = (field: string, value: any) => setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await saveEvaluation(form);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Error al guardar la evaluación");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{ maxWidth: "700px", width: "100%", margin: "2rem auto" }}>
        <LiquidGlass style={{ padding: "3rem", textAlign: "center" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "1rem" }}>¡Gracias por tu evaluación!</h2>
          <p style={{ opacity: 0.8, lineHeight: 1.6 }}>Tus respuestas nos ayudarán a mejorar Signum para toda la comunidad.</p>
        </LiquidGlass>
      </div>
    );
  }

  const radioStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px",
    borderRadius: "10px", background: "rgba(255,255,255,0.05)",
    borderWidth: "1px", borderStyle: "solid", borderColor: "rgba(255,255,255,0.1)",
    cursor: "pointer", fontSize: "0.95rem", transition: "all 0.2s",
  };
  const radioSelected: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: "8px", padding: "12px 16px",
    borderRadius: "10px", cursor: "pointer", fontSize: "0.95rem", transition: "all 0.2s",
    background: "rgba(59,130,246,0.15)",
    borderWidth: "1px", borderStyle: "solid", borderColor: "#3b82f6",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "14px", borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)",
    color: "#fff", fontSize: "1rem", outline: "none", boxSizing: "border-box",
    resize: "vertical", minHeight: "80px",
  };

  return (
    <div style={{ maxWidth: "750px", width: "100%", margin: "0 auto" }}>
      <LiquidGlass style={{ padding: "2rem" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Evaluación de Signum</h2>
        <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.8)", marginBottom: "1.5rem" }}>
          Tu opinión nos ayuda a mejorar. Todos los campos son opcionales.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Sección 1: Configuración de uso */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem", color: "#93c5fd" }}>Configuración de uso</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "8px" }}>¿Qué resolución tiene la cámara web que usaste?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {["Alta resolución (HD/Full HD)", "Resolución estándar", "No estoy seguro/a"].map((o) => (
                    <div key={o} style={form.resolucion === o ? radioSelected : radioStyle} onClick={() => update("resolucion", o)}>
                      <input type="radio" name="resolucion" checked={form.resolucion === o} onChange={() => update("resolucion", o)} style={{ accentColor: "#3b82f6" }} />
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "8px" }}>¿Cómo describirías la iluminación del lugar donde usaste el sistema?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {["Buena y constante", "Un poco oscura o con luz variable"].map((o) => (
                    <div key={o} style={form.iluminacion === o ? radioSelected : radioStyle} onClick={() => update("iluminacion", o)}>
                      <input type="radio" name="iluminacion" checked={form.iluminacion === o} onChange={() => update("iluminacion", o)} style={{ accentColor: "#3b82f6" }} />
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "8px" }}>¿A qué distancia de la cámara te colocaste aproximadamente?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {["Muy cerca (menos de 50 cm)", "A una distancia cómoda (50 cm a 1 metro)", "Lejos (más de 1 metro)"].map((o) => (
                    <div key={o} style={form.distancia === o ? radioSelected : radioStyle} onClick={() => update("distancia", o)}>
                      <input type="radio" name="distancia" checked={form.distancia === o} onChange={() => update("distancia", o)} style={{ accentColor: "#3b82f6" }} />
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "8px" }}>¿Qué tipo de dispositivo usaste?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {["Laptop", "PC de escritorio", "Tablet", "Celular"].map((o) => (
                    <div key={o} style={form.dispositivo === o ? radioSelected : radioStyle} onClick={() => update("dispositivo", o)}>
                      <input type="radio" name="dispositivo" checked={form.dispositivo === o} onChange={() => update("dispositivo", o)} style={{ accentColor: "#3b82f6" }} />
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "8px" }}>¿Qué navegador usaste?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {["Google Chrome", "Firefox", "Microsoft Edge", "Safari", "Otro"].map((o) => (
                    <div key={o} style={form.navegador === o ? radioSelected : radioStyle} onClick={() => update("navegador", o)}>
                      <input type="radio" name="navegador" checked={form.navegador === o} onChange={() => update("navegador", o)} style={{ accentColor: "#3b82f6" }} />
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "8px" }}>¿Habías usado antes algún sistema de reconocimiento de señas?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {["Sí", "No"].map((o) => (
                    <div key={o} style={form.experiencia_previa === o ? radioSelected : radioStyle} onClick={() => update("experiencia_previa", o)}>
                      <input type="radio" name="experiencia_previa" checked={form.experiencia_previa === o} onChange={() => update("experiencia_previa", o)} style={{ accentColor: "#3b82f6" }} />
                      {o}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sección 2: Experiencia de uso */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 0.5rem", color: "#93c5fd" }}>Experiencia de uso</h3>
            <p style={{ fontSize: "0.85rem", opacity: 0.7, fontStyle: "italic", marginBottom: "1rem" }}>1 = Totalmente en desacuerdo · 5 = Totalmente de acuerdo</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[
                { field: "p4_uso_frecuente", label: "Me gustaría usar esta herramienta seguido en mis clases o reuniones de trabajo." },
                { field: "p5_complicado", label: "El sistema es complicado y difícil de entender." },
                { field: "p6_facil_interactuar", label: "Fue fácil interactuar con la plataforma y usarla." },
                { field: "p7_necesita_ayuda", label: "Siento que necesitaría ayuda de alguien técnico para poder usar este sistema." },
                { field: "p8_traduccion_natural", label: "Las funciones para traducir mis señas se sienten naturales y bien integradas." },
                { field: "experiencia_general", label: "En general, mi experiencia con Signum fue satisfactoria." },
                { field: "facil_aprender", label: "Fue fácil aprender a hacer las señas que el sistema reconoce." },
                { field: "util_educativo", label: "Signum sería útil en entornos educativos o laborales." },
              ].map((q) => (
                <div key={q.field}>
                  <label style={{ fontWeight: 500, fontSize: "0.95rem", display: "block", marginBottom: "6px" }}>{q.label}</label>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" onClick={() => update(q.field, n)}
                        style={{
                          width: "44px", height: "44px", borderRadius: "10px",
                          border: form[q.field as keyof typeof form] === n ? "2px solid #3b82f6" : "1px solid rgba(255,255,255,0.2)",
                          background: form[q.field as keyof typeof form] === n ? "rgba(59,130,246,0.2)" : "rgba(255,255,255,0.05)",
                          color: "#fff", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer",
                        }}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sección 3: Satisfacción */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem", color: "#93c5fd" }}>Satisfacción</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "6px" }}>¿Qué tan satisfecho/a quedaste con la voz que genera el sistema al interpretar tus señas?</label>
                <p style={{ fontSize: "0.8rem", opacity: 0.6, marginBottom: "8px" }}>1 = Nada satisfecho · 5 = Muy satisfecho</p>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => update("voz_satisfaccion", n)}
                      style={{
                        width: "52px", height: "52px", borderRadius: "10px",
                        border: form.voz_satisfaccion === n ? "2px solid #8b5cf6" : "1px solid rgba(255,255,255,0.2)",
                        background: form.voz_satisfaccion === n ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.05)",
                        color: "#fff", fontSize: "1.1rem", fontWeight: 700, cursor: "pointer",
                      }}
                    >{n}</button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "8px" }}>¿Sentiste que tuviste que esforzarte mucho mentalmente para que el sistema entendiera tus señas?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {["Fue muy fácil, no requirió esfuerzo.", "Requirió un poco de atención, pero fue fluido.", "Tuve que concentrarme mucho y hacer mucho esfuerzo mental."].map((o) => (
                    <div key={o} style={form.esfuerzo_mental === o ? radioSelected : radioStyle} onClick={() => update("esfuerzo_mental", o)}>
                      <input type="radio" name="esfuerzo_mental" checked={form.esfuerzo_mental === o} onChange={() => update("esfuerzo_mental", o)} style={{ accentColor: "#8b5cf6" }} />
                      {o}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "8px" }}>¿Recomendarías Signum a otras personas?</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {["Sí", "No", "Tal vez"].map((o) => (
                    <div key={o} style={form.recomendaria === o ? radioSelected : radioStyle} onClick={() => update("recomendaria", o)}>
                      <input type="radio" name="recomendaria" checked={form.recomendaria === o} onChange={() => update("recomendaria", o)} style={{ accentColor: "#8b5cf6" }} />
                      {o}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sección 4: Comentarios */}
          <div>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 700, margin: "0 0 1rem", color: "#93c5fd" }}>Comentarios</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "6px" }}>¿Qué función te pareció más útil?</label>
                <textarea value={form.funcion_mas_util} onChange={(e) => update("funcion_mas_util", e.target.value)} placeholder="Deletrear letras, palabras completas, auto-añadir, voz al detectar..." style={inputStyle} />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "6px" }}>¿Hubo alguna letra o palabra específica que el sistema no reconociera bien?</label>
                <textarea value={form.senas_dificiles} onChange={(e) => update("senas_dificiles", e.target.value)} placeholder="Por ejemplo: la letra M, la palabra 'gracias', etc." style={inputStyle} />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "6px" }}>¿Hubo algún problema?</label>
                <p style={{ fontSize: "0.8rem", opacity: 0.7, marginBottom: "6px" }}>Ejemplo: el sistema se trabó, el audio tardó en salir, la pantalla se veía mal o fue incómodo realizar las señas frente a la cámara.</p>
                <textarea value={form.problemas} onChange={(e) => update("problemas", e.target.value)} placeholder="Describe cualquier problema que hayas tenido..." style={inputStyle} />
              </div>

              <div>
                <label style={{ fontWeight: 600, fontSize: "0.95rem", display: "block", marginBottom: "6px" }}>Sugerencias o recomendaciones</label>
                <textarea value={form.sugerencias} onChange={(e) => update("sugerencias", e.target.value)} placeholder="¿Qué mejorarías de Signum?" style={inputStyle} />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: "0.85rem", textAlign: "center", border: "1px solid rgba(239,68,68,0.3)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting}
            style={{
              width: "100%", padding: "16px", borderRadius: "50px", border: "none",
              background: submitting ? "rgba(15,58,115,0.5)" : "#0f3a73",
              color: "#fff", fontSize: "1.1rem", fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer", marginTop: "0.5rem",
            }}
          >
            {submitting ? "Enviando..." : "Enviar evaluación"}
          </button>
        </form>
      </LiquidGlass>
    </div>
  );
}
