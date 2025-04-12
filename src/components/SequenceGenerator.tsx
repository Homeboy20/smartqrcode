"use client";

import React, { useState, useRef, useEffect } from "react";
import QRCode from "react-qr-code";
import * as qrcode from "qrcode";
import JsBarcode from "jsbarcode";
import { createRoot } from 'react-dom/client';
import jsPDF from 'jspdf';
import { useSubscription } from "../hooks/useSubscription";
import { useTrackUsage } from "../hooks/useTrackUsage";
import { hasFeatureAccess, getFeatureLimit } from '../lib/subscriptions';
import SubscriptionCheck from './SubscriptionCheck';
import { useRouter } from "next/navigation";
import Link from "next/link";

type ImageFormat = 'png' | 'svg' | 'jpg' | 'eps' | 'pdf' | 'pdf-tile';

export default function SequenceGenerator() {
  const router = useRouter();
  // Use subscription context
  const { 
    subscriptionTier,
    loading: subscriptionLoading,
    error: subscriptionError
  } = useSubscription();
  
  // Use tracking hook
  const {
    trackUsage,
    isTracking,
    error: trackingError,
    canUseFeature,
    getRemainingUsage,
    isWithinUsageLimit
  } = useTrackUsage();
  
  const [prefix, setPrefix] = useState<string>("");
  const [startNumber, setStartNumber] = useState<number>(1);
  const [increment, setIncrement] = useState<number>(1);
  const [padding, setPadding] = useState<number>(4);
  const [suffix, setSuffix] = useState<string>("");
  const [count, setCount] = useState<number>(1);
  const [format, setFormat] = useState<"qrcode" | "barcode">("barcode");
  const [barcodeType, setBarcodeType] = useState<string>("CODE128");
  const [previewCode, setPreviewCode] = useState<string>("");
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [imageFormat, setImageFormat] = useState<ImageFormat>('png');
  
  // Tiling State (for PDF Tile download)
  const [tileColumns, setTileColumns] = useState<number>(5);
  const [tileRows, setTileRows] = useState<number>(10);
  const [tileSpacing, setTileSpacing] = useState<number>(5);
  const [tileSpacingUnit, setTileSpacingUnit] = useState<'mm' | 'cm'>('mm');

  const qrCodeRef = useRef<HTMLDivElement>(null);
  const barcodeCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const barcodeFormats = [
    { value: "CODE128", label: "Code 128 (default)" },
    { value: "EAN13", label: "EAN-13" },
    { value: "UPC", label: "UPC" },
    { value: "EAN8", label: "EAN-8" },
    { value: "CODE39", label: "Code 39" },
    { value: "ITF14", label: "ITF-14" },
    { value: "MSI", label: "MSI" },
    { value: "pharmacode", label: "Pharmacode" },
  ];

  // Generate preview whenever input values change
  useEffect(() => {
    const generatePreview = () => {
      const paddedNumber = String(startNumber).padStart(padding, '0');
      const code = `${prefix}${paddedNumber}${suffix}`;
      setPreviewCode(code);
      
      if (format === "barcode" && barcodeCanvasRef.current) {
        try {
          JsBarcode(barcodeCanvasRef.current, code, {
            format: barcodeType,
            width: 2,
            height: 100,
            displayValue: true,
            lineColor: "#000000",
            background: "#FFFFFF",
          });
        } catch (err) {
          console.error("Error generating barcode", err);
        }
      }
      
      return code;
    };

    if (prefix !== '' || startNumber > 0) {
      generatePreview();
    }
  }, [prefix, startNumber, padding, format, barcodeType, barcodeCanvasRef, suffix]);

  const generateSequence = () => {
    // Validate input
    if (!count || count <= 0) {
      alert("Please enter a valid count greater than 0");
      return [];
    }

    const feature = format === "qrcode" ? "qrCodesGenerated" : "barcodesGenerated";
    
    // Check if user can generate this many codes
    if (subscriptionTier === "free" && !isWithinUsageLimit(feature, count)) {
      alert(`You've reached your daily limit for ${format === "qrcode" ? "QR code" : "barcode"} generation.`);
      router.push('/pricing');
      return [];
    }

    // If user can proceed, track the usage
    if (subscriptionTier === "free") {
      if (format === "qrcode") {
        trackUsage('qrCodesGenerated', count);
      } else {
        trackUsage('barcodesGenerated', count);
      }
    }

    const newCodes = [];
    let currentNumber = startNumber;
    
    for (let i = 0; i < count; i++) {
      const paddedNumber = String(currentNumber).padStart(padding, '0');
      const code = `${prefix}${paddedNumber}${suffix}`;
      newCodes.push(code);
      currentNumber += increment;
    }
    
    setGeneratedCodes(newCodes);
    return newCodes;
  };

  // For a specific feature check
  const canGenerateQRCodes = canUseFeature('qrCodesGenerated');
  const canGenerateBarcodes = canUseFeature('barcodesGenerated');
  
  // For remaining usage
  const remainingQRCodes = getRemainingUsage('qrCodesGenerated');
  const remainingBarcodes = getRemainingUsage('barcodesGenerated');
  
  const downloadCode = async (codeValue: string, index: number) => {
    try {
      const canvas = document.createElement("canvas");
      let imageDataUrl: string | null = null;
      let isSvg = false;
      let svgString = '';

      if (format === "qrcode") {
        if (imageFormat === 'svg') {
          isSvg = true;
          // Create SVG string (rendered in a temporary element)
          const qrElement = document.createElement('div');
          qrElement.style.display = 'inline-block';
          document.body.appendChild(qrElement);
          const qrComponent = <QRCode value={codeValue} size={256} level="M" />;
          createRoot(qrElement).render(qrComponent);
          const renderedSvg = qrElement.querySelector('svg');
          svgString = renderedSvg ? renderedSvg.outerHTML : '';
          document.body.removeChild(qrElement);
        } else {
          await qrcode.toCanvas(canvas, codeValue, { width: 256, margin: 1 });
          imageDataUrl = canvas.toDataURL('image/png'); // Use PNG as base for PDF
        }
      } else {
        // Barcode
        JsBarcode(canvas, codeValue, { format: barcodeType, width: 2, height: 100, displayValue: true, lineColor: "#000000", background: "#FFFFFF" });
        if (imageFormat === 'svg') {
          isSvg = true;
          const barcodeData = canvas.toDataURL('image/png');
          svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${barcodeData}" width="${canvas.width}" height="${canvas.height}"/></svg>`;
        } else {
          imageDataUrl = canvas.toDataURL('image/png'); // Use PNG as base for PDF
        }
      }

      // --- Download Logic --- 
      const downloadFileName = `${format === "qrcode" ? "qrcode" : "barcode"}-${index + 1}`;

      if (imageFormat === 'pdf') {
         if (!imageDataUrl) {
           alert("Cannot generate PDF from SVG directly yet. Please choose PNG or JPG as base.");
           // TODO: Could implement SVG to PDF conversion if needed
           return;
         }
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        
        const availableWidth = pdfWidth - margin * 2;
        const availableHeight = pdfHeight - margin * 2;
        let imgWidth = canvas.width * 0.264583;
        let imgHeight = canvas.height * 0.264583;
        const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
        imgWidth *= ratio;
        imgHeight *= ratio;
        
        const xPos = (pdfWidth - imgWidth) / 2;
        const yPos = (pdfHeight - imgHeight) / 2;
        
        pdf.addImage(imageDataUrl, 'PNG', xPos, yPos, imgWidth, imgHeight);
        pdf.save(`${downloadFileName}.pdf`);

      } else if (imageFormat === 'pdf-tile') {
        if (!imageDataUrl) {
          alert("Cannot generate PDF Tile from SVG directly yet. Please choose PNG or JPG as base.");
          return;
        }
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' }); // Default to A4 for tiles
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10; // Default margin
        const spacingVal = tileSpacingUnit === 'cm' ? tileSpacing * 10 : tileSpacing; // Convert cm to mm
        
        const usableWidth = pdfWidth - margin * 2;
        const usableHeight = pdfHeight - margin * 2;
        
        // Calculate code size based on columns/rows and spacing
        const cellWidth = (usableWidth - (tileColumns - 1) * spacingVal) / tileColumns;
        const cellHeight = (usableHeight - (tileRows - 1) * spacingVal) / tileRows;
        
        // Use canvas aspect ratio to determine code dimensions within cell
        const canvasRatio = canvas.width / canvas.height;
        let codeWidthMM, codeHeightMM;
        if ((cellWidth / cellHeight) > canvasRatio) { // Cell is wider than code
          codeHeightMM = cellHeight;
          codeWidthMM = cellHeight * canvasRatio;
        } else { // Cell is taller than code
          codeWidthMM = cellWidth;
          codeHeightMM = cellWidth / canvasRatio;
        }

        // Add the same image multiple times
        for (let r = 0; r < tileRows; r++) {
          for (let c = 0; c < tileColumns; c++) {
            const xPos = margin + c * (cellWidth + spacingVal) + (cellWidth - codeWidthMM) / 2; // Center in cell
            const yPos = margin + r * (cellHeight + spacingVal) + (cellHeight - codeHeightMM) / 2; // Center in cell
            
            // Check bounds before adding image
            if (xPos + codeWidthMM <= pdfWidth - margin && yPos + codeHeightMM <= pdfHeight - margin) {
                pdf.addImage(imageDataUrl, 'PNG', xPos, yPos, codeWidthMM, codeHeightMM);
            } else {
                console.warn("Skipping image placement: Out of bounds");
            }
          }
        }
        
        pdf.save(`${downloadFileName}-tile.pdf`);

      } else if (isSvg) {
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${downloadFileName}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (imageDataUrl) {
        let mimeType = 'image/png';
        let fileExtension = 'png';
        if (imageFormat === 'jpg') {
          mimeType = 'image/jpeg';
          fileExtension = 'jpg';
        } else if (imageFormat === 'eps') {
          // Basic EPS handling (might need refinement)
          mimeType = 'application/postscript'; 
          fileExtension = 'eps';
        }
        const dataUrl = canvas.toDataURL(mimeType); // Re-encode if needed
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `${downloadFileName}.${fileExtension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

    } catch (err) {
      console.error("Error downloading code", err);
      alert("Failed to download code.");
    }
  };

  const downloadAll = async () => {
    const codes = generatedCodes.length > 0 ? generatedCodes : generateSequence();
    
    for (let i = 0; i < codes.length; i++) {
      await downloadCode(codes[i], i);
    }
  };

  const copyToClipboard = () => {
    const codes = generatedCodes.length > 0 ? generatedCodes : generateSequence();
    navigator.clipboard.writeText(codes.join('\n'))
      .then(() => alert('Codes copied to clipboard!'))
      .catch(err => console.error('Failed to copy: ', err));
  };

  const downloadSequence = () => {
    if (!barcodeCanvasRef.current || generatedCodes.length === 0) return;
    
    try {
      // For free users, check and track usage
      if (subscriptionTier === "free") {
        const feature = format === "qrcode" ? "qrCodesGenerated" : "barcodesGenerated";
        
        // Check if user has enough remaining usage
        if (!isWithinUsageLimit(feature, generatedCodes.length)) {
          alert(`You've reached your daily limit for ${format === "qrcode" ? "QR code" : "barcode"} generation.`);
          router.push('/pricing');
          return;
        }
        
        // If we can proceed, track the usage
        trackUsage(feature, generatedCodes.length);
        
        // Create a zip with low-resolution JPEGs
        alert("Free tier: Files will be downloaded as low-resolution JPEGs");
        
        // Simulate downloading a low-res sample
        const canvas = barcodeCanvasRef.current;
        const resizedCanvas = document.createElement("canvas");
        const scaleFactor = 0.5; // 50% of original size for low resolution
        resizedCanvas.width = canvas.width * scaleFactor;
        resizedCanvas.height = canvas.height * scaleFactor;
        const ctx = resizedCanvas.getContext("2d");
        ctx?.drawImage(canvas, 0, 0, resizedCanvas.width, resizedCanvas.height);
        
        // Force JPEG format with low quality for free users
        const dataUrl = resizedCanvas.toDataURL("image/jpeg", 0.7);
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `barcode-sequence-sample.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show upgrade message
        alert("Upgrade to Pro to download the full sequence in high resolution!");
      } else {
        // Paid users get full sequence in high quality
        const canvas = barcodeCanvasRef.current;
        
        // Check permissions for the selected format
        if ((imageFormat === "svg" && !canUseFeature("svgDownload")) ||
            ((imageFormat === "pdf" || imageFormat === "pdf-tile") && !canUseFeature("pdfDownload")) ||
            (imageFormat === "eps" && !canUseFeature("svgDownload")) ||
            (imageFormat === "png" && !canUseFeature("noWatermark"))) {
          // User doesn't have permission for this format
          alert(`You need a Pro or Business subscription to download in ${imageFormat.toUpperCase()} format.`);
          router.push('/pricing');
          return;
        }
        
        // Handle different formats
        if (imageFormat === "svg") {
          alert("SVG sequence export would be available here for Pro/Business users");
        } else if (imageFormat === "pdf" || imageFormat === "pdf-tile") {
          alert(`PDF ${imageFormat === "pdf-tile" ? "Tile " : ""}export would be available here for Pro/Business users`);
        } else if (imageFormat === "eps") {
          alert("EPS sequence export would be available here for Pro/Business users");
        } else {
          // High quality PNG or JPEG download
          const mimeType = imageFormat === "jpg" ? "image/jpeg" : "image/png";
          const quality = imageFormat === "jpg" ? 1.0 : undefined;
          const dataUrl = canvas.toDataURL(mimeType, quality);
          
          // In a real implementation, we would create a zip file with all barcodes
          // For this demo, we'll just download the current preview
          const link = document.createElement("a");
          link.href = dataUrl;
          link.download = `barcode-sequence-${previewCode}.${imageFormat}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          alert(`In a complete implementation, this would download a ZIP file containing all ${generatedCodes.length} barcodes in high quality ${imageFormat.toUpperCase()} format.`);
        }
      }
    } catch (error) {
      console.error("Error downloading sequence:", error);
      alert("Failed to download sequence. Please try again.");
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left column - Controls */}
      <div className="flex-1">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Generate Barcode Sequence</h2>
          
          {/* Form Container */}
          <div className="space-y-6">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="code-format">
                Code Format
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio"
                    name="code-format"
                    value="barcode"
                    checked={format === "barcode"}
                    onChange={() => setFormat("barcode")}
                  />
                  <span className="ml-2">Barcode</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio"
                    name="code-format"
                    value="qrcode"
                    checked={format === "qrcode"}
                    onChange={() => setFormat("qrcode")}
                  />
                  <span className="ml-2">QR Code</span>
                </label>
              </div>
            </div>

            {format === "barcode" && (
              <div className="mb-4">
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
              </div>
            )}

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="prefix">
                Prefix (Optional)
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                id="prefix"
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g., PROD-"
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="suffix">
                Suffix (Optional)
              </label>
              <input
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                id="suffix"
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                placeholder="e.g., -V1"
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="start-number">
                  Start Number
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  id="start-number"
                  type="number"
                  min="0"
                  value={startNumber}
                  onChange={(e) => setStartNumber(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="increment">
                  Increment By
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  id="increment"
                  type="number"
                  min="1"
                  value={increment}
                  onChange={(e) => setIncrement(Number(e.target.value))}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="padding">
                  Number Padding
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  id="padding"
                  type="number"
                  min="0"
                  max="10"
                  value={padding}
                  onChange={(e) => setPadding(Number(e.target.value))}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Number of digits (filled with leading zeros)
                </p>
              </div>
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="count">
                  Number of Codes
                </label>
                <input
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  id="count"
                  type="number"
                  min="1"
                  max="1000"
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                />
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="image-format">
                Download Format
              </label>
              <div className="bg-zinc-50 p-4 rounded-lg border border-zinc-200 mb-4">
                <div className="flex flex-wrap gap-3">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio"
                      name="image-format"
                      value="jpg"
                      checked={imageFormat === "jpg"}
                      onChange={(e) => setImageFormat(e.target.value as ImageFormat)}
                    />
                    <span className="ml-2">JPEG</span>
                    {subscriptionTier === "free" && (
                      <span className="ml-1 text-xs text-gray-600">(Low Resolution)</span>
                    )}
                  </label>
                  
                  <label className={`inline-flex items-center ${!canUseFeature("noWatermark") ? "opacity-50" : ""}`}>
                    <input
                      type="radio"
                      className="form-radio"
                      name="image-format"
                      value="png"
                      checked={imageFormat === "png"}
                      onChange={(e) => canUseFeature("noWatermark") ? setImageFormat(e.target.value as ImageFormat) : router.push('/pricing')}
                      disabled={!canUseFeature("noWatermark")}
                    />
                    <span className="ml-2">PNG</span>
                    {!canUseFeature("noWatermark") && (
                      <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                    )}
                  </label>
                  
                  <label className={`inline-flex items-center ${!canUseFeature("svgDownload") ? "opacity-50" : ""}`}>
                    <input
                      type="radio"
                      className="form-radio"
                      name="image-format"
                      value="svg"
                      checked={imageFormat === "svg"}
                      onChange={(e) => canUseFeature("svgDownload") ? setImageFormat(e.target.value as ImageFormat) : router.push('/pricing')}
                      disabled={!canUseFeature("svgDownload")}
                    />
                    <span className="ml-2">SVG</span>
                    {!canUseFeature("svgDownload") && (
                      <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                    )}
                  </label>
                  
                  <label className={`inline-flex items-center ${!canUseFeature('pdfDownload') ? "opacity-50" : ""}`}>
                    <input
                      type="radio"
                      className="form-radio text-blue-600"
                      name="image-format"
                      value="pdf"
                      checked={imageFormat === "pdf"}
                      onChange={(e) => canUseFeature('pdfDownload') ? setImageFormat(e.target.value as ImageFormat) : router.push('/pricing')}
                      disabled={!canUseFeature('pdfDownload')}
                    />
                    <span className="ml-2">PDF</span>
                    {!canUseFeature('pdfDownload') && (
                      <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                    )}
                  </label>
                  
                  <label className={`inline-flex items-center ${!canUseFeature('pdfDownload') ? "opacity-50" : ""}`}>
                    <input
                      type="radio"
                      className="form-radio text-blue-600"
                      name="image-format"
                      value="pdf-tile"
                      checked={imageFormat === "pdf-tile"}
                      onChange={(e) => canUseFeature('pdfDownload') ? setImageFormat(e.target.value as ImageFormat) : router.push('/pricing')}
                      disabled={!canUseFeature('pdfDownload')}
                    />
                    <span className="ml-2">PDF Tile</span>
                    {!canUseFeature('pdfDownload') && (
                      <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                    )}
                  </label>
                  
                  <label className={`inline-flex items-center ${!canUseFeature("svgDownload") ? "opacity-50" : ""}`}>
                    <input
                      type="radio"
                      className="form-radio"
                      name="image-format"
                      value="eps"
                      checked={imageFormat === "eps"}
                      onChange={(e) => canUseFeature("svgDownload") ? setImageFormat(e.target.value as ImageFormat) : router.push('/pricing')}
                      disabled={!canUseFeature("svgDownload")}
                    />
                    <span className="ml-2">EPS</span>
                    {!canUseFeature("svgDownload") && (
                      <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                    )}
                  </label>
                </div>
              </div>
            </div>

            {/* Tiling Options (Conditional) */}
            {imageFormat === 'pdf-tile' && (
              <div className="space-y-4 p-4 border border-zinc-300 rounded-lg bg-zinc-100">
                <h4 className="text-md font-semibold text-gray-800">PDF Tile Layout</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="tile-cols">Columns</label>
                    <input id="tile-cols" type="number" min="1" value={tileColumns} onChange={e => setTileColumns(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="tile-rows">Rows</label>
                    <input id="tile-rows" type="number" min="1" value={tileRows} onChange={e => setTileRows(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="tile-spacing">Spacing</label>
                    <input id="tile-spacing" type="number" min="0" value={tileSpacing} onChange={e => setTileSpacing(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-1" htmlFor="tile-spacing-unit">Unit</label>
                    <select id="tile-spacing-unit" value={tileSpacingUnit} onChange={e => setTileSpacingUnit(e.target.value as 'mm' | 'cm')} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary">
                      <option value="mm">mm</option>
                      <option value="cm">cm</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <button
                className="bg-primary hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                onClick={generateSequence}
                disabled={isTracking || (format === "qrcode" ? 
                  getRemainingUsage('qrCodesGenerated') < count : 
                  getRemainingUsage('barcodesGenerated') < count)}
              >
                {isTracking ? 'Generating...' : `Generate ${count} ${format === "qrcode" ? "QR Codes" : "Barcodes"}`}
              </button>
              <div className="relative">
                <button
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex items-center"
                  onClick={downloadSequence}
                  disabled={generatedCodes.length === 0 && count === 0}
                >
                  <span>Download All</span>
                  <span className="ml-1">(.{imageFormat.toUpperCase()})</span>
                </button>
              </div>
            </div>
            
            {/* Remaining daily count for free users */}
            {subscriptionTier === "free" && (
              <div className="mt-4 text-xs text-amber-600 bg-amber-50 p-2 rounded-md text-center">
                {getRemainingUsage(format === "qrcode" ? 'qrCodesGenerated' : 'barcodesGenerated') <= 5 ? (
                  <>
                    You have {getRemainingUsage(format === "qrcode" ? 'qrCodesGenerated' : 'barcodesGenerated')} downloads remaining today.  
                    <Link 
                      href='/pricing' 
                      className="ml-1 underline"
                    >
                      Upgrade for unlimited.
                    </Link>
                  </>
                ) : (
                  <>Free tier: Limited to low-resolution JPEG</>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Right column - Preview */}
      <div className="flex-1">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Preview</h2>
            <div className="text-sm text-gray-600">
              {generatedCodes.length > 0 ? `${previewCode}` : "No sequence generated"}
            </div>
          </div>
          
          <div className="mb-4 flex justify-center items-center bg-gray-50 rounded-lg p-4 min-h-[200px]">
            {generatedCodes.length > 0 ? (
              <div className="inline-block">
                {format === "qrcode" ? (
                  <div className="p-4 bg-white rounded-md shadow-sm" ref={qrCodeRef}>
                    <QRCode
                      value={previewCode}
                      size={180}
                      level="M"
                    />
                    <div className="mt-2 text-center font-medium">{previewCode}</div>
                  </div>
                ) : (
                  <div className="p-4 bg-white rounded-md shadow-sm">
                    <canvas ref={barcodeCanvasRef} />
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-400 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto mb-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5Z" />
                </svg>
                <p>Fill the form to see your code</p>
              </div>
            )}
          </div>
          
          {generatedCodes.length > 0 && (
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setPreviewCode(generatedCodes[Math.max(0, generatedCodes.indexOf(previewCode) - 1)])}
                disabled={generatedCodes.length <= 1}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPreviewCode(generatedCodes[Math.min(generatedCodes.length - 1, generatedCodes.indexOf(previewCode) + 1)])}
                disabled={generatedCodes.length <= 1}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
          
          {/* Premium features banner */}
          {subscriptionTier === "free" && (
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800">Premium Features</h3>
              <ul className="mt-2 ml-5 list-disc text-sm text-blue-600">
                <li>Download full sequence in high resolution</li>
                <li>Export as PNG, SVG, and PDF</li>
                <li>Customize with more barcode types</li>
                <li>Generate up to 1000 barcodes at once</li>
              </ul>
              <Link
                href='/pricing'
                className="mt-3 px-4 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Upgrade Now
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 