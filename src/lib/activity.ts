// Reports real actions to the backend's activity log so the dashboard can show how the
// system is actually used and how it performs. Fire-and-forget: it can never slow down
// or break the feature that calls it.
const BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");

export function logActivity(e: {
  kind: "stock_analysis" | "compare";
  ok: boolean;
  ms?: number;
  cached?: boolean;
  items?: string[];
  detail?: string;
}): void {
  try {
    fetch(`${BASE}/api/activity`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(e),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* telemetry must never throw */
  }
}
