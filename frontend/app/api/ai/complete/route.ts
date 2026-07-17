import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `Eres un asistente de lengua de senas mexicana (LSM).
Recibes una secuencia de palabras en notacion "gloss" (palabras sueltas sin gramatica).
Tu tarea es convertirla a espanol mexicano natural y fluido, respetando el significado original.

REGLAS ESTRICTAS:
1. SOLO agrega articulos, preposiciones, conjugaciones, conectores y puntuacion.
2. NO inventes contenido, conceptos ni palabras que no esten en la frase original.
3. NO agregues saludos, despedidas ni formulas de cortesia (a menos que esten en la frase).
4. Si la frase ya es gramaticalmente correcta, devuelvela identica.
5. RESPONDE UNICAMENTE con la frase completada. Sin explicaciones, sin markdown, sin comillas.`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Groq API key not configured on the server." },
      { status: 500 },
    );
  }

  let phrase: string;
  try {
    const body = await request.json();
    phrase = (body.phrase || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!phrase || phrase.length < 3) {
    return NextResponse.json(
      { error: "Phrase too short. Minimum 3 characters." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: phrase },
          ],
          temperature: 0.2,
          max_tokens: 200,
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`[API/AI] Groq returned ${response.status}: ${errText}`);
      return NextResponse.json(
        { error: `Groq API error ${response.status}` },
        { status: 502 },
      );
    }

    const data = await response.json();
    const completed = data.choices?.[0]?.message?.content?.trim() || phrase;

    console.log(`[API/AI] "${phrase}" → "${completed}"`);

    return NextResponse.json({ completed });
  } catch (e) {
    console.error("[API/AI] proxy error:", e);
    return NextResponse.json({ error: "AI completion failed" }, { status: 500 });
  }
}
