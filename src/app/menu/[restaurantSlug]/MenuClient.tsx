'use client';

import { useEffect, useMemo, useState } from 'react';

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
  image_url?: string | null;
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

function slugifyCategory(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildWhatsappMessage(opts: {
  restaurantName: string;
  items: Array<{ name: string; qty: number; price: number }>;
  acceptedPayments: string[];
  orderType: 'dine_in' | 'delivery';
  table?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
}) {
  const lines: string[] = [];

  lines.push(`Hello ${opts.restaurantName}`);
  lines.push('');

  lines.push(`Order type: ${opts.orderType === 'dine_in' ? 'Dine-in' : 'Delivery'}`);
  lines.push('');

  if (opts.orderType === 'dine_in') {
    if (opts.table) {
      lines.push(`Table: ${opts.table}`);
      lines.push('');
    }
  } else {
    if (opts.customerName) lines.push(`Name: ${opts.customerName}`);
    if (opts.customerPhone) lines.push(`Phone: ${opts.customerPhone}`);
    if (opts.deliveryAddress) lines.push(`Address: ${opts.deliveryAddress}`);
    if (opts.deliveryNotes) lines.push(`Notes: ${opts.deliveryNotes}`);
    if (opts.customerName || opts.customerPhone || opts.deliveryAddress || opts.deliveryNotes) lines.push('');
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
  const tableFromQr = Boolean(table?.trim());
  const [layout, setLayout] = useState<'list' | 'grid'>(() => {
    if (typeof window === 'undefined') return 'list';
    const v = window.localStorage.getItem('smartqrcode_menu_layout');
    return v === 'grid' || v === 'list' ? v : 'list';
  });
  const [cart, setCart] = useState<Record<string, number>>({});

  const [orderType, setOrderType] = useState<'dine_in' | 'delivery'>(() => {
    return tableFromQr ? 'dine_in' : 'delivery';
  });

  const [tableNumber, setTableNumber] = useState<string>(() => (tableFromQr ? table!.trim() : ''));
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // If the scanned QR includes ?table=, keep dine-in table locked to that identity.
  useEffect(() => {
    if (tableFromQr) {
      setOrderType('dine_in');
      setTableNumber(table.trim());
    }
  }, [table, tableFromQr]);

  useEffect(() => {
    try {
      window.localStorage.setItem('smartqrcode_menu_layout', layout);
    } catch {
      // ignore
    }
  }, [layout]);

  const availableItems = useMemo(() => items.filter((i) => i.available), [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of availableItems) {
      const key = item.category || 'Other';
      map.set(key, [...(map.get(key) || []), item]);
    }

    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [availableItems]);

  function scrollToCategory(category: string) {
    const id = `cat-${slugifyCategory(category || 'Other')}`;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

  const effectiveTable = tableFromQr ? table!.trim() : tableNumber.trim();
  const dineInReady = orderType !== 'dine_in' || Boolean(effectiveTable);
  const deliveryReady =
    orderType !== 'delivery' ||
    Boolean(deliveryAddress.trim()) ||
    Boolean(customerPhone.trim()) ||
    Boolean(customerName.trim());

  const canOrder = waNumber.length >= 7 && cartItems.length > 0 && dineInReady && deliveryReady;

  const waUrl = useMemo(() => {
    if (!canOrder) return '#';

    const msg = buildWhatsappMessage({
      restaurantName: restaurant.name,
      items: cartItems,
      acceptedPayments: restaurant.accepted_payments || [],
      orderType,
      table: orderType === 'dine_in' && effectiveTable ? effectiveTable : undefined,
      customerName: orderType === 'delivery' ? customerName.trim() || undefined : undefined,
      customerPhone: orderType === 'delivery' ? customerPhone.trim() || undefined : undefined,
      deliveryAddress: orderType === 'delivery' ? deliveryAddress.trim() || undefined : undefined,
      deliveryNotes: orderType === 'delivery' ? deliveryNotes.trim() || undefined : undefined,
    });

    return `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`;
  }, [canOrder, restaurant.name, restaurant.accepted_payments, cartItems, orderType, effectiveTable, customerName, customerPhone, deliveryAddress, deliveryNotes, waNumber]);

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
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-gray-900 truncate">{restaurant.name}</h1>
              <p className="mt-1 text-xs text-gray-600">Tap items to add to cart · WhatsApp ordering</p>
              {table?.trim() ? <div className="mt-1 text-[11px] text-gray-500">Table: {table.trim()}</div> : null}
            </div>
            {totalQty > 0 ? (
              <div className="text-right">
                <div className="text-xs font-semibold text-gray-700">Cart</div>
                <div className="text-sm font-bold text-gray-900">{totalQty} items</div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            {grouped.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {grouped.map(([category]) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => scrollToCategory(category)}
                    className="flex-shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100"
                  >
                    {category}
                  </button>
                ))}
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                onClick={() => setLayout('list')}
                className={
                  layout === 'list'
                    ? 'rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50'
                }
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setLayout('grid')}
                className={
                  layout === 'grid'
                    ? 'rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white'
                    : 'rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50'
                }
              >
                Grid
              </button>
            </div>
          </div>
        </div>

        {false ? (
          <div className="max-w-3xl mx-auto px-4 pb-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {grouped.map(([category]) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => scrollToCategory(category)}
                  className="flex-shrink-0 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100"
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 pb-28">
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-bold text-gray-900">Order options</div>
            {tableFromQr ? (
              <div className="text-xs text-gray-600">Table QR detected</div>
            ) : null}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (tableFromQr) return;
                setOrderType('dine_in');
              }}
              disabled={tableFromQr}
              className={
                orderType === 'dine_in'
                  ? 'rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50'
              }
            >
              Dine-in
            </button>
            <button
              type="button"
              onClick={() => {
                if (tableFromQr) return;
                setOrderType('delivery');
              }}
              disabled={tableFromQr}
              className={
                orderType === 'delivery'
                  ? 'rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white'
                  : 'rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50'
              }
            >
              Delivery
            </button>
          </div>

          {tableFromQr ? (
            <div className="mt-2 text-xs text-gray-500">Delivery is disabled for table QRs.</div>
          ) : null}

          {orderType === 'dine_in' ? (
            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-700">Table number</label>
              <p className="mt-1 text-xs text-gray-500">If you scanned a table QR, this is set automatically.</p>
              {tableFromQr ? (
                <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
                  Table {table!.trim()}
                  <span className="text-xs font-medium text-gray-500">(from QR)</span>
                </div>
              ) : (
                <input
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  inputMode="numeric"
                  placeholder="e.g. 5"
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
              {!dineInReady ? (
                <div className="mt-2 text-xs text-red-700">Table number is required for dine-in orders.</div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700">Name (optional)</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">Phone (optional)</label>
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="e.g. 07xxxxxxxx"
                  inputMode="tel"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700">Delivery address (optional)</label>
                <textarea
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Street, landmark, area"
                  rows={2}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-gray-700">Notes (optional)</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Any special instructions"
                  rows={2}
                />
              </div>
              {!deliveryReady ? (
                <div className="md:col-span-2 text-xs text-red-700">Add at least one delivery detail to help the restaurant.</div>
              ) : null}
            </div>
          )}
        </div>

        {availableItems.length === 0 ? (
          <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
            <div className="text-sm font-semibold text-gray-900">Menu not available</div>
            <p className="mt-1 text-sm text-gray-600">This restaurant has not published any available items yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([category, catItems]) => (
              <section
                key={category}
                id={`cat-${slugifyCategory(category)}`}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
              >
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-sm font-bold text-gray-900">{category}</h2>
                </div>

                {layout === 'list' ? (
                  <div className="divide-y divide-gray-100">
                    {catItems.map((item) => {
                      const qty = cart[item.id] || 0;
                      const price = toNumber(item.price);
                      return (
                        <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                          <div className="min-w-0 flex items-start gap-3">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="h-16 w-16 rounded-lg object-cover border border-gray-200 bg-white flex-shrink-0"
                                loading="lazy"
                              />
                            ) : null}

                            <div className="min-w-0">
                              <div className="font-semibold text-gray-900 leading-snug">{item.name}</div>
                              {item.description ? (
                                <div className="mt-1 text-sm text-gray-600 leading-snug">{item.description}</div>
                              ) : null}
                              <div className="mt-2 text-sm font-extrabold text-gray-900">{formatTzs(price)}</div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 flex-shrink-0">
                            {qty > 0 ? (
                              <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
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
                                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {catItems.map((item) => {
                        const qty = cart[item.id] || 0;
                        const price = toNumber(item.price);

                        return (
                          <div
                            key={item.id}
                            className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm"
                          >
                            {item.image_url ? (
                              <div className="aspect-[4/3] bg-gray-100">
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className="aspect-[4/3] bg-gray-100" />
                            )}

                            <div className="p-3">
                              <div className="font-semibold text-gray-900 leading-snug line-clamp-2">{item.name}</div>
                              {item.description ? (
                                <div className="mt-1 text-xs text-gray-600 leading-snug line-clamp-2">{item.description}</div>
                              ) : null}

                              <div className="mt-2 flex items-center justify-between gap-2">
                                <div className="text-sm font-extrabold text-gray-900">{formatTzs(price)}</div>

                                {qty > 0 ? (
                                  <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
                                    <button
                                      type="button"
                                      onClick={() => dec(item.id)}
                                      className="px-2 py-1.5 text-sm font-bold text-gray-800 hover:bg-gray-50"
                                    >
                                      −
                                    </button>
                                    <div className="px-2 py-1.5 text-sm font-bold text-gray-900">{qty}</div>
                                    <button
                                      type="button"
                                      onClick={() => add(item.id)}
                                      className="px-2 py-1.5 text-sm font-bold text-gray-800 hover:bg-gray-50"
                                    >
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => add(item.id)}
                                    className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                                  >
                                    Add
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
                  className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
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
                    ? 'inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700'
                    : 'inline-flex items-center justify-center rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 cursor-not-allowed'
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

          {!dineInReady ? (
            <div className="mt-2 text-xs text-gray-600">Select dine-in table number to order.</div>
          ) : null}

          {restaurant.accepted_payments?.length ? (
            <div className="mt-2 text-xs text-gray-600">Accepted payments: {restaurant.accepted_payments.join(', ')}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
