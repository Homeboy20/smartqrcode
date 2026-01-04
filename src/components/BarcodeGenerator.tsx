"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import JsBarcode from "jsbarcode";
import { useSubscription } from "@/hooks/useSubscription";
import { useRouter } from "next/navigation";
import { useTrackUsage } from "@/hooks/useTrackUsage";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import Link from "next/link";

type ImageFormat = 'png' | 'svg' | 'jpg' | 'eps' | 'pdf';

interface BarcodeGeneratorProps {
  onDownload?: (dataUrl: string) => void;
}

export default function BarcodeGenerator({ onDownload }: BarcodeGeneratorProps) {
  const router = useRouter();
  const { subscriptionTier } = useSubscription();
  
  // Use the tracking hook
  const {
    trackUsage,
    error: trackingError,
    canUseFeature,
    getRemainingUsage,
  } = useTrackUsage();
  
  // Check free mode and auth status
  const { settings: appSettings, loading: settingsLoading } = useAppSettings();
  const { user, getAccessToken } = useSupabaseAuth();
  const isVisitor = !user;
  const canUseBasicFeatures = isVisitor && appSettings.freeMode && appSettings.freeModeFeatures.barcodeGeneration;
  
  const [text, setText] = useState<string>("");
  const [suffix, setSuffix] = useState<string>("");
  const [barcodeType, setBarcodeType] = useState<string>("CODE128");
  const [width, setWidth] = useState<number>(2);
  const [height, setHeight] = useState<number>(100);
  const [displayValue, setDisplayValue] = useState<boolean>(true);
  const [foregroundColor, setForegroundColor] = useState<string>("#000000");
  const [backgroundColor, setBackgroundColor] = useState<string>("#FFFFFF");
  const [marginTop, setMarginTop] = useState<number>(10);
  const [marginBottom, setMarginBottom] = useState<number>(10);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [imageFormat, setImageFormat] = useState<ImageFormat>('png');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [useDynamicLink, setUseDynamicLink] = useState(false);
  const [encryptDestination, setEncryptDestination] = useState(false);

  const isValidHttpUrl = (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  // List of supported barcode formats
  const barcodeFormats = useMemo(() => [
    { value: "CODE128", label: "Code 128 (default)", regex: /^[\x00-\x7F]*$/ },
    { value: "EAN13", label: "EAN-13", regex: /^\d{13}$/ },
    { value: "UPC", label: "UPC", regex: /^\d{12}$/ },
    { value: "EAN8", label: "EAN-8", regex: /^\d{8}$/ },
    { value: "CODE39", label: "Code 39", regex: /^[0-9A-Z\-\.\ \$\/\+\%]*$/ },
    { value: "ITF14", label: "ITF-14", regex: /^\d{14}$/ },
    { value: "MSI", label: "MSI", regex: /^\d+$/ },
    { value: "pharmacode", label: "Pharmacode", regex: /^\d+$/ },
  ], []);

  // List of supported image formats
  // const imageFormats = [
  //   { value: 'png', label: 'PNG' },
  //   { value: 'svg', label: 'SVG' },
  //   { value: 'jpg', label: 'JPG' },
  //   { value: 'eps', label: 'EPS' },
  //   { value: 'pdf', label: 'PDF' },
  // ];

  // Validate the barcode text based on the selected format
  useEffect(() => {
    if (!text) {
      setErrorMessage("");
      return;
    }

    const selectedFormat = barcodeFormats.find(f => f.value === barcodeType);
    if (selectedFormat && !selectedFormat.regex.test(text)) {
      setErrorMessage(`Invalid format for ${selectedFormat.label}`);
    } else {
      setErrorMessage("");
    }
  }, [text, barcodeType, barcodeFormats]);

  // Generate the barcode when inputs change
  const generateBarcode = useCallback(() => {
    if (canvasRef.current && text && !errorMessage) {
      try {
        JsBarcode(canvasRef.current, text, {
          format: barcodeType,
          displayValue,
          width,
          height,
          margin: 0,
          marginTop,
          marginBottom,
          lineColor: foregroundColor,
          background: backgroundColor,
        });
      } catch (e) {
        console.error("Failed to generate barcode:", e);
        alert("Failed to generate barcode. Please check your input.");
      }
    }
  }, [text, barcodeType, width, height, displayValue, foregroundColor, backgroundColor, marginTop, marginBottom, errorMessage]);

  useEffect(() => {
    if (text && !errorMessage && canvasRef.current) {
      generateBarcode();
    }
  }, [text, errorMessage, canvasRef, generateBarcode]);

  const downloadBarcode = async () => {
    if (canvasRef.current) {
      try {
        // Check if user can generate barcode
        const remainingBarcodes = getRemainingUsage('barcodesGenerated');
        
        if (remainingBarcodes <= 0) {
          alert(`You've reached your barcode generation limit for your ${subscriptionTier} plan. Please upgrade to continue.`);
          router.push('/pricing');
          return;
        }
        
        // Track usage before generating
        const trackSuccess = await trackUsage('barcodesGenerated');
        
        if (!trackSuccess) {
          if (trackingError) {
            alert(trackingError);
          }
          return;
        }

        let valueToEncode = (text + suffix).trim();

        if (useDynamicLink) {
          if (!user) {
            setLockedFeatureName('Dynamic Barcodes');
            setShowLoginModal(true);
            return;
          }

          if (!canUseFeature('enhancedBarcodes')) {
            setLockedFeatureName('Dynamic Barcodes (Pro+)');
            setShowLoginModal(true);
            router.push('/pricing');
            return;
          }

          if (!isValidHttpUrl(valueToEncode)) {
            alert('Dynamic barcodes only support http(s) URLs.');
            return;
          }

          const token = await getAccessToken();
          if (!token) {
            alert('Please log in again.');
            return;
          }

          const res = await fetch('/api/codes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              type: 'barcode',
              destination: valueToEncode,
              encrypt: encryptDestination,
              name: `Dynamic Barcode (${barcodeType})`,
            }),
          });

          const json = await res.json().catch(() => ({}));
          if (!res.ok) {
            alert((json as any)?.error || 'Failed to create dynamic barcode');
            return;
          }

          const dynamicUrl = (json as any)?.url;
          if (!dynamicUrl) {
            alert('Failed to create dynamic barcode');
            return;
          }

          valueToEncode = dynamicUrl;

          // Update preview to match what we download.
          setText(dynamicUrl);
          setSuffix('');
        }

        // Ensure canvas renders the final value.
        try {
          JsBarcode(canvasRef.current, valueToEncode, {
            format: barcodeType,
            displayValue,
            width,
            height,
            margin: 0,
            marginTop,
            marginBottom,
            lineColor: foregroundColor,
            background: backgroundColor,
          });
        } catch (e) {
          console.error('Failed to generate barcode:', e);
          alert('Failed to generate barcode. Please check your input.');
          return;
        }
        
        // Process based on image format
        const canvas = canvasRef.current as HTMLCanvasElement;
        let dataUrl;
        let extension;
        
        // Check premium formats
        if (imageFormat === "svg" && !canUseFeature('barcodesGenerated')) {
          setLockedFeatureName('SVG Export');
          setShowLoginModal(true);
          return;
        } else if (imageFormat === "pdf" && !canUseFeature('barcodesGenerated')) {
          setLockedFeatureName('PDF Export');
          setShowLoginModal(true);
          return;
        }
        
        // Process the different formats
        if (imageFormat === "svg") {
          // SVG export logic (simplified for this example)
          alert("SVG export not implemented in this demo");
          return;
        } else if (imageFormat === "pdf") {
          // PDF export logic (simplified for this example)
          alert("PDF export not implemented in this demo");
          return;
        } else {
          // Default to PNG/JPEG 
          const mimeType = imageFormat === "jpg" ? "image/jpeg" : "image/png";
          const quality = imageFormat === "jpg" ? 1.0 : undefined;
          
          // For free tier, reduce quality
          if (subscriptionTier === "free" && imageFormat === "jpg") {
            const resizedCanvas = document.createElement("canvas");
            const scaleFactor = 0.5;
            resizedCanvas.width = canvas.width * scaleFactor;
            resizedCanvas.height = canvas.height * scaleFactor;
            const ctx = resizedCanvas.getContext("2d");
            ctx?.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
            dataUrl = resizedCanvas.toDataURL(mimeType, 0.7);
          } else {
            dataUrl = canvas.toDataURL(mimeType, quality);
          }
          
          extension = imageFormat;
        }
        
        // Download the file
        if (onDownload && dataUrl) {
          onDownload(dataUrl);
        } else if (dataUrl) {
          const downloadLink = document.createElement("a");
          downloadLink.href = dataUrl;
          downloadLink.download = `barcode-${barcodeType.toLowerCase()}-${valueToEncode}.${extension}`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
      } catch (e) {
        console.error("Failed to download barcode:", e);
      }
    }
  };

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Login prompt for visitors in free mode */}
      {canUseBasicFeatures && (
        <div className="bg-gradient-to-r from-green-50 to-teal-50 border-l-4 border-green-500 p-4 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-green-800">Free Preview Mode</h3>
              <p className="mt-1 text-sm text-green-700">
                You're using basic barcode generation. <Link href="/register" className="font-semibold underline hover:text-green-900">Create a free account</Link> to save your barcodes and access premium features.
              </p>
            </div>
            <div className="ml-auto pl-3">
              <Link href="/login" className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none">
                Login
              </Link>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-lg p-6 border border-zinc-200">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Barcode Generator</h2>
        <p className="text-gray-600">Create various standard barcodes.</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column - Form */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="barcode-text">
              Barcode Value <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              id="barcode-text"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter barcode value"
            />
            {errorMessage && (
              <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
            )}
          </div>

          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-gray-700">Dynamic link</div>
                <div className="text-xs text-gray-600">Creates a short ScanMagic link for your barcode.</div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={useDynamicLink}
                  onChange={(e) => {
                    const next = e.target.checked;
                    if (next) {
                      if (isVisitor) {
                        setLockedFeatureName('Dynamic Barcodes');
                        setShowLoginModal(true);
                        return;
                      }
                      if (!canUseFeature('enhancedBarcodes')) {
                        setLockedFeatureName('Dynamic Barcodes (Pro+)');
                        setShowLoginModal(true);
                        router.push('/pricing');
                        return;
                      }
                    }

                    setUseDynamicLink(next);
                    if (!next) setEncryptDestination(false);
                  }}
                />
                Enable
              </label>
            </div>

            {useDynamicLink && (
              <div className="mt-3 flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-gray-700">Encrypt destination</div>
                  <div className="text-xs text-gray-600">Hides the destination URL in storage.</div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={encryptDestination}
                    onChange={(e) => setEncryptDestination(e.target.checked)}
                  />
                  Enable
                </label>
              </div>
            )}
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="barcode-suffix">
              Suffix (Optional)
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              id="barcode-suffix"
              type="text"
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              placeholder="Enter optional suffix"
            />
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="barcode-type">
              Barcode Format
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              id="barcode-type"
              value={barcodeType}
              onChange={(e) => setBarcodeType(e.target.value)}
            >
              {barcodeFormats.map((format) => (
                <option key={format.value} value={format.value}>
                  {format.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {barcodeType === "CODE128" && "Accepts any ASCII character"}
              {barcodeType === "EAN13" && "Must be exactly 13 digits"}
              {barcodeType === "UPC" && "Must be exactly 12 digits"}
              {barcodeType === "EAN8" && "Must be exactly 8 digits"}
              {barcodeType === "CODE39" && "Accepts 0-9, A-Z, -, ., space, $, /, +, %"}
              {barcodeType === "ITF14" && "Must be exactly 14 digits"}
              {barcodeType === "MSI" && "Accepts only digits"}
              {barcodeType === "pharmacode" && "Accepts only digits"}
            </p>
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="barcode-width">
                Bar Width: {width}
              </label>
              <input
                className="w-full"
                id="barcode-width"
                type="range"
                min="1"
                max="5"
                step="0.5"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="barcode-height">
                Height: {height}px
              </label>
              <input
                className="w-full"
                id="barcode-height"
                type="range"
                min="50"
                max="200"
                step="10"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </div>
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="margin-top">
                Top Margin: {marginTop}px
              </label>
              <input
                className="w-full"
                id="margin-top"
                type="range"
                min="0"
                max="50"
                step="5"
                value={marginTop}
                onChange={(e) => setMarginTop(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="margin-bottom">
                Bottom Margin: {marginBottom}px
              </label>
              <input
                className="w-full"
                id="margin-bottom"
                type="range"
                min="0"
                max="50"
                step="5"
                value={marginBottom}
                onChange={(e) => setMarginBottom(Number(e.target.value))}
              />
            </div>
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="fg-color">
                Foreground Color
              </label>
              <input
                className="w-full"
                id="fg-color"
                type="color"
                value={foregroundColor}
                onChange={(e) => setForegroundColor(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="bg-color">
                Background Color
              </label>
              <input
                className="w-full"
                id="bg-color"
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
              />
            </div>
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 mb-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={displayValue}
                onChange={(e) => setDisplayValue(e.target.checked)}
                className="mr-2"
              />
              <span className="text-gray-700 text-sm font-bold">Show Text Below Barcode</span>
            </label>
          </div>
          
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="image-format">
              Download Format
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="image-format"
                  value="jpg"
                  checked={imageFormat === "jpg" || subscriptionTier === "free"}
                  onChange={() => setImageFormat("jpg")}
                />
                <span className="ml-2">JPEG</span>
                {subscriptionTier === "free" && (
                  <span className="ml-1 text-xs text-gray-600">(Low Resolution)</span>
                )}
              </label>
              
              <label className={`inline-flex items-center ${!canUseFeature('barcodesGenerated') ? "opacity-50" : ""}`}>
                <input
                  type="radio"
                  className="form-radio"
                  name="image-format"
                  value="png"
                  checked={imageFormat === "png"}
                  onChange={() => setImageFormat("png")}
                  disabled={!canUseFeature('barcodesGenerated')}
                />
                <span className="ml-2">PNG</span>
                {!canUseFeature('barcodesGenerated') && (
                  <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                )}
              </label>
              
              <label className={`inline-flex items-center ${!canUseFeature('barcodesGenerated') ? "opacity-50" : ""}`}>
                <input
                  type="radio"
                  className="form-radio"
                  name="image-format"
                  value="svg"
                  checked={imageFormat === "svg"}
                  onChange={() => setImageFormat("svg")}
                  disabled={!canUseFeature('barcodesGenerated')}
                />
                <span className="ml-2">SVG</span>
                {!canUseFeature('barcodesGenerated') && (
                  <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                )}
              </label>
              
              <label className={`inline-flex items-center ${!canUseFeature('barcodesGenerated') ? "opacity-50" : ""}`}>
                <input
                  type="radio"
                  className="form-radio"
                  name="image-format"
                  value="pdf"
                  checked={imageFormat === "pdf"}
                  onChange={() => setImageFormat("pdf")}
                  disabled={!canUseFeature('barcodesGenerated')}
                />
                <span className="ml-2">PDF</span>
                {!canUseFeature('barcodesGenerated') && (
                  <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                )}
              </label>
            </div>
          </div>
          
          <button
            className="w-full bg-primary hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center justify-center"
            onClick={generateBarcode}
            disabled={!text || !!errorMessage}
          >
            <span>Generate Barcode</span>
          </button>
          
          <button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center justify-center"
            onClick={downloadBarcode}
            disabled={!text || !!errorMessage}
          >
            <span>Download Barcode</span>
            <span className="ml-2">(.{imageFormat.toUpperCase()})</span>
          </button>
        </div>
        
        {/* Right Column - Preview */}
        <div className="space-y-4">
          <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 text-center">
            <h3 className="text-lg font-medium text-gray-800 mb-3">Preview</h3>
            {(text + suffix).trim() === "" ? (
              <div className="flex items-center justify-center h-32 bg-gray-200 rounded-md text-gray-500">
                Enter value to preview
              </div>
            ) : (
              <canvas ref={canvasRef} className="mx-auto border border-gray-300"></canvas>
            )}
            {errorMessage && (
              <p className="mt-2 text-sm text-red-600">{errorMessage}</p>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-4">
            {(text+suffix) && !errorMessage && `Type: ${barcodeFormats.find(f => f.value === barcodeType)?.label}`}
          </p>
        </div>
      </div>
      </div>

      {/* Login Required Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setShowLoginModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <svg className="w-6 h-6 text-green-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Premium Feature
              </h3>
              <button
                onClick={() => setShowLoginModal(false)}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-6">
              <div className="bg-gradient-to-r from-green-50 to-teal-50 border-l-4 border-green-500 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-700">
                  <strong className="text-green-700">{lockedFeatureName}</strong> {isVisitor ? 'requires a free account' : 'is a premium feature'}.
                </p>
              </div>
              
              {isVisitor ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Create a <strong>free account</strong> to unlock:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2 ml-4">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Save your barcodes</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Access download history</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Track analytics</span>
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-3">
                    🚀 Upgrade to Pro later for advanced export formats
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Upgrade to <strong className="text-green-600">Pro</strong> or <strong className="text-teal-600">Business</strong> to unlock:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2 ml-4">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>SVG & PDF export formats</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>High-quality exports</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Bulk barcode generation</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              {isVisitor ? (
                <>
                  <button
                    onClick={() => router.push('/register?returnTo=/barcode')}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition transform hover:scale-105 flex items-center justify-center shadow-lg"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Create Free Account
                  </button>
                  <button
                    onClick={() => router.push('/login?returnTo=/barcode')}
                    className="w-full bg-white border-2 border-green-600 text-green-600 hover:bg-green-50 font-semibold py-3 px-4 rounded-lg transition"
                  >
                    Already have an account? Login
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition transform hover:scale-105 flex items-center justify-center shadow-lg"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    View Pricing Plans
                  </button>
                  <button
                    onClick={() => setShowLoginModal(false)}
                    className="w-full bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 px-4 rounded-lg transition"
                  >
                    Continue with Free Features
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 