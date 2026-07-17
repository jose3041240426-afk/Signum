"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signUp, getGeneros, getCurrentUser } from "@/services/auth.service";

type Genero = { id_genero: number; genero: string };

export default function RegisterPage() {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [apellidoPaterno, setApellidoPaterno] = useState("");
  const [apellidoMaterno, setApellidoMaterno] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [idGenero, setIdGenero] = useState("");
  const [generos, setGeneros] = useState<Genero[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        router.push("/app");
      }
    }).catch(console.error);
    getGeneros().then(setGeneros).catch(console.error);
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!idGenero) {
      setError("Selecciona un género");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, nombre, apellidoPaterno, apellidoMaterno, Number(idGenero));
      router.push("/login");
    } catch (err: any) {
      console.error("Error en registro:", err);
      setError(err?.message || JSON.stringify(err) || "Error al registrarse");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.3)",
    color: "#fff",
    fontSize: "1rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "#fff",
      }}
    >
      <div
        className="stagger"
        style={{
          background: "rgba(255,255,255,0.08)",
          backdropFilter: "blur(16px)",
          borderRadius: "24px",
          border: "1px solid rgba(255,255,255,0.15)",
          padding: "40px",
          width: "100%",
          maxWidth: "600px",
        }}
      >
        <h1
          style={{
            fontSize: "1.8rem",
            fontWeight: 700,
            marginBottom: "1.5rem",
            textAlign: "center",
          }}
        >
          Registrarse
        </h1>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "6px", fontWeight: 600, opacity: 0.8 }}>
                Nombre
              </label>
              <input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Tu nombre" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "6px", fontWeight: 600, opacity: 0.8 }}>
                Correo
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="correo@ejemplo.com" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "6px", fontWeight: 600, opacity: 0.8 }}>
                Apellido paterno
              </label>
              <input type="text" value={apellidoPaterno} onChange={(e) => setApellidoPaterno(e.target.value)} required placeholder="García" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "6px", fontWeight: 600, opacity: 0.8 }}>
                Contraseña
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "6px", fontWeight: 600, opacity: 0.8 }}>
                Apellido materno
              </label>
              <input type="text" value={apellidoMaterno} onChange={(e) => setApellidoMaterno(e.target.value)} placeholder="López (opcional)" style={inputStyle} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "6px", fontWeight: 600, opacity: 0.8 }}>
                Género
              </label>
              <select value={idGenero} onChange={(e) => setIdGenero(e.target.value)} required style={selectStyle}>
                <option value="" disabled>Seleccionar</option>
                {generos.map((g) => (
                  <option key={g.id_genero} value={g.id_genero} style={{ color: "#000" }}>{g.genero}</option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div
              style={{
                padding: "10px",
                borderRadius: "8px",
                background: "rgba(239,68,68,0.2)",
                color: "#fca5a5",
                fontSize: "0.85rem",
                textAlign: "center",
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "50px",
              border: "none",
              background: loading ? "rgba(15,58,115,0.5)" : "#0f3a73",
              color: "#fff",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: "8px",
            }}
          >
            {loading ? "Registrando..." : "Crear cuenta"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.9rem", opacity: 0.7 }}>
          ¿Ya tienes cuenta?{" "}
          <a href="/login" style={{ color: "#60a5fa", textDecoration: "none", fontWeight: 600 }}>
            Iniciar sesión
          </a>
        </div>

        <div style={{ textAlign: "center", marginTop: "1rem" }}>
          <a href="/" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none", fontSize: "0.85rem" }}>
            ← Volver
          </a>
        </div>
      </div>
    </div>
  );
}
