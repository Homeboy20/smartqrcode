'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { supabase } from '@/lib/supabase/client';

type Incoming = {
  sessionId: string;
  from: 'user' | 'agent';
  text: string;
  ts: number;
};

type SessionThread = {
  sessionId: string;
  lastTs: number;
  messages: Incoming[];
};

type SessionSummary = {
  sessionId: string;
  userEmail: string | null;
  subject: string | null;
  status: 'open' | 'pending' | 'closed';
  lastMessageAt: string | null;
  transcriptLastSentAt: string | null;
};

export default function AdminSupportChatPage() {
  const { loading: authLoading, isAdmin } = useSupabaseAuth();

  const [online, setOnline] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [threads, setThreads] = useState<Record<string, SessionThread>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [transcriptEmail, setTranscriptEmail] = useState('');

  const listRef = useRef<HTMLDivElement | null>(null);
  const chatChannelRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  const sessionList = useMemo(() => {
    return sessions
      .slice()
      .sort((a, b) => {
        const aTs = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTs = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTs - aTs;
      });
  }, [sessions]);

  const activeThread = activeSessionId ? threads[activeSessionId] : null;
  const activeSession = activeSessionId
    ? sessions.find((s) => s.sessionId === activeSessionId) || null
    : null;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeThread?.messages.length]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;

    setError(null);

    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
    }).catch(() => {
      // ignore
    });

    const loadSessions = async () => {
      try {
        if (!isMountedRef.current) return;
        setLoadingSessions(true);
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) {
          if (isMountedRef.current) {
            setLoadingSessions(false);
          }
          return;
        }

        const res = await fetch('/api/admin/support-chat/sessions', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const data = await res.json();
        if (Array.isArray(data?.sessions) && isMountedRef.current) {
          setSessions(data.sessions as SessionSummary[]);
        }
      } catch (e: any) {
        if (isMountedRef.current) {
          setError(e?.message || 'Failed to load support sessions');
        }
      } finally {
        if (isMountedRef.current) {
          setLoadingSessions(false);
        }
      }
    };

    loadSessions();

    const presenceKeyPromise = supabase.auth
      .getUser()
      .then(({ data }) => (data.user?.id ? `agent:${data.user.id}` : `agent:${crypto.randomUUID()}`))
      .catch(() => `agent:${crypto.randomUUID()}`);

    let presenceChannel: any;
    let chatChannel: any;

    (async () => {
      const key = await presenceKeyPromise;

      presenceChannel = supabase.channel('support:presence', {
        config: {
          presence: {
            key,
          },
        },
      });

      chatChannel = supabase.channel('support:chat', {
        config: {
          broadcast: { ack: true },
        },
      });
      chatChannelRef.current = chatChannel;

      presenceChannel.subscribe(async (status: any) => {
          if (!isMountedRef.current) return;
        if (status === 'SUBSCRIBED') {
          try {
            await presenceChannel.track({ role: 'agent', ts: Date.now() });
              if (isMountedRef.current) {
                setOnline(true);
              }
          } catch (e: any) {
              if (isMountedRef.current) {
                setError(e?.message || 'Failed to go online');
                setOnline(false);
              }
          }
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (isMountedRef.current) {
              setError('Failed to connect to live chat presence.');
              setOnline(false);
            }
        }
      });

      chatChannel.on('broadcast', { event: 'chat_message' }, ({ payload }: any) => {
      const p = payload as any;
      if (!p || !p.sessionId || !p.text) return;
      if (p.from !== 'user' && p.from !== 'agent') return;

      const msg: Incoming = {
        sessionId: String(p.sessionId),
        from: p.from,
        text: String(p.text),
        ts: typeof p.ts === 'number' ? p.ts : Date.now(),
      };

      if (!isMountedRef.current) return;
      setThreads((prev) => {
        const current = prev[msg.sessionId];
        const nextThread: SessionThread = {
          sessionId: msg.sessionId,
          lastTs: msg.ts,
          messages: current ? [...current.messages, msg] : [msg],
        };
        const next = { ...prev, [msg.sessionId]: nextThread };
        return next;
      });

      setSessions((prev) => {
        const existing = prev.find((s) => s.sessionId === msg.sessionId);
        const nextSession: SessionSummary = existing
          ? { ...existing, lastMessageAt: new Date(msg.ts).toISOString() }
          : {
              sessionId: msg.sessionId,
              userEmail: null,
              subject: null,
              status: 'open',
              lastMessageAt: new Date(msg.ts).toISOString(),
              transcriptLastSentAt: null,
            };

        const filtered = prev.filter((s) => s.sessionId !== msg.sessionId);
        return [nextSession, ...filtered];
      });

      setActiveSessionId((prevActive) => prevActive || msg.sessionId);
      });

      chatChannel.subscribe((status: any) => {
        if (!isMountedRef.current) return;
        if (status === 'SUBSCRIBED') {
          if (isMountedRef.current) {
            setChatConnected(true);
          }
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (isMountedRef.current) {
            setChatConnected(false);
            setError('Failed to connect to live chat.');
          }
        }
      });
    })();

    return () => {
      if (isMountedRef.current) {
        setOnline(false);
      }
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      if (chatChannel) supabase.removeChannel(chatChannel);
      chatChannelRef.current = null;
    };
  }, [authLoading, isAdmin]);

  useEffect(() => {
    if (!activeSessionId) return;
    let cancelled = false;

    const loadMessages = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) return;

        const res = await fetch(`/api/admin/support-chat/messages?sessionId=${encodeURIComponent(activeSessionId)}`, {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
          },
        });

        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data?.messages)) return;

        if (!cancelled && isMountedRef.current) {
          setThreads((prev) => ({
            ...prev,
            [activeSessionId]: {
              sessionId: activeSessionId,
              lastTs: data.messages.length ? data.messages[data.messages.length - 1].ts : Date.now(),
              messages: data.messages as Incoming[],
            },
          }));
        }
      } catch {
        // ignore
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [activeSessionId]);

  useEffect(() => {
    if (activeSession?.userEmail) {
      setTranscriptEmail(activeSession.userEmail);
    }
  }, [activeSession?.userEmail]);

  const send = async () => {
    if (!isMountedRef.current) return;
    setError(null);

    if (!activeSessionId) {
      setError('Select a conversation first.');
      return;
    }

    const text = draft.trim();
    if (!text) return;

    setDraft('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/support-chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: activeSessionId, text }),
      });

      if (!res.ok) throw new Error(await res.text());

      const channel = chatChannelRef.current;
      if (!channel || !chatConnected) throw new Error('Chat is not connected yet.');

      const sendRes = await channel.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: {
          sessionId: activeSessionId,
          from: 'agent',
          text,
          ts: Date.now(),
        },
      });

      const status = (sendRes as any)?.status ?? sendRes;
      if (status !== 'ok') throw new Error('Failed to send');

      // Optimistically store in thread
      const msg: Incoming = {
        sessionId: activeSessionId,
        from: 'agent',
        text,
        ts: Date.now(),
      };

      if (!isMountedRef.current) return;
      setThreads((prev) => {
        const current = prev[msg.sessionId];
        const nextThread: SessionThread = {
          sessionId: msg.sessionId,
          lastTs: msg.ts,
          messages: current ? [...current.messages, msg] : [msg],
        };
        return { ...prev, [msg.sessionId]: nextThread };
      });

      setSessions((prev) =>
        prev.map((s) =>
          s.sessionId === msg.sessionId
            ? { ...s, lastMessageAt: new Date(msg.ts).toISOString() }
            : s
        )
      );
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e?.message || 'Failed to send');
      }
    }
  };

  const updateStatus = async (nextStatus: 'open' | 'pending' | 'closed') => {
    if (!activeSessionId) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/support-chat/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: activeSessionId, status: nextStatus }),
      });

      if (!res.ok) throw new Error(await res.text());

      if (isMountedRef.current) {
        setSessions((prev) =>
          prev.map((s) => (s.sessionId === activeSessionId ? { ...s, status: nextStatus } : s))
        );
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e?.message || 'Failed to update status');
      }
    }
  };

  const sendTranscript = async () => {
    if (!activeSessionId) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const res = await fetch('/api/admin/support-chat/transcript', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          toEmail: transcriptEmail || undefined,
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      if (isMountedRef.current) {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === activeSessionId
              ? { ...s, transcriptLastSentAt: new Date().toISOString() }
              : s
          )
        );
        setError(null);
      }
    } catch (e: any) {
      if (isMountedRef.current) {
        setError(e?.message || 'Failed to send transcript');
      }
    }
  };

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
        <p className="ml-4">Verifying authentication...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <p className="text-sm text-yellow-700">Please log in with an admin account to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1 py-4 sm:px-0">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Chat</h1>
          <p className="mt-1 text-sm text-gray-600">Stay on this page to be marked as online.</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={
              online
                ? 'inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 border border-green-200'
                : 'inline-flex items-center rounded-full bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 border border-gray-200'
            }
          >
            {online ? 'Online' : 'Offline'}
          </span>
          {!chatConnected && (
            <span className="text-xs text-gray-500">Connecting…</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">Conversations</h2>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {loadingSessions ? (
              <div className="p-4 text-sm text-gray-600">Loading conversations…</div>
            ) : sessionList.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">No conversations yet.</div>
            ) : (
              sessionList.map((s) => (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => {
                    setActiveSessionId(s.sessionId);
                    setTranscriptEmail(s.userEmail || '');
                  }}
                  className={
                    activeSessionId === s.sessionId
                      ? 'w-full text-left px-4 py-3 border-b border-gray-100 bg-indigo-50'
                      : 'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50'
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium text-gray-900">{s.userEmail || 'Unknown user'}</div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                        s.status === 'closed'
                          ? 'bg-gray-100 text-gray-700 border-gray-200'
                          : s.status === 'pending'
                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                          : 'bg-green-50 text-green-700 border-green-200'
                      }`}
                    >
                      {s.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 truncate">{s.subject || s.sessionId}</div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Chat</h2>
              <p className="text-xs text-gray-600 truncate">
                {activeSessionId ? `Active: ${activeSessionId}` : 'Select a conversation'}
              </p>
            </div>
            {activeSession && (
              <div className="flex items-center gap-2">
                <select
                  value={activeSession.status}
                  onChange={(e) => updateStatus(e.target.value as 'open' | 'pending' | 'closed')}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
                >
                  <option value="open">Open</option>
                  <option value="pending">Pending</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            )}
          </div>

          <div ref={listRef} className="h-[420px] overflow-y-auto bg-gray-50 p-4 space-y-2">
            {!activeThread ? (
              <p className="text-sm text-gray-500">Waiting for a user message…</p>
            ) : (
              activeThread.messages.map((m, idx) => (
                <div key={`${m.ts}-${idx}`} className={m.from === 'agent' ? 'flex justify-end' : 'flex justify-start'}>
                  <div
                    className={
                      m.from === 'agent'
                        ? 'max-w-[85%] rounded-lg bg-gray-900 text-white px-3 py-2 text-sm'
                        : 'max-w-[85%] rounded-lg bg-white border border-gray-200 text-gray-900 px-3 py-2 text-sm'
                    }
                  >
                    {m.text}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-gray-200 p-3 space-y-3">
            {activeSession && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600">Transcript email</label>
                  <input
                    type="email"
                    value={transcriptEmail}
                    onChange={(e) => setTranscriptEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2 sm:pt-5">
                  <button
                    type="button"
                    onClick={sendTranscript}
                    className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Send transcript
                  </button>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={activeSessionId ? 'Type a reply…' : 'Select a conversation to reply'}
                disabled={!activeSessionId}
                className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50"
              />
              <button
                type="button"
                onClick={send}
                disabled={!activeSessionId || !draft.trim()}
                className={
                  !activeSessionId || !draft.trim()
                    ? 'rounded-md px-4 py-2 text-sm font-semibold text-white bg-indigo-300 cursor-not-allowed'
                    : 'rounded-md px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700'
                }
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
