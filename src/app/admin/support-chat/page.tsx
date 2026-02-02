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

export default function AdminSupportChatPage() {
  const { loading: authLoading, isAdmin } = useSupabaseAuth();

  const [online, setOnline] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<Record<string, SessionThread>>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const listRef = useRef<HTMLDivElement | null>(null);
  const chatChannelRef = useRef<any>(null);

  const sessionList = useMemo(() => {
    return Object.values(threads)
      .sort((a, b) => b.lastTs - a.lastTs)
      .map((t) => ({ sessionId: t.sessionId, lastTs: t.lastTs }));
  }, [threads]);

  const activeThread = activeSessionId ? threads[activeSessionId] : null;

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [activeThread?.messages.length]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;

    let isMounted = true;
    setError(null);

    supabase.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      if (token) supabase.realtime.setAuth(token);
    }).catch(() => {
      // ignore
    });

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
        if (!isMounted) return;
        if (status === 'SUBSCRIBED') {
          try {
            await presenceChannel.track({ role: 'agent', ts: Date.now() });
            setOnline(true);
          } catch (e: any) {
            setError(e?.message || 'Failed to go online');
            setOnline(false);
          }
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setError('Failed to connect to live chat presence.');
          setOnline(false);
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

      setActiveSessionId((prevActive) => prevActive || msg.sessionId);
      });

      chatChannel.subscribe((status: any) => {
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
    })();

    return () => {
      isMounted = false;
      setOnline(false);
      if (presenceChannel) supabase.removeChannel(presenceChannel);
      if (chatChannel) supabase.removeChannel(chatChannel);
      chatChannelRef.current = null;
    };
  }, [authLoading, isAdmin]);

  const send = async () => {
    setError(null);

    if (!activeSessionId) {
      setError('Select a conversation first.');
      return;
    }

    const text = draft.trim();
    if (!text) return;

    setDraft('');

    try {
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

      setThreads((prev) => {
        const current = prev[msg.sessionId];
        const nextThread: SessionThread = {
          sessionId: msg.sessionId,
          lastTs: msg.ts,
          messages: current ? [...current.messages, msg] : [msg],
        };
        return { ...prev, [msg.sessionId]: nextThread };
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to send');
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
            {sessionList.length === 0 ? (
              <div className="p-4 text-sm text-gray-600">No conversations yet.</div>
            ) : (
              sessionList.map((s) => (
                <button
                  key={s.sessionId}
                  type="button"
                  onClick={() => setActiveSessionId(s.sessionId)}
                  className={
                    activeSessionId === s.sessionId
                      ? 'w-full text-left px-4 py-3 border-b border-gray-100 bg-indigo-50'
                      : 'w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50'
                  }
                >
                  <div className="text-sm font-medium text-gray-900">Session</div>
                  <div className="text-xs text-gray-600 truncate">{s.sessionId}</div>
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

          <div className="border-t border-gray-200 p-3">
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
