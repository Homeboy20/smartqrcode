'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardShell from '@/components/dashboard/DashboardShell';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRestaurantAccess } from '@/hooks/useRestaurantAccess';

type StaffRole = 'manager' | 'kitchen' | 'waiter' | 'delivery';

type StaffRow = {
  id: string;
  userId: string;
  role: StaffRole;
  createdAt: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
};

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string };

export default function DashboardStaffPage() {
  const router = useRouter();
  const { getAccessToken } = useSupabaseAuth();
  const { loading: accessLoading, access } = useRestaurantAccess();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [myRole, setMyRole] = useState<StaffRole | null>(null);
  const [canManageStaff, setCanManageStaff] = useState(false);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<StaffRole>('waiter');
  const [usePassword, setUsePassword] = useState(true);
  const [password, setPassword] = useState('');

  const roleOptions = useMemo(() => {
    const base: Array<{ value: StaffRole; label: string }> = [
      { value: 'waiter', label: 'Waiter' },
      { value: 'kitchen', label: 'Kitchen' },
      { value: 'delivery', label: 'Delivery' },
    ];

    if (isOwner) {
      base.unshift({ value: 'manager', label: 'Manager' });
    }

    return base;
  }, [isOwner]);

  useEffect(() => {
    if (accessLoading) return;
    if (!access) return;

    // Owner and managers can see Staff management.
    if (!access.isOwner && access.staffRole !== 'manager') {
      router.replace('/dashboard/orders');
    }
  }, [accessLoading, access, router]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setStatus({ kind: 'idle' });

      try {
        const token = await getAccessToken();
        const res = await fetch('/api/restaurant/staff', {
          method: 'GET',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const body = await res.json().catch(() => ({} as any));
        if (!res.ok) {
          throw new Error(body?.error || 'Failed to load staff');
        }

        if (cancelled) return;

        setStaff(Array.isArray(body?.staff) ? body.staff : []);
        setIsOwner(Boolean(body?.isOwner));
        setMyRole((body?.myRole as StaffRole) || null);
        setCanManageStaff(Boolean(body?.canManageStaff));
      } catch (e: any) {
        if (!cancelled) setStatus({ kind: 'error', message: String(e?.message || 'Failed to load staff') });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  async function inviteStaff() {
    setStatus({ kind: 'loading' });

    try {
      const token = await getAccessToken();
      const res = await fetch('/api/restaurant/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email,
          displayName,
          role,
          password: usePassword ? password : '',
        }),
      });

      const body = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(body?.error || 'Failed to add staff');
      }

      const newStaff = body?.staff as any;
      if (newStaff?.id) {
        setStaff((prev) => [newStaff as StaffRow, ...prev]);
      }

      setEmail('');
      setDisplayName('');
      setPassword('');
      setRole(isOwner ? 'waiter' : 'waiter');
      setStatus({
        kind: 'success',
        message: body?.createdWithPassword
          ? 'Staff user created with password. They can log in at /login.'
          : body?.invited
            ? 'Invite email sent and staff added.'
            : 'Staff added (existing user).',
      });
    } catch (e: any) {
      setStatus({ kind: 'error', message: String(e?.message || 'Failed to add staff') });
    }
  }

  function generatePassword() {
    // Simple client-side generator (12+ chars). Manager can copy once.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const length = 14;
    let out = '';
    for (let i = 0; i < length; i++) {
      out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    setPassword(out);
    setUsePassword(true);
  }

  return (
    <DashboardShell
      title="Staff"
      subtitle="Add and manage managers, kitchen staff, and waiters for your restaurant."
    >
      {status.kind === 'error' ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{status.message}</div>
      ) : null}
      {status.kind === 'success' ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{status.message}</div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-gray-900">Team members</div>
              <p className="mt-1 text-sm text-gray-600">
                You are {isOwner ? 'the owner' : (myRole ? myRole : 'a staff member')}.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="mt-4 text-sm text-gray-600">Loading…</div>
          ) : staff.length === 0 ? (
            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
              No staff members yet.
            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-md border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Role</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Added</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-2 text-sm text-gray-900">
                        {s.displayName || '—'}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        {s.email || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800">
                          {s.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">
                        {s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-sm font-semibold text-gray-900">Add staff</div>
          <p className="mt-1 text-sm text-gray-600">
            Create a staff account so they can sign in to this app.
          </p>

          {!canManageStaff ? (
            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Only the restaurant owner/manager can add staff.
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Email</label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@example.com"
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900">Display name (optional)</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. John"
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as StaffRole)}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {!isOwner ? (
                <div className="mt-2 text-xs text-gray-500">Only the owner can create other managers.</div>
              ) : null}
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <input
                  type="checkbox"
                  checked={usePassword}
                  onChange={(e) => setUsePassword(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Set a password (recommended)
              </label>
              <div className="mt-2 text-xs text-gray-600">
                Your login page uses email + password. If you don’t set a password, we’ll send an invite email instead.
              </div>

              {usePassword ? (
                <div className="mt-3">
                  <label className="block text-sm font-semibold text-gray-900">Temporary password</label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 characters"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Generate
                    </button>
                  </div>
                  <div className="mt-2 text-xs text-gray-600">
                    Share this password securely. Staff can change it later using password reset.
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={inviteStaff}
              disabled={!canManageStaff || status.kind === 'loading' || (usePassword && password.trim().length > 0 && password.trim().length < 8)}
              className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {status.kind === 'loading' ? 'Working…' : 'Invite / Add'}
            </button>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
