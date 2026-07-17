"use client";
import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser, signOut, recordActiveTime, getUserRoles } from "@/services/auth.service";
import { MenuDrawer } from "@/components/ui/MenuDrawer";
import { FlipButton } from "@/components/ui/FlipButton";
import { NavButton } from "@/components/ui/NavButton";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [glassOpacity, setGlassOpacity] = useState(0.05);
  const [glassBorder, setGlassBorder] = useState(0);
  const [animateText, setAnimateText] = useState(true);

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(console.error);
    
    if (typeof window !== "undefined") {
      const savedOpacity = localStorage.getItem("glassOpacity");
      if (savedOpacity !== null) {
        setGlassOpacity(parseFloat(savedOpacity));
      } else {
        setGlassOpacity(0.05);
      }

      const savedBorder = localStorage.getItem("glassBorder");
      if (savedBorder !== null) {
        setGlassBorder(parseInt(savedBorder, 10));
      }
    }

    const handleStorageChange = () => {
      const savedOpacity = localStorage.getItem("glassOpacity");
      if (savedOpacity !== null) {
        setGlassOpacity(parseFloat(savedOpacity));
      }
      const savedBorder = localStorage.getItem("glassBorder");
      if (savedBorder !== null) {
        setGlassBorder(parseInt(savedBorder, 10));
      }
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("glassOpacityChange", handleStorageChange as EventListener);
    window.addEventListener("glassBorderChange", handleStorageChange as EventListener);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("glassOpacityChange", handleStorageChange as EventListener);
      window.removeEventListener("glassBorderChange", handleStorageChange as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      recordActiveTime(currentUser.id, 1).catch(console.error);
    }, 60000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    getUserRoles(currentUser.id).then((roles) => {
      setIsAdmin(roles.some((r: any) => r.roles?.nombre_rol === "Administrador"));
    }).catch(console.error);
  }, [currentUser]);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/");
  }, [router]);

  const titleText =
    pathname === "/app" ? "SIGNUM" :
    pathname === "/app/perfil" ? "MI PERFIL" :
    pathname === "/app/estadisticas" ? "ESTADÍSTICAS" :
    pathname === "/app/ajustes" ? "AJUSTES" :
    pathname === "/app/acerca-de" ? "ACERCA DE" :
    pathname === "/app/acerca-de/evaluar" ? "EVALUAR" :
    pathname === "/app/admin/dashboard" ? "DASHBOARD" : "SIGNUM";

  return (
    <>
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.3); } }
        @keyframes drawText {
          0% { stroke-dashoffset: 1200; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes fillText {
          0% { fill: transparent; }
          100% { fill: currentColor; }
        }
        .signum-text {
          stroke: currentColor;
          stroke-width: 1.5;
          stroke-dasharray: 1200;
          fill: currentColor;
        }
        .signum-text.animated {
          fill: transparent;
          animation: drawText 2.5s ease-in-out forwards, fillText 0.5s ease 2s forwards;
        }
        :root {
          --glass-opacity: ${glassOpacity};
          --glass-border: ${glassBorder}px solid rgba(255, 255, 255, 0.3);
          --text-color: ${glassOpacity < 0.4 ? "#ffffff" : "#000000"};
          --text-shadow: ${glassOpacity < 0.4 ? "0 1px 3px rgba(0,0,0,0.6)" : "none"};
        }
        p, h1, h2, h3, h4, h5, h6, span, label, td, th, li, option {
          transition: color 0.3s ease;
        }
      `}</style>
      <div style={{ position: "fixed", left: "20px", top: "32px", zIndex: 50 }}>
        <MenuDrawer>
          <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 48px)", boxSizing: "border-box" }}>
            <h3 style={{ color: "#fff", fontSize: "1.25rem", fontWeight: 700, marginTop: "3rem", marginBottom: "1rem" }}>
              Opciones
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <NavButton onClick={() => router.push("/app")}>Registrar palabras</NavButton>
              <NavButton onClick={() => router.push("/app/estadisticas")}>Estadísticas</NavButton>
              <NavButton onClick={() => router.push("/app/perfil")}>Perfil</NavButton>
              <NavButton onClick={() => router.push("/app/ajustes")}>Ajustes</NavButton>
              <NavButton onClick={() => router.push("/app/acerca-de")}>Acerca de</NavButton>
              {isAdmin && (
                <NavButton onClick={() => router.push("/app/admin/dashboard")}>Dashboard</NavButton>
              )}
            </div>
            <div style={{ marginTop: "auto", display: "flex", justifyContent: "center", paddingBottom: "2rem" }}>
              <FlipButton onClick={handleSignOut} />
            </div>
          </div>
        </MenuDrawer>
      </div>
      <div
        className="stagger"
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
                style={{ color: "#fff" }}
              >
                <path
                  fill="currentColor"
                  d="M10.2 3c0-1.105.696-2 1.8-2s1.8.895 1.8 2l.2 8c0-.364.5-5.66.5-6c0-1 .595-2 1.7-2s1.8.895 1.8 2v7.268c.083-.048.3-3.846.3-4.268c0-1 .263-2 1.2-2c.938 0 1.5.895 1.5 2v6a8 8 0 0 1-8 8h-.674a8 8 0 0 1-7.155-4.422l-2.842-5.684c-.364-.728-.084-1.668.72-2.024c.423-.187.897-.292 1.343-.15c1.108.353.944.86 1.608 1.49V5c0-1.105.695-2 1.8-2c1 0 1.609 1.315 1.7 2c.125.938.5 5.634.5 5.998z"
                />
              </svg>
              <svg
                width="280"
                height="56"
                viewBox="0 0 280 56"
                style={{ color: "#fff", overflow: "visible" }}
              >
                <text
                  x="0"
                  y="45"
                  fontFamily="'Segoe UI', Roboto, system-ui, sans-serif"
                  fontSize="48"
                  fontWeight="800"
                  letterSpacing="1"
                  className={`signum-text${animateText ? " animated" : ""}`}
                >
                  {titleText}
                </text>
              </svg>
            </div>
          </div>
        </header>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", color: "var(--text-color, #ffffff)" }}>
          {children}
        </div>
      </div>
    </>
  );
}
