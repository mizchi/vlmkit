import type { HtmlSource } from "../api-types.ts";

export async function loadCraterAvailability(): Promise<boolean> {
  const { isCraterAvailable } = await import("@mizchi/vlmkit-capture/crater-client.ts");
  return await isCraterAvailable();
}

export async function resolveHtmlSource(source: HtmlSource): Promise<string | null> {
  if (source.html) return source.html;
  if (!source.url) return null;

  try {
    if (!source.url.startsWith("http://") && !source.url.startsWith("https://")) {
      return null;
    }
    const parsed = new URL(source.url);
    const hostname = parsed.hostname;
    if (
      hostname === "localhost"
      || hostname.startsWith("127.")
      || hostname.startsWith("10.")
      || hostname.startsWith("172.")
      || hostname.startsWith("192.168.")
      || hostname === "169.254.169.254"
      || hostname === "[::1]"
      || hostname === "0.0.0.0"
    ) {
      return null;
    }
    const res = await fetch(source.url);
    return await res.text();
  } catch {
    return null;
  }
}
