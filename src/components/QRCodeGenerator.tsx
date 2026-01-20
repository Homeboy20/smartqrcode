"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import QRCode from "react-qr-code";
import * as qrcode from "qrcode";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";
import { useTrackUsage } from "@/hooks/useTrackUsage";
import { FeatureType } from "@/lib/subscription";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useSupabaseAuth } from "@/context/SupabaseAuthContext";
import { supabase } from "@/lib/supabase/client";

type QRCodeType = 'url' | 'text' | 'email' | 'phone' | 'sms' | 'contact' | 'wifi' | 'menu';

type ImageFormat = 'png' | 'svg' | 'jpg' | 'jpeg' | 'pdf';

interface QRCodeGeneratorProps {
  onDownload?: (dataUrl: string) => void;
}

interface FormField {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
}

// Add QR code template definitions
const qrTemplates = [
  { id: "basic", name: "Basic", free: true },
  { id: "rounded", name: "Rounded Corners", free: true },
  { id: "gradient", name: "Gradient", premium: true, tier: 'pro' },
  { id: "dotted", name: "Dotted", premium: true, tier: 'pro' },
  { id: "framed", name: "Framed", premium: true, tier: 'business' },
  { id: "logo-overlay", name: "Logo Overlay", premium: true, tier: 'business' },
];

