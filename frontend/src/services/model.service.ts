import { fetchJson } from "./api-client";

export interface TrainLetterResult {
  msg: string;
  classes: string[];
}

export interface TrainWordResult {
  msg: string;
  classes: string[];
  total_sequences: number;
}

export interface TrainDynamicResult {
  msg: string;
  classes: string[];
  total_sequences: number;
}

export async function trainSignModel(): Promise<TrainLetterResult> {
  return fetchJson<TrainLetterResult>("/train", { method: "POST" });
}

export async function trainWordModel(): Promise<TrainWordResult> {
  return fetchJson<TrainWordResult>("/train_words", { method: "POST" });
}

export async function trainDynamicModel(): Promise<TrainDynamicResult> {
  return fetchJson<TrainDynamicResult>("/train_dynamic", { method: "POST" });
}
