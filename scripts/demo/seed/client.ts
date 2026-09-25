import type { Hono } from 'hono';

// One browser: a cookie jar, an Origin, and the app answering in-process.

export class Browser {
  readonly jar = new Map<string, string>();

  constructor(
    private readonly app: Hono<any>,
    private readonly origin: string,
    private readonly ip = '192.0.2.1',
  ) {}

  async request(
    method: string,
    path: string,
    body?: unknown,
    extra: Record<string, string> = {},
  ): Promise<Response> {
    const headers = new Headers({ origin: this.origin, 'x-real-ip': this.ip, ...extra });
    if (this.jar.size > 0) {
      headers.set('cookie', [...this.jar].map(([name, value]) => `${name}=${value}`).join('; '));
    }
    let payload: BodyInit | undefined;
    if (body instanceof Uint8Array) {
      payload = new Blob([body as Uint8Array<ArrayBuffer>]);
    } else if (body !== undefined) {
      headers.set('content-type', 'application/json');
      payload = JSON.stringify(body);
    }
    const res = await this.app.request(path, { method, headers, body: payload });
    for (const header of res.headers.getSetCookie()) {
      const [pair, ...attrs] = header.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const maxAge = attrs.map((a) => a.trim().toLowerCase()).find((a) => a.startsWith('max-age='));
      if (value === '' || (maxAge !== undefined && Number(maxAge.slice(8)) <= 0))
        this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return res;
  }

  async json<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.request(method, path, body);
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 400)}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  get<T = any>(path: string) {
    return this.json<T>('GET', path);
  }
  post<T = any>(path: string, body?: unknown) {
    return this.json<T>('POST', path, body ?? {});
  }
  patch<T = any>(path: string, body?: unknown) {
    return this.json<T>('PATCH', path, body ?? {});
  }
  put<T = any>(path: string, body?: unknown) {
    return this.json<T>('PUT', path, body ?? {});
  }
  del<T = any>(path: string) {
    return this.json<T>('DELETE', path);
  }
}
