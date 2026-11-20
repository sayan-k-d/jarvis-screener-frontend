"use client";
import React from "react";

// ---- formatting helpers -----------------------------------------------------
export const fmtBytes = (n: number): string =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const stripPdf = (n: string) => n.replace(/\.pdf$/i, "");

// ---- icons (inline SVG, no dependency) --------------------------------------
const P: Record<string, string> = {
  upload: "M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3",
  file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  x: "M6 6l12 12M18 6L6 18",
  alert: "M12 8v5m0 3.5v.01M10.3 3.9L2.5 17.5A2 2 0 004.2 20.5h15.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  send: "M5 12h14m0 0l-6-6m6 6l-6 6",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3",
  back: "M19 12H5m0 0l6-6m-6 6l6 6",
  plus: "M12 5v14M5 12h14",
  external: "M14 4h6v6m0-6L10 14M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5",
  retry: "M20 12a8 8 0 11-2.6-5.9M20 4v5h-5",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zm9 3l-4.3-4.3",
  chat: "M21 12a8 8 0 01-11.6 7.1L4 20l1-4.6A8 8 0 1121 12z",
};

export function Icon({ name, size = 16 }: { name: keyof typeof P; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: "none" }}
    >
      <path d={P[name]} />
    </svg>
  );
}

// ---- tiny markdown renderer (bold, code, bullets, numbered lists) -----------
function inline(text: string, keyBase: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.length > 4 && p.startsWith("**") && p.endsWith("**"))
      return <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>;
    if (p.length > 2 && p.startsWith("`") && p.endsWith("`"))
      return <code key={`${keyBase}-${i}`}>{p.slice(1, -1)}</code>;
    return <React.Fragment key={`${keyBase}-${i}`}>{p}</React.Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    out.push(
      <Tag key={`l${out.length}`}>
        {list.items.map((it, i) => (
          <li key={i}>{inline(it, `li${out.length}-${i}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((bullet || num)![1]);
      return;
    }
    flush();
    if (!line) return;
    const heading = line.match(/^#{1,4}\s+(.*)$/);
    out.push(
      <p key={`p${i}`}>
        {heading ? <strong>{inline(heading[1], `h${i}`)}</strong> : inline(line, `p${i}`)}
      </p>,
    );
  });
  flush();
  return <div className="md">{out}</div>;
}

/** Paragraphs from text separated by blank lines. */
export function Prose({ text }: { text: string }) {
  const parts = String(text || "")
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className="rl-prose">
      {parts.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}
