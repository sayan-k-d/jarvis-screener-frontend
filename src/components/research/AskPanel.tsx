"use client";
import { useEffect, useRef, useState } from "react";
import { researchApi, type ChatMessage } from "@/lib/researchApi";
import { Icon, Markdown, fmtTime } from "./ui";

export default function AskPanel({
  id,
  initial,
  suggestions,
  names,
}: {
  id: string;
  initial: ChatMessage[];
  suggestions: string[];
  names: [string, string];
}) {
  const [msgs, setMsgs] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Opening a different saved comparison resets the conversation to its own history.
  useEffect(() => {
    setMsgs(initial);
    setText("");
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [msgs, busy]);

  const send = async (q?: string) => {
    const question = (q ?? text).trim();
    if (!question || busy) return;
    setError("");
    setBusy(true);
    const temp: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: question,
      at: new Date().toISOString(),
    };
    setMsgs((m) => [...m, temp]);
    setText("");
    try {
      const res = await researchApi.ask(id, question);
      setMsgs((m) => [...m.filter((x) => x.id !== temp.id), res.user, res.assistant]);
    } catch (e) {
      setMsgs((m) => m.filter((x) => x.id !== temp.id));
      setText(question); // give the question back so nothing is lost
      setError((e as Error).message || "Could not get an answer. Please try again.");
    }
    setBusy(false);
  };

  const clear = async () => {
    if (!msgs.length || busy) return;
    if (!window.confirm("Clear this conversation? The comparison itself is kept.")) return;
    try {
      await researchApi.clearChat(id);
      setMsgs([]);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const questions = msgs.filter((m) => m.role === "user").length;

  return (
    <div className="card rl-ask">
      <div className="rl-ask-head">
        <div className="rl-spread">
          <div className="rl-row" style={{ gap: 8 }}>
            <Icon name="chat" size={17} />
            <h3 className="rl-sec-title">Ask about these reports</h3>
          </div>
          {questions > 0 && (
            <button className="rl-btn ghost" onClick={clear} disabled={busy} style={{ fontSize: 12 }}>
              Clear
            </button>
          )}
        </div>
        <p className="rl-sub" style={{ marginTop: 6 }}>
          Answers use only these two reports and cite the page they came from.
        </p>
      </div>

      <div className="rl-msgs" ref={boxRef} aria-live="polite">
        {!msgs.length && (
          <div className="rl-sugg">
            <span className="rl-label">Try asking</span>
            {suggestions.slice(0, 4).map((s) => (
              <button key={s} className="rl-chip" onClick={() => send(s)} disabled={busy}>
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m) =>
          m.role === "user" ? (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div className="rl-msg user">{m.content}</div>
              <div className="rl-time rl-user-time">{fmtTime(m.at)}</div>
            </div>
          ) : (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <div className="rl-msg assistant">
                <Markdown text={m.content} />
                {!!m.sources?.length && (
                  <div className="rl-src">
                    <small>Sources</small>
                    {m.sources.map((s) => (
                      <span
                        key={s.doc + s.page}
                        className={`rl-tag ${s.doc === "A" ? "a" : "b"}`}
                        title={names[s.doc === "A" ? 0 : 1]}
                      >
                        {s.doc} · p.{s.page}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="rl-time">{fmtTime(m.at)}</div>
            </div>
          ),
        )}
        {busy && (
          <div className="rl-msg assistant" aria-label="Jarvis is thinking">
            <span className="rl-dots">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="rl-banner err" style={{ margin: "0 14px 10px" }} role="alert">
          <Icon name="alert" /> <span>{error}</span>
        </div>
      )}
      <form
        className="rl-compose"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          className="rl-ta"
          rows={2}
          maxLength={2000}
          value={text}
          placeholder="Ask a question about the reports…"
          aria-label="Your question"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          disabled={busy}
          style={{ minHeight: 48 }}
        />
        <button className="rl-btn primary" type="submit" disabled={busy || !text.trim()} aria-label="Send question">
          <Icon name="send" />
        </button>
      </form>
    </div>
  );
}
