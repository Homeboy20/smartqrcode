import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/min';

export type CountryCallingCodeOption = {
  country: string; // ISO-3166-1 alpha-2
  name: string;
  callingCode: string; // digits only
};

let cachedOptions: CountryCallingCodeOption[] | null = null;

function getCountryDisplayName(country: string, locale?: string) {
  try {
    // Intl.DisplayNames is supported in modern browsers; fall back to country code if unavailable.
    const displayNames = new Intl.DisplayNames([locale || 'en'], { type: 'region' });
    return displayNames.of(country) || country;
  } catch {
    return country;
  }
}

export function getCountryCallingCodeOptions(locale?: string): CountryCallingCodeOption[] {
  // This list is locale-agnostic except for the rendered country names.
  // To avoid huge bundles and repeated work, cache one English-named list.
  // (If you need locale-specific sorting/names later, we can extend this cache by locale key.)
  if (cachedOptions) return cachedOptions;

  const countries = getCountries();
  const options: CountryCallingCodeOption[] = countries
    .map((country) => {
      const callingCode = String(getCountryCallingCode(country));
      return {
        country,
        name: getCountryDisplayName(country, locale),
        callingCode,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  cachedOptions = options;
  return options;
}

export function findOptionByCountry(country: string | null | undefined) {
  if (!country) return undefined;
  const upper = country.toUpperCase();
  return getCountryCallingCodeOptions().find((o) => o.country === upper);
}

export function findBestCountryMatchFromE164(e164: string) {
  const raw = String(e164 || '').trim();
  if (!raw.startsWith('+')) return undefined;

  // Prefer a real parse (handles edge cases and shared calling codes).
  const parsed = parsePhoneNumberFromString(raw);
  const parsedCountry = parsed?.country;
  if (parsedCountry) return findOptionByCountry(parsedCountry);

  // Fallback: longest calling-code prefix.
  const normalized = raw.replace(/\s+/g, '');
  let best: CountryCallingCodeOption | undefined;
  for (const opt of getCountryCallingCodeOptions()) {
    const prefix = `+${opt.callingCode}`;
    if (normalized.startsWith(prefix)) {
      if (!best || opt.callingCode.length > best.callingCode.length) best = opt;
    }
  }
  return best;
}
