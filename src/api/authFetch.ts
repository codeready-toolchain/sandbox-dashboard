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
    headers.set("Authorization", `Bearer ${token}`);
    headers.set("Accept", "application/json");
  }
  return fetch(input, { ...init, headers });
}
