import { apiBaseUrl } from '../config/env';

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function parseJson<T>(response: Response): Promise<ApiResult<T>> {
  const payload = (await response.json().catch(() => null)) as
    | { success?: boolean; data?: T; error?: string; message?: string }
    | null;

  if (!response.ok || !payload?.success) {
    return {
      ok: false,
      error: payload?.error ?? payload?.message ?? `Request failed (${response.status})`,
    };
  }

  return { ok: true, data: payload.data as T };
}

export async function apiPost<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return parseJson<T>(response);
}

export type { ApiResult };
