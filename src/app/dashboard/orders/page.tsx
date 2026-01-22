'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRestaurantAccess, type RestaurantAccess, type RestaurantStaffRole } from '@/hooks/useRestaurantAccess';

type AssignableStaff = {
  userId: string;
  role: 'waiter' | 'delivery';
  displayName?: string | null;
  email?: string | null;
};

type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';

type OrderType = 'dine_in' | 'delivery';

type OrderRow = {
  id: string;
  restaurant_id: string;
  status: OrderStatus;
  order_type: OrderType;
  table_number: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  items: any;
  total: string | number;
  placed_via: string;
  created_at: string;
  updated_at: string;
  assigned_to_user_id?: string | null;
  assigned_by_user_id?: string | null;
  assigned_at?: string | null;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string };

function canSetStatus(role: RestaurantStaffRole | null, isOwner: boolean, next: OrderStatus): boolean {
  if (isOwner) return true;
  if (role === 'manager') return true;
  if (role === 'kitchen') return next === 'accepted' || next === 'preparing' || next === 'ready' || next === 'cancelled';
  if (role === 'waiter') return next === 'served' || next === 'completed' || next === 'cancelled';
  if (role === 'delivery') return next === 'served' || next === 'completed' || next === 'cancelled';
  return false;
}

function canAssign(role: RestaurantStaffRole | null, isOwner: boolean): boolean {
  if (isOwner) return true;
  return role === 'manager' || role === 'kitchen';
}

function formatTzs(value: string | number) {
  const n = typeof value === 'number' ? value : Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `TZS ${Math.round(safe).toLocaleString()}`;
}

function statusLabel(s: OrderStatus) {
  switch (s) {
    case 'placed':
      return 'Placed';
    case 'accepted':
      return 'Accepted';
    case 'preparing':
      return 'Preparing';
    case 'ready':
      return 'Ready';
    case 'served':
      return 'Served';
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
  }
}

type OrderLineItem = {
  id?: string;
  name: string;
  qty: number;
  price: number;
  lineTotal?: number;
};

function normalizeLineItems(value: any): OrderLineItem[] {
  if (!value) return [];
  if (!Array.isArray(value)) return [];

  const out: OrderLineItem[] = [];
  for (const row of value) {
    const name = String(row?.name || '').trim();
    const qty = Number(row?.qty);
    const price = Number(row?.price);
    if (!name) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(price) || price < 0) continue;

    const lineTotalRaw = row?.lineTotal;
    const lineTotal = Number(lineTotalRaw);
    out.push({
      id: row?.id ? String(row.id) : undefined,
      name,
      qty: Math.trunc(qty),
      price,
      lineTotal: Number.isFinite(lineTotal) ? lineTotal : undefined,
    });
  }
  return out;
}

