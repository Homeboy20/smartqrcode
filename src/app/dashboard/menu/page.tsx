'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import DashboardShell from '@/components/dashboard/DashboardShell';
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRestaurantAccess } from '@/hooks/useRestaurantAccess';
import { useSubscription } from '@/hooks/useSubscription';

type Restaurant = {
  id: string;
  name: string;
  slug: string;
};

type MenuItem = {
  id: string;
  category: string;
  name: string;
  description: string | null;
  image_url?: string | null;
  price: string | number;
  available: boolean;
};

type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'success'; message: string };

async function fetchWithAuthFallback(
  getAccessToken: () => Promise<string | null>,
  input: RequestInfo,
  init?: RequestInit
) {
  let res = await fetch(input, init);

  if (res.status !== 401) return res;

  const token = await getAccessToken();
  if (!token) return res;

  const headers = new Headers(init?.headers || undefined);
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}

function toNumber(value: string | number) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function DashboardMenuPage() {
  const router = useRouter();
  const { getAccessToken } = useSupabaseAuth();
  const { loading: accessLoading, access } = useRestaurantAccess();
  const { subscriptionTier, baseSubscriptionTier, loading: subscriptionLoading, canUseFeature } = useSubscription();

  useEffect(() => {
    if (accessLoading) return;
    if (access && !access.isOwner) {
      router.replace('/dashboard/orders');
    }
  }, [accessLoading, access, router]);

  const baseTier = baseSubscriptionTier || subscriptionTier;
  const hasRestaurantAccess = canUseFeature('restaurant');

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const [editId, setEditId] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [price, setPrice] = useState('');
  const [available, setAvailable] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  async function loadAll() {
    setLoading(true);
    setStatus({ kind: 'idle' });

    try {
      const rRes = await fetchWithAuthFallback(getAccessToken, '/api/restaurant', { method: 'GET' });
      const rJson = await rRes.json().catch(() => ({} as any));
      if (!rRes.ok) throw new Error(rJson?.error || `Failed to load restaurant (${rRes.status})`);

      const r = (rJson as any)?.restaurant as Restaurant | null;
      setRestaurant(r);

      if (!r) {
        setItems([]);
        return;
      }

      const res = await fetchWithAuthFallback(getAccessToken, '/api/menu-items', { method: 'GET' });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Failed to load menu (${res.status})`);

      setItems(Array.isArray((json as any)?.items) ? ((json as any).items as MenuItem[]) : []);
    } catch (e: any) {
      setStatus({ kind: 'error', message: e?.message || 'Failed to load menu' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (subscriptionLoading) return;
    if (!hasRestaurantAccess) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptionLoading, hasRestaurantAccess]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      set.add(item.category || 'Other');
    }
    return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      if (availabilityFilter === 'available' && !item.available) return false;
      if (availabilityFilter === 'unavailable' && item.available) return false;

      const categoryName = item.category || 'Other';
      if (categoryFilter !== 'all' && categoryName !== categoryFilter) return false;

      if (!query) return true;
      const nameMatch = item.name.toLowerCase().includes(query);
      const descMatch = (item.description || '').toLowerCase().includes(query);
      return nameMatch || descMatch || categoryName.toLowerCase().includes(query);
    });
  }, [items, search, categoryFilter, availabilityFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of filteredItems) {
      const key = item.category || 'Other';
      map.set(key, [...(map.get(key) || []), item]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems]);

  function resetForm() {
    setEditId(null);
    setCategory('');
    setName('');
    setDescription('');
    setImageUrl('');
    setImageFile(null);
    setPrice('');
    setAvailable(true);
  }

  async function uploadImage() {
    if (!imageFile) {
      setStatus({ kind: 'error', message: 'Choose an image file first' });
      return;
    }

    setUploadingImage(true);
    setStatus({ kind: 'loading' });

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Please log in again');

      const fd = new FormData();
      fd.append('file', imageFile);

      const res = await fetch('/api/uploads/menu', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: fd,
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || json?.details || `Upload failed (${res.status})`);

      const url = String((json as any)?.url || '').trim();
      if (!url) throw new Error('Upload succeeded but URL is missing');

      setImageUrl(url);
      setStatus({ kind: 'success', message: 'Image uploaded' });
      setTimeout(() => setStatus({ kind: 'idle' }), 1200);
    } catch (e: any) {
      setStatus({ kind: 'error', message: e?.message || 'Upload failed' });
    } finally {
      setUploadingImage(false);
    }
  }

  function clearImage() {
    setImageUrl('');
    setImageFile(null);
    setStatus({ kind: 'idle' });
  }

  async function submit() {
    setStatus({ kind: 'loading' });

    try {
      const payload = {
        category,
        name,
        description: description.trim() ? description.trim() : null,
        imageUrl: imageUrl.trim() ? imageUrl.trim() : null,
        price,
        available,
      };

      const url = editId ? `/api/menu-items/${editId}` : '/api/menu-items';
      const method = editId ? 'PATCH' : 'POST';

      const res = await fetchWithAuthFallback(getAccessToken, url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Save failed (${res.status})`);

      setStatus({ kind: 'success', message: editId ? 'Item updated' : 'Item added' });
      resetForm();
      await loadAll();
    } catch (e: any) {
      setStatus({ kind: 'error', message: e?.message || 'Save failed' });
    }
  }

  async function toggleAvailability(item: MenuItem) {
    setStatus({ kind: 'loading' });

    try {
      const res = await fetchWithAuthFallback(getAccessToken, `/api/menu-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !item.available }),
      });

      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Update failed (${res.status})`);

      setItems((prev) => prev.map((p) => (p.id === item.id ? { ...p, available: !item.available } : p)));
      setStatus({ kind: 'idle' });
    } catch (e: any) {
      setStatus({ kind: 'error', message: e?.message || 'Update failed' });
    }
  }

  async function removeItem(id: string) {
    if (!confirm('Delete this menu item?')) return;

    setStatus({ kind: 'loading' });

    try {
      const res = await fetchWithAuthFallback(getAccessToken, `/api/menu-items/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({} as any));
      if (!res.ok) throw new Error(json?.error || `Delete failed (${res.status})`);

      setItems((prev) => prev.filter((p) => p.id !== id));
      setStatus({ kind: 'success', message: 'Item deleted' });
    } catch (e: any) {
      setStatus({ kind: 'error', message: e?.message || 'Delete failed' });
    }
  }

  function startEdit(item: MenuItem) {
    setEditId(item.id);
    setCategory(item.category);
    setName(item.name);
    setDescription(item.description || '');
    setImageUrl(item.image_url || '');
    setImageFile(null);
    setPrice(String(toNumber(item.price)));
    setAvailable(Boolean(item.available));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <DashboardShell
      title="Menu"
      subtitle="Create categories and items. Customers will order via WhatsApp."
      actions={
        restaurant ? (
          <Link
            href={`/menu/${restaurant.slug}`}
            target="_blank"
            className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            View public menu
          </Link>
        ) : null
      }
    >
      {subscriptionLoading ? (
        <div className="max-w-3xl mx-auto">
          <div className="h-24 bg-gray-200 animate-pulse rounded-lg" />
        </div>
      ) : baseTier === 'free' || !hasRestaurantAccess ? (
        <div className="max-w-3xl mx-auto">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900">Restaurant menu is a premium feature</h1>
            <p className="mt-2 text-gray-600">Start a paid trial or subscribe to manage menu items and uploads.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/pricing?required=1&redirect=${encodeURIComponent('/dashboard/menu')}`}
                className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                View plans
              </Link>
              <Link
                href="/generator"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                Continue to generator
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
      {status.kind === 'error' ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{status.message}</div>
      ) : null}
      {status.kind === 'success' ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">{status.message}</div>
      ) : null}

      {!loading && !restaurant ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm font-semibold text-amber-900">Restaurant not set up yet</div>
          <p className="mt-1 text-sm text-amber-900/90">Create your restaurant profile first.</p>
          <div className="mt-3">
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Go to settings
            </Link>
          </div>
        </div>
      ) : null}

      {restaurant ? (
        <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-gray-900">{editId ? 'Edit item' : 'Add menu item'}</div>
              <div className="text-xs text-gray-600">Simple MVP: category + name + price + availability</div>
            </div>
            {editId ? (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700">Category</label>
              <input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Burgers"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. Chicken Burger"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700">Description (optional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Short description"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700">Price</label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="e.g. 14000"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-700">Item image (optional)</label>
              <p className="mt-1 text-xs text-gray-600">Upload an image for this item (Pro/Business required for uploads).</p>

              <div className="mt-2 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="text-sm"
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={uploadImage}
                    disabled={!imageFile || uploadingImage}
                    className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {uploadingImage ? 'Uploading…' : 'Upload image'}
                  </button>

                  {imageUrl.trim() ? (
                    <button
                      type="button"
                      onClick={clearImage}
                      className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>

              {imageUrl.trim() ? (
                <div className="mt-3">
                  <div className="text-xs font-semibold text-gray-700">Preview</div>
                  <img
                    src={imageUrl}
                    alt="Menu item"
                    className="mt-2 h-24 w-24 rounded-md object-cover border border-gray-200 bg-white"
                    loading="lazy"
                    onError={() => setStatus({ kind: 'error', message: 'Image preview failed to load' })}
                  />
                </div>
              ) : (
                <div className="mt-2 text-xs text-gray-500">No image uploaded yet.</div>
              )}
            </div>
            <div className="flex items-end gap-3">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Available
              </label>
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={submit}
              disabled={status.kind === 'loading'}
              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {editId ? 'Save item' : 'Add item'}
            </button>
          </div>
        </div>
      ) : null}

      {restaurant ? (
        <>
          <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <div className="text-xs text-gray-500">Total items</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{items.length}</div>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <div className="text-xs text-gray-500">Available</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">
                {items.filter((i) => i.available).length}
              </div>
            </div>
            <div className="rounded-md border border-gray-200 bg-white p-3">
              <div className="text-xs text-gray-500">Categories</div>
              <div className="mt-1 text-lg font-semibold text-gray-900">{categories.length}</div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search items by name, category, or description"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <select
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as 'all' | 'available' | 'unavailable')}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All availability</option>
              <option value="available">Available only</option>
              <option value="unavailable">Unavailable only</option>
            </select>
          </div>

          {loading ? (
          <div className="space-y-3">
            <div className="h-10 bg-gray-100 animate-pulse rounded" />
            <div className="h-10 bg-gray-100 animate-pulse rounded" />
            <div className="h-10 bg-gray-100 animate-pulse rounded" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-md border border-gray-200 p-6 text-center">
            <div className="text-sm font-semibold text-gray-900">No menu items yet</div>
            <p className="mt-1 text-sm text-gray-600">Add your first item above.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-md border border-gray-200 p-6 text-center">
            <div className="text-sm font-semibold text-gray-900">No results match your filters</div>
            <p className="mt-1 text-sm text-gray-600">Try clearing filters or adjusting your search.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([cat, catItems]) => (
              <div key={cat} className="rounded-lg border border-gray-200">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="text-sm font-bold text-gray-900">{cat}</div>
                  <div className="text-xs text-gray-500">{catItems.length} items</div>
                </div>

                <div className="divide-y divide-gray-100">
                  {catItems.map((item) => (
                    <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="font-semibold text-gray-900 truncate">{item.name}</div>
                          <span
                            className={
                              item.available
                                ? 'text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800'
                                : 'text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700'
                            }
                          >
                            {item.available ? 'Available' : 'Unavailable'}
                          </span>
                        </div>
                        {item.description ? <div className="mt-1 text-sm text-gray-600">{item.description}</div> : null}
                        <div className="mt-1 text-sm font-semibold text-gray-900">TZS {toNumber(item.price).toLocaleString()}</div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleAvailability(item)}
                          disabled={status.kind === 'loading'}
                          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                        >
                          {item.available ? 'Mark unavailable' : 'Mark available'}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="inline-flex items-center justify-center rounded-md border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        </>
      ) : null}
        </>
      )}
    </DashboardShell>
  );
}
