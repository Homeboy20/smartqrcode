"use client";

import React, { useState } from "react";
import QRCodeModal from "./QRCodeModal";

export default function QRModalExample() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [qrValue, setQrValue] = useState("https://example.com");

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">QR Code Modal Example</h2>
      
      <div className="mb-6">
        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="qr-value">
          QR Code Content
        </label>
        <input
          id="qr-value"
          type="text"
          value={qrValue}
          onChange={(e) => setQrValue(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter URL or text for QR code"
        />
      </div>
      
      <button
        onClick={openModal}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors"
      >
        Generate QR Code
      </button>
      
      <QRCodeModal
        isOpen={isModalOpen}
        onClose={closeModal}
        value={qrValue}
        title="Your QR Code"
      />
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Click the button above to generate and view your QR code in a modal dialog.</p>
        <p className="mt-2">You can then download the QR code as a PNG image.</p>
      </div>
    </div>
  );
} 