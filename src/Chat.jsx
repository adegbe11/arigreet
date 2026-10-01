import React, { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Sheet, first, clock } from "./ui.jsx";

/* Spec §45: lightweight, finding-each-other only. */
const QUICK = {
  guest: ["I've landed", "I'm collecting my bags", "I'm at Arrivals", "I'm at the meeting point", "I can't see you", "I'm on my way", "I can see you"],
  greeter: ["I'm at Arrivals", "I'm at the meeting point", "Stay where you are", "I'm on my way", "I can't see you", "I can see you"],
};

export default function Chat({ g, role, onSend, onClose, busy, canSend }) {
  const [text, setText] = useState("");
  const list = useRef(null);
  const peer = role === "guest" ? g.greeter : g.name;
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" });
  }, [g.messages.length]);
  const send = async (t) => {
    const v = t.trim();
    if (!v) return;
    await onSend(v);
    setText("");
  };
  return (
    <Sheet title={peer} onClose={onClose} label={"Messages with " + peer}>
      <div className="chat-list" ref={list}>
        {g.messages.length === 0 && (
          <p className="chat-empty">Messages for this Greet appear here.</p>
        )}
        {g.messages.map((m) => (
          <div key={m.id} className={"chat-b " + (m.role === role ? "me" : "them")}>
            {m.text}
            <small>{clock(m.at)}</small>
          </div>
        ))}
      </div>
      {canSend ? (
        <>
          <div className="chat-quick" role="list" aria-label="Quick messages">
            {QUICK[role].map((q) => (
              <button key={q} role="listitem" disabled={busy} onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>
          <form
            className="chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message ${first(peer)}`}
              maxLength={2000}
              aria-label={`Message ${first(peer)}`}
            />
            <button disabled={busy || !text.trim()} aria-label="Send">
              <ArrowUp size={20} strokeWidth={2.6} />
            </button>
          </form>
        </>
      ) : (
        <p className="chat-empty">Messaging is off for this Greet.</p>
      )}
    </Sheet>
  );
}
