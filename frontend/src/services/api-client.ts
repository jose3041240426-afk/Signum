import { ENV } from "@/lib/env";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${ENV.BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const payload = await res.json();
      detail = payload.detail ?? detail;
    } catch {
      /* no-op */
    }
    throw new ApiError(detail, res.status);
  }
  return res.json() as Promise<T>;
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return fetchJson<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

function del(path: string): Promise<Response> {
  return fetch(`${ENV.BACKEND_URL}${path}`, { method: "DELETE" });
}

export { fetchJson, postJson, del };
