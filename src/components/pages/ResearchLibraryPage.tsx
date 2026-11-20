"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  researchApi,
  type ResearchRecord,
  type ResearchSummary,
} from "@/lib/researchApi";
import { RESEARCH_CSS } from "@/components/research/researchStyles";
import { Icon, fmtBytes, fmtDate, stripPdf } from "@/components/research/ui";
import AnalysisLoader from "@/components/research/AnalysisLoader";
import ResultView from "@/components/research/ResultView";

const MAX_BYTES = 25 * 1024 * 1024;

function validate(f: File): string {
  const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
  if (!isPdf) return "Only PDF files are supported.";
  if (f.size === 0) return "That file is empty.";
  if (f.size > MAX_BYTES) return `That file is ${fmtBytes(f.size)} — the limit is 25 MB per PDF.`;
  return "";
}

// ---------------------------------------------------------------- drop zone
function DropZone({
  tone,
  file,
  onFile,
  disabled,
}: {
  tone: "a" | "b";
  file: File | null;
  onFile: (f: File | null) => void;
  disabled: boolean;
}) {
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const take = (f?: File | null) => {
    if (!f) return;
    const e = validate(f);
    setErr(e);
    if (!e) onFile(f);
  };

  return (
    <div>
      <div className="rl-row" style={{ marginBottom: 8 }}>
        <span className={`rl-tag ${tone}`}>Report {tone.toUpperCase()}</span>
      </div>
      {file ? (
        <div className={`rl-drop has ${tone}`}>
          <div className="rl-file">
            <div className="rl-file-ic">PDF</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="rl-file-name">{file.name}</div>
              <div className="rl-sub">{fmtBytes(file.size)}</div>
            </div>
            <button
              className="rl-btn ghost"
              onClick={() => {
                setErr("");
                onFile(null);
              }}
              disabled={disabled}
              aria-label={`Remove report ${tone.toUpperCase()}`}
            >
              <Icon name="x" />
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`rl-drop ${tone} ${over ? "over" : ""}`}
          role="button"
          tabIndex={0}
          aria-label={`Choose the PDF for report ${tone.toUpperCase()}`}
          onClick={() => !disabled && input.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !disabled) {
              e.preventDefault();
              input.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            if (!disabled) take(e.dataTransfer.files?.[0]);
          }}
        >
          <div className="rl-dz-ic">
            <Icon name="upload" size={20} />
          </div>
          <div style={{ fontWeight: 600 }}>Drop a PDF here or click to browse</div>
          <div className="rl-sub">PDF only · up to 25 MB</div>
          <input
            ref={input}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              take(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}
      {err && (
        <p style={{ color: "var(--red)", fontSize: 12.5, marginTop: 6 }} role="alert">
          {err}
        </p>
      )}
    </div>
  );
}

