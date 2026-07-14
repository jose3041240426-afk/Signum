"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getUserProfile, getUserRoles, updateUserProfile, getGeneros } from "@/services/auth.service";
import { LiquidGlass } from "@/components/ui/LiquidGlass";

interface ProfileScreenProps {
  userId: string | null;
}

export function ProfileScreen({ userId }: ProfileScreenProps) {
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);
  const [generos, setGeneros] = useState<any[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form State
  const [nombre, setNombre] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [idGenero, setIdGenero] = useState<number>(1);

  useEffect(() => {
    async function loadData() {
      if (!userId) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [profData, rolesData, genList] = await Promise.all([
          getUserProfile(userId),
          getUserRoles(userId),
          getGeneros(),
        ]);
        setProfile(profData);
        setRoles(rolesData);
        setGeneros(genList);

        // Populate form
        setNombre(profData.nombre || "");
        setApellidoPaterno(profData.apellido_paterno || "");
        setApellidoMaterno(profData.apellido_materno || "");
        setIdGenero(profData.id_genero || 1);
      } catch (err: any) {
        console.error("Error al cargar perfil:", err);
        setError("Ocurrió un error al cargar los datos del perfil.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const updated = await updateUserProfile(userId, {
        nombre,
        apellido_paterno: apellidoPaterno,
        apellido_materno: apellidoMaterno,
        id_genero: Number(idGenero),
      });
      
      // Reload profile data with genre name
      const freshProfile = await getUserProfile(userId);
      setProfile(freshProfile);
      setIsEditing(false);
      setSuccess("¡Perfil actualizado con éxito!");
    } catch (err: any) {
      console.error("Error al guardar perfil:", err);
      setError(err.message || "Error al guardar los cambios.");
    } finally {
      setSaving(false);
    }
  };

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
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h2 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "1rem" }}>Perfil de Invitado</h2>
          <p style={{ opacity: 0.8, marginBottom: "2rem", lineHeight: "1.6" }}>
            Has accedido en modo invitado. Los perfiles son accesibles y personalizables únicamente para usuarios registrados.
          </p>
          <button
            onClick={() => window.location.href = "/register"}
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
            Registrarse ahora
          </button>
        </LiquidGlass>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "4rem" }}>
        <div style={{ border: "4px solid rgba(255,255,255,0.1)", borderTop: "4px solid #fff", borderRadius: "50%", width: "40px", height: "40px", animation: "spin 1s linear infinite" }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", width: "100%", margin: "1rem auto" }}>
      <LiquidGlass style={{ padding: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "1.5rem" }}>
          <div>
            <h2 style={{ fontSize: "2rem", fontWeight: 800, margin: 0, background: "linear-gradient(to right, #fff, #93c5fd)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Mi Perfil
            </h2>
            <p style={{ fontSize: "0.9rem", opacity: 0.7, marginTop: "4px" }}>
              Administra tu información personal de Signum
            </p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: "8px 18px",
                borderRadius: "50px",
                border: "1px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.2)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
            >
              Editar Perfil
            </button>
          )}
        </div>

        {error && (
          <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(239,68,68,0.2)", color: "#fca5a5", fontSize: "0.9rem", marginBottom: "1.5rem", border: "1px solid rgba(239,68,68,0.3)" }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ padding: "12px", borderRadius: "10px", background: "rgba(16,185,129,0.2)", color: "#a7f3d0", fontSize: "0.9rem", marginBottom: "1.5rem", border: "1px solid rgba(16,185,129,0.3)" }}>
            {success}
          </div>
        )}

        {isEditing ? (
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", opacity: 0.8, fontWeight: 600 }}>Nombre</label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "0.95rem" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", opacity: 0.8, fontWeight: 600 }}>Apellido Paterno</label>
                <input
                  type="text"
                  value={apellidoPaterno}
                  onChange={(e) => setApellidoPaterno(e.target.value)}
                  required
                  style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "0.95rem" }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", opacity: 0.8, fontWeight: 600 }}>Apellido Materno</label>
              <input
                type="text"
                value={apellidoMaterno}
                onChange={(e) => setApellidoMaterno(e.target.value)}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: "0.95rem" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", opacity: 0.8, fontWeight: 600 }}>Género</label>
              <select
                value={idGenero}
                onChange={(e) => setIdGenero(Number(e.target.value))}
                style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(0,0,0,0.8)", color: "#fff", fontSize: "0.95rem" }}
              >
                {generos.map((g) => (
                  <option key={g.id_genero} value={g.id_genero} style={{ background: "#1f2937", color: "#fff" }}>
                    {g.genero}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button
                type="submit"
                disabled={saving}
                style={{
                  flex: 1,
                  padding: "14px",
                  borderRadius: "50px",
                  border: "none",
                  background: "#0f3a73",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 8px 20px rgba(15, 58, 115, 0.3)",
                }}
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  padding: "14px 28px",
                  borderRadius: "50px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "transparent",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Nombre Completo</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "1.15rem", fontWeight: 500 }}>
                  {profile?.nombre} {profile?.apellido_paterno} {profile?.apellido_materno}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Correo Electrónico</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "1.15rem", fontWeight: 500 }}>{profile?.correo}</p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Género</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "1.15rem", fontWeight: 500 }}>
                  {profile?.catalogo_generos?.genero || "No especificado"}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Roles Asignados</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "1.15rem", fontWeight: 500 }}>
                  {roles.length > 0
                    ? roles.map((r) => r.roles?.nombre_rol).join(", ")
                    : "Usuario"}
                </p>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Fecha de Registro</p>
                <p style={{ margin: "4px 0 0 0", fontSize: "1.15rem", fontWeight: 500 }}>
                  {profile?.fecha_registro ? new Date(profile.fecha_registro).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) : "-"}
                </p>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "1px" }}>Estado de Cuenta</p>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: profile?.estado ? "#10b981" : "#ef4444" }} />
                  <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 500 }}>
                    {profile?.estado ? "Activo" : "Inactivo"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </LiquidGlass>
    </div>
  );
}
