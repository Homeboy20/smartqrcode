"use client";

import React, { useState, useEffect, useCallback } from "react";
import * as qrcode from "qrcode";
import JsBarcode from "jsbarcode";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import jsPDF from 'jspdf';
import { useSubscription } from "@/hooks/useSubscription";
import { useTrackUsage } from "@/hooks/useTrackUsage";
import { useSupabaseAuth } from '@/context/SupabaseAuthContext';
import { useRouter } from "next/navigation";

export default function BulkSequenceGenerator() {
  const router = useRouter();
  const subscriptionData = useSubscription();
  const subscriptionTier = subscriptionData?.subscriptionTier || 'free';
  
  const { user, getAccessToken } = useSupabaseAuth();
  const isVisitor = !user;
  
  // Use tracking hook
  const {
    trackUsage,
    canUseFeature,
    getRemainingUsage,
    isWithinUsageLimit
  } = useTrackUsage();

  // Define remainingDaily - safely get remaining usage
  const remainingDaily = getRemainingUsage ? getRemainingUsage('bulkGenerations') : 0;

  const [prefix, setPrefix] = useState<string>("");
  const [suffix, setSuffix] = useState<string>("");
  const [startNumber, setStartNumber] = useState<number>(1);
  const [increment, setIncrement] = useState<number>(1);
  const [padding, setPadding] = useState<number>(4);
  const [count, setCount] = useState<number>(50);
  const [format, setFormat] = useState<"qrcode" | "barcode">("barcode");
  const [barcodeType, setBarcodeType] = useState<string>("CODE128");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [outputType, setOutputType] = useState<'zip' | 'pdf' | 'pdf-tile'>('zip');

  const [useDynamicLink, setUseDynamicLink] = useState(false);
  const [encryptDestination, setEncryptDestination] = useState(false);

  // Tiling State (for PDF Tile download)
  const [tileColumns, /* setTileColumns */] = useState<number>(4);
  const [tileRows, /* setTileRows */] = useState<number>(10);
  const [tileSpacing, /* setTileSpacing */] = useState<number>(5);
  const [tileSpacingUnit, /* setTileSpacingUnit */] = useState<'mm' | 'cm'>('mm');
  const [addOutline, /* setAddOutline */] = useState<boolean>(false);

  // Add a state variable for barcode height
  const [barcodeHeight, setBarcodeHeight] = useState<number>(4);

  // Add a state variable for barcode height unit
  const [barcodeHeightUnit, setBarcodeHeightUnit] = useState<'px' | 'cm' | 'mm'>('cm');

  // Add state for generated codes
  const [codes, setCodes] = useState<string[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState('');
  
  // Add codesInput state variable
  const [codesInput, /* setCodesInput */] = useState<boolean>(true);

  // Add missing state variables for download options
  const [downloadFormat, setDownloadFormat] = useState<string>("zip-jpg");

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

  const isValidHttpUrl = (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const createDynamicUrl = async (destination: string, name: string) => {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Please log in again.');
    }

    const res = await fetch('/api/codes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: format,
        destination,
        encrypt: encryptDestination,
        name,
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((json as any)?.error || 'Failed to create dynamic code');
    }

    const dynamicUrl = (json as any)?.url;
    if (!dynamicUrl) {
      throw new Error('Failed to create dynamic code');
    }

    return String(dynamicUrl);
  };

  // Conversion Factors
  const PX_PER_CM = 37.7953;
  const PX_PER_MM = 3.77953;

  // Generalized unit conversion function
  const convertUnits = (value: number, fromUnit: string, toUnit: string): number => {
    if (fromUnit === toUnit) return value;

    let valueInPx: number;

    // Convert input value to pixels first
    switch (fromUnit) {
      case 'cm': valueInPx = value * PX_PER_CM; break;
      case 'mm': valueInPx = value * PX_PER_MM; break;
      case 'px': 
      default:   valueInPx = value; break;
    }

    // Convert from pixels to the target unit
    let convertedValue: number;
    switch (toUnit) {
      case 'cm': convertedValue = valueInPx / PX_PER_CM; break;
      case 'mm': convertedValue = valueInPx / PX_PER_MM; break;
      case 'px': 
      default:   convertedValue = valueInPx; break;
    }
    
    // Round to reasonable precision (e.g., 1 decimal for cm/mm, 0 for px)
    return Number(convertedValue.toFixed(toUnit === 'px' ? 0 : 1));
  };

  // Handler for unit change - converts the current height value
  const handleUnitChange = (newUnit: 'px' | 'cm' | 'mm') => {
    const currentHeight = barcodeHeight; // Get value from state
    const currentUnit = barcodeHeightUnit; // Get unit from state
    
    const newHeightValue = convertUnits(currentHeight, currentUnit, newUnit);
    
    setBarcodeHeight(newHeightValue);
    setBarcodeHeightUnit(newUnit);
  };

  // Wrap generateSequence in useCallback to stabilize its reference
  const generateSequence = useCallback(() => {
    const sequences = [];
    let currentNumber = startNumber;
    
    for (let i = 0; i < count; i++) {
      const paddedNumber = String(currentNumber).padStart(padding, '0');
      const code = `${prefix}${paddedNumber}${suffix}`;
      sequences.push(code);
      currentNumber += increment;
    }
    
    return sequences;
  }, [prefix, suffix, startNumber, padding, count, increment]); // Add dependencies

  const generateBulkCodes = async () => {
    // First check if the user can perform a bulk generation
    if (!isWithinUsageLimit("bulkGenerations", 1)) {
      setLockedFeatureName('Bulk Generation Limit');
      setShowLoginModal(true);
      router.push('/pricing');
      return;
    }
    
    setIsGenerating(true);
    setProgress(0);
    
    try {
      // Track usage for bulk generation
      await trackUsage('bulkGenerations');
      
      let codes = generateSequence();

      if (useDynamicLink) {
        if (!user) {
          setLockedFeatureName(format === 'qrcode' ? 'Dynamic QR Codes' : 'Dynamic Barcodes');
          setShowLoginModal(true);
          return;
        }

        const hasDynamicAccess =
          format === 'qrcode' ? canUseFeature('qrCodeTracking') : canUseFeature('enhancedBarcodes');
        if (!hasDynamicAccess) {
          setLockedFeatureName(
            format === 'qrcode' ? 'Dynamic QR Codes (Pro+)' : 'Dynamic Barcodes (Pro+)'
          );
          setShowLoginModal(true);
          router.push('/pricing');
          return;
        }

        const invalid = codes.find((c) => !isValidHttpUrl(c));
        if (invalid) {
          alert('Dynamic codes only support http(s) URLs.');
          return;
        }

        const created: string[] = [];
        for (let i = 0; i < codes.length; i++) {
          const dynamicUrl = await createDynamicUrl(
            codes[i],
            `Dynamic ${format === 'qrcode' ? 'QR' : 'Barcode'} (Bulk ${i + 1})`
          );
          created.push(dynamicUrl);

          const totalProgress = ((i + 1) / codes.length) * 100;
          setProgress(Math.round(totalProgress));
        }
        codes = created;
      }

      setCodes(codes);
      
      if (outputType === 'zip') {
        // --- ZIP Generation Logic --- 
        const zip = new JSZip();
        const folder = format === "qrcode" ? zip.folder("qrcodes") : zip.folder("barcodes");
        
        if (!folder) {
          throw new Error("Could not create folder in ZIP");
        }
        
        folder.file("all_codes.txt", codes.join("\n"));
        
        const batchSize = 10;
        const batches = Math.ceil(codes.length / batchSize);
        
        for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
          const batchStart = batchIndex * batchSize;
          const batchEnd = Math.min((batchIndex + 1) * batchSize, codes.length);
          const batch = codes.slice(batchStart, batchEnd);
          
          for (let i = 0; i < batch.length; i++) {
            const code = batch[i];
            const index = batchStart + i;
            const canvas = document.createElement("canvas");
            if (format === "qrcode") {
              await qrcode.toCanvas(canvas, code, { width: 256, margin: 1 });
            } else {
              // Use convertUnits to get pixel height for JsBarcode
              JsBarcode(canvas, code, { format: barcodeType, width: 2, height: convertUnits(barcodeHeight, barcodeHeightUnit, 'px'), displayValue: true, lineColor: "#000000", background: "#FFFFFF" });
            }
            const dataUrl = canvas.toDataURL("image/png").split(',')[1];
            
            const fileName = `${format === "qrcode" ? "qrcode" : "barcode"}-${index + 1}.png`;
            folder.file(fileName, dataUrl, { base64: true });
            
            const totalProgress = ((index + 1) / codes.length) * 100;
            setProgress(Math.round(totalProgress));
          }
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${format === "qrcode" ? "qrcodes" : "barcodes"}-bulk.zip`);

      } else if (outputType === 'pdf') {
        // --- PDF Generation Logic (Single code per page - maybe adapt later?) --- 
        const pdfWidth = 210;
        const pdfHeight = 297;
        const pdfFormat: string | number[] = 'a4'; // Local variable for jsPDF format
        
        const pdf = new jsPDF({
          orientation: 'p',
          unit: 'mm',
          format: pdfFormat // Use the determined format
        });
        
        const codesPerPage = 4 * 10;
        const totalPages = Math.ceil(codes.length / codesPerPage);

        const usableWidth = pdfWidth - 20;
        const usableHeight = pdfHeight - 20;

        const cellWidth = (usableWidth - (4 - 1) * 5) / 4;
        const cellHeight = (usableHeight - (10 - 1) * 5) / 10;
        
        // Determine image dimensions (adjust as needed)
        const imageWidthMM = Math.min(cellWidth, 50); // Example max width
        const imageHeightMM = Math.min(cellHeight, 50); // Example max height

        let codeIndex = 0;
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            pdf.addPage();
          }
          
          for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 4; c++) {
              if (codeIndex >= codes.length) break;
              
              const code = codes[codeIndex];
              
              const xPos = 10 + c * (cellWidth + 5);
              const yPos = 10 + r * (cellHeight + 5);
              
              const canvas = document.createElement("canvas");
              try {
                if (format === "qrcode") {
                  await qrcode.toCanvas(canvas, code, { width: 256, margin: 1 });
                } else {
                  // Use convertUnits to get pixel height for JsBarcode
                  JsBarcode(canvas, code, { format: barcodeType, width: 2, height: convertUnits(barcodeHeight, barcodeHeightUnit, 'px'), displayValue: true, lineColor: "#000000", background: "#FFFFFF" });
                }
                const dataUrl = canvas.toDataURL("image/png");
                
                // Add image to PDF - center it within the cell
                const imgX = xPos + (cellWidth - imageWidthMM) / 2;
                const imgY = yPos + (cellHeight - imageHeightMM) / 2;
                pdf.addImage(dataUrl, 'PNG', imgX, imgY, imageWidthMM, imageHeightMM);

                // Optional: Add the code text below the image
                // pdf.setFontSize(8);
                // pdf.text(code, imgX + imageWidthMM / 2, imgY + imageHeightMM + 2, { align: 'center' });

              } catch (imgErr) {
                console.error(`Failed to generate image for code: ${code}`, imgErr);
                // Optionally add placeholder text to PDF
                pdf.setFontSize(8);
                pdf.text(`Error for: ${code}`, xPos, yPos + 5);
              }
              
              codeIndex++;
              
              const totalProgress = (codeIndex / codes.length) * 100;
              setProgress(Math.round(totalProgress));
            }
            if (codeIndex >= codes.length) break;
          }
          // Allow UI update between pages
          await new Promise(resolve => setTimeout(resolve, 0)); 
        }
        
        pdf.save(`${format === "qrcode" ? "qrcodes" : "barcodes"}-layout.pdf`);
      } else { // outputType === 'pdf-tile'
        // --- PDF Tiling Logic --- 
        const margin = 10; // mm - Page margin
        const spacingVal = tileSpacingUnit === 'cm' ? tileSpacing * 10 : tileSpacing; // mm - Space between codes
        const outlineWidth = 0.05; // mm - Thinner border
        const codePadding = 1.5; // mm - Padding inside the border around the code+text
        const initialCodeFontSize = 5; // pt - Starting font size for text
        const minCodeFontSize = 2; // pt - Minimum font size
        const textImageSpacing = 0.5; // mm - Space between image bottom and text top
        const textSideMarginMM = 0.5; // mm - Small margin so text doesn't touch image edges
        const PT_TO_MM = 0.352778; // Conversion factor

        // --- Fixed Tile Width & Calculate Image Area --- 
        const tileWidthMM = 40; 
        const imageMaxWidthMM = tileWidthMM - (codePadding * 2);
        const textMaxWidthMM = imageMaxWidthMM - (textSideMarginMM * 2);
        
        // --- Calculate Code Aspect Ratio & Image Height --- 
        let imageAspectRatio = 1.0; // Default for QR code
        if (format === 'barcode') {
          try { // Quick ratio check for display
            const sampleCanvas = document.createElement('canvas');
            JsBarcode(sampleCanvas, '1234', { format: barcodeType, width: 2, height: 100, displayValue: false }); 
            if (sampleCanvas.width > 0) imageAspectRatio = sampleCanvas.height / sampleCanvas.width;
          } catch {} /* Ignore error for display */
        }
        const imageMaxHeightMM = imageMaxWidthMM * imageAspectRatio; // Height constrained by width and ratio

        // --- Fit Text Font Size --- 
        const longestCode = codes.reduce((a, b) => a.length > b.length ? a : b, "");
        let currentFontSize = initialCodeFontSize;
        const tempPdf = new jsPDF(); // Temporary instance for text measurement
        tempPdf.setFontSize(currentFontSize);
        let textWidthMM = tempPdf.getTextWidth(longestCode) * PT_TO_MM;

        while (textWidthMM > textMaxWidthMM && currentFontSize > minCodeFontSize) {
          currentFontSize -= 0.5; // Decrease font size
          tempPdf.setFontSize(currentFontSize);
          textWidthMM = tempPdf.getTextWidth(longestCode) * PT_TO_MM;
        }
        const finalCodeFontSize = Math.max(minCodeFontSize, currentFontSize); // Ensure minimum
        const finalFontHeightMM = finalCodeFontSize * PT_TO_MM * 1.2; // Approximate height based on font size (factor might need tweaking)
        
        // --- Calculate Final Tile Height --- 
        const tileHeightMM = imageMaxHeightMM + textImageSpacing + finalFontHeightMM + (codePadding * 2);
        // --- End Dimension Calculations --- 

        // Calculate exact grid dimensions based on FINAL tile size and spacing
        const gridWidthMM = (tileColumns * tileWidthMM) + (Math.max(0, tileColumns - 1) * spacingVal);
        const gridHeightMM = (tileRows * tileHeightMM) + (Math.max(0, tileRows - 1) * spacingVal);
        
        // Calculate PDF page size needed for one grid + margins
        const pdfPageWidth = gridWidthMM + margin * 2;
        const pdfPageHeight = gridHeightMM + margin * 2;

        console.log(`PDF Tiling: Tile ${tileWidthMM}x${tileHeightMM.toFixed(1)}mm, Img ${imageMaxWidthMM.toFixed(1)}x${imageMaxHeightMM.toFixed(1)}mm (Ratio: ${imageAspectRatio.toFixed(2)}), Font ${finalCodeFontSize.toFixed(1)}pt, Page ${pdfPageWidth.toFixed(1)}x${pdfPageHeight.toFixed(1)}mm`);
        
        const pdf = new jsPDF({ 
          orientation: 'p', 
          unit: 'mm', 
          format: [pdfPageWidth, pdfPageHeight] 
        }); 
        pdf.setFont('helvetica', 'normal'); // Set a standard font
        
        const codesPerPage = tileColumns * tileRows;
        const totalPages = Math.ceil(codes.length / codesPerPage);
        
        let codeIndex = 0;
        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            pdf.addPage([pdfPageWidth, pdfPageHeight], 'p'); 
            pdf.setFont('helvetica', 'normal'); // Re-apply font settings on new page
          }
          
          for (let r = 0; r < tileRows; r++) {
            for (let c = 0; c < tileColumns; c++) {
              if (codeIndex >= codes.length) break;
              
              const code = codes[codeIndex];
              
              // Calculate top-left corner for the entire tile
              const tileXPos = margin + c * (tileWidthMM + spacingVal);
              const tileYPos = margin + r * (tileHeightMM + spacingVal);
              
              // Calculate position for the image placement inside the padding
              const imageXPos = tileXPos + codePadding;
              const imageYPos = tileYPos + codePadding;
              
              // Use calculated dimensions for placing image 
              const finalImageWidthMM = imageMaxWidthMM;
              const finalImageHeightMM = imageMaxHeightMM;
              
              // Calculate position for the text
              const textXPos = tileXPos + tileWidthMM / 2; // Center text horizontally within the tile
              const textYPos = imageYPos + finalImageHeightMM + textImageSpacing + (finalFontHeightMM * 0.8); // Position baseline correctly
              
              const canvas = document.createElement("canvas");
              try {
                // Generate image data
                let dataUrl: string;
                if (format === "qrcode") {
                  const qrCanvasSize = 256; // Generate at a reasonable fixed size
                  await qrcode.toCanvas(canvas, code, { width: qrCanvasSize, margin: 1 });
                  dataUrl = canvas.toDataURL("image/png");
                  // Add QR code image, scaling it
                  pdf.addImage(dataUrl, 'PNG', imageXPos, imageYPos, finalImageWidthMM, finalImageHeightMM); 
                } else {
                  // Generate barcode with enough pixels for quality, height based on aspect ratio
                  const barcodeCanvasWidthPx = 500; // Generate wider for better quality before scaling
                  const barcodeCanvasHeightPx = barcodeCanvasWidthPx * imageAspectRatio; 
                  JsBarcode(canvas, code, { 
                    format: barcodeType, 
                    width: 2, 
                    height: barcodeCanvasHeightPx, 
                    displayValue: false,
                    margin: 5, // Add some margin in generation for safety
                    lineColor: "#000000", 
                    background: "#FFFFFF" 
                  });
                  dataUrl = canvas.toDataURL("image/png");
                  // Add barcode image, scaling it into the calculated image box
                  pdf.addImage(dataUrl, 'PNG', imageXPos, imageYPos, finalImageWidthMM, finalImageHeightMM);
                }
                
                // Add the code text below the image, centered, using calculated font size
                pdf.setFontSize(finalCodeFontSize);
                pdf.text(code, textXPos, textYPos, { align: 'center', maxWidth: textMaxWidthMM });
                
                // Add outline border around the entire tile if requested
                if (addOutline) {
                   pdf.setLineWidth(outlineWidth);
                   pdf.rect(tileXPos, tileYPos, tileWidthMM, tileHeightMM); 
                }

              } catch (imgErr) {
                 // Handle image generation error (draw border and text)
                 console.error(`Failed to generate image for code: ${code}`, imgErr);
                 pdf.setFontSize(6);
                 // Place error text roughly where code text would be
                 pdf.text(`Error: ${code}`, tileXPos + tileWidthMM / 2, textYPos, { align: 'center'}); 
                 if (addOutline) {
                   pdf.setLineWidth(outlineWidth);
                   pdf.rect(tileXPos, tileYPos, tileWidthMM, tileHeightMM);
                 }
              }
              
              codeIndex++;
              
              const totalProgress = (codeIndex / codes.length) * 100;
              setProgress(Math.round(totalProgress));
            }
            if (codeIndex >= codes.length) break;
          }
          await new Promise(resolve => setTimeout(resolve, 0)); 
        }
        
        pdf.save(`${format === "qrcode" ? "qrcodes" : "barcodes"}-tile-layout.pdf`);
      }

    } catch (error) {
      console.error("Error generating bulk codes:", error);
      alert("An error occurred while generating codes. Please check your input or layout settings.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Effect to regenerate preview images when settings change
  useEffect(() => {
    const generatePreviewImages = async () => {
      const numPreviewCodes = Math.min(count, tileColumns * tileRows);
      if (numPreviewCodes <= 0) {
        return;
      }

      const codesToPreview = generateSequence().slice(0, numPreviewCodes);
      const imageDataUrls: (string | null)[] = [];

      for (const code of codesToPreview) {
        const canvas = document.createElement("canvas");
        try {
          if (format === "qrcode") {
            // Use a smaller fixed size for QR preview for performance
            await qrcode.toCanvas(canvas, code, { width: 64, margin: 1 });
          } else {
            // Use smaller fixed dimensions for barcode preview
            JsBarcode(canvas, code, { 
              format: barcodeType, 
              width: 1, // Smaller width for preview
              height: 30, // Smaller fixed height for preview
              displayValue: false, // Don't show text in preview image
              margin: 2
            });
          }
          imageDataUrls.push(canvas.toDataURL("image/png"));
        } catch (error) {
          console.error("Error generating preview code:", error);
          imageDataUrls.push(null); // Indicate error for this code
        }
      }
    };

    // Only run if pdf-tile output is selected
    if (outputType === 'pdf-tile') {
      generatePreviewImages();
    }

  }, [ prefix, suffix, startNumber, increment, padding, count, format, barcodeType, tileColumns, tileRows, outputType, generateSequence /* Add generateSequence dependency */ ]);

  // Effect to calculate and display estimated grid size for tiling
  useEffect(() => {
    if (outputType === 'pdf-tile') {
      const spacingVal = tileSpacingUnit === 'cm' ? tileSpacing * 10 : tileSpacing;
      // Use fixed tile width for grid calculation
      const fixedTileWidthMM = 40;
      const width = (tileColumns * fixedTileWidthMM) + (Math.max(0, tileColumns - 1) * spacingVal);
      
      // Recalculate tile height here for display based on current settings
      const codePadding = 1.5; 
      const textHeightApproximation = 1.5; // Use approximation for display
      const textImageSpacing = 0.5;
      const imageMaxWidthMM = fixedTileWidthMM - (codePadding * 2);
      let imageAspectRatio = 1.0;
      if (format === 'barcode') { 
         try { // Quick ratio check for display
            const sampleCanvas = document.createElement('canvas');
            JsBarcode(sampleCanvas, '1234', { format: barcodeType, width: 2, height: 100, displayValue: false }); 
            if (sampleCanvas.width > 0) imageAspectRatio = sampleCanvas.height / sampleCanvas.width;
          } catch {} /* Ignore error for display */
      }
      const imageMaxHeightMM = imageMaxWidthMM * imageAspectRatio;
      const calculatedTileHeightMM = imageMaxHeightMM + textImageSpacing + textHeightApproximation + (codePadding * 2); 
      
      const height = (tileRows * calculatedTileHeightMM) + (Math.max(0, tileRows - 1) * spacingVal);
      
    } else {
    }
    // Dependencies for grid display calculation
  }, [outputType, tileColumns, tileRows, tileSpacing, tileSpacingUnit, format, barcodeType]); 

  // Effect to calculate preview container dimensions - NOT needed for pdf-tile anymore
  // useEffect(() => { ... }, [paperSize, orientation, customWidth, customHeight]); 
  // We can use a fixed reasonable size for the preview container in pdf-tile mode

  const handleDownload = async () => {
    if (codes.length === 0) return;
    
    setIsGenerating(true);
    try {
      // For free users, check and track usage
      if (subscriptionTier === "free") {
        const feature = format === "qrcode" ? "qrCodesGenerated" : "barcodesGenerated";
        
        // Check if user has enough remaining usage
        if (!isWithinUsageLimit(feature, codes.length)) {
          setLockedFeatureName(`${format === "qrcode" ? "QR Code" : "Barcode"} Generation Limit`);
          setShowLoginModal(true);
          setIsGenerating(false);
          return;
        }
        
        // If we can proceed, track the usage
        trackUsage(feature, codes.length);
        alert("Free tier: Files will be downloaded as low-resolution JPEGs");
        
        // Force JPEG format in low resolution for free users
        setDownloadFormat("zip-jpg");
        
        // Create a zip with low-resolution JPEGs
        const zip = new JSZip();
        const totalCodes = Math.min(10, codes.length); // Limit to 10 codes for free users
        
        for (let i = 0; i < totalCodes; i++) {
          setProgress(Math.floor((i / totalCodes) * 100));
          const code = codes[i];
          
          // Generate low resolution image
          const canvas = document.createElement("canvas");
          canvas.width = 300; // Lower resolution
          canvas.height = 150;
          
          if (format === "qrcode") {
            await qrcode.toCanvas(canvas, code, {
              width: 150,
              margin: 1,
            });
          } else {
            JsBarcode(canvas, code, {
              format: barcodeType,
              width: 1.5,
              height: 50,
              displayValue: true,
              background: "#FFFFFF",
              lineColor: "#000000"
            });
          }
          
          // Convert to low quality JPEG
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          const imageData = dataUrl.split(",")[1];
          
          zip.file(`code-${i+1}.jpg`, imageData, { base64: true });
        }
        
        const content = await zip.generateAsync({ type: "blob" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = "bulk-codes-sample.zip";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show upgrade message
        alert(`Free tier: Limited to ${totalCodes} low-resolution JPEG files. Upgrade to Pro for full access!`);
      } else {
        // Paid users get full functionality
        // Check permissions for the selected output type first
        if ((outputType === 'pdf' || outputType === 'pdf-tile') && !canUseFeature("pdfDownload")) {
          setLockedFeatureName('PDF Export');
          setShowLoginModal(true);
          return;
        }
        
        if (downloadFormat === "zip-svg" && !canUseFeature("svgDownload")) {
          setLockedFeatureName('SVG Export');
          setShowLoginModal(true);
          return;
        }
        
        if (downloadFormat === "zip-png" && !canUseFeature("noWatermark")) {
          setLockedFeatureName('High-Quality PNG Export');
          setShowLoginModal(true);
          return;
          return;
        }
        
        if (downloadFormat === "pdf") {
          // Generate PDF
          const pdf = new jsPDF({
            orientation: 'portrait',
            unit: "mm"
          });
          
          // ... existing PDF generation code ...
          
        } else {
          // ZIP file generation (high quality)
          const zip = new JSZip();
          
          for (let i = 0; i < codes.length; i++) {
            setProgress(Math.floor((i / codes.length) * 100));
            const code = codes[i];
            
            const canvas = document.createElement("canvas");
            canvas.width = 800; // Higher resolution for paid users
            canvas.height = 400;
            
            if (format === "qrcode") {
              await qrcode.toCanvas(canvas, code, {
                width: 400,
                margin: 2,
              });
            } else {
              JsBarcode(canvas, code, {
                format: barcodeType,
                width: 2,
                height: 100,
                displayValue: true,
                background: "#FFFFFF",
                lineColor: "#000000"
              });
            }
            
            let imageType, quality, extension;
            
            if (downloadFormat === "zip-svg") {
              // SVG generation code
              if (format === "qrcode") {
                const svgString = await qrcode.toString(code, {
                  type: "svg",
                  width: 400,
                  margin: 2,
                });
                zip.file(`code-${i+1}.svg`, svgString);
              } else {
                // For barcodes, we'd need to capture SVG differently
                const svgContainer = document.createElement("div");
                JsBarcode(svgContainer, code, {
                  format: barcodeType,
                  width: 2,
                  height: 100,
                  displayValue: true,
                  background: "#FFFFFF",
                  lineColor: "#000000",
                });
                const svgString = svgContainer.innerHTML;
                zip.file(`code-${i+1}.svg`, svgString);
              }
            } else if (downloadFormat === "zip-png") {
              imageType = "image/png";
              extension = "png";
              const dataUrl = canvas.toDataURL(imageType);
              const imageData = dataUrl.split(",")[1];
              zip.file(`code-${i+1}.${extension}`, imageData, { base64: true });
            } else {
              // JPEG format with high quality for paid users
              imageType = "image/jpeg";
              quality = 1.0;
              extension = "jpg";
              const dataUrl = canvas.toDataURL(imageType, quality);
              const imageData = dataUrl.split(",")[1];
              zip.file(`code-${i+1}.${extension}`, imageData, { base64: true });
            }
          }
          
          const content = await zip.generateAsync({ type: "blob" });
          const link = document.createElement("a");
          link.href = URL.createObjectURL(content);
          link.download = `bulk-codes.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (error) {
      console.error("Error generating bulk download:", error);
      alert("An error occurred during download. Please try again.");
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left column - Input */}
      <div className="flex-1">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-6">Bulk Code Generator</h2>
          
          {/* ... existing code ... */}
          
          {/* Code Format */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Code Type
            </label>
            <div className="flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="codeType"
                  value="qrcode"
                  checked={format === "qrcode"}
                  onChange={() => setFormat("qrcode")}
                />
                <span className="ml-2">QR Code</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="codeType"
                  value="barcode"
                  checked={format === "barcode"}
                  onChange={() => setFormat("barcode")}
                />
                <span className="ml-2">Barcode</span>
              </label>
            </div>
          </div>
          
          {/* Sequence Configuration Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="prefix">
                Prefix
              </label>
              <input
                id="prefix"
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="Optional prefix"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="suffix">
                Suffix
              </label>
              <input
                id="suffix"
                type="text"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                placeholder="Optional suffix"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="startNumber">
                Start Number
              </label>
              <input
                id="startNumber"
                type="number"
                value={startNumber}
                onChange={(e) => setStartNumber(parseInt(e.target.value) || 0)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                min="0"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="increment">
                Increment
              </label>
              <input
                id="increment"
                type="number"
                value={increment}
                onChange={(e) => setIncrement(parseInt(e.target.value) || 1)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                min="1"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="padding">
                Zero Padding
              </label>
              <input
                id="padding"
                type="number"
                value={padding}
                onChange={(e) => setPadding(parseInt(e.target.value) || 0)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                min="0"
                max="10"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="count">
                Number of Codes
              </label>
              <input
                id="count"
                type="number"
                value={count}
                onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                min="1"
                max={subscriptionTier === "free" ? 100 : 5000}
              />
            </div>
            
            {format === "barcode" && (
              <>
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="barcodeType">
                    Barcode Format
                  </label>
                  <select
                    id="barcodeType"
                    value={barcodeType}
                    onChange={(e) => setBarcodeType(e.target.value)}
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  >
                    {barcodeFormats.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="barcodeHeight">
                    Barcode Height ({barcodeHeightUnit})
                  </label>
                  <div className="flex">
                    <input
                      id="barcodeHeight"
                      type="number"
                      value={barcodeHeight}
                      onChange={(e) => setBarcodeHeight(parseFloat(e.target.value) || 1)}
                      className="shadow appearance-none border rounded-l w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      min="1"
                      step="0.1"
                    />
                    <select
                      value={barcodeHeightUnit}
                      onChange={(e) => handleUnitChange(e.target.value as 'px' | 'cm' | 'mm')}
                      className="shadow border rounded-r py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                      <option value="px">px</option>
                      <option value="cm">cm</option>
                      <option value="mm">mm</option>
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="mb-6">
            <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Dynamic link</div>
                <div className="text-xs text-gray-600">
                  Creates a short link you can edit later and track.
                </div>
              </div>
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={useDynamicLink}
                  onChange={(e) => {
                    const next = e.target.checked;

                    if (next) {
                      if (!user) {
                        setLockedFeatureName(format === 'qrcode' ? 'Dynamic QR Codes' : 'Dynamic Barcodes');
                        setShowLoginModal(true);
                        return;
                      }

                      const hasDynamicAccess =
                        format === 'qrcode'
                          ? canUseFeature('qrCodeTracking')
                          : canUseFeature('enhancedBarcodes');
                      if (!hasDynamicAccess) {
                        setLockedFeatureName(
                          format === 'qrcode' ? 'Dynamic QR Codes (Pro+)' : 'Dynamic Barcodes (Pro+)'
                        );
                        setShowLoginModal(true);
                        router.push('/pricing');
                        return;
                      }
                    }

                    setUseDynamicLink(next);
                    if (!next) setEncryptDestination(false);
                  }}
                  className="h-4 w-4"
                />
              </label>
            </div>

            {useDynamicLink && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">Encrypt destination</div>
                  <div className="text-xs text-gray-600">Stores the destination encrypted in the database.</div>
                </div>
                <label className="inline-flex items-center">
                  <input
                    type="checkbox"
                    checked={encryptDestination}
                    onChange={(e) => setEncryptDestination(e.target.checked)}
                    className="h-4 w-4"
                  />
                </label>
              </div>
            )}
          </div>
          
          {/* Download Format Selection */}
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Download Format
            </label>
            <div className="flex flex-wrap gap-3">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio"
                  name="downloadFormat"
                  value="zip-jpg"
                  checked={outputType === 'zip' || subscriptionTier === "free"}
                  onChange={() => setOutputType('zip')}
                />
                <span className="ml-2">ZIP (Individual Images)</span>
                {subscriptionTier === "free" && (
                  <span className="ml-1 text-xs text-gray-600">(Low Resolution)</span>
                )}
              </label>
              
              <label className={`inline-flex items-center ${!canUseFeature("pdfDownload") ? "opacity-50" : ""}`}>
                <input
                  type="radio"
                  className="form-radio"
                  name="downloadFormat"
                  value="pdf"
                  checked={outputType === 'pdf'}
                  onChange={() => setOutputType('pdf')}
                  disabled={!canUseFeature("pdfDownload")}
                />
                <span className="ml-2">PDF (Layout Sheet)</span>
                {!canUseFeature("pdfDownload") && (
                  <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                )}
              </label>
              
              <label className={`inline-flex items-center ${!canUseFeature("pdfDownload") ? "opacity-50" : ""}`}>
                <input
                  type="radio"
                  className="form-radio"
                  name="downloadFormat"
                  value="pdf-tile"
                  checked={outputType === 'pdf-tile'}
                  onChange={() => setOutputType('pdf-tile')}
                  disabled={!canUseFeature("pdfDownload")}
                />
                <span className="ml-2">PDF (Tile Sheet)</span>
                {!canUseFeature("pdfDownload") && (
                  <span className="ml-1 text-xs text-blue-600 font-semibold">PRO</span>
                )}
              </label>
            </div>
          </div>
          
          {/* Generate and Download Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={generateBulkCodes}
              disabled={!codesInput || isGenerating}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline disabled:opacity-50"
            >
              Generate
            </button>
            
            <button
              onClick={handleDownload}
              disabled={codes.length === 0 || isGenerating}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md focus:outline-none focus:shadow-outline disabled:opacity-50"
            >
              {isGenerating ? `Generating... ${progress}%` : "Download All"}
            </button>
          </div>
          
          {/* Remaining daily count for free users */}
          {subscriptionTier === "free" && (
            <div className="mt-4 text-xs text-amber-600 bg-amber-50 p-2 rounded-md text-center">
              {remainingDaily <= 5 ? (
                <>
                  You have {remainingDaily} downloads remaining today.  
                  <button 
                    onClick={() => router.push('/pricing')} 
                    className="ml-1 underline"
                  >
                    Upgrade for unlimited.
                  </button>
                </>
              ) : (
                <>Free tier: Limited to 10 codes in low-resolution JPEG</>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Right column - Preview */}
      <div className="flex-1">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-6">Generated Codes</h2>
          
          {codes.length > 0 ? (
            <div>
              <div className="bg-gray-50 p-4 rounded-lg mb-4 max-h-96 overflow-y-auto">
                <ul className="space-y-2">
                  {codes.slice(0, 100).map((code, index) => (
                    <li key={index} className="p-2 bg-white rounded-md shadow-sm">
                      {code}
                    </li>
                  ))}
                  {codes.length > 100 && (
                    <li className="text-center text-sm text-gray-500 p-2">
                      Showing first 100 of {codes.length} codes
                    </li>
                  )}
                </ul>
              </div>
              
              <p className="text-sm text-gray-600 mb-4">
                Total: {codes.length} codes generated
              </p>
            </div>
          ) : (
            <div className="bg-gray-50 p-8 rounded-lg text-center text-gray-400">
              No codes generated yet. Enter your data and click Generate.
            </div>
          )}
          
          {/* Premium features banner */}
          {subscriptionTier === "free" && (
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-800">Premium Features</h3>
              <ul className="mt-2 ml-5 list-disc text-sm text-blue-600">
                <li>Download unlimited codes in high resolution</li>
                <li>Export as PNG, SVG, and PDF</li>
                <li>Customize layout and code appearance</li>
                <li>Generate QR codes with logos</li>
                <li>Batch processing for large datasets</li>
              </ul>
              <button
                onClick={() => router.push('/pricing')}
                className="mt-3 px-4 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
              >
                Upgrade Now
              </button>
            </div>
          )}
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
                      <span>Bulk generation from CSV/Excel</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Download as ZIP archives</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Save and reuse templates</span>
                    </li>
                  </ul>
                  <p className="text-xs text-gray-500 mt-3">
                    🚀 Upgrade to Pro later for unlimited bulk generation
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
                      <span>Unlimited bulk generations</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>High-quality PNG, SVG & PDF exports</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Custom PDF tiling and layouts</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              {isVisitor ? (
                <>
                  <button
                    onClick={() => router.push('/register?returnTo=/bulk')}
                    className="w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition transform hover:scale-105 flex items-center justify-center shadow-lg"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Create Free Account
                  </button>
                  <button
                    onClick={() => router.push('/login?returnTo=/bulk')}
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