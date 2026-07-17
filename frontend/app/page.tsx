"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/services/auth.service";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (user) {
        router.push("/app");
      }
    }).catch(console.error);
  }, [router]);

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
          style={{ color: "#fff" }}
        >
          <path
            fill="currentColor"
            d="M10.2 3c0-1.105.696-2 1.8-2s1.8.895 1.8 2l.2 8c0-.364.5-5.66.5-6c0-1 .595-2 1.7-2s1.8.895 1.8 2v7.268c.083-.048.3-3.846.3-4.268c0-1 .263-2 1.2-2c.938 0 1.5.895 1.5 2v6a8 8 0 0 1-8 8h-.674a8 8 0 0 1-7.155-4.422l-2.842-5.684c-.364-.728-.084-1.668.72-2.024c.423-.187.897-.292 1.343-.15c1.108.353.944.86 1.608 1.49V5c0-1.105.695-2 1.8-2c1 0 1.609 1.315 1.7 2c.125.938.5 5.634.5 5.998z"
          />
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
            display: "none",
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
