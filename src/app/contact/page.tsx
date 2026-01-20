'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import SupportChatWidget from '@/components/SupportChatWidget';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const canSubmit = name.trim() && email.trim() && subject.trim() && message.trim();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmittedEmail(null);

    try {
      setLoading(true);
      const { data, error: fnError } = await supabase.functions.invoke('submit-contact', {
        body: {
          name,
          email,
          subject,
          message,
          website,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to send message');
      }

      if (!data?.ok) {
        throw new Error((data as any)?.error || 'Failed to send message');
      }

      setSuccess(true);
      setSubmittedEmail(email.trim());
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
      setWebsite('');
    } catch (err: any) {
      setError(err?.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">Contact</h1>
          <p className="mt-2 text-sm text-gray-600">
            Need help or have a question about pricing, billing, or setup? Send us a message and we’ll get back to you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <div className="bg-white shadow-sm rounded-xl border border-gray-200 p-6 sm:p-8">
          {error && (
            <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded" role="alert">
              Message sent. We’ll reply to {submittedEmail || 'your email'}.
            </div>
          )}

          <form className="space-y-5" onSubmit={onSubmit}>
            {/* Honeypot field (bots tend to fill this; humans won't see it) */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                Website
              </label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                Subject
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                required
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                Or email us directly: <span className="font-medium">support@scanmagic.online</span>
              </p>
              <button
                type="submit"
                disabled={loading || !canSubmit}
                className={`inline-flex justify-center rounded-md px-5 py-2.5 text-sm font-semibold text-white ${
                  loading || !canSubmit
                    ? 'bg-indigo-300 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {loading ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <SupportChatWidget />

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Support</h2>
              <p className="mt-1 text-sm text-gray-600">
                If live chat is unavailable, use the form and we’ll respond by email.
              </p>
              <div className="mt-4 text-sm text-gray-700">
                <div className="font-medium">Email</div>
                <div>support@scanmagic.online</div>
              </div>

              <div className="mt-5 text-xs text-gray-500">
                <a className="text-indigo-700 hover:text-indigo-800" href="/refunds">
                  Refund policy
                </a>
                <span className="mx-2">•</span>
                <a className="text-indigo-700 hover:text-indigo-800" href="/privacypolicy">
                  Privacy
                </a>
                <span className="mx-2">•</span>
                <a className="text-indigo-700 hover:text-indigo-800" href="/terms&condition">
                  Terms
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
