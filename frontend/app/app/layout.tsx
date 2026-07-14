"use client";
import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, signOut, recordActiveTime } from "@/services/auth.service";
import { MenuDrawer } from "@/components/ui/MenuDrawer";
import { FlipButton } from "@/components/ui/FlipButton";
import { NavButton } from "@/components/ui/NavButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [glassOpacity, setGlassOpacity] = useState(0.05);

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(console.error);
    
    // Leer opacidad inicial
    if (typeof window !== "undefined") {
      const savedOpacity = localStorage.getItem("glassOpacity");
      if (savedOpacity !== null) {
        setGlassOpacity(parseFloat(savedOpacity));
      } else {
        setGlassOpacity(0.05);
      }
    }

    // Escuchar cambios de localStorage en el mismo documento (por ej. cuando se guarda configuración)
    const handleStorageChange = () => {
      const savedOpacity = localStorage.getItem("glassOpacity");
      if (savedOpacity !== null) {
        setGlassOpacity(parseFloat(savedOpacity));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    // Custom event para cambios en la misma pestaña
    window.addEventListener("glassOpacityChange", handleStorageChange as EventListener);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("glassOpacityChange", handleStorageChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      recordActiveTime(currentUser.id, 1).catch(console.error);
    }, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/");
  }, [router]);

  const titleText =
    pathname === "/app" ? "SIGNUM" :
    pathname === "/app/perfil" ? "MI PERFIL" :
    pathname === "/app/estadisticas" ? "ESTADÍSTICAS" :
    pathname === "/app/ajustes" ? "AJUSTES" : "SIGNUM";

  return (
    <>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
        :root {
          --glass-opacity: ${glassOpacity};
        }
      `}</style>
      <div style={{ position: "fixed", left: "20px", top: "32px", zIndex: 50 }}>
        <MenuDrawer>
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", boxSizing: "border-box" }}>
            <h3 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700, marginTop: "3rem", marginBottom: "1rem" }}>
              Opciones
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <NavButton onClick={() => router.push("/app")}>Registrar</NavButton>
              <NavButton onClick={() => router.push("/app/estadisticas")}>Estadísticas</NavButton>
              <NavButton onClick={() => router.push("/app/perfil")}>Perfil</NavButton>
              <NavButton onClick={() => router.push("/app/ajustes")}>Ajustes</NavButton>
            </div>
            <div style={{ marginTop: "auto", display: "flex", justifyContent: "center", paddingBottom: "2rem" }}>
              <FlipButton onClick={handleSignOut} />
            </div>
          </div>
        </MenuDrawer>
      </div>
      <div
        style={{
          minHeight: "100vh",
          background: "transparent",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "2rem",
          fontFamily: "'Segoe UI', Roboto, system-ui, sans-serif",
          color: "#ffffff",
        }}
      >
        <header
          style={{
            textAlign: "center",
            marginBottom: "2rem",
            width: "100%",
            maxWidth: "1100px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "1rem",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <svg
                width="48"
                height="48"
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
                <path d="M6 11V8a2 2 0 0 0-4 0v10a8 8 0 0 0 8 8h1a8 8 0 0 0 8-8v-3.5a2.5 2.5 0 0 0-5 0V11" />
                <path d="M16 11l3-3" />
                <path d="M4 11l-2-2" />
                <path d="M10 2v2" />
              </svg>
              <h1
                style={{
                  fontSize: "3.5rem",
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: "1px",
                  textShadow: "0 2px 10px rgba(0,0,0,0.1)",
                }}
              >
                {titleText}
              </h1>
            </div>
          </div>
        </header>
        {children}
      </div>
    </>
  );
}
