"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useSubscription as useSubscriptionHook } from '@/hooks/useSubscription';

type SubscriptionContextType = ReturnType<typeof useSubscriptionHook>;

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

// Avoid colliding with the canonical hook export name in hooks/useSubscription.
export function useSubscriptionContext() {
  return useSubscription();
}

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const subscriptionData = useSubscriptionHook();
  
  return (
    <SubscriptionContext.Provider value={subscriptionData}>
      {children}
    </SubscriptionContext.Provider>
  );
} 