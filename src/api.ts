async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { ...init, headers: { "Content-Type": "application/json" } });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T = unknown>(path: string, data: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T = unknown>(path: string, data: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  del: (path: string) => request<void>(path, { method: "DELETE" }),
};