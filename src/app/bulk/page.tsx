import React from "react";
import BulkSequenceGenerator from "@/components/BulkSequenceGenerator";

export const metadata = {
  title: "Bulk Sequence Generator - ScanMagic",
  description: "Generate and download multiple QR codes or barcodes at once",
};

export default function BulkPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Bulk Sequence Generator
        </h1>
        <p className="mt-3 max-w-2xl mx-auto text-base text-gray-500 sm:text-lg">
          Generate and download multiple QR codes or barcodes at once as a ZIP file.
        </p>
      </div>
      
      <BulkSequenceGenerator />
    </div>
  );
} 