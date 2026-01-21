// This module previously provided Firebase OAuth providers.
// During the Supabase migration, OAuth sign-in is handled by Supabase.
// These exports are retained only to preserve import paths.

export type AuthProvider = unknown;

export const googleProvider: AuthProvider | null = null;
export const githubProvider: AuthProvider | null = null;
export const facebookProvider: AuthProvider | null = null;
export const twitterProvider: AuthProvider | null = null;

// Export available providers - ONLY include providers that are configured in Firebase console
export const AVAILABLE_PROVIDERS = {
  google: {
    name: 'Google',
    enabled: false,
    provider: googleProvider,
  },
  // Explicitly set these to false since they're not configured
  twitter: {
    name: 'Twitter',
    enabled: false,
    provider: twitterProvider,
  },
  github: {
    name: 'GitHub',
    enabled: false,
    provider: githubProvider,
  },
  facebook: {
    name: 'Facebook',
    enabled: false,
    provider: facebookProvider,
  }
};

// Define available auth providers
export const AUTH_PROVIDERS = [
  { id: 'google', name: 'Google', icon: 'google' },
  { id: 'facebook', name: 'Facebook', icon: 'facebook' },
  { id: 'github', name: 'GitHub', icon: 'github' },
  { id: 'twitter', name: 'Twitter', icon: 'twitter' }
];

// Function to check if a provider is available and initialized
export const isProviderEnabled = (providerId: string): boolean => {
  const providerKey = providerId.toLowerCase() as keyof typeof AVAILABLE_PROVIDERS;
  const providerInfo = AVAILABLE_PROVIDERS[providerKey];
  // Ensure the provider key exists, it's marked as enabled, AND the provider object itself is not null
  return providerInfo ? providerInfo.enabled && !!providerInfo.provider : false;
};

// Available provider options for UI display (this seems redundant with AUTH_PROVIDERS, consider removing one)
export const authProviderOptions = [
  { id: 'google', name: 'Google', icon: 'google' },
  { id: 'github', name: 'GitHub', icon: 'github' },
  { id: 'facebook', name: 'Facebook', icon: 'facebook' },
  { id: 'twitter', name: 'Twitter', icon: 'twitter' }
]; 