function shortId(id: string) {
  const v = String(id || '');
  if (v.length <= 8) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function getNextActions(opts: {
  current: OrderStatus;
  role: RestaurantStaffRole | null;
  isOwner: boolean;
}): OrderStatus[] {
  const { current, role, isOwner } = opts;

  if (current === 'completed' || current === 'cancelled') return [];

  // Owner/manager: broad control but still keep actions sensible.
  if (isOwner || role === 'manager') {
    switch (current) {
      case 'placed':
        return ['accepted', 'cancelled'];
      case 'accepted':
        return ['preparing', 'ready', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['served', 'completed', 'cancelled'];
      case 'served':
        return ['completed', 'cancelled'];
      default:
        return [];
    }
  }

  if (role === 'kitchen') {
    switch (current) {
      case 'placed':
        return ['accepted', 'cancelled'];
      case 'accepted':
        return ['preparing', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      default:
        return [];
    }
  }

  if (role === 'waiter') {
    switch (current) {
      case 'ready':
        return ['served', 'cancelled'];
      case 'served':
        return ['completed', 'cancelled'];
      default:
        return [];
    }
  }

  if (role === 'delivery') {
    switch (current) {
      case 'ready':
        return ['served', 'cancelled'];
      case 'served':
        return ['completed', 'cancelled'];
      default:
        return [];
    }
  }

  return [];
}

export default function DashboardOrdersPage() {
  const { getAccessToken } = useSupabaseAuth();
  const { loading: accessLoading, access, error: accessError } = useRestaurantAccess();

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const [assignable, setAssignable] = useState<AssignableStaff[]>([]);
  const [selectedAssigneeByOrder, setSelectedAssigneeByOrder] = useState<Record<string, string>>({});
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);

  const audioUnlockedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const lastAssignedToRef = useRef<Map<string, string | null>>(new Map());
  const lastStatusRef = useRef<Map<string, OrderStatus>>(new Map());
  const lastNotificationAtRef = useRef<string | null>(null);
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());

  const canAssignOrders = !!access && canAssign(access.staffRole, access.isOwner);

  const playNotifySound = () => {
    if (!audioUnlockedRef.current) return;
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }

    try {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gain.gain.value = 0.0001;

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      oscillator.start(now);
      oscillator.stop(now + 0.2);
    } catch {
      // ignore
    }
  };

  const navItems = useMemo(() => {
    if (!access) return [{ href: '/dashboard/orders', label: 'Orders' }];
    if (access.isOwner) {
      return [
        { href: '/dashboard', label: 'Overview' },
        { href: '/dashboard/orders', label: 'Orders' },
        { href: '/dashboard/menu', label: 'Menu' },
        { href: '/dashboard/qr', label: 'QR' },
        { href: '/dashboard/staff', label: 'Staff' },
        { href: '/dashboard/settings', label: 'Settings' },
      ];
    }

    if (access.staffRole === 'manager') {
      return [
        { href: '/dashboard/orders', label: 'Orders' },
        { href: '/dashboard/staff', label: 'Staff' },
      ];
    }

    return [{ href: '/dashboard/orders', label: 'Orders' }];
  }, [access]);

  async function fetchOrders(currentAccess: RestaurantAccess) {
    // Prefer cookie auth; fall back to bearer.
    let res = await fetch('/api/restaurant/orders?limit=100', { method: 'GET' });
    if (res.status === 401) {
      const token = await getAccessToken();
      if (token) {
        res = await fetch('/api/restaurant/orders?limit=100', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    const body = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      throw new Error(body?.error || 'Failed to load orders');
    }

    const list = Array.isArray(body?.orders) ? (body.orders as OrderRow[]) : [];

    // Optional role-based filtering in UI
    if (!currentAccess.isOwner && currentAccess.staffRole === 'kitchen') {
      return list.filter((o) => o.status === 'placed' || o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready');
    }

    if (!currentAccess.isOwner && currentAccess.staffRole === 'waiter') {
      return list.filter((o) => o.status === 'ready' || o.status === 'served' || o.status === 'completed');
    }

    if (!currentAccess.isOwner && currentAccess.staffRole === 'delivery') {
      return list.filter((o) => o.status === 'ready' || o.status === 'served' || o.status === 'completed');
    }

    return list;
  }

  async function fetchNotifications(currentAccess: RestaurantAccess) {
    // Prefer cookie auth; fall back to bearer.
    const since = lastNotificationAtRef.current;
    const qs = new URLSearchParams();
    if (since) qs.set('since', since);
    qs.set('limit', '50');

    let res = await fetch(`/api/restaurant/notifications?${qs.toString()}`, { method: 'GET' });
    if (res.status === 401) {
      const token = await getAccessToken();
      if (token) {
        res = await fetch(`/api/restaurant/notifications?${qs.toString()}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    const body = await res.json().catch(() => ({} as any));
    if (!res.ok) throw new Error(body?.error || 'Failed to load notifications');

    const list = Array.isArray(body?.notifications) ? (body.notifications as any[]) : [];
    if (list.length === 0) return;

    // list is newest-first
    const newestCreatedAt = String(list[0]?.created_at || '').trim();
    if (newestCreatedAt) lastNotificationAtRef.current = newestCreatedAt;

    let hasNew = false;
    for (const n of list) {
      const id = String(n?.id || '').trim();
      if (!id) continue;
      if (!seenNotificationIdsRef.current.has(id)) {
        seenNotificationIdsRef.current.add(id);
        hasNew = true;
      }
    }

    if (hasNew) playNotifySound();
  }

  async function fetchAssignable(currentAccess: RestaurantAccess) {
    if (!canAssign(currentAccess.staffRole, currentAccess.isOwner)) return;

    let res = await fetch('/api/restaurant/staff?assignable=1', { method: 'GET' });
    if (res.status === 401) {
      const token = await getAccessToken();
      if (token) {
        res = await fetch('/api/restaurant/staff?assignable=1', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    }

    const body = await res.json().catch(() => ({} as any));
    if (!res.ok) throw new Error(body?.error || 'Failed to load staff');

    const list = Array.isArray(body?.staff) ? (body.staff as AssignableStaff[]) : [];
    setAssignable(list.filter((s) => s.role === 'waiter' || s.role === 'delivery'));
  }

  function getAssigneeLabel(userId: string | null | undefined) {
    if (!userId) return 'Unassigned';
    const staff = assignable.find((s) => s.userId === userId);
    if (!staff) return shortId(userId);
    const name = (staff.displayName || '').trim();
    if (name) return `${name} (${staff.role})`;
    const email = (staff.email || '').trim();
    if (email) return `${email} (${staff.role})`;
    return `${shortId(staff.userId)} (${staff.role})`;
  }

  function handleNotifications(list: OrderRow[], currentAccess: RestaurantAccess) {
    const isFirstLoad = seenOrderIdsRef.current.size === 0;

    let hasNew = false;
    for (const o of list) {
      if (!seenOrderIdsRef.current.has(o.id)) {
        seenOrderIdsRef.current.add(o.id);
        if (!isFirstLoad) hasNew = true;
      }

      // Keep refs warm (used mostly for future extensions)
      lastAssignedToRef.current.set(o.id, o.assigned_to_user_id ?? null);
      lastStatusRef.current.set(o.id, o.status);
    }

    if (hasNew) playNotifySound();
  }

  useEffect(() => {
    let cancelled = false;

    if (accessLoading) return;

    if (accessError || !access) {
      setStatus({ kind: 'error', message: accessError || 'No restaurant access' });
      setLoading(false);
      return;
    }

    // Unlock audio after first user gesture
    const onFirstGesture = () => {
      audioUnlockedRef.current = true;
      window.removeEventListener('pointerdown', onFirstGesture);
    };
    window.addEventListener('pointerdown', onFirstGesture, { once: true });

    (async () => {
      setLoading(true);
      setStatus({ kind: 'idle' });
      try {
        const list = await fetchOrders(access);
        if (!cancelled) {
          setOrders(list);
          handleNotifications(list, access);
          await fetchAssignable(access);
          await fetchNotifications(access);
        }
      } catch (e: any) {
        if (!cancelled) setStatus({ kind: 'error', message: String(e?.message || 'Failed to load orders') });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const interval = window.setInterval(async () => {
      if (!access) return;
      try {
        const list = await fetchOrders(access);
        if (!cancelled) {
          setOrders(list);
          handleNotifications(list, access);
          await fetchNotifications(access);
        }
      } catch {
        // ignore periodic refresh errors
      }
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [accessLoading, accessError, access, getAccessToken]);

  async function notifyOrder(orderId: string) {
    if (!access) return;
    if (!canAssign(access.staffRole, access.isOwner)) return;

    try {
      let res = await fetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (res.status === 401) {
        const token = await getAccessToken();
        if (token) {
          res = await fetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({}),
          });
        }
      }

      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(body?.error || 'Failed to notify');
    } catch (e: any) {
      setStatus({ kind: 'error', message: String(e?.message || 'Failed to notify') });
    }
  }

  async function assignOrder(orderId: string, assignedToUserId: string | null) {
    if (!access) return;
    if (!canAssign(access.staffRole, access.isOwner)) return;

    try {
      setAssigningOrderId(orderId);
      let res = await fetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToUserId }),
      });

      if (res.status === 401) {
        const token = await getAccessToken();
        if (token) {
          res = await fetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ assignedToUserId }),
          });
        }
      }

      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(body?.error || 'Failed to assign order');

      const list = await fetchOrders(access);
      setOrders(list);
      handleNotifications(list, access);
    } catch (e: any) {
      setStatus({ kind: 'error', message: String(e?.message || 'Failed to assign order') });
    } finally {
      setAssigningOrderId(null);
    }
  }

  async function setOrderStatus(orderId: string, next: OrderStatus) {
    if (!access) return;
    if (!canSetStatus(access.staffRole, access.isOwner, next)) return;

    const prev = orders;
    setOrders((rows) => rows.map((o) => (o.id === orderId ? { ...o, status: next } : o)));

    try {
      let res = await fetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });

      if (res.status === 401) {
        const token = await getAccessToken();
        if (token) {
          res = await fetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: next }),
          });
        }
      }

      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(body?.error || 'Failed to update order');
    } catch (e) {
      setOrders(prev);
    }
  }

  return (
    <DashboardShell
      title="Orders"
      subtitle="Kitchen, waiters, and delivery staff see only what they need."
      navItems={navItems}
    >
      {status.kind === 'error' ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{status.message}</div>
      ) : null}

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 bg-gray-100 animate-pulse rounded" />
          <div className="h-10 bg-gray-100 animate-pulse rounded" />
          <div className="h-10 bg-gray-100 animate-pulse rounded" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-6 text-center">
          <div className="text-sm font-semibold text-gray-900">No orders yet</div>
          <p className="mt-1 text-sm text-gray-600">Orders will appear here once customers place them.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {o.order_type === 'dine_in' ? `Dine-in${o.table_number ? ` • Table ${o.table_number}` : ''}` : 'Delivery'}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">
                    {new Date(o.created_at).toLocaleString()} • {formatTzs(o.total)} • #{shortId(o.id)} • {o.placed_via}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800">
                    {statusLabel(o.status)}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <div className="text-xs font-semibold text-gray-700">Items</div>
                  {(() => {
                    const lineItems = normalizeLineItems(o.items);
                    if (lineItems.length === 0) {
                      return (
                        <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-md p-3 overflow-auto">
                          {JSON.stringify(o.items, null, 2)}
                        </pre>
                      );
                    }

                    return (
                      <div className="mt-2 overflow-hidden rounded-md border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Item</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Qty</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Price</th>
                              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {lineItems.map((li, idx) => {
                              const lineTotal = Number.isFinite(li.lineTotal) ? (li.lineTotal as number) : li.qty * li.price;
                              return (
                                <tr key={`${li.id || li.name}-${idx}`}>
                                  <td className="px-3 py-2 text-sm text-gray-900">{li.name}</td>
                                  <td className="px-3 py-2 text-sm text-gray-700 text-right">{li.qty}</td>
                                  <td className="px-3 py-2 text-sm text-gray-700 text-right">{formatTzs(li.price)}</td>
                                  <td className="px-3 py-2 text-sm text-gray-900 font-semibold text-right">{formatTzs(lineTotal)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  {canAssignOrders ? (
                    <>
                      <div className="text-xs font-semibold text-gray-700">Assignment</div>
                      <div className="mt-1 text-sm text-gray-800">{getAssigneeLabel(o.assigned_to_user_id)}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <select
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                          value={selectedAssigneeByOrder[o.id] ?? ''}
                          onChange={(e) =>
                            setSelectedAssigneeByOrder((prev) => ({
                              ...prev,
                              [o.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Assign to…</option>
                          {assignable.map((s) => {
                            const label = (s.displayName || '').trim() || (s.email || '').trim() || shortId(s.userId);
                            return (
                              <option key={s.userId} value={s.userId}>
                                {label} ({s.role})
                              </option>
                            );
                          })}
                        </select>

                        <button
                          type="button"
                          onClick={() => assignOrder(o.id, selectedAssigneeByOrder[o.id] || null)}
                          disabled={assigningOrderId === o.id || !selectedAssigneeByOrder[o.id]}
                          className="inline-flex items-center justify-center rounded-md bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {assigningOrderId === o.id ? 'Assigning…' : 'Assign'}
                        </button>

                        {o.assigned_to_user_id ? (
                          <button
                            type="button"
                            onClick={() => assignOrder(o.id, null)}
                            disabled={assigningOrderId === o.id}
                            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Unassign
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => notifyOrder(o.id)}
                          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                        >
                          Notify
                        </button>
                      </div>
                    </>
                  ) : null}

                  <div className="text-xs font-semibold text-gray-700">Customer</div>
                  <div className="mt-1 text-sm text-gray-800">{o.customer_name || '—'}</div>
                  <div className="mt-1 text-sm text-gray-800">{o.customer_phone || '—'}</div>

                  {o.order_type === 'delivery' ? (
                    <>
                      <div className="mt-3 text-xs font-semibold text-gray-700">Address</div>
                      <div className="mt-1 text-sm text-gray-800">{o.delivery_address || '—'}</div>
                      {o.delivery_notes ? <div className="mt-1 text-xs text-gray-600">Notes: {o.delivery_notes}</div> : null}
                    </>
                  ) : null}

                  <div className="mt-4 text-xs font-semibold text-gray-700">Actions</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {access
                      ? getNextActions({ current: o.status, role: access.staffRole, isOwner: access.isOwner }).map((next) => (
                          <button
                            key={next}
                            type="button"
                            onClick={() => setOrderStatus(o.id, next)}
                            disabled={!canSetStatus(access.staffRole, access.isOwner, next)}
                            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                          >
                            Mark {statusLabel(next)}
                          </button>
                        ))
                      : null}

                    {access && getNextActions({ current: o.status, role: access.staffRole, isOwner: access.isOwner }).length === 0 ? (
                      <div className="text-xs text-gray-500">No actions available.</div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
