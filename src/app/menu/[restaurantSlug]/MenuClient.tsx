'use client';

import { useMemo, useState } from 'react';

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  whatsapp_number: string;
  accepted_payments: string[];
};

type MenuItem = {
  id: string;
  restaurant_id: string;
  category: string;
  name: string;
  description: string | null;
  price: string | number;
  available: boolean;
};

function toNumber(value: string | number) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeWaNumber(input: string) {
  return input.replace(/\D/g, '');
}

function formatTzs(n: number) {
  return `TZS ${Math.round(n).toLocaleString()}`;
}

function buildWhatsappMessage(opts: {
  restaurantName: string;
  items: Array<{ name: string; qty: number; price: number }>;
  acceptedPayments: string[];
  table?: string;
}) {
  const lines: string[] = [];

  lines.push(`Hello ${opts.restaurantName}`);
  lines.push('');

  if (opts.table) {
    lines.push(`Table: ${opts.table}`);
    lines.push('');
  }

  lines.push('New Order:');

  let total = 0;
  for (const item of opts.items) {
    const rowTotal = item.price * item.qty;
    total += rowTotal;
    lines.push(`• ${item.qty}x ${item.name} – ${formatTzs(rowTotal)}`);
  }

  lines.push('');
  lines.push(`Total: ${formatTzs(total)}`);

  const payments = (opts.acceptedPayments || []).filter(Boolean);
  if (payments.length) {
    lines.push('Accepted Payments:');
    for (const p of payments) lines.push(`• ${p}`);
  }

  return lines.join('\n');
}

export default function MenuClient({
  restaurant,
  items,
  table,
}: {
  restaurant: Restaurant;
  items: MenuItem[];
  table?: string;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});

  const availableItems = useMemo(() => items.filter((i) => i.available), [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of availableItems) {
      const key = item.category || 'Other';
      map.set(key, [...(map.get(key) || []), item]);
    }

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [availableItems]);

  const cartItems = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i] as const));
    const rows: Array<{ id: string; name: string; qty: number; price: number }> = [];

    for (const [id, qty] of Object.entries(cart)) {
      if (!qty) continue;
      const item = byId.get(id);
      if (!item) continue;
      rows.push({ id, name: item.name, qty, price: toNumber(item.price) });
    }

    return rows;
  }, [cart, items]);

  const total = useMemo(() => cartItems.reduce((sum, r) => sum + r.qty * r.price, 0), [cartItems]);
  const totalQty = useMemo(() => cartItems.reduce((sum, r) => sum + r.qty, 0), [cartItems]);

  const waNumber = sanitizeWaNumber(restaurant.whatsapp_number || '');
  const canOrder = waNumber.length >= 7 && cartItems.length > 0;

  const waUrl = useMemo(() => {
    if (!canOrder) return '#';

    const msg = buildWhatsappMessage({
      restaurantName: restaurant.name,
      items: cartItems,
      acceptedPayments: restaurant.accepted_payments || [],
      table: table?.trim() ? table.trim() : undefined,
    });

    return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
  }, [canOrder, restaurant.name, restaurant.accepted_payments, cartItems, table, waNumber]);

  function add(id: string) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  }

  function dec(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      const qty = (next[id] || 0) - 1;
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  function clearCart() {
    setCart({});
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-gray-900 truncate">{restaurant.name}</h1>
              <p className="mt-1 text-xs text-gray-600">Digital menu · Order via WhatsApp</p>
            </div>
            {totalQty > 0 ? (
              <div className="text-right">
                <div className="text-xs font-semibold text-gray-700">Cart</div>
                <div className="text-sm font-bold text-gray-900">{totalQty} items</div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        {availableItems.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <div className="text-sm font-semibold text-gray-900">Menu not available</div>
            <p className="mt-1 text-sm text-gray-600">This restaurant has not published any available items yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([category, catItems]) => (
              <section key={category} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-gray-900">{category}</h2>
                </div>

                <div className="divide-y divide-gray-100">
                  {catItems.map((item) => {
                    const qty = cart[item.id] || 0;
                    const price = toNumber(item.price);
                    return (
                      <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="font-semibold text-gray-900">{item.name}</div>
                          {item.description ? <div className="mt-1 text-sm text-gray-600">{item.description}</div> : null}
                          <div className="mt-2 text-sm font-bold text-gray-900">{formatTzs(price)}</div>
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          {qty > 0 ? (
                            <div className="inline-flex items-center rounded-md border border-gray-200 bg-white">
                              <button
                                type="button"
                                onClick={() => dec(item.id)}
                                className="px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
                              >
                                −
                              </button>
                              <div className="px-3 py-2 text-sm font-bold text-gray-900">{qty}</div>
                              <button
                                type="button"
                                onClick={() => add(item.id)}
                                className="px-3 py-2 text-sm font-bold text-gray-800 hover:bg-gray-50"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => add(item.id)}
                              className="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                            >
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-gray-700">Total</div>
              <div className="text-lg font-extrabold text-gray-900">{formatTzs(total)}</div>
            </div>

            <div className="flex items-center gap-2">
              {totalQty > 0 ? (
                <button
                  type="button"
                  onClick={clearCart}
                  className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                >
                  Clear
                </button>
              ) : null}

              <a
                href={waUrl}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!canOrder}
                className={
                  canOrder
                    ? 'inline-flex items-center justify-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700'
                    : 'inline-flex items-center justify-center rounded-md bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 cursor-not-allowed'
                }
                onClick={(e) => {
                  if (!canOrder) e.preventDefault();
                }}
              >
                Order via WhatsApp
              </a>
            </div>
          </div>

          {waNumber.length < 7 ? (
            <div className="mt-2 text-xs text-red-700">Restaurant WhatsApp number is not configured correctly.</div>
          ) : null}

          {cartItems.length === 0 ? (
            <div className="mt-2 text-xs text-gray-600">Add items to your cart to order.</div>
          ) : null}

          {restaurant.accepted_payments?.length ? (
            <div className="mt-2 text-xs text-gray-600">Accepted payments: {restaurant.accepted_payments.join(', ')}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
