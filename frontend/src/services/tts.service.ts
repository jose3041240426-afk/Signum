import { ENV } from "@/lib/env";

export function fetchAudioUrl(text: string): string {
  return `${ENV.BACKEND_URL}/tts?text=${encodeURIComponent(text)}`;
}

export async function generateAudioBlob(text: string): Promise<string> {
  const res = await fetch(`${ENV.BACKEND_URL}/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.trim() }),
  });
  if (!res.ok) throw new Error("TTS request failed");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