export default function QRCodeGenerator({ onDownload }: QRCodeGeneratorProps) {
  // Use the subscription context
  const { 
    subscriptionTier,
    getLimit,
    canUseFeature
  } = useSubscription();
  
  // Use the tracking hook
  const {
    trackUsage,
    isTracking,
    error: trackingError,
    getRemainingUsage
  } = useTrackUsage();
  
  // Check free mode and auth status
  const { settings: appSettings, loading: settingsLoading } = useAppSettings();
  const { user, getAccessToken } = useSupabaseAuth();
  const isVisitor = !user;
  const canUseBasicFeatures = isVisitor && appSettings.freeMode && appSettings.freeModeFeatures.qrCodeGeneration;
  
  const router = useRouter();
  const [qrType, setQRType] = useState<QRCodeType>('url');
  const [formValues, setFormValues] = useState<Record<string, string>>({
    url: '',
    text: '',
    email: '',
    emailSubject: '',
    emailBody: '',
    phone: '',
    smsPhone: '',
    smsMessage: '',
    contactName: '',
    contactOrg: '',
    contactPhone: '',
    contactEmail: '',
    contactAddress: '',
    contactUrl: '',
    wifiSsid: '',
    wifiPassword: '',
    wifiType: 'WPA',
    wifiHidden: 'false',
    menuUrl: '',
  });

  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [menuUploading, setMenuUploading] = useState(false);
  const [menuUploadError, setMenuUploadError] = useState<string | null>(null);

  const [qrValue, setQrValue] = useState<string>('');
  const [size] = useState<number>(200);
  const [backgroundColor] = useState<string>('#FFFFFF');
  const [foregroundColor] = useState<string>('#000000');
  const [imageFormat, setImageFormat] = useState<ImageFormat>('png');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [lockedFeatureName, setLockedFeatureName] = useState('');
  const qrRef = useRef<HTMLDivElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("basic");

  const [useDynamicLink, setUseDynamicLink] = useState(false);
  const [encryptDestination, setEncryptDestination] = useState(false);

  const qrTypes = [
    { value: 'url', label: 'Website URL' },
    { value: 'text', label: 'Plain Text' },
    { value: 'email', label: 'Email Address' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'sms', label: 'SMS Message' },
    { value: 'contact', label: 'Contact Information' },
    { value: 'wifi', label: 'WiFi Network' },
    { value: 'menu', label: 'Menu / Brochure (PDF/Image)' },
  ] as const;

  const formFields: Record<QRCodeType, FormField[]> = {
    url: [
      { id: 'url', label: 'Website URL', type: 'url', placeholder: 'https://example.com', required: true },
    ],
    text: [
      { id: 'text', label: 'Your Text', type: 'textarea', placeholder: 'Enter text to encode in QR code', required: true },
    ],
    email: [
      { id: 'email', label: 'Email Address', type: 'email', placeholder: 'email@example.com', required: true },
      { id: 'emailSubject', label: 'Subject (Optional)', type: 'text', placeholder: 'Email subject' },
      { id: 'emailBody', label: 'Body (Optional)', type: 'textarea', placeholder: 'Email body text' },
    ],
    phone: [
      { id: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+1234567890', required: true },
    ],
    sms: [
      { id: 'smsPhone', label: 'Phone Number', type: 'tel', placeholder: '+1234567890', required: true },
      { id: 'smsMessage', label: 'Message (Optional)', type: 'textarea', placeholder: 'Your SMS message' },
    ],
    contact: [
      { id: 'contactName', label: 'Name', type: 'text', placeholder: 'John Doe', required: true },
      { id: 'contactOrg', label: 'Organization (Optional)', type: 'text', placeholder: 'Company Name' },
      { id: 'contactPhone', label: 'Phone (Optional)', type: 'tel', placeholder: '+1234567890' },
      { id: 'contactEmail', label: 'Email (Optional)', type: 'email', placeholder: 'email@example.com' },
      { id: 'contactAddress', label: 'Address (Optional)', type: 'textarea', placeholder: '123 Main St, City, Country' },
      { id: 'contactUrl', label: 'Website (Optional)', type: 'url', placeholder: 'https://example.com' },
    ],
    wifi: [
      { id: 'wifiSsid', label: 'Network Name (SSID)', type: 'text', placeholder: 'WiFi Network Name', required: true },
      { id: 'wifiPassword', label: 'Password', type: 'password', placeholder: 'WiFi Password' },
      { id: 'wifiType', label: 'Security Type', type: 'select', placeholder: 'Select security type', required: true,
        options: [
          { value: 'WPA', label: 'WPA/WPA2/WPA3' },
          { value: 'WEP', label: 'WEP' },
          { value: 'nopass', label: 'No Password' },
        ],
      },
      { id: 'wifiHidden', label: 'Hidden Network', type: 'select', placeholder: 'Is this network hidden?',
        options: [
          { value: 'false', label: 'No' },
          { value: 'true', label: 'Yes' },
        ],
      },
    ],
    menu: [
      { id: 'menuUrl', label: 'Hosted File URL', type: 'url', placeholder: 'Upload a file or paste a URL', required: true },
    ],
  };

  const imageFormats = [
    { value: "png", label: "PNG" },
    { value: "jpeg", label: "JPEG" },
    { value: "svg", label: "SVG", premium: true },
    { value: "pdf", label: "PDF", premium: true },
  ];

  const dynamicSupported = qrType === 'url' || qrType === 'menu';

  useEffect(() => {
    if (!dynamicSupported) {
      setUseDynamicLink(false);
      setEncryptDestination(false);
    }
  }, [dynamicSupported]);

  const isValidHttpUrl = (value: string) => {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // Moved function inside useEffect to fix the dependency warning
    const updateQRValue = () => {
      let value = '';
  
      switch (qrType) {
        case 'url':
          value = formValues.url;
          break;
        case 'text':
          value = formValues.text;
          break;
        case 'email':
          value = `mailto:${formValues.email}`;
          if (formValues.emailSubject) value += `?subject=${encodeURIComponent(formValues.emailSubject)}`;
          if (formValues.emailBody) value += `${formValues.emailSubject ? '&' : '?'}body=${encodeURIComponent(formValues.emailBody)}`;
          break;
        case 'phone':
          value = `tel:${formValues.phone}`;
          break;
        case 'sms':
          value = `sms:${formValues.smsPhone}`;
          if (formValues.smsMessage) value += `?body=${encodeURIComponent(formValues.smsMessage)}`;
          break;
        case 'contact':
          // Simple vCard format
          value = 'BEGIN:VCARD\nVERSION:3.0\n';
          value += formValues.contactName ? `FN:${formValues.contactName}\n` : '';
          value += formValues.contactOrg ? `ORG:${formValues.contactOrg}\n` : '';
          value += formValues.contactPhone ? `TEL:${formValues.contactPhone}\n` : '';
          value += formValues.contactEmail ? `EMAIL:${formValues.contactEmail}\n` : '';
          value += formValues.contactAddress ? `ADR:;;${formValues.contactAddress};;;\n` : '';
          value += formValues.contactUrl ? `URL:${formValues.contactUrl}\n` : '';
          value += 'END:VCARD';
          break;
        case 'wifi':
          value = `WIFI:T:${formValues.wifiType};S:${formValues.wifiSsid};`;
          if (formValues.wifiPassword && formValues.wifiType !== 'nopass') {
            value += `P:${formValues.wifiPassword};`;
          }
          value += `H:${formValues.wifiHidden};`;
          break;
        case 'menu':
          value = formValues.menuUrl;
          break;
      }
  
      setQrValue(value);
    };
    
    updateQRValue();
  }, [qrType, formValues]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormValues(prev => ({ ...prev, [id]: value }));
  };

  const uploadMenuFile = async () => {
    setMenuUploadError(null);

    if (!menuFile) {
      setMenuUploadError('Choose a PDF or image first.');
      return;
    }

    // Require auth for uploads.
    if (!user) {
      setLockedFeatureName('Menu/Brochure Hosting');
      setShowLoginModal(true);
      return;
    }

    // Enforce subscription access for uploads.
    if (!canUseFeature('fileUploads')) {
      setLockedFeatureName('Menu/Brochure Hosting (Pro+)');
      setShowLoginModal(true);
      router.push('/pricing');
      return;
    }

    try {
      setMenuUploading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        setMenuUploadError('Please log in again to upload files.');
        return;
      }

      const fd = new FormData();
      fd.append('file', menuFile);

      const res = await fetch('/api/uploads/menu', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: fd,
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMenuUploadError((json as any)?.error || 'Upload failed');
        return;
      }

      const url = (json as any)?.url;
      if (!url) {
        setMenuUploadError('Upload succeeded but URL is missing.');
        return;
      }

      setFormValues((prev) => ({ ...prev, menuUrl: url }));
    } catch (e: any) {
      setMenuUploadError(e?.message || 'Upload failed');
    } finally {
      setMenuUploading(false);
    }
  };

  const isFormValid = () => {
    const requiredFields = formFields[qrType].filter(field => field.required);
    return requiredFields.every(field => formValues[field.id].trim() !== '');
  };

  // Calculate progress bar width here
  const qrCodesRemaining = useMemo(() => {
      return getRemainingUsage('qrCodesGenerated');
  }, [getRemainingUsage]);

  const qrCodeLimit = useMemo(() => {
      return getLimit('qrGenerationLimit');
  }, [getLimit]);

  const widthPercentage = useMemo(() => {
      return Math.min(100, (qrCodesRemaining / (qrCodeLimit || 1)) * 100);
  }, [qrCodesRemaining, qrCodeLimit]);

  const downloadQRCode = async () => {
    try {
      if (qrValue.trim() === "") return;
      
      // Check if user can generate QR code (use calculated remaining)
      if (qrCodesRemaining <= 0) {
        alert(`You've reached your QR code generation limit for your ${subscriptionTier} plan. Please upgrade to continue.`);
        router.push('/pricing');
        return;
      }
      
      // Track usage (pass correct FeatureType)
      const trackSuccess = await trackUsage('qrCodesGenerated');
      
      if (!trackSuccess) {
        if (trackingError) {
          alert(trackingError);
        }
        return;
      }

      let valueToEncode = qrValue;

      if (useDynamicLink && dynamicSupported) {
        if (!user) {
          setLockedFeatureName('Dynamic QR Codes');
          setShowLoginModal(true);
          return;
        }

        if (!canUseFeature('qrCodeTracking')) {
          setLockedFeatureName('Dynamic QR Codes (Pro+)');
          setShowLoginModal(true);
          router.push('/pricing');
          return;
        }

        if (!isValidHttpUrl(qrValue)) {
          alert('Dynamic QR Codes only support http(s) URLs.');
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
            type: 'qrcode',
            destination: qrValue,
            encrypt: encryptDestination,
            name: `Dynamic QR (${qrType})`,
          }),
        });

        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          alert((json as any)?.error || 'Failed to create dynamic QR code');
          return;
        }

        const dynamicUrl = (json as any)?.url;
        if (!dynamicUrl) {
          alert('Failed to create dynamic QR code');
          return;
        }

        valueToEncode = dynamicUrl;
        setQrValue(dynamicUrl);
      }
      
      if (imageFormat === 'svg') {
        const svgData = await qrcode.toString(valueToEncode, {
          type: 'svg',
          margin: 1,
          width: size,
          color: {
            dark: foregroundColor,
            light: backgroundColor,
          },
        });

        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);

        const downloadLink = document.createElement('a');
        downloadLink.href = svgUrl;
        downloadLink.download = `qrcode-${qrType}.svg`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(svgUrl);
      } else {
        // For other formats, use the qrcode.toDataURL method
        const options: qrcode.QRCodeToDataURLOptions = {
          margin: 1,
          width: size,
          color: {
            dark: foregroundColor,
            light: backgroundColor
          }
        };
        
        const dataUrl = await qrcode.toDataURL(valueToEncode, options);
        
        let fileExtension = imageFormat;
        if (fileExtension === 'jpg') fileExtension = 'jpeg';
        
        if (onDownload) {
          onDownload(dataUrl);
        } else {
          // Default download behavior
          const downloadLink = document.createElement('a');
          downloadLink.href = dataUrl;
          downloadLink.download = `qrcode-${qrType}.${fileExtension}`;
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
        }
      }
    } catch (error) {
      console.error("Error downloading QR code:", error);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col gap-6">
      {/* Login prompt for visitors in free mode */}
      {canUseBasicFeatures && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 p-4 rounded-lg">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-indigo-800">Free Preview Mode</h3>
              <p className="mt-1 text-sm text-indigo-700">
                You're using basic features. <Link href="/register" className="font-semibold underline hover:text-indigo-900">Create a free account</Link> to save your QR codes, access premium templates, and unlock advanced features.
              </p>
            </div>
            <div className="ml-auto pl-3">
              <Link href="/login" className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none">
                Login
              </Link>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex flex-col lg:flex-row gap-6">
      {/* Form Column - Left Side */}
      <div className="flex-1">
        {/* Optional Header */}
        {/* <div className="p-6 border-b border-neutral-200">
          <h2 className="text-xl font-semibold text-neutral-800">QR Code Generator</h2>
          <p className="text-neutral-500 text-sm mt-1">Create custom QR codes for various purposes</p>
        </div> */}
        
        <div className="rounded-lg border border-neutral-200 p-4 bg-neutral-50">
          {/* Usage Progress Bar */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">QR Codes Remaining:</span>
            <span className="text-sm font-bold">{qrCodesRemaining}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full" 
              style={{ width: `${widthPercentage}%` }}
            ></div>
          </div>
          
          {subscriptionTier === 'free' && qrCodesRemaining < 3 && (
            <div className="mt-2 text-xs text-amber-700">
              <Link href="/pricing" className="text-indigo-600 hover:underline">
                Upgrade to Pro
              </Link> for unlimited QR codes.
            </div>
          )}
          
          <label className="block text-neutral-700 text-sm font-semibold mb-2" htmlFor="qr-type">
            QR Code Type
          </label>
          <select
            id="qr-type"
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-sm bg-white"
            value={qrType}
            onChange={(e) => setQRType(e.target.value as QRCodeType)}
          >
            {qrTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          
          <div className="mt-4 space-y-4">
            {formFields[qrType].map((field) => (
              <div key={field.id}>
                <label className="block text-neutral-700 text-sm font-semibold mb-2" htmlFor={field.id}>
                  {field.label}
                </label>

                {qrType === 'menu' && field.id === 'menuUrl' && (
                  <div className="mb-3 rounded-md border border-neutral-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">Upload a menu/brochure</div>
                        <div className="text-xs text-gray-600">PDF or image (max 15MB). Generates a hosted link for your QR.</div>
                      </div>
                      <button
                        type="button"
                        onClick={uploadMenuFile}
                        disabled={menuUploading || !menuFile}
                        className={
                          menuUploading || !menuFile
                            ? 'rounded-md px-4 py-2 text-sm font-semibold text-white bg-indigo-300 cursor-not-allowed'
                            : 'rounded-md px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700'
                        }
                      >
                        {menuUploading ? 'Uploading…' : 'Upload'}
                      </button>
                    </div>

                    <div className="mt-3">
                      <input
                        type="file"
                        accept="application/pdf,image/*"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setMenuFile(f);
                          setMenuUploadError(null);
                        }}
                        className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
                      />
                      {menuUploadError && (
                        <div className="mt-2 text-sm text-red-600">{menuUploadError}</div>
                      )}
                      {formValues.menuUrl && (
                        <div className="mt-2 text-sm">
                          <a className="text-indigo-600 hover:underline" href={formValues.menuUrl} target="_blank" rel="noreferrer">
                            Preview hosted file
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {field.type === 'textarea' ? (
                  <textarea
                    id={field.id}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-sm resize-none"
                    placeholder={field.placeholder}
                    rows={4}
                    value={formValues[field.id] || ''}
                    onChange={handleInputChange}
                    required={field.required}
                  />
                ) : field.type === 'select' ? (
                  <select
                    id={field.id}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-sm bg-white"
                    value={formValues[field.id] || ''}
                    onChange={handleInputChange}
                    required={field.required}
                  >
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={field.id}
                    type={field.type}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition text-sm"
                    placeholder={field.placeholder}
                    value={formValues[field.id] || ''}
                    onChange={handleInputChange}
                    required={field.required}
                  />
                )}
              </div>
            ))}
          </div>

          {dynamicSupported && (
            <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Dynamic link</div>
                  <div className="text-xs text-gray-600">
                    Creates a short ScanMagic link that can track scans.
                  </div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={useDynamicLink}
                    onChange={(e) => {
                      const next = e.target.checked;
                      if (next) {
                        if (isVisitor) {
                          setLockedFeatureName('Dynamic QR Codes');
                          setShowLoginModal(true);
                          return;
                        }
                        if (!canUseFeature('qrCodeTracking')) {
                          setLockedFeatureName('Dynamic QR Codes (Pro+)');
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
                    <div className="text-sm font-semibold text-gray-900">Encrypt destination</div>
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
          )}
          
          {/* Render QR templates with subscription checks */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              QR Code Style
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {qrTemplates.map((template) => {
                // Premium templates require login for visitors
                const requiresLogin = template.premium && isVisitor;
                const isPremiumLocked = template.premium && 
                  (template.tier === 'pro' ? subscriptionTier === 'free' : 
                  template.tier === 'business' ? subscriptionTier === 'free' || subscriptionTier === 'pro' : false);
                
                const isLocked = requiresLogin || isPremiumLocked;
                
                return (
                  <div
                    key={template.id}
                    className={`relative p-4 border rounded-lg text-center transition-all cursor-pointer ${selectedTemplate === template.id && !isLocked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'} ${isLocked ? 'opacity-60' : ''}`}
                    onClick={() => {
                      if (requiresLogin) {
                        setLockedFeatureName(`${template.name} Template`);
                        setShowLoginModal(true);
                      } else if (isPremiumLocked) {
                        setLockedFeatureName(`${template.name} Template (${template.tier.toUpperCase()})`);
                        setShowLoginModal(true);
                      } else {
                        setSelectedTemplate(template.id);
                      }
                    }}
                  >
                    {/* Template preview would go here */}
                    <div className="h-16 mb-2 flex items-center justify-center bg-gray-100 rounded">
                      <span className="text-xs text-gray-500">{template.name}</span>
                    </div>
                    
                    <span className="text-sm">{template.name}</span>
                    
                    {requiresLogin && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 rounded-lg">
                        <div className="text-center">
                          <div className="bg-indigo-100 text-indigo-800 text-xs py-1 px-2 rounded-full flex items-center mx-auto w-fit mb-1">
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Login Required
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {!requiresLogin && isPremiumLocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70 rounded-lg">
                        <div className="bg-indigo-100 text-indigo-800 text-xs py-1 px-2 rounded-full flex items-center">
                          <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                          {template.tier.charAt(0).toUpperCase() + template.tier.slice(1)}+
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          <button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm"
            onClick={downloadQRCode}
            disabled={!isFormValid() || !qrValue || isTracking || qrCodesRemaining <= 0}
          >
            {isTracking ? (
              <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
              </svg>
            )}
            {isTracking ? 'Generating...' : 'Generate QR Code'}
          </button>
          
          {trackingError && (
            <div className="mt-2 p-2 bg-red-50 text-red-600 text-sm rounded">
              {trackingError}
            </div>
          )}
        </div>
      </div>

      {/* Preview Column - Right Side */}
      <div className="flex-1">
        <div className="relative bg-white p-8 rounded-lg shadow-sm border border-neutral-200 flex flex-col items-center justify-center min-h-[300px]">
          <div className="relative">
            {qrValue ? (
              <div className="qr-container" ref={qrRef}>
                <QRCode 
                  value={qrValue} 
                  size={224} 
                  level="H" 
                  className={`
                    ${selectedTemplate === 'rounded' ? 'rounded-lg' : ''}
                    ${selectedTemplate === 'gradient' ? 'bg-gradient-to-r from-blue-400 to-purple-500 p-2' : ''}
                    ${selectedTemplate === 'dotted' ? 'p-4 border-2 border-dashed border-gray-400' : ''}
                    ${selectedTemplate === 'framed' ? 'p-4 border-4 border-gray-800' : ''}
                  `}
                />
                
                {/* Watermark for free tier */}
                {subscriptionTier === 'free' && qrCodesRemaining < 3 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="absolute transform rotate-45 text-gray-300 text-lg font-bold opacity-50">
                      SCANMAGIC
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gray-100 text-xs text-center py-1 opacity-70">
                      Free version - Upgrade to remove
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-56 h-56 border-2 border-dashed border-neutral-300 rounded-md flex items-center justify-center text-neutral-400">
                QR code preview
              </div>
            )}
          </div>
          
          <p className="text-xs text-neutral-500 mt-3 h-4">
            {qrValue && `Type: ${qrTypes.find(t => t.value === qrType)?.label}`}
          </p>
        </div>
        
        {/* Format selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Download Format
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {imageFormats.map((format) => {
              const requiresLogin = format.premium && isVisitor;
              const isPremium = format.premium && !isVisitor && (subscriptionTier === 'free');
              const isLocked = requiresLogin || isPremium;
              
              return (
                <button
                  key={format.value}
                  type="button"
                  onClick={() => {
                    if (requiresLogin) {
                      setLockedFeatureName(`${format.label} Export`);
                      setShowLoginModal(true);
                    } else if (isPremium) {
                      setLockedFeatureName(`${format.label} Export (PRO)`);
                      setShowLoginModal(true);
                    } else {
                      setImageFormat(format.value as ImageFormat);
                    }
                  }}
                  className={`
                    px-3 py-2 text-sm font-medium rounded-md transition
                    ${imageFormat === format.value && !isLocked
                      ? 'bg-indigo-600 text-white'
                      : isLocked
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }
                    ${isLocked ? 'relative overflow-hidden' : ''}
                  `}
                >
                  {format.label}
                  {requiresLogin && (
                    <div className="absolute top-0 right-0 -mr-1 -mt-1 text-xs bg-indigo-200 text-indigo-800 px-1 rounded-bl">
                      LOGIN
                    </div>
                  )}
                  {!requiresLogin && isPremium && (
                    <div className="absolute top-0 right-0 -mr-1 -mt-1 text-xs bg-indigo-200 text-indigo-800 px-1 rounded-bl">
                      PRO
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        
        {/* Add a subscription info section */}
        {!isVisitor ? (
          <div className="mt-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">Your {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)} Plan</div>
                <div className="text-xs text-gray-500">
                  {getRemainingUsage('qrCodesGenerated')} QR codes remaining
                </div>
              </div>
              
              {subscriptionTier !== 'business' && (
                <Link href="/pricing" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        ) : canUseBasicFeatures && (
          <div className="mt-6 bg-indigo-50 p-4 rounded-lg border border-indigo-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-indigo-900">Free Preview Mode</div>
                <div className="text-xs text-indigo-700">
                  Create a free account to save and manage your QR codes
                </div>
              </div>
              
              <Link href="/register" className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline">
                Sign Up
              </Link>
            </div>
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
                <svg className="w-6 h-6 text-indigo-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-l-4 border-indigo-500 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-700">
                  <strong className="text-indigo-700">{lockedFeatureName}</strong> {isVisitor ? 'requires a free account' : 'is a premium feature'}.
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
                      <span>Save your QR codes</span>
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
                    🚀 Upgrade to Pro later for premium templates & advanced features
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    Upgrade to <strong className="text-indigo-600">Pro</strong> or <strong className="text-purple-600">Business</strong> to unlock:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2 ml-4">
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-indigo-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Premium templates & designs</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-indigo-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>SVG & PDF export</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-5 h-5 text-indigo-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Bulk generation & API</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              {isVisitor ? (
                <>
                  <button
                    onClick={() => router.push('/register?returnTo=/qrcode')}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition transform hover:scale-105 flex items-center justify-center shadow-lg"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                    Create Free Account
                  </button>
                  <button
                    onClick={() => router.push('/login?returnTo=/qrcode')}
                    className="w-full bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold py-3 px-4 rounded-lg transition"
                  >
                    Already have an account? Login
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => router.push('/pricing')}
                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition transform hover:scale-105 flex items-center justify-center shadow-lg"
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