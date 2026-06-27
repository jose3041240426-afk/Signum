import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/tts?text=Hola&lang=es
 *
 * Proxies Google Translate's public TTS endpoint so the browser
 * can play the audio without CORS issues.
 * 100% Next.js — no Python needed.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const text = searchParams.get("text");
  const lang = searchParams.get("lang") || "es";

  if (!text) {
    return NextResponse.json({ error: "Missing 'text' parameter" }, { status: 400 });
  }

  const encoded = encodeURIComponent(text.slice(0, 200));
  const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encoded}`;

  try {
    const response = await fetch(googleUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://translate.google.com/",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Google TTS returned ${response.status}` },
        { status: 502 },
      );
    }

    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    console.error("[API/TTS] Proxy error:", e);
    return NextResponse.json({ error: "TTS proxy failed" }, { status: 500 });
  }
}
