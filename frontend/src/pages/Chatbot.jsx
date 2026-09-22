import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Zap, Sparkles } from "lucide-react";
import "./Chatbot.css";

function formatMinutes(minutes) {
  const value = Number(minutes || 0);
  const hours = Math.floor(value / 60);
  const mins = Math.round(value % 60);
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function Chatbot(props) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: "Hi! I’m your Focus Guard assistant. Ask me anything—I'll use your focus data whenever it is helpful.",
    },
  ]);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);
  const quickPrompts = ["How can I improve productive time?", "Why is my focus score low?", "Give me a focus plan"];
  const focusScore = Number(props.metrics?.focusScore || 0).toFixed(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function handleSend(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: props.selectedUser,
          message: text,
          history: messages.slice(1).map((message) => ({
            role: message.role === "bot" ? "assistant" : "user",
            text: message.text,
          })),
          context: {
            periodTitle: props.periodTitle,
            mode: props.mode,
            metrics: props.metrics,
            switchAnalytics: props.switchAnalytics,
            topApplications: props.topApplications,
            timelineData: props.timelineData,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Assistant is unavailable.");
      setMessages((prev) => [...prev, { role: "bot", text: data.answer }]);
    } catch (error) {
      setMessages((prev) => [...prev, { role: "bot", text: `${error.message} Try again in a moment.` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="chatbot-root">
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <div className="chatbot-title">
              <Zap size={16} />
              <span>Focus Guard Assistant</span>
            </div>
            <button className="chatbot-close" onClick={() => setOpen(false)} type="button">
              <X size={18} />
            </button>
          </div>

          <div className="chatbot-messages">
            <div className="chatbot-snapshot">
              <span>FOCUS SNAPSHOT</span>
              <strong>{focusScore}%</strong>
              <small>{formatMinutes(props.metrics?.productiveMinutes)} productive of {formatMinutes(props.metrics?.totalMinutes)} tracked</small>
            </div>
            {messages.map((m, i) => (
              <div key={i} className={`chatbot-bubble ${m.role === "user" ? "chatbot-bubble-user" : "chatbot-bubble-bot"}`}>
                {m.text}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {messages.length === 1 && (
            <div className="chatbot-prompts">
              <div className="chatbot-prompts-label"><Sparkles size={13} /> Suggested questions</div>
              {quickPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => setInput(prompt)}>{prompt}</button>
              ))}
            </div>
          )}

          <form className="chatbot-input-row" onSubmit={handleSend}>
            <input type="text" placeholder="Ask anything..." value={input} onChange={(e) => setInput(e.target.value)} disabled={sending} />
            <button type="submit" aria-label="Send" disabled={sending}>
              <Send size={16} />
            </button>
          </form>
        </div>
      )}

      <button className="chatbot-fab" onClick={() => setOpen((v) => !v)} aria-label="Open chat assistant" type="button">
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
