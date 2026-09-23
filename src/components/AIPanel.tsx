"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { sendChatMessage } from "@/lib/api";

interface ChatChip {
  label: string;
  icon: string; // Font Awesome glyph, e.g. "fa-globe"
  q: string;
}
interface ChatMessage {
  type: "bot" | "user";
  content: string;
  chips?: ChatChip[];
}

interface AIPanelProps {
  isOpen: boolean;
  onToggle: () => void;
  /** Set by a caller to have the panel open and ask a question programmatically. */
  externalQuestion?: string | null;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    type: "bot",
    content:
      "Hi, I'm Jarvis — your AI investment intelligence assistant. Ask me about markets, momentum stocks, or risk, or try one of these:",
    chips: [
      {
        label: "Market Summary",
        icon: "fa-globe",
        q: "Give me the latest market headlines",
      },
      {
        label: "Top Movers",
        icon: "fa-chart-line",
        q: "What are today's top momentum stocks?",
      },
      {
        label: "Opportunities",
        icon: "fa-lightbulb",
        q: "What are the best opportunities right now?",
      },
      {
        label: "Risk Factors",
        icon: "fa-shield-alt",
        q: "What are the main market risks right now?",
      },
    ],
  },
];

export default function AIPanel({
  isOpen,
  onToggle,
  externalQuestion,
}: AIPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  const scrollBottom = () => {
    if (messagesRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  };

  const ask = useCallback(
    async (question: string) => {
      if (!isOpen) onToggle();
      setMessages((prev) => [...prev, { type: "user", content: question }]);
      setIsTyping(true);
      try {
        const botResponse = await sendChatMessage(question);
        setMessages((prev) => [...prev, { type: "bot", content: botResponse }]);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error(error);
        setMessages((prev) => [
          ...prev,
          {
            type: "bot",
            content:
              "Sorry, I'm having trouble connecting to the server right now.",
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    },
    [isOpen, onToggle],
  );

  useEffect(() => {
    if (externalQuestion) ask(externalQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestion]);

  useEffect(() => {
    scrollBottom();
  }, [messages, isTyping]);

  const send = () => {
    if (inputVal.trim()) {
      ask(inputVal.trim());
      setInputVal("");
    }
  };

  return (
    <div className={`ai-panel${isOpen ? " open" : ""}`}>
      <div className="ai-header">
        <div className="ai-avatar">
          <i className="fas fa-robot" />
        </div>
        <div className="ai-info">
          <h3>Jarvis AI</h3>
          <span>Online</span>
        </div>
        <div className="ai-header-actions">
          <button
            className="ai-header-btn"
            onClick={onToggle}
            title="Minimize"
            type="button"
            aria-label="Minimize assistant"
          >
            <i className="fas fa-chevron-right" />
          </button>
        </div>
      </div>

      <div className="ai-messages" ref={messagesRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`ai-message ${msg.type}`}>
            <div className="message-bubble">
              <span
                dangerouslySetInnerHTML={{
                  __html: msg.content.replace(/\n/g, "<br/>"),
                }}
              />
              {msg.chips && (
                <div className="ai-suggestions">
                  {msg.chips.map((chip) => (
                    <span
                      key={chip.q}
                      className="suggestion-chip"
                      onClick={() => ask(chip.q)}
                    >
                      <i className={`fas ${chip.icon}`} /> {chip.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="ai-message bot">
            <div className="message-bubble">
              <div className="ai-typing">
                <div className="ai-typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="ai-typing-label">Jarvis is thinking...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="ai-input">
        <div className="input-container">
          <input
            type="text"
            placeholder="Ask about markets, stocks, risks, or opportunities..."
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <div className="input-actions">
            <button
              type="button"
              title="Voice input (coming soon)"
              aria-label="Voice input"
            >
              <i className="fas fa-microphone" />
            </button>
            <button
              type="button"
              className="send-btn"
              onClick={send}
              title="Send"
              aria-label="Send message"
            >
              <i className="fas fa-paper-plane" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
