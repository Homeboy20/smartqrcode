import 'server-only';

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { createAnonClient } from '@/lib/supabase/server';

export type FirebaseDecodedIdToken = JWTPayload & {
  uid: string;
  phone_number?: string;
  email?: string;
};

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

const PROJECT_ID_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedProjectId: { value: string | null; fetchedAt: number } = { value: null, fetchedAt: 0 };

function readProjectIdFromEnv(): string | null {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT ||
    null
  );
}

async function readProjectIdFromAppSettings(): Promise<string | null> {
  const supabase = createAnonClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'general')
    .single();

  // Ignore missing-row errors.
  if (error && (error as any).code !== 'PGRST116') {
    return null;
  }

  const value: any = data?.value;
  if (!value) return null;

  const firebaseConfig = value?.firebaseConfig ?? value?.firebase_config ?? {};
  const firebase = value?.firebase ?? {};
  const merged = {
    ...firebaseConfig,
    ...firebase,
  } as any;

  const enabled = merged?.enabled;
  const projectId = typeof merged?.projectId === 'string' ? merged.projectId : null;

  if (enabled === false) return null;
  return projectId;
}

async function getFirebaseProjectId(): Promise<string> {
  const envProjectId = readProjectIdFromEnv();
  if (envProjectId) return envProjectId;

  const now = Date.now();
  if (now - cachedProjectId.fetchedAt < PROJECT_ID_CACHE_TTL_MS && cachedProjectId.value) {
    return cachedProjectId.value;
  }

  const dbProjectId = await readProjectIdFromAppSettings();
  cachedProjectId = { value: dbProjectId, fetchedAt: now };

  if (!dbProjectId) {
    throw new Error(
      'Missing Firebase project id. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID (or FIREBASE_PROJECT_ID), or configure Firebase in the admin panel (app_settings.general.firebase.projectId), to verify Firebase ID tokens.'
    );
  }

  return dbProjectId;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseDecodedIdToken> {
  const projectId = await getFirebaseProjectId();

  const { payload } = await jwtVerify(idToken, JWKS, {
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
  });

  const uid =
    (typeof (payload as any).user_id === 'string' && (payload as any).user_id) ||
    (typeof payload.sub === 'string' && payload.sub);

  if (!uid) {
    throw new Error('Invalid Firebase ID token: missing subject');
  }

  return {
    ...payload,
    uid,
    phone_number: typeof (payload as any).phone_number === 'string' ? (payload as any).phone_number : undefined,
    email: typeof (payload as any).email === 'string' ? (payload as any).email : undefined,
  };
}
