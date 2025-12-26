"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useSupabaseSubscription } from '@/hooks/useSupabaseSubscription';
import { SubscriptionTier } from '@/lib/subscription';

type SubscriptionContextType = ReturnType<typeof useSupabaseSubscription>;

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

interface SubscriptionProviderProps {
  children: ReactNode;
}

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const subscriptionData = useSupabaseSubscription();
  
  return (
    <SubscriptionContext.Provider value={subscriptionData}>
      {children}
    </SubscriptionContext.Provider>
  );
} 