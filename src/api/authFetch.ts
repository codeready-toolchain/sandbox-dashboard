let tokenGetter: (() => Promise<string>) | null = null;

export function setTokenGetter(fn: () => Promise<string>) {
  tokenGetter = fn;
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (tokenGetter) {
    const token = await tokenGetter();
    if (init?.signal?.aborted) {
      const reason = init.signal.reason;
      if (reason instanceof Error) {
        throw reason;
      }
      if (typeof DOMException !== "undefined") {
        throw new DOMException("The operation was aborted.", "AbortError");
      }
      const error = new Error("The operation was aborted.");
      error.name = "AbortError";
      throw error;
    }
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
  }
  return fetch(input, { ...init, headers });
}
