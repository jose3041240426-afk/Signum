"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <svg
          width="64"
          height="64"
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
            fontSize: "4.5rem",
            fontWeight: 800,
            margin: 0,
            letterSpacing: "2px",
            textShadow: "0 2px 10px rgba(0,0,0,0.1)",
          }}
        >
          SIGNUM
        </h1>
      </div>
      <p
        style={{
          fontSize: "1.15rem",
          opacity: 0.85,
          marginTop: "0.5rem",
          marginBottom: "3rem",
          textAlign: "center",
        }}
      >
        Conecta con el mundo usando Lengua de Señas Mexicana.
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "100%",
          maxWidth: "320px",
        }}
      >
        <button
          onClick={() => router.push("/login")}
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
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.02)";
            e.currentTarget.style.boxShadow = "0 12px 28px rgba(15, 58, 115, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 8px 20px rgba(15, 58, 115, 0.3)";
          }}
        >
          Iniciar sesión
        </button>

        <button
          onClick={() => router.push("/register")}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: "50px",
            border: "2px solid rgba(255,255,255,0.5)",
            background: "rgba(255,255,255,0.1)",
            backdropFilter: "blur(4px)",
            color: "#fff",
            fontSize: "1.1rem",
            fontWeight: 700,
            cursor: "pointer",
            transition: "transform 0.2s ease, background 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.02)";
            e.currentTarget.style.background = "rgba(255,255,255,0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          }}
        >
          Registrarse
        </button>

        <button
          onClick={() => router.push("/app")}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.6)",
            fontSize: "0.95rem",
            fontWeight: 500,
            cursor: "pointer",
            padding: "8px",
            transition: "color 0.2s ease",
            textDecoration: "underline",
            textUnderlineOffset: "3px",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.9)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(255,255,255,0.6)";
          }}
        >
          Entrar como invitado
        </button>
      </div>
    </div>
  );
}
