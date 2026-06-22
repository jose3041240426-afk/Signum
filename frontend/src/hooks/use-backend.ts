import { useState, useEffect, useRef } from "react";
import { checkHealth } from "@/services/backend.service";
import type { BackendStatus } from "@/types";

export function useBackend() {
  const [status, setStatus] = useState<BackendStatus>("checking");
  const [modelLoaded, setModelLoaded] = useState(false);
  const [wordModelLoaded, setWordModelLoaded] = useState(false);
  const [dynamicModelLoaded, setDynamicModelLoaded] = useState(false);
  const [message, setMessage] = useState("Conectando con el servidor de Python...");

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (!alive) return;
      try {
        const data = await checkHealth();
        if (data.ok) {
          setStatus("online");
          setModelLoaded(data.modelLoaded);
          setWordModelLoaded(data.wordModelLoaded);
          setDynamicModelLoaded(data.dynamicModelLoaded);
          if (data.modelLoaded || data.wordModelLoaded || data.dynamicModelLoaded) {
            setMessage("Servidor en linea - Haz senas LSM");
          } else {
            setMessage("Servidor en linea pero no hay modelos entrenados. Entrena tu modelo.");
          }
        } else {
          setStatus("offline");
          setMessage("Servidor Python desconectado. Ejecuta uvicorn en la terminal.");
        }
      } catch {
        setStatus("offline");
        setMessage("Servidor Python desconectado. Ejecuta uvicorn en la terminal.");
      }
    };

    tick();
    const id = setInterval(tick, 3000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return { status, modelLoaded, wordModelLoaded, dynamicModelLoaded, message, setMessage };
}
