export function toFriendlyFirebasePhoneAuthError(err: unknown): string {
  const code = String((err as any)?.code || '').toLowerCase();
  const message = String((err as any)?.message || '').toLowerCase();
  const combined = `${code} ${message}`;

  if (combined.includes('auth/billing-not-enabled')) {
    return 'Phone verification is unavailable because billing is not enabled for this Firebase project. Enable Billing (Blaze plan) in Firebase/Google Cloud and try again.';
  }

  if (combined.includes('auth/unauthorized-domain')) {
    return 'Phone verification is blocked because this domain is not authorized in Firebase. Add your domain in Firebase Console → Authentication → Settings → Authorized domains.';
  }

  if (combined.includes('auth/operation-not-allowed')) {
    return 'Phone verification is not enabled in Firebase. Enable it in Firebase Console → Authentication → Sign-in method → Phone.';
  }

  if (combined.includes('auth/quota-exceeded')) {
    return 'SMS quota exceeded for phone verification. Please try again later or contact support.';
  }

  if (combined.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (combined.includes('error-code:-39') || combined.includes('recaptcha') || combined.includes('captcha')) {
    return 'reCAPTCHA verification failed. Ask the administrator to verify the reCAPTCHA configuration in Firebase Console (Authentication → Sign-in method → Phone → reCAPTCHA verifier).';
  }

  // Firebase can block SMS sending via Identity Platform “SMS region policy”.
  // The exact error surface varies (often looks like invalid phone number or not allowed).
  if (
    combined.includes('sms') && (combined.includes('region') || combined.includes('policy') || combined.includes('not allowed') || combined.includes('blocked'))
  ) {
    return 'This phone number/country is blocked by the Firebase SMS region policy for this project. To support all countries, update Firebase/Identity Platform → SMS Region Policy to allow all regions.';
  }

  if (combined.includes('auth/invalid-phone-number') || combined.includes('invalid phone number')) {
    return 'Invalid phone number. Enter a full international number (e.g. +14155552671) or choose the correct country and try again.';
  }

  return String((err as any)?.message || 'Something went wrong. Please try again.');
}
