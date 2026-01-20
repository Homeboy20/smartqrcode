"use client";

import React, { useEffect, useState } from 'react';

import QRCodeGenerator from '@/components/QRCodeGenerator';
import BarcodeGenerator from '@/components/BarcodeGenerator';
import SequenceGenerator from '@/components/SequenceGenerator';
import BulkSequenceGenerator from '@/components/BulkSequenceGenerator';

export default function UnifiedGenerator() {
  const [activeTab, setActiveTab] = useState<string>('qrcode');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (['qrcode', 'barcode', 'sequence', 'bulk'].includes(hash)) {
      setActiveTab(hash);
    } else {
      const savedTab = localStorage.getItem('activeGeneratorTab');
      if (savedTab && ['qrcode', 'barcode', 'sequence', 'bulk'].includes(savedTab)) {
        setActiveTab(savedTab);
      }
    }
    setIsInitialized(true);
  }, []);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);

    if (typeof window !== 'undefined') {
      localStorage.setItem('activeGeneratorTab', tab);
      window.history.replaceState(null, '', `#${tab}`);
    }
  };

  if (!isInitialized) {
    return <div className="w-full h-64 bg-gray-100 rounded-lg animate-pulse"></div>;
  }

  return (
    <div className="w-full">
      <div className="w-full bg-gray-50 rounded-xl p-2 border border-gray-200 mb-6">
        <nav className="flex flex-wrap justify-center gap-2" aria-label="Generator tabs">
          <button
            onClick={() => handleTabChange('qrcode')}
            id="tab-qrcode"
            aria-pressed={activeTab === 'qrcode'}
            className={`${
              activeTab === 'qrcode'
                ? 'bg-indigo-600 text-white font-bold shadow-md'
                : 'bg-white text-gray-700 hover:text-indigo-600 hover:bg-indigo-50'
            } whitespace-nowrap py-3 px-5 rounded-lg font-medium text-sm sm:text-base transition-all duration-200`}
          >
            🔲 QR Code
          </button>
          <button
            onClick={() => handleTabChange('barcode')}
            id="tab-barcode"
            aria-pressed={activeTab === 'barcode'}
            className={`${
              activeTab === 'barcode'
                ? 'bg-indigo-600 text-white font-bold shadow-md'
                : 'bg-white text-gray-700 hover:text-indigo-600 hover:bg-indigo-50'
            } whitespace-nowrap py-3 px-5 rounded-lg font-medium text-sm sm:text-base transition-all duration-200`}
          >
            📊 Barcode
          </button>
          <button
            onClick={() => handleTabChange('sequence')}
            id="tab-sequence"
            aria-pressed={activeTab === 'sequence'}
            className={`${
              activeTab === 'sequence'
                ? 'bg-indigo-600 text-white font-bold shadow-md'
                : 'bg-white text-gray-700 hover:text-indigo-600 hover:bg-indigo-50'
            } whitespace-nowrap py-3 px-5 rounded-lg font-medium text-sm sm:text-base transition-all duration-200`}
          >
            🔢 Sequence
          </button>
          <button
            onClick={() => handleTabChange('bulk')}
            id="tab-bulk"
            aria-pressed={activeTab === 'bulk'}
            className={`${
              activeTab === 'bulk'
                ? 'bg-indigo-600 text-white font-bold shadow-md'
                : 'bg-white text-gray-700 hover:text-indigo-600 hover:bg-indigo-50'
            } whitespace-nowrap py-3 px-5 rounded-lg font-medium text-sm sm:text-base transition-all duration-200`}
          >
            📦 Bulk Generator
          </button>
        </nav>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6">
        {activeTab === 'qrcode' && <QRCodeGenerator />}
        {activeTab === 'barcode' && <BarcodeGenerator />}
        {activeTab === 'sequence' && <SequenceGenerator />}
        {activeTab === 'bulk' && <BulkSequenceGenerator />}
      </div>
    </div>
  );
}
