"use client";
import { ENV } from "@/lib/env";

interface CameraFeedProps {
  cameraOn: boolean;
  backendStatus: "checking" | "online" | "offline";
}

export function CameraFeed({ cameraOn, backendStatus }: CameraFeedProps) {
  if (backendStatus !== "online" || !cameraOn) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-black p-8 text-center">
        <h3 className="text-lg font-semibold text-white">
          {backendStatus === "online" ? "Cámara Apagada" : "Servidor de Inferencia Offline"}
        </h3>
        <p className="mt-2 max-w-md text-sm text-gray-400">
          {backendStatus === "offline"
            ? "Por favor, inicia tu servidor backend de Python ejecutando: uvicorn backend.app.main:app --reload"
            : "Pulsa el botón Encender Cámara para volver a activarla."}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
      <img
        src={`${ENV.BACKEND_URL}/video_feed`}
        alt="Signum Camera Stream"
        className="aspect-video w-full object-cover"
      />
    </div>
  );
}
