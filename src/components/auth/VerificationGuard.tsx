'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { useAuth } from '@/context/FirebaseAuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface VerificationGuardProps {
  children: ReactNode;
  redirectTo?: string;
}

const VerificationGuard: React.FC<VerificationGuardProps> = ({ 
  children, 
  redirectTo = '/verify-account'
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isVerified, setIsVerified] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // User not logged in, redirect to login
        router.push('/login');
        return;
      }

      // Check verification status
      const verified = Boolean(user.emailVerified) || Boolean(user.phoneNumber);
      setIsVerified(verified);
      if (!verified) router.push(redirectTo);
    }
  }, [user, loading, router, redirectTo]);

  if (loading || isVerified === null) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Only render children if verified
  return isVerified ? <>{children}</> : null;
};

export default VerificationGuard; 