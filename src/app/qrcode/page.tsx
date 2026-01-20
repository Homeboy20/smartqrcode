import React from "react";
import QRCodeGenerator from "@/components/QRCodeGenerator";
// import TabNavigation from "@/components/TabNavigation"; // Removed

export const metadata = {
  title: "QR Code Generator - ScanMagic",
  description: "Generate custom QR codes for URLs, text, email, phone, and more.",
};

export default function QRCodePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          QR Code Generator
        </h1>
        <p className="mt-3 max-w-2xl mx-auto text-base text-gray-500 sm:text-lg">
          Create custom QR codes for various data types.
        </p>
      </div>
      
      {/* <TabNavigation /> */}
      <QRCodeGenerator />
    </div>
  );
} 