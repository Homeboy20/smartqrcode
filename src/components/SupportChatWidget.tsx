'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

type ChatMessage = {
  id: string;
  sessionId: string;
  from: 'user' | 'agent';
  text: string;
  ts: number;
};

function getOrCreateSessionId(): string {
  const fallbackId = () => `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  if (typeof window === 'undefined') return (globalThis.crypto?.randomUUID?.() ?? fallbackId());
  const key = 'support_chat_session_id';
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const id = window.crypto?.randomUUID?.() ?? fallbackId();
  window.localStorage.setItem(key, id);
  return id;
}

function nowMs() {
  return Date.now();
}

export default function SupportChatWidget() {
  const sessionId = useMemo(() => getOrCreateSessionId(), []);

  const [agentOnline, setAgentOnline] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const chatChannelRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
      const userEmail = data.session?.user?.email;
      if (userEmail && isMounted) setEmail(userEmail);
    }).catch(() => {
      // ignore
    });

    const presenceChannel = supabase.channel('support:presence', {
      config: {
        presence: {
          key: `viewer:${sessionId}`,
        },
      },
    });

    const updatePresence = () => {
      const state = presenceChannel.presenceState();
      // state is { [key]: Array<meta> }
      const anyAgent = Object.values(state).some((metas: any) => {
        if (!Array.isArray(metas)) return false;
        return metas.some((m: any) => m?.role === 'agent');
      });
      if (isMounted) setAgentOnline(anyAgent);
    };

    presenceChannel
      .on('presence', { event: 'sync' }, updatePresence)
      .on('presence', { event: 'join' }, updatePresence)
      .on('presence', { event: 'leave' }, updatePresence);

    presenceChannel.subscribe((status) => {
      if (!isMounted) return;
      if (status === 'SUBSCRIBED') {
        setSubscribed(true);
        updatePresence();
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setSubscribed(false);
        setError('Failed to connect to live chat presence.');
      }
    });

    const chatChannel = supabase.channel('support:chat', {
      config: {
        broadcast: { ack: true },
      },
    });
    chatChannelRef.current = chatChannel;

    chatChannel.on('broadcast', { event: 'chat_message' }, ({ payload }) => {
      const p = payload as any;
      if (!p || p.sessionId !== sessionId) return;
      if (!p.text || typeof p.text !== 'string') return;
      if (p.from !== 'agent' && p.from !== 'user') return;

      const msg: ChatMessage = {
        id: `${p.ts || nowMs()}-${Math.random().toString(16).slice(2)}`,
        sessionId,
        from: p.from,
        text: p.text,
        ts: typeof p.ts === 'number' ? p.ts : nowMs(),
      };

      setMessages((prev) => [...prev, msg]);
    });

    chatChannel.subscribe((status) => {
      if (!isMounted) return;
      if (status === 'SUBSCRIBED') {
        setChatConnected(true);
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setChatConnected(false);
        setError('Failed to connect to live chat.');
      }
    });

    return () => {
      isMounted = false;
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(chatChannel);
      chatChannelRef.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    const loadHistory = async () => {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/support-chat/messages?sessionId=${encodeURIComponent(sessionId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data?.messages)) {
          setMessages(data.messages as ChatMessage[]);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    // auto-scroll to bottom
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = async () => {
    setError(null);

    const text = draft.trim();
    if (!text) return;

    // optimistic add
    const optimistic: ChatMessage = {
      id: `${nowMs()}-${Math.random().toString(16).slice(2)}`,
      sessionId,
      from: 'user',
      text,
      ts: nowMs(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft('');

    try {
      const res = await fetch('/api/support-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          text,
          email: email || undefined,
          subject: subject || undefined,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Failed to send');
      }

        const channel = chatChannelRef.current;
        if (!channel || !chatConnected) {
          throw new Error('Chat is not connected yet.');
        }

      const sendRes = await channel.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: {
          sessionId,
          from: 'user',
          text,
          ts: nowMs(),
        },
      });

      const status = (sendRes as any)?.status ?? sendRes;
      if (status !== 'ok') throw new Error('Failed to send');
    } catch (e: any) {
      setError(e?.message || 'Failed to send');
    }
  };

  if (!agentOnline) {
    return (
      <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Live support chat</h2>
            <p className="mt-1 text-sm text-gray-600">No support agent is online right now.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 border border-gray-200">
              Offline
            </span>
            {!subscribed && (
              <span className="text-xs text-gray-500">Connecting…</span>
            )}
          </div>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Live chat is unavailable at the moment. Please use the contact form.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Live support chat</h2>
          <p className="mt-1 text-sm text-gray-600">A support agent is online. Ask your question here.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 border border-green-200">
            Online
          </span>
          {!subscribed && (
            <span className="text-xs text-gray-500">Connecting…</span>
          )}
        </div>
      </div>

      <div className="mt-4 border border-gray-200 rounded-lg bg-gray-50">
        <div className="border-b border-gray-200 bg-white p-3 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex-1">
              <label htmlFor="support-chat-email" className="block text-xs font-medium text-gray-600">
                Email for transcript (optional)
              </label>
              <input
                id="support-chat-email"
                name="supportChatEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="support-chat-subject" className="block text-xs font-medium text-gray-600">
                Ticket subject (optional)
              </label>
              <input
                id="support-chat-subject"
                name="supportChatSubject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Billing question"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
        <div ref={listRef} className="h-56 overflow-y-auto p-3 space-y-2">
          {loadingHistory ? (
            <p className="text-sm text-gray-500">Loading conversation…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-gray-500">Start a conversation…</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.from === 'user'
                    ? 'flex justify-end'
                    : 'flex justify-start'
                }
              >
                <div
                  className={
                    m.from === 'user'
                      ? 'max-w-[85%] rounded-lg bg-indigo-600 text-white px-3 py-2 text-sm'
                      : 'max-w-[85%] rounded-lg bg-white border border-gray-200 text-gray-900 px-3 py-2 text-sm'
                  }
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-200 p-3">
          {error && (
            <p className="mb-2 text-sm text-red-600">{error}</p>
          )}
          <div className="flex items-center gap-2">
            <label htmlFor="support-chat-message" className="sr-only">
              Message
            </label>
            <input
              id="support-chat-message"
              name="message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Type a message…"
              disabled={!chatConnected}
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              type="button"
              onClick={send}
              disabled={!draft.trim() || !chatConnected}
              className={
                !draft.trim() || !chatConnected
                  ? 'rounded-md px-4 py-2 text-sm font-semibold text-white bg-indigo-300 cursor-not-allowed'
                  : 'rounded-md px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700'
              }
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        This chat is available while an agent is online.
      </p>
    </section>
  );
}
