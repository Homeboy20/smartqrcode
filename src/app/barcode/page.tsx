import React from "react";
import BarcodeGenerator from "@/components/BarcodeGenerator";
// import TabNavigation from "@/components/TabNavigation"; // Removed

export const metadata = {
  title: "Barcode Generator - ScanMagic",
  description: "Generate various barcode formats like Code 128, EAN, UPC, and more.",
};

export default function BarcodePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Barcode Generator
        </h1>
        <p className="mt-3 max-w-2xl mx-auto text-base text-gray-500 sm:text-lg">
          Create various standard barcode formats.
        </p>
      </div>
      
      {/* <TabNavigation /> */}
      <BarcodeGenerator />
    </div>
  );
} 