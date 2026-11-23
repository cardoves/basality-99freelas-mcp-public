const MAX_HTML_BYTES = 1024 * 1024;

async function readLimitedHtml(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
    throw new Error("Public page exceeds the allowed size.");
  }
  if (!response.body) throw new Error("Public page returned an empty body.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_HTML_BYTES) {
        await reader.cancel();
        throw new Error("Public page exceeds the allowed size.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function fetchPublicHtml(url: URL, fetchImpl: typeof fetch = fetch): Promise<string> {
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.99freelas.com.br" ||
    url.port || url.username || url.password
  ) {
    throw new Error("Public HTML access is restricted to 99Freelas HTTPS URLs.");
  }
  const response = await fetchImpl(url, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
    headers: {
      accept: "text/html",
      "user-agent": "Basality99FreelasMCP/0.1 (read-only; source on GitHub)",
    },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Redirect blocked; this URL needs manual verification.");
  }
  if (!response.ok) throw new Error(`Public page request failed (HTTP ${response.status}).`);
  if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
    throw new Error("Expected a public HTML page.");
  }
  return readLimitedHtml(response);
}
