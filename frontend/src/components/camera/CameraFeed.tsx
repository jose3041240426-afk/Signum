"use client";
import { RefObject } from "react";

interface CameraFeedProps {
  cameraOn: boolean;
  backendStatus: "checking" | "online" | "offline";
  videoRef: RefObject<HTMLVideoElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
}

export function CameraFeed({ cameraOn, backendStatus, videoRef, canvasRef }: CameraFeedProps) {
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
      <video
        ref={videoRef}
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
        playsInline
        muted
      />
      <canvas
        ref={canvasRef}
        className="aspect-video w-full object-cover"
      />
    </div>
  );
}
