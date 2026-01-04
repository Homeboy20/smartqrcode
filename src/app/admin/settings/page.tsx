'use client';

import React from 'react';
import BrandingSettingsForm from '@/components/admin/BrandingSettingsForm';

export default function AdminSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Application Settings</h1>
      <div className="mt-6">
        <BrandingSettingsForm />
      </div>
    </div>
  );
} 