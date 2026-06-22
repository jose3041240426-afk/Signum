import { fetchJson, del } from "./api-client";

export async function startLetterCapture(letter: string): Promise<void> {
  await fetchJson<{ msg: string }>(`/start_capture/${letter}`, { method: "POST" });
}

export async function startWordCapture(word: string): Promise<void> {
  await fetchJson<{ msg: string }>(`/start_capture_word/${encodeURIComponent(word.trim())}`, {
    method: "POST",
  });
}

export async function startDynamicCapture(signName: string): Promise<{ msg: string; sequences_needed: number; frames_per_sequence: number }> {
  return fetchJson<{ msg: string; sequences_needed: number; frames_per_sequence: number }>(
    `/start_capture_dynamic/${encodeURIComponent(signName.trim())}`,
    { method: "POST" }
  );
}

export async function stopWordCapture(): Promise<{ msg: string; sequences_saved?: number }> {
  return fetchJson<{ msg: string; sequences_saved?: number }>("/stop_capture_word", { method: "POST" });
}

export async function stopDynamicCapture(): Promise<{ msg: string; sequences_saved: number }> {
  return fetchJson<{ msg: string; sequences_saved: number }>("/stop_capture_dynamic", { method: "POST" });
}

export async function getRegisteredLetters(): Promise<string[]> {
  try {
    const data = await fetchJson<{ registered: string[] }>("/registered_letters");
    return data.registered;
  } catch {
    return [];
  }
}

export async function getRegisteredWords(): Promise<string[]> {
  try {
    const data = await fetchJson<{ registered: string[] }>("/registered_words");
    return data.registered;
  } catch {
    return [];
  }
}

export async function getRegisteredDynamic(): Promise<string[]> {
  try {
    const data = await fetchJson<{ registered: string[] }>("/registered_dynamic");
    return data.registered;
  } catch {
    return [];
  }
}

export async function deleteWord(word: string): Promise<void> {
  await del(`/delete_word/${encodeURIComponent(word)}`);
}

export async function deleteDynamic(signName: string): Promise<void> {
  await del(`/delete_dynamic/${encodeURIComponent(signName)}`);
}
