import 'server-only';

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type FirebaseDecodedIdToken = JWTPayload & {
  uid: string;
  phone_number?: string;
  email?: string;
};

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com')
);

function getFirebaseProjectId(): string {
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GCP_PROJECT;

  if (!projectId) {
    throw new Error(
      'Missing Firebase project id. Set NEXT_PUBLIC_FIREBASE_PROJECT_ID (or FIREBASE_PROJECT_ID) to verify Firebase ID tokens.'
    );
  }

  return projectId;
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseDecodedIdToken> {
  const projectId = getFirebaseProjectId();

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
