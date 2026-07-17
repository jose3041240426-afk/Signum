import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/tts/elevenlabs?text=…&voice_id=…&model_id=…
 *
 * Server-side proxy that keeps the ElevenLabs API key out of the browser
 * (the key is read from ELEVENLABS_API_KEY in .env.local).
 *
 * Returns audio/mpeg on success, JSON with an error on failure.
 */
const FREE_TIER_VOICES: Record<string, string> = {
  "pNInz6obpgDQGcFmaJgB": "Adam",
  "21m00Tcm4TlvDq8ikWAM": "Rachel",
  "AZnzlk1XvdvUeBnXmlld": "Domi",
  "EXAVITQu4vr4xnSDxMaL": "Sarah",
  "MF3mGyEYCl7XYWbV9V6O": "Elli",
  "TxGEqnHWrfWFTfGW9XjX": "Josh",
  "VR6AewLTigWG4xSOukaG": "Arnold",
  "pFZP5JQG7iQjIQuC4Bku": "Lily",
  "bIHbv24MWmeRgasZH58o": "Will",
  "cgSgspJ2msm6clMCkdW9": "Jessica",
  "cjVigY5qzO86Huf0OWal": "Eric",
  "hpp4J3VqNfWAUOO0d1Us": "Bella",
  "iP95p4xoKVk53GoZ742B": "Chris",
  "nPczCjzI2devNBz1zQrb": "Brian",
  "onwK4e9ZLuTAKqWW03F9": "Daniel",
  "pqHfZKP75CvOlQylNhV4": "Bill",
  "CwhRBWXzGAHq8TQ4Fs17": "Roger",
  "FGY2WhTYpPnrIDTdsKH5": "Laura",
  "IKne3meq5aSn9XLyUdCD": "Charlie",
  "JBFqnCBsd6RMkjVDRZzb": "George",
  "N2lVS1w4EtoT3dr4eOWO": "Callum",
  "SAz9YHcvj6GT2YYXdXww": "River",
  "SOYHLrjzK2X1ezoPC6cr": "Harry",
  "TX3LPaxmHKxFdv7VOQHJ": "Liam",
  "Xb7hH8MSUJpSbSDYk0k2": "Alice",
  "XrExE9yKIg1WjnnlVkGX": "Matilda",
};

export async function GET(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs API key not configured on the server." },
      { status: 500 },
    );
  }

  const { searchParams } = request.nextUrl;
  const text = searchParams.get("text")?.slice(0, 500);
  const voiceId =
    searchParams.get("voice_id") || "pNInz6obpgDQGcFmaJgB"; // Adam (English male, free-friendly)
  const modelId =
    searchParams.get("model_id") || "eleven_multilingual_v2";

  if (!text) {
    return NextResponse.json(
      { error: "Missing 'text' parameter" },
      { status: 400 },
    );
  }

  const safeVoiceId = FREE_TIER_VOICES[voiceId] ? voiceId : "pNInz6obpgDQGcFmaJgB";

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${safeVoiceId}?model_id=${modelId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[API/TTS/ElevenLabs] upstream ${response.status}: ${errText}`);
      return NextResponse.json(
        { error: `ElevenLabs returned ${response.status}`, detail: errText },
        { status: response.status === 402 ? 402 : 502 },
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[API/TTS/ElevenLabs] proxy error:", e);
    return NextResponse.json(
      { error: "ElevenLabs proxy failed" },
      { status: 500 },
    );
  }
}
