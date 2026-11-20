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

export const researchApi = {
  status: () => jf<{ hasKey: boolean; model: string }>("/api/research/status"),
  list: () => jf<ResearchSummary[]>("/api/research"),
  get: (id: string) => jf<ResearchRecord>(`/api/research/${id}`),
  create: (a: File, b: File, focus: string) => {
    const fd = new FormData();
    fd.append("reportA", a);
    fd.append("reportB", b);
    if (focus.trim()) fd.append("focus", focus.trim());
    return jf<{ id: string }>("/api/research/compare", { method: "POST", body: fd });
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
