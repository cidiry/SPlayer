const isNeteaseMusicUrl = (url: URL) =>
  url.protocol === "https:" &&
  (url.hostname === "music.126.net" || url.hostname.endsWith(".music.126.net"));

export const config = {
  runtime: "edge",
};

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return new Response("Missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  const headers = new Headers();
  for (const name of ["range", "if-range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  for (let redirects = 0; redirects < 4; redirects++) {
    if (!isNeteaseMusicUrl(target)) return new Response("Unsupported url", { status: 403 });

    const response = await fetch(target, {
      method: request.method === "HEAD" ? "HEAD" : "GET",
      headers,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return new Response("Invalid redirect", { status: 502 });
      target = new URL(location, target);
      continue;
    }

    const responseHeaders = new Headers();
    for (const name of [
      "accept-ranges",
      "content-length",
      "content-range",
      "content-type",
      "etag",
      "last-modified",
    ]) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("cache-control", "no-store");
    responseHeaders.set("vary", "range");
    return new Response(response.body, { status: response.status, headers: responseHeaders });
  }

  return new Response("Too many redirects", { status: 502 });
}
