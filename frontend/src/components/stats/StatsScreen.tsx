"use client";
import { useEffect, useState } from "react";
import { getUserStats, getUserTranslations, getUserLogins } from "@/services/auth.service";
import { LiquidGlass } from "@/components/ui/LiquidGlass";

interface StatsScreenProps {
  userId: string | null;
}

export function StatsScreen({ userId }: StatsScreenProps) {
  const [stats, setStats] = useState<any[]>([]);
  const [translations, setTranslations] = useState<any[]>([]);
  const [logins, setLogins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadStats() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [statsData, transData, loginsData] = await Promise.all([
          getUserStats(userId),
          getUserTranslations(userId, 5),
          getUserLogins(userId, 5),
        ]);
        setStats(statsData);
        setTranslations(transData);
        setLogins(loginsData);
      } catch (err: any) {
        console.error("Error al cargar estadísticas:", err);
        setError("Ocurrió un error al cargar las estadísticas de uso.");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, [userId]);

  // Aggregate translation counts and minutes
  const totalTranslations = stats.reduce((sum, item) => sum + (item.traducciones_realizadas || 0), 0);
  const totalMinutes = stats.reduce((sum, item) => sum + (item.tiempo_uso_minutos || 0), 0);

  if (!userId) {
    return (
      <div style={{ maxWidth: "600px", width: "100%", margin: "2rem auto" }}>
        <LiquidGlass style={{ padding: "2.5rem", textAlign: "center" }}>
          <svg
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "#fbbf24", marginBottom: "1.5rem" }}
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "1rem" }}>Estadísticas de Invitado</h2>
          <p style={{ opacity: 0.8, marginBottom: "2rem", lineHeight: "1.6" }}>
            El historial de traducciones, avances de aprendizaje y estadísticas de uso se guardan únicamente para usuarios registrados.
          </p>
          <button
            onClick={() => window.location.href = "/login"}
            style={{
              padding: "12px 28px",
              borderRadius: "50px",
              border: "none",
              background: "#0f3a73",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 8px 20px rgba(15, 58, 115, 0.3)",
            }}
          >
            Iniciar sesión
          </button>
        </LiquidGlass>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "4rem" }}>
        <div style={{ border: "4px solid rgba(255,255,255,0.1)", borderTop: "4px solid #fff", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1100px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Top Section / Header */}
      <div>
        <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, background: "linear-gradient(to right, #fff, #93c5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Mis Estadísticas
        </h2>
        <p style={{ fontSize: "0.9rem", opacity: 0.7, marginTop: "4px" }}>
          Monitorea tus traducciones y uso general de la plataforma
        </p>
      </div>

      {error && (
        <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: "0.9rem", border: "1px solid rgba(239,68,68,0.3)" }}>
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem" }}>
        <LiquidGlass style={{ padding: "1.5rem 2rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ background: "linear-gradient(135deg, #1e3a8a, #3b82f6)", borderRadius: "16px", padding: "14px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: "2.2rem", fontWeight: 800, margin: 0 }}>{totalTranslations}</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", opacity: 0.7, fontWeight: 600 }}>Traducciones Realizadas</p>
          </div>
        </LiquidGlass>

        <LiquidGlass style={{ padding: "1.5rem 2rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ background: "linear-gradient(135deg, #065f46, #10b981)", borderRadius: "16px", padding: "14px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: "2.2rem", fontWeight: 800, margin: 0 }}>{totalMinutes} <span style={{ fontSize: "1rem", fontWeight: 400 }}>min</span></h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", opacity: 0.7, fontWeight: 600 }}>Tiempo de Uso Total</p>
          </div>
        </LiquidGlass>

        <LiquidGlass style={{ padding: "1.5rem 2rem", display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <div style={{ background: "linear-gradient(135deg, #7c2d12, #f97316)", borderRadius: "16px", padding: "14px", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: "2.2rem", fontWeight: 800, margin: 0 }}>{stats.length}</h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.85rem", opacity: 0.7, fontWeight: 600 }}>Días de Actividad</p>
          </div>
        </LiquidGlass>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem", flexWrap: "wrap" }}>
        {/* Recent Translations table */}
        <LiquidGlass style={{ padding: "2rem" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 1.5rem 0" }}>Traducciones Recientes</h3>
          {translations.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: "0.95rem", textAlign: "center", padding: "2rem 0" }}>
              Aún no has realizado ninguna traducción. Ve a la pantalla principal para empezar.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.15)", opacity: 0.7 }}>
                    <th style={{ padding: "12px 8px" }}>Tipo</th>
                    <th style={{ padding: "12px 8px" }}>Original</th>
                    <th style={{ padding: "12px 8px" }}>Traducción</th>
                    <th style={{ padding: "12px 8px" }}>Fecha / Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {translations.map((t) => (
                    <tr key={t.id_traduccion} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                      <td style={{ padding: "14px 8px" }}>
                        <span style={{ background: "rgba(37,99,235,0.2)", color: "#93c5fd", padding: "4px 8px", borderRadius: "12px", fontSize: "0.75rem", fontWeight: 600 }}>
                          {t.catalogo_tipo_traduccion?.tipo || "LSM"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 8px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.texto_original}</td>
                      <td style={{ padding: "14px 8px", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#60a5fa", fontWeight: 500 }}>{t.texto_traducido}</td>
                      <td style={{ padding: "14px 8px", opacity: 0.8 }}>
                        {new Date(t.fecha_hora).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LiquidGlass>

        {/* Recent Logins & IP logs */}
        <LiquidGlass style={{ padding: "2rem" }}>
          <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 1.5rem 0" }}>Últimos Accesos</h3>
          {logins.length === 0 ? (
            <p style={{ opacity: 0.6, fontSize: "0.95rem", textAlign: "center", padding: "2rem 0" }}>No hay registros de login.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {logins.map((l) => (
                <div key={l.id_login} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 600 }}>Dirección IP</p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", opacity: 0.6 }}>{l.direccion_ip || "N/A"}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.8 }}>
                      {new Date(l.fecha_hora).toLocaleDateString("es-MX", { month: "short", day: "numeric" })}
                    </p>
                    <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", opacity: 0.5 }}>
                      {new Date(l.fecha_hora).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </LiquidGlass>
      </div>
    </div>
  );
}
