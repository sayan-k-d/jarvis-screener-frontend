// Research Library API client (PDF comparison + Q&A). The OpenAI key never reaches
// the browser: every call goes to the NestJS backend, directly or via the Next proxy.
const BASE = (process.env.NEXT_PUBLIC_BACKEND_URL || "").replace(/\/$/, "");
const url = (p: string) => `${BASE}${p}`;

export type RecordStatus = "processing" | "complete" | "failed";
export type DocStatus =
  | "pending"
  | "extracting"
  | "extracted"
  | "analyzing"
  | "analyzed"
  | "error";

export interface DocInfo {
  name: string;
  size: number;
  pages: number;
  chars: number;
  truncated: boolean;
  status: DocStatus;
}
export interface KeyFigure {
  label: string;
  value: string;
  context: string;
  page?: number | null;
}
export interface DocAnalysis {
  title: string;
  entity: string;
  report_type: string;
  period: string;
  summary: string;
  key_figures: KeyFigure[];
  highlights: string[];
  risks: string[];
  outlook: string;
  themes: string[];
}
export interface Comparison {
  title: string;
  headline: string;
  executive_summary: string;
  comparability: { level: "high" | "medium" | "low"; reason: string };
  key_differences: {
    topic: string;
    report_a: string;
    report_b: string;
    insight: string;
  }[];
  similarities: string[];
  metrics: { metric: string; report_a: string; report_b: string; note: string }[];
  strengths: { a: string[]; b: string[] };
  concerns: { a: string[]; b: string[] };
  outlook: string;
  next_steps: string[];
  caveats: string[];
  suggested_questions: string[];
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  at: string;
  sources?: { doc: "A" | "B"; page: number }[];
}
export interface ResearchRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  focus: string;
  status: RecordStatus;
  stage: "queued" | "extract" | "analyze" | "compare" | "done";
  progress: number;
  message: string;
  error?: string;
  model: string;
  docs: [DocInfo, DocInfo];
  analyses?: [DocAnalysis, DocAnalysis];
  comparison?: Comparison;
  chat: ChatMessage[];
}
export interface ResearchSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: RecordStatus;
  stage: ResearchRecord["stage"];
  progress: number;
  headline?: string;
  docs: { name: string; pages: number }[];
  questions: number;
  error?: string;
}

async function jf<T>(path: string, opts?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url(path), opts);
  } catch {
    throw new Error("Could not reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.message) msg = Array.isArray(j.message) ? j.message.join(", ") : j.message;
    } catch {
      /* keep default */
    }
    if (res.status === 413) msg = "That file is too large (25 MB maximum per PDF).";
    throw new Error(msg);
  }
  return res.json();
}

// Both files together in one request must stay under the host's body limit (4.5 MB on Vercel).
const DIRECT_LIMIT = 3.5 * 1024 * 1024;
const CHUNK_BYTES = 3 * 1024 * 1024;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends one file to the server in pieces; returns what the server needs to stitch it together. */
async function uploadInChunks(file: File, onBytes: (n: number) => void): Promise<{ uploadId: string; chunks: number }> {
  const start = await jf<{ uploadId: string; maxChunkBytes: number }>("/api/research/uploads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size }),
  });
  const size = Math.min(CHUNK_BYTES, start.maxChunkBytes || CHUNK_BYTES);
  const chunks = Math.ceil(file.size / size);
  for (let i = 0; i < chunks; i++) {
    const piece = file.slice(i * size, Math.min(file.size, (i + 1) * size));
    const fd = new FormData();
    fd.append("index", String(i));
    fd.append("chunk", piece, "chunk");
    for (let attempt = 1; ; attempt++) {
      try {
        await jf(`/api/research/uploads/${start.uploadId}/chunk`, { method: "POST", body: fd });
        break;
      } catch (e) {
        if (attempt >= 3) throw e; // a flaky connection gets two retries per piece
        await sleep(700 * attempt);
      }
    }
    onBytes(piece.size);
  }
  return { uploadId: start.uploadId, chunks };
}

export const researchApi = {
  status: () =>
    jf<{ hasKey: boolean; model: string; keyStatus?: "ok" | "rejected" | "unknown" | "missing" }>(
      "/api/research/status",
    ),
  list: () => jf<ResearchSummary[]>("/api/research"),
  get: (id: string) => jf<ResearchRecord>(`/api/research/${id}`),
  /**
   * Upload two PDFs and start the analysis. Serverless hosts (e.g. Vercel) reject request
   * bodies over ~4.5 MB, so anything bigger than DIRECT_LIMIT travels in small chunks that the
   * server stitches back together. `onProgress` receives 0-100 while uploading.
   */
  create: async (a: File, b: File, focus: string, onProgress?: (pct: number) => void) => {
    if (a.size + b.size <= DIRECT_LIMIT) {
      const fd = new FormData();
      fd.append("reportA", a);
      fd.append("reportB", b);
      if (focus.trim()) fd.append("focus", focus.trim());
      onProgress?.(100);
      return jf<{ id: string }>("/api/research/compare", { method: "POST", body: fd });
    }
    const total = a.size + b.size;
    let sent = 0;
    const bump = (n: number) => {
      sent += n;
      onProgress?.(Math.min(99, Math.round((sent / total) * 100)));
    };
    onProgress?.(0);
    const upA = await uploadInChunks(a, bump);
    const upB = await uploadInChunks(b, bump);
    const res = await jf<{ id: string }>("/api/research/compare-uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ a: upA, b: upB, focus: focus.trim() }),
    });
    onProgress?.(100);
    return res;
  },
  retry: (id: string) => jf<{ id: string }>(`/api/research/${id}/retry`, { method: "POST" }),
  remove: (id: string) => jf<{ ok: boolean }>(`/api/research/${id}`, { method: "DELETE" }),
  ask: (id: string, question: string) =>
    jf<{ user: ChatMessage; assistant: ChatMessage }>(`/api/research/${id}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    }),
  clearChat: (id: string) =>
    jf<{ ok: boolean }>(`/api/research/${id}/chat`, { method: "DELETE" }),
  fileUrl: (id: string, which: "a" | "b") => url(`/api/research/${id}/file/${which}`),
};
