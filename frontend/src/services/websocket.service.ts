import { ENV } from "@/lib/env";

export interface WSPredictionResult {
  letter: string;
  confidence: number;
  word: string;
  word_confidence: number;
  dynamic_sign: string;
  dynamic_confidence: number;
  hand_detected: boolean;
}

type OnPrediction = (result: WSPredictionResult) => void;
type OnStatusChange = (connected: boolean) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let shouldReconnect = false;
let pendingLandmarks: number[] | null = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 3;

export function connectWebSocket(
  onPrediction: OnPrediction,
  onStatusChange: OnStatusChange,
  mode: string = "letters",
): void {
  shouldReconnect = true;
  reconnectAttempts = 0;
  const url = ENV.BACKEND_URL.replace(/^http/, "ws") + "/ws/predict";

  try {
    ws = new WebSocket(url);

    ws.onopen = () => {
      onStatusChange(true);
      if (pendingLandmarks) {
        sendLandmarks(pendingLandmarks, mode);
        pendingLandmarks = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSPredictionResult;
        onPrediction(data);
      } catch {
        /* ignore malformed */
      }
    };

    ws.onclose = () => {
      onStatusChange(false);
      if (shouldReconnect && reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        reconnectTimer = setTimeout(
          () => connectWebSocket(onPrediction, onStatusChange, mode),
          2000,
        );
      } else {
        shouldReconnect = false;
      }
    };

    ws.onerror = () => {
      onStatusChange(false);
    };
  } catch {
    onStatusChange(false);
  }
}

export function sendLandmarks(landmarks: number[], mode: string): void {
  const payload = JSON.stringify({ landmarks, mode });
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(payload);
  } else {
    pendingLandmarks = landmarks;
  }
}

export function disconnectWebSocket(): void {
  shouldReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
}