// ------------------------------------------------------------ confirm dialog
function Confirm({
  title,
  body,
  confirm,
  onCancel,
  onConfirm,
  busy,
}: {
  title: string;
  body: string;
  confirm: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [busy, onCancel]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => !busy && onCancel()}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div className="card" style={{ maxWidth: 420, width: "100%", padding: 22 }} onClick={(e) => e.stopPropagation()}>
        <h3 className="rl-sec-title" style={{ fontSize: 17 }}>{title}</h3>
        <p className="rl-sub" style={{ margin: "8px 0 18px", fontSize: 14 }}>{body}</p>
        <div className="rl-row" style={{ justifyContent: "flex-end" }}>
          <button className="rl-btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button className="rl-btn primary" style={{ background: "var(--red)", borderColor: "var(--red)" }} onClick={onConfirm} disabled={busy}>
            {busy ? "Deleting…" : confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- record view
function RecordView({
  id,
  onBack,
  onDeleted,
}: {
  id: string;
  onBack: () => void;
  onDeleted: () => void;
}) {
  const [rec, setRec] = useState<ResearchRecord | null>(null);
  const [error, setError] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await researchApi.get(id);
      setRec(r);
      setError("");
      return r;
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, [id]);

  useEffect(() => {
    setRec(null);
    load();
  }, [id, load]);

  // Poll while the analysis is running (and keep trying through brief network errors).
  const processing = rec?.status === "processing";
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [processing, load]);

  const retry = async () => {
    setRetrying(true);
    try {
      await researchApi.retry(id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setRetrying(false);
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await researchApi.remove(id);
      onDeleted();
    } catch (e) {
      setError((e as Error).message);
      setDeleting(false);
      setAskDelete(false);
    }
  };

  if (!rec) {
    return (
      <div className="rl">
        <div>
          <button className="rl-btn" onClick={onBack}>
            <Icon name="back" /> Library
          </button>
        </div>
        <div className="card">
          {error ? (
            <div className="rl-empty">
              <p style={{ color: "var(--red)" }}>{error}</p>
              <button className="rl-btn" style={{ marginTop: 14 }} onClick={load}>
                <Icon name="retry" /> Try again
              </button>
            </div>
          ) : (
            <div className="rl-empty">Loading…</div>
          )}
        </div>
      </div>
    );
  }

  const confirmUi = askDelete && (
    <Confirm
      title="Delete this comparison?"
      body="The reports, the comparison and every question and answer will be permanently removed from your library."
      confirm="Delete"
      busy={deleting}
      onCancel={() => setAskDelete(false)}
      onConfirm={doDelete}
    />
  );

  if (rec.status === "complete" && rec.comparison && rec.analyses) {
    return (
      <>
        <ResultView rec={rec} onBack={onBack} onDelete={() => setAskDelete(true)} />
        {confirmUi}
      </>
    );
  }

  return (
    <div className="rl">
      <div className="rl-spread">
        <button className="rl-btn" onClick={onBack}>
          <Icon name="back" /> Library
        </button>
        {rec.status === "failed" && (
          <button className="rl-btn danger" onClick={() => setAskDelete(true)}>
            <Icon name="trash" /> Delete
          </button>
        )}
      </div>
      <div className="card">
        {rec.status === "processing" ? (
          <AnalysisLoader rec={rec} />
        ) : (
          <div className="rl-pad">
            <div className="rl-banner err" role="alert">
              <Icon name="alert" size={18} />
              <div>
                <b>The analysis could not be completed</b>
                <p style={{ marginTop: 4 }}>{rec.error || "Something went wrong."}</p>
              </div>
            </div>
            <p className="rl-sub" style={{ margin: "14px 0" }}>
              Your uploaded reports are saved. You can retry the analysis, or delete this entry and upload different files.
            </p>
            <button className="rl-btn primary" onClick={retry} disabled={retrying}>
              <Icon name="retry" /> {retrying ? "Retrying…" : "Retry analysis"}
            </button>
          </div>
        )}
      </div>
      {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}
      {confirmUi}
    </div>
  );
}

// ---------------------------------------------------------------- home view
function Home({ onOpen }: { onOpen: (id: string) => void }) {
  const [status, setStatus] = useState<{ hasKey: boolean; model: string } | null>(null);
  const [items, setItems] = useState<ResearchSummary[] | null>(null);
  const [listError, setListError] = useState("");
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [focus, setFocus] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [formError, setFormError] = useState("");
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<ResearchSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await researchApi.list());
      setListError("");
    } catch (e) {
      setListError((e as Error).message);
      setItems((v) => v ?? []);
    }
  }, []);

  useEffect(() => {
    researchApi.status().then(setStatus).catch(() => setStatus({ hasKey: false, model: "" }));
    refresh();
  }, [refresh]);

  // keep in-progress entries fresh
  const anyProcessing = !!items?.some((i) => i.status === "processing");
  useEffect(() => {
    if (!anyProcessing) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [anyProcessing, refresh]);

  const submit = async () => {
    if (!fileA || !fileB || uploading) return;
    setFormError("");
    setUploading(true);
    try {
      setUploadPct(0);
      const { id } = await researchApi.create(fileA, fileB, focus, setUploadPct);
      setFileA(null);
      setFileB(null);
      setFocus("");
      onOpen(id);
    } catch (e) {
      setFormError((e as Error).message);
    }
    setUploading(false);
    setUploadPct(null);
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s || !items) return items || [];
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(s) ||
        (i.headline || "").toLowerCase().includes(s) ||
        i.docs.some((d) => d.name.toLowerCase().includes(s)),
    );
  }, [items, q]);

  const doDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await researchApi.remove(toDelete.id);
      setToDelete(null);
      await refresh();
    } catch (e) {
      setListError((e as Error).message);
      setToDelete(null);
    }
    setDeleting(false);
  };

  return (
    <div className="rl">
      <div className="card">
        <div className="rl-pad" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <h2 className="rl-sec-title" style={{ fontSize: 18 }}>Compare two reports</h2>
            <p className="rl-sub" style={{ marginTop: 4, fontSize: 14 }}>
              Upload two PDF reports. Jarvis reads both, compares them side by side, and then answers your questions
              about them.
            </p>
          </div>

          {status && !status.hasKey && (
            <div className="rl-banner warn" role="alert">
              <Icon name="alert" size={18} />
              <span>
                The AI service is not set up yet. Add <b>OPENAI_API_KEY</b> to the backend <b>.env</b> file and restart
                the server to enable comparisons.
              </span>
            </div>
          )}

          <div className="rl-drops">
            <DropZone tone="a" file={fileA} onFile={setFileA} disabled={uploading} />
            <DropZone tone="b" file={fileB} onFile={setFileB} disabled={uploading} />
          </div>

          <div>
            <label htmlFor="rl-focus" className="rl-label">
              Comparison focus (optional)
            </label>
            <textarea
              id="rl-focus"
              className="rl-ta"
              rows={2}
              maxLength={400}
              style={{ marginTop: 7 }}
              placeholder="e.g. growth, profit margins and outlook — or leave blank for a general comparison"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              disabled={uploading}
            />
          </div>

          {formError && (
            <div className="rl-banner err" role="alert">
              <Icon name="alert" /> <span>{formError}</span>
            </div>
          )}

          <div className="rl-spread">
            <span className="rl-sub">
              {fileA && fileB ? "Ready to compare." : "Choose both reports to continue."}
            </span>
            <button
              className="rl-btn primary"
              onClick={submit}
              disabled={!fileA || !fileB || uploading || status?.hasKey === false}
            >
              {uploading ? (
                uploadPct !== null && uploadPct > 0 && uploadPct < 100 ? `Uploading… ${uploadPct}%` : "Uploading…"
              ) : (
                <>
                  Analyze &amp; compare <Icon name="send" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* library */}
      <div className="card">
        <div className="card-head" style={{ gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3>Your library</h3>
            <div className="sub">
              {items ? `${items.length} saved comparison${items.length === 1 ? "" : "s"}` : "Loading…"} · reopen any to
              see its results and continue asking questions
            </div>
          </div>
          {!!items?.length && (
            <div style={{ position: "relative", minWidth: 220 }}>
              <input
                className="inp"
                style={{ paddingLeft: 32, width: "100%" }}
                placeholder="Search your library"
                aria-label="Search your library"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <span style={{ position: "absolute", left: 10, top: 9, color: "var(--muted)" }}>
                <Icon name="search" size={15} />
              </span>
            </div>
          )}
        </div>

        {listError && (
          <div className="rl-banner err" style={{ margin: "14px 20px 0" }} role="alert">
            <Icon name="alert" /> <span>{listError}</span>
          </div>
        )}

        {items === null ? (
          <div className="rl-empty">Loading your library…</div>
        ) : !items.length ? (
          <div className="rl-empty">
            <b style={{ color: "var(--ink)" }}>Nothing here yet</b>
            <br />
            Your analysed comparisons, and every question you ask about them, will be kept here.
          </div>
        ) : !filtered.length ? (
          <div className="rl-empty">No comparisons match “{q}”.</div>
        ) : (
          <div className="rl-list">
            {filtered.map((it) => (
              <div key={it.id} style={{ position: "relative" }}>
                <button className="rl-item" onClick={() => onOpen(it.id)} aria-label={`Open ${it.title}`}>
                  <div style={{ flex: 1, minWidth: 0, paddingRight: 56 }}>
                    <div className="rl-row" style={{ gap: 10 }}>
                      <span className="rl-item-title">{it.title}</span>
                      <span className={`rl-status ${it.status}`}>
                        {it.status === "complete" ? "Ready" : it.status === "processing" ? "Analyzing…" : "Needs attention"}
                      </span>
                    </div>
                    {it.status === "complete" && it.headline && <div className="rl-item-head">{it.headline}</div>}
                    {it.status === "failed" && it.error && (
                      <div className="rl-item-head" style={{ color: "var(--red)" }}>{it.error}</div>
                    )}
                    {it.status === "processing" && (
                      <div className="rl-mini" aria-hidden="true">
                        <i style={{ width: `${it.progress}%` }} />
                      </div>
                    )}
                    <div className="rl-meta">
                      {it.docs.map((d, i) => (
                        <span key={i} title={d.name}>
                          <span className={`rl-tag ${i === 0 ? "a" : "b"}`} style={{ padding: "0 6px" }}>
                            {i === 0 ? "A" : "B"}
                          </span>
                          {stripPdf(d.name)}
                          {d.pages ? ` · ${d.pages}p` : ""}
                        </span>
                      ))}
                      <span>{fmtDate(it.createdAt)}</span>
                      {it.questions > 0 && (
                        <span>
                          <Icon name="chat" size={13} /> {it.questions} question{it.questions === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
                <button
                  className="rl-btn ghost danger"
                  style={{ position: "absolute", right: 14, top: 14 }}
                  aria-label={`Delete ${it.title}`}
                  title="Delete"
                  onClick={() => setToDelete(it)}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {toDelete && (
        <Confirm
          title="Delete this comparison?"
          body={`“${toDelete.title}”, its reports and all of its questions and answers will be permanently removed.`}
          confirm="Delete"
          busy={deleting}
          onCancel={() => setToDelete(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------------- page
export default function ResearchLibraryPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const open = (id: string) => {
    setActiveId(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  return (
    <>
      <style>{RESEARCH_CSS}</style>
      {activeId ? (
        <RecordView id={activeId} onBack={() => setActiveId(null)} onDeleted={() => setActiveId(null)} />
      ) : (
        <Home onOpen={open} />
      )}
    </>
  );
}
