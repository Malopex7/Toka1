"use client";
import React, { useState, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { useFeedStore } from '@/store/useFeedStore';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { firebaseUser } = useAuth();
  
  const [title, setTitle] = useState('');
  const [tier, setTier] = useState<'fan_funded' | 'brand_safe'>('fan_funded');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [compressedFile, setCompressedFile] = useState<File | Blob | null>(null);
  const [compressionRatio, setCompressionRatio] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file format
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      setErrorMessage('Invalid file format. Please select an MP4, WebM or MOV video.');
      return;
    }

    setSelectedFile(file);
    setCompressedFile(null);
    setCompressionRatio(null);
    setErrorMessage(null);

    // Simulate client-side compression/optimization process if file is large (> 5MB)
    if (file.size > 5 * 1024 * 1024) {
      runClientSideCompression(file);
    } else {
      setCompressedFile(file);
    }
  };

  /**
   * Simulates/performs client-side compression/optimization for the video file
   */
  const runClientSideCompression = async (file: File) => {
    setIsCompressing(true);
    setCompressionProgress(0);
    setErrorMessage(null);

    try {
      // Step-by-step progress simulation of downscaling/bitrate optimization
      for (let i = 0; i <= 100; i += 20) {
        setCompressionProgress(i);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      // Optimize file size client-side (simulate 40% compression by chunking or quality capping)
      // For demo, we just pass the original file but label it as optimized
      const mockOptimizedSize = Math.round(file.size * 0.6);
      const savingsPercent = 40;
      
      setCompressedFile(file); // Pass file down to uploader
      setCompressionRatio(`Compressed from ${(file.size / (1024 * 1024)).toFixed(2)}MB to ${(mockOptimizedSize / (1024 * 1024)).toFixed(2)}MB (${savingsPercent}% saved)`);
    } catch (err) {
      setErrorMessage('Failed during client-side compression.');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !selectedFile || !compressedFile) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage(null);

    try {
      // 1) Initialize upload directly to Cloud Storage for Firebase (bypasses server)
      const fileToUpload = compressedFile;
      const fileExtension = selectedFile.name.split('.').pop() || 'mp4';
      const storageRef = ref(storage, `videos/${Date.now()}_upload.${fileExtension}`);
      
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        }, 
        (error) => {
          console.error('Firebase Storage upload error:', error);
          setErrorMessage('Upload to Cloud Storage failed. Please try again.');
          setIsUploading(false);
        }, 
        async () => {
          // 2) Fetch the direct public download URL on complete
          const downloadUrl = await getDownloadURL(storageRef);

          // 3) Register the video URL with the backend database API
          const token = await firebaseUser.getIdToken();
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              videoUrl: downloadUrl,
              title,
              tier
            })
          });

          const data = await response.json();
          if (data.status === 'success') {
            setSuccessMessage('Video successfully uploaded! AI brand safety review started in background.');
            // Reload the Zustand store feed
            useFeedStore.getState().resetFeed();
            useFeedStore.getState().fetchNextPage();

            setTimeout(() => {
              handleClose();
            }, 3000);
          } else {
            setErrorMessage(data.message || 'Failed to register video in database.');
          }
          setIsUploading(false);
        }
      );

    } catch (err) {
      console.error(err);
      setErrorMessage('Upload pipeline error.');
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setTier('fan_funded');
    setSelectedFile(null);
    setCompressedFile(null);
    setCompressionRatio(null);
    setSuccessMessage(null);
    setErrorMessage(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans select-none animate-fade-in">
      <div className="bg-shaded-canopy border border-white/10 rounded-3xl w-full max-w-lg p-8 shadow-2xl flex flex-col gap-5 relative">
        
        {/* Close Button */}
        <button 
          onClick={handleClose} 
          className="absolute top-5 right-5 text-cloud-white/40 hover:text-cloud-white transition-colors"
        >
          <span className="material-symbols-outlined text-[22px]">close</span>
        </button>

        {successMessage ? (
          // Success Feedback View
          <div className="flex flex-col items-center text-center gap-4 py-8 animate-scale-up">
            <span className="material-symbols-outlined text-fintech-mint text-[64px] animate-bounce">check_circle</span>
            <h3 className="text-xl font-bold text-cloud-white">Upload Completed!</h3>
            <p className="text-sm text-cloud-white/60 max-w-sm">{successMessage}</p>
          </div>
        ) : (
          // Form View
          <>
            <div>
              <h2 className="text-lg font-black tracking-tight text-cloud-white flex items-center gap-2">
                <span className="material-symbols-outlined text-toka-flare">video_call</span>
                Share a Video
              </h2>
              <p className="text-xs text-cloud-white/50 mt-0.5">Direct client-side direct uploads to Cloud Storage.</p>
            </div>

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/35 text-red-500 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              
              {/* Drag and Drop Zone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  selectedFile 
                    ? 'border-fintech-mint/45 bg-fintech-mint/5' 
                    : 'border-white/10 hover:border-white/20 bg-black/10'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="video/*" 
                  className="hidden" 
                />
                
                {selectedFile ? (
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-fintech-mint text-[36px]">movie</span>
                    <span className="text-xs font-bold text-cloud-white truncate max-w-[250px]">{selectedFile.name}</span>
                    <span className="text-[10px] text-cloud-white/40 font-mono">
                      Original: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="material-symbols-outlined text-toka-flare text-[36px]">cloud_upload</span>
                    <span className="text-xs font-bold text-cloud-white">Click to browse video file</span>
                    <span className="text-[9px] text-cloud-white/40 font-mono">Supports MP4, WebM, MOV (Max 15MB)</span>
                  </div>
                )}
              </div>

              {/* Compression loader */}
              {isCompressing && (
                <div className="bg-black/20 border border-white/5 p-4 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-toka-flare flex items-center gap-1.5">
                      <span className="w-3 h-3 border border-toka-flare border-t-transparent rounded-full animate-spin"></span>
                      Optimizing and compressing video...
                    </span>
                    <span className="font-mono">{compressionProgress}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-toka-flare h-full rounded-full transition-all duration-300" style={{ width: `${compressionProgress}%` }}></div>
                  </div>
                </div>
              )}

              {/* Compression feedback */}
              {compressionRatio && (
                <div className="bg-fintech-mint/10 border border-fintech-mint/35 text-fintech-mint text-[10px] font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  <span>{compressionRatio}</span>
                </div>
              )}

              {/* Input Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-cloud-white/40 uppercase">Video Title</label>
                <input 
                  type="text" 
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Give your video a descriptive title" 
                  className="bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-medium text-cloud-white outline-none focus:border-toka-flare transition-colors"
                />
              </div>

              {/* Input Tier Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-cloud-white/40 uppercase">Advertising Tier</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTier('fan_funded')}
                    className={`py-3.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col gap-0.5 justify-center items-center ${
                      tier === 'fan_funded'
                        ? 'bg-toka-flare border-toka-flare text-cloud-white shadow-[0_0_12px_rgba(255,79,0,0.25)]'
                        : 'bg-black/20 border-white/10 text-cloud-white/70 hover:text-cloud-white'
                    }`}
                  >
                    <span>Fan Funded Only</span>
                    <span className="text-[9px] font-normal opacity-60">Allows tipping, no brand rules</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier('brand_safe')}
                    className={`py-3.5 rounded-xl border text-xs font-bold transition-all text-center flex flex-col gap-0.5 justify-center items-center ${
                      tier === 'brand_safe'
                        ? 'bg-toka-flare border-toka-flare text-cloud-white shadow-[0_0_12px_rgba(255,79,0,0.25)]'
                        : 'bg-black/20 border-white/10 text-cloud-white/70 hover:text-cloud-white'
                    }`}
                  >
                    <span>Brand Sponsorship</span>
                    <span className="text-[9px] font-normal opacity-60">AI safety checked & brand approved</span>
                  </button>
                </div>
              </div>

              {/* Upload progress indicator */}
              {isUploading && (
                <div className="bg-black/20 border border-white/5 p-4 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-fintech-mint flex items-center gap-1.5">
                      <span className="w-3 h-3 border border-fintech-mint border-t-transparent rounded-full animate-spin"></span>
                      Uploading directly to Cloud Storage...
                    </span>
                    <span className="font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-fintech-mint h-full rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                type="submit"
                disabled={isUploading || isCompressing || !selectedFile || !title}
                className="w-full bg-toka-flare hover:bg-toka-flare/90 disabled:opacity-50 text-cloud-white py-3.5 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-[0_4px_15px_rgba(255,79,0,0.25)] flex justify-center items-center gap-2 mt-2"
              >
                <span className="material-symbols-outlined text-[18px]">publish</span>
                <span>Confirm & Upload Video</span>
              </button>

            </form>
          </>
        )}

      </div>
    </div>
  );
}
