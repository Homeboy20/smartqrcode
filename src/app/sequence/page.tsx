import React from "react";
import SequenceGenerator from "@/components/SequenceGenerator";

export const metadata = {
  title: "Sequence Generator - ScanMagic",
  description: "Generate sequential QR codes and barcodes with custom options",
};

export default function SequencePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Sequence Generator
        </h1>
        <p className="mt-3 max-w-2xl mx-auto text-base text-gray-500 sm:text-lg">
          Generate sequential QR codes or barcodes with customizable options and flexible numbering.
        </p>
      </div>
      
      <SequenceGenerator />
    </div>
  );
} 