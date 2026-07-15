/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Camera, Upload, Trash2, CheckCircle2 } from 'lucide-react';

interface PhotoUploaderProps {
  photos: string[];
  onUpload: (base64: string) => void;
}

// Highly realistic mock service images to easily test the app without local files
const SAMPLE_PHOTOS = [
  {
    name: 'Outdoor Unit Mounted',
    url: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Vacuum Gauge Check',
    url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=600&q=80',
  },
  {
    name: 'Indoor Filter Service',
    url: 'https://images.unsplash.com/photo-1621905252507-b354bc25edac?auto=format&fit=crop&w=600&q=80',
  }
];

export default function PhotoUploader({ photos, onUpload }: PhotoUploaderProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        onUpload(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const loadSamplePhoto = async (url: string) => {
    try {
      // Direct base64 conversion is cleaner for saving. If fetch CORS blocks,
      // we can just pass the URL directly since our state supports both image URLs and base64.
      onUpload(url);
    } catch (e) {
      console.error('Error fetching sample image:', e);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-2">
          Service Documentation Photos
        </label>
        
        {/* Drag and Drop Container */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all relative ${
            dragActive
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70'
          }`}
        >
          <input
            type="file"
            id="file-upload"
            multiple={false}
            accept="image/*"
            onChange={handleInputChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
            <div className="p-3 bg-white rounded-full shadow-sm text-slate-500">
              <Camera className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              Drag photo here or <span className="text-indigo-600">browse camera/gallery</span>
            </p>
            <p className="text-xs text-slate-400">Supports PNG, JPG up to 10MB</p>
          </div>
        </div>
      </div>

      {/* Quick Sample Photos */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
          Quick-Insert Sample Job Photos
        </h4>
        <div className="grid grid-cols-3 gap-2">
          {SAMPLE_PHOTOS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => loadSamplePhoto(p.url)}
              className="group relative h-16 rounded-lg overflow-hidden border border-slate-200 shadow-sm transition-all hover:scale-105 active:scale-95"
            >
              <img
                src={p.url}
                alt={p.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:brightness-90"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="w-4 h-4 text-white" />
              </div>
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white py-0.5 px-1 truncate font-medium text-center">
                {p.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thumbnail Gallery */}
      {photos.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Uploaded Photos ({photos.length})
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p, idx) => (
              <div
                key={idx}
                className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 shadow-sm"
              >
                <img
                  src={p}
                  alt={`Service upload ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 right-1 bg-green-500 text-white rounded-full p-0.5 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
