import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { findBestCountryMatchFromE164 } from '@/lib/phone/countryCallingCodes';

export type NormalizedPhone = {
  e164: string;
  inferredCountry?: string;
};

export function normalizeToE164(options: {
  raw: string;
  defaultCountry?: string; // ISO-3166-1 alpha-2
}): NormalizedPhone {
  const rawTrimmed = String(options.raw || '').trim();
  if (!rawTrimmed) {
    throw new Error('Please enter a phone number');
  }

  const parsed = rawTrimmed.startsWith('+')
    ? parsePhoneNumberFromString(rawTrimmed)
    : parsePhoneNumberFromString(rawTrimmed, (options.defaultCountry || undefined) as any);

  if (!parsed || !parsed.isValid()) {
    throw new Error('Invalid phone number. Please check it and try again.');
  }

  const e164 = parsed.number;
  const inferredCountry = parsed.country || findBestCountryMatchFromE164(e164)?.country;

  return { e164, inferredCountry };
}
