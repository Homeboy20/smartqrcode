'use client';

import React, { useState, useEffect } from 'react';

interface SettingsData {
  firebaseApiKey: string;
  firebaseAuthDomain: string;
  firebaseProjectId: string;
  someOtherApiKey: string;
  // Always make sure this is a string, not undefined
  firebaseServiceAccountPath: string; 
}

export default function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData>({
    firebaseApiKey: '',
    firebaseAuthDomain: '',
    firebaseProjectId: '',
    someOtherApiKey: '',
    firebaseServiceAccountPath: '' // Initialize with empty string, not undefined
  });
  // State to manage which Firebase config method is selected
  const [firebaseAuthMethod, setFirebaseAuthMethod] = useState<'manual' | 'file'>('manual');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // TODO: Fetch current settings and auth method
  useEffect(() => {
    // Fetch settings and determine initial firebaseAuthMethod based on what's configured
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Add null check for e.target.files
    const files = e.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
      // Always set to a string, never undefined
      setSettings(prev => ({ 
        ...prev, 
        firebaseServiceAccountPath: files[0].name 
      }));
    } else {
      setSelectedFile(null);
      // Set to empty string, not undefined
      setSettings(prev => ({ ...prev, firebaseServiceAccountPath: '' }));
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Placeholder for actual API call
      // Determine payload based on firebaseAuthMethod
      // const payload = firebaseAuthMethod === 'manual' ? settings : { /* handle file data securely */ };
      // const response = await fetch('/api/admin/settings', { ... body: JSON.stringify(payload) ... });
      
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      setSuccess('Settings saved successfully! (Placeholder)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  // Consistent input field style
  const inputStyle = "mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm read-only:bg-gray-100 read-only:cursor-not-allowed";
  const labelStyle = "block text-sm font-medium text-gray-700";

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
      <h2 className="text-xl font-semibold mb-6 text-gray-800 border-b pb-3">Application Settings</h2>
      <form onSubmit={handleSaveSettings} className="space-y-6">
        {error && <p className="text-red-600 bg-red-50 p-3 rounded-md text-sm">Error: {error}</p>}
        {success && <p className="text-green-600 bg-green-50 p-3 rounded-md text-sm">{success}</p>}

        {/* --- Firebase Configuration --- */}
        <div className="space-y-4 p-4 border border-gray-200 rounded-md">
          <h3 className="text-lg font-medium text-gray-900">Firebase Configuration</h3>
          
          {/* Method Selection */}
          <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Authentication Method:</p>
              <div className="flex items-center gap-x-6">
                  <label className="flex items-center cursor-pointer">
                      <input 
                          type="radio" 
                          name="firebaseAuthMethod" 
                          value="manual"
                          checked={firebaseAuthMethod === 'manual'}
                          onChange={() => setFirebaseAuthMethod('manual')}
                          className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      /> <span className="ml-2 text-sm">Manual Configuration</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                      <input 
                          type="radio" 
                          name="firebaseAuthMethod" 
                          value="file"
                          checked={firebaseAuthMethod === 'file'}
                          onChange={() => setFirebaseAuthMethod('file')}
                          className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                      /> <span className="ml-2 text-sm">Service Account File <span className="text-xs text-gray-500">(Recommended: Use Env Var)</span></span>
                  </label>
              </div>
          </div>

          {/* Conditional Fields */}
          {firebaseAuthMethod === 'manual' ? (
            <div className="pl-5 border-l-4 border-indigo-100 space-y-4 mt-3 pt-3">
              <p className="text-xs text-gray-500">Enter client-side Firebase details. Backend SDKs should use the Service Account method.</p>
              <div>
                <label htmlFor="firebaseApiKey" className={labelStyle}>Firebase API Key</label>
                <input type="password" id="firebaseApiKey" name="firebaseApiKey" value={settings.firebaseApiKey} onChange={handleInputChange} className={inputStyle} placeholder="Enter Firebase API Key" />
              </div>
              <div>
                <label htmlFor="firebaseAuthDomain" className={labelStyle}>Firebase Auth Domain</label>
                <input type="text" id="firebaseAuthDomain" name="firebaseAuthDomain" value={settings.firebaseAuthDomain} onChange={handleInputChange} className={inputStyle} placeholder="your-app.firebaseapp.com" />
              </div>
              <div>
                <label htmlFor="firebaseProjectId" className={labelStyle}>Firebase Project ID</label>
                <input type="text" id="firebaseProjectId" name="firebaseProjectId" value={settings.firebaseProjectId} onChange={handleInputChange} className={inputStyle} placeholder="your-project-id" />
              </div>
            </div>
          ) : (
            <div className="pl-5 border-l-4 border-red-100 space-y-4 mt-3 pt-3">
              <div className="bg-red-50 p-3 rounded-md border border-red-200">
                  <p className="text-sm font-semibold text-red-700">Security Warning:</p>
                  <p className="text-xs text-red-600 mt-1">Uploading service account keys via a web form is highly discouraged. Use the <code>GOOGLE_APPLICATION_CREDENTIALS</code> environment variable on your server for production.</p>
              </div>
              <div>
                <label htmlFor="firebaseServiceAccountFile" className={labelStyle}>Service Account JSON File</label>
                <input
                  type="file"
                  id="firebaseServiceAccountFile"
                  name="firebaseServiceAccountFile"
                  accept=".json"
                  onChange={handleFileChange}
                  className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                {selectedFile && <p className="text-xs text-gray-600 mt-1">Selected: {selectedFile.name}</p>}
                 <p className="text-xs text-gray-500 mt-1">Leave blank if using environment variables (recommended).</p>
              </div>
              <div>
                  <label htmlFor="firebaseServiceAccountPath" className={labelStyle}>Service Account Path (Info)</label>
                  <input 
                      type="text" 
                      id="firebaseServiceAccountPath" 
                      name="firebaseServiceAccountPath" 
                      // Ensure this is always a string
                      value={settings.firebaseServiceAccountPath} 
                      readOnly 
                      className={inputStyle} 
                      placeholder="Path set via environment variable" 
                  />
                  <p className="text-xs text-gray-500 mt-1">This read-only field shows the detected path if set via environment variables.</p>
              </div>
            </div>
          )}
        </div>

        {/* --- Other Integrations --- */}
         <div className="space-y-4 p-4 border border-gray-200 rounded-md">
            <h3 className="text-lg font-medium text-gray-900">Other Integrations</h3>
            <div>
              <label htmlFor="someOtherApiKey" className={labelStyle}>Some Other Service API Key</label>
              <input type="password" id="someOtherApiKey" name="someOtherApiKey" value={settings.someOtherApiKey} onChange={handleInputChange} className={inputStyle} placeholder="Enter API Key" />
            </div>
         </div>

        {/* Save Button */}
        <div className="pt-2 text-right">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
} 