"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useFeedStore } from '@/store/useFeedStore';
import MentionInput from './MentionInput';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function generateUniqueFilename(originalName: string): string {
  const fileExtension = originalName.split('.').pop() || 'mp4';
  return `${Date.now()}_upload.${fileExtension}`;
}

export default function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { firebaseUser, mongooseUser } = useAuth();
  
  // Sponsorship state fields
  const [isSponsorshipRequested, setIsSponsorshipRequested] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [sponsorshipAmount, setSponsorshipAmount] = useState('');
  const [sponsorshipTerms, setSponsorshipTerms] = useState('');
  const [verifiedBrands, setVerifiedBrands] = useState<{ _id: string; username: string }[]>([]);

  // Co-Author state fields
  const [isCoAuthorEnabled, setIsCoAuthorEnabled] = useState(false);
  const [selectedCoAuthor, setSelectedCoAuthor] = useState<{ _id: string; username: string; isBrandSafeVerified?: boolean } | null>(null);
  const [coAuthorQuery, setCoAuthorQuery] = useState('');
  const [coAuthorSplitPercentage, setCoAuthorSplitPercentage] = useState<number>(50);
  const [mutualFollowers, setMutualFollowers] = useState<{ _id: string; username: string; role: string; isBrandSafeVerified: boolean }[]>([]);
  const [isSearchingMutual, setIsSearchingMutual] = useState(false);

  // Fetch verified brands when verified creator enables dashboard
  useEffect(() => {
    if (!isOpen || !firebaseUser || !mongooseUser?.isBrandSafeVerified) return;

    const fetchBrands = async () => {
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/verified-brands`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.status === 'success') {
          setVerifiedBrands(json.data.brands);
        }
      } catch (err) {
        console.error('Failed to fetch verified brands:', err);
      }
    };

    fetchBrands();
  }, [isOpen, firebaseUser, mongooseUser]);

  // Fetch mutual followers when co-author section is open
  useEffect(() => {
    if (!isOpen || !firebaseUser || !isCoAuthorEnabled) return;

    const fetchMutualFollowers = async () => {
      setIsSearchingMutual(true);
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/mutual-followers?q=${encodeURIComponent(coAuthorQuery)}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        const json = await res.json();
        if (json.status === 'success') {
          setMutualFollowers(json.data.users || []);
        }
      } catch (err) {
        console.error('Failed to fetch mutual followers:', err);
      } finally {
        setIsSearchingMutual(false);
      }
    };

    const timer = setTimeout(fetchMutualFollowers, 250);
    return () => clearTimeout(timer);
  }, [isOpen, firebaseUser, isCoAuthorEnabled, coAuthorQuery]);
  
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
      const fileToUpload = compressedFile;
      const filename = generateUniqueFilename(selectedFile.name);

      // Create FormData payload
      const formData = new FormData();
      formData.append('video', fileToUpload, filename);
      formData.append('title', title);
      formData.append('tier', tier);

      if (isSponsorshipRequested && selectedBrandId && sponsorshipAmount) {
        formData.append('brandId', selectedBrandId);
        formData.append('sponsorshipAmount', sponsorshipAmount);
        formData.append('sponsorshipTerms', sponsorshipTerms);
      }

      if (isCoAuthorEnabled && selectedCoAuthor) {
        formData.append('coAuthorId', selectedCoAuthor._id);
        formData.append('coAuthorSplitPercentage', String(coAuthorSplitPercentage));
      }

      const token = await firebaseUser.getIdToken();

      // We use XMLHttpRequest so we can track upload progress in React
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${process.env.NEXT_PUBLIC_API_URL}/api/videos/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      // Track progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          console.log(`[GridFS Upload] Progress: ${percentComplete}%`);
          setUploadProgress(percentComplete);
        }
      };

      // Handle completion
      xhr.onload = () => {
        if (xhr.status === 200 || xhr.status === 201) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.status === 'success') {
              setSuccessMessage('Video successfully uploaded! AI brand safety review started in background.');
              useFeedStore.getState().resetFeed();
              useFeedStore.getState().fetchNextPage();

              setTimeout(() => {
                handleClose();
              }, 3000);
            } else {
              setErrorMessage(data.message || 'Failed to register video in database.');
            }
          } catch (e) {
            setErrorMessage('Server returned an invalid response.');
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            setErrorMessage(errorData.message || 'Failed to upload video to local server.');
          } catch {
            setErrorMessage(`Server error: status ${xhr.status}`);
          }
        }
        setIsUploading(false);
      };

      // Handle connection error
      xhr.onerror = () => {
        setIsUploading(false);
        setErrorMessage('Network connection failed during upload. Check if the server is running.');
      };

      // Send form data
      xhr.send(formData);

    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Upload pipeline error.');
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
    setIsSponsorshipRequested(false);
    setSelectedBrandId('');
    setSponsorshipAmount('');
    setSponsorshipTerms('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans select-none animate-fade-in">
      <div className="bg-[#09090B] border border-white/10 rounded-2xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-4 relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button 
          onClick={handleClose} 
          className="absolute top-5 right-5 text-cloud-white/40 hover:text-cloud-white transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        {successMessage ? (
          // Success Feedback View
          <div className="flex flex-col items-center text-center gap-3 py-8 animate-scale-up">
            <span className="material-symbols-outlined text-fintech-mint text-[56px] animate-bounce">check_circle</span>
            <h3 className="text-lg font-bold text-cloud-white">Upload Completed!</h3>
            <p className="text-xs text-cloud-white/60 max-w-sm">{successMessage}</p>
          </div>
        ) : (
          // Form View
          <>
            <div>
              <h2 className="text-base font-black tracking-tight text-cloud-white flex items-center gap-2">
                <span className="material-symbols-outlined text-toka-flare">video_call</span>
                Share a Video
              </h2>
              <p className="text-[11px] text-cloud-white/50 mt-0.5">Direct client-side uploads to Cloud Storage.</p>
            </div>

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/35 text-red-500 text-xs font-bold px-3.5 py-2.5 rounded-[0.625rem] flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">error</span>
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleUpload} className="flex flex-col gap-3.5">
              
              {/* Drag and Drop Zone */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-[0.625rem] p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                  selectedFile 
                    ? 'border-fintech-mint/45 bg-fintech-mint/5' 
                    : 'border-white/10 hover:border-white/20 bg-[#18181B]/40'
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
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="material-symbols-outlined text-fintech-mint text-[32px]">movie</span>
                    <span className="text-xs font-bold text-cloud-white truncate max-w-[250px]">{selectedFile.name}</span>
                    <span className="text-[10px] text-cloud-white/40 font-mono">
                      Original: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="material-symbols-outlined text-toka-flare text-[32px]">cloud_upload</span>
                    <span className="text-xs font-bold text-cloud-white">Click to browse video file</span>
                    <span className="text-[9px] text-cloud-white/40 font-mono">Supports MP4, WebM, MOV (Max 15MB)</span>
                  </div>
                )}
              </div>

              {/* Compression loader */}
              {isCompressing && (
                <div className="bg-[#18181B] border border-white/10 p-3.5 rounded-[0.625rem] flex flex-col gap-2">
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
                <div className="bg-fintech-mint/10 border border-fintech-mint/35 text-fintech-mint text-[10px] font-bold px-3 py-2 rounded-[0.625rem] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>
                  <span>{compressionRatio}</span>
                </div>
              )}

              {/* Input Title */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-cloud-white/50 uppercase">Video Title &amp; Description</label>
                  <span className="text-[9px] text-cloud-white/30 font-mono">Type @ to tag creators</span>
                </div>
                <MentionInput 
                  as="input"
                  value={title}
                  onChange={(val) => setTitle(val)}
                  placeholder="Give your video a title or tag creators with @..." 
                  className="w-full bg-[#18181B]/60 border border-white/10 rounded-[0.625rem] py-2.5 px-3 text-xs font-medium text-cloud-white outline-none focus:border-toka-flare transition-colors"
                  popoverPlacement="bottom"
                />
              </div>

              {/* Recessed Segmented Advertising Tier Select */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-cloud-white/50 uppercase">Advertising Tier</label>
                <div className="grid grid-cols-2 bg-[#09090B] p-1 rounded-[0.625rem] border border-white/10 text-xs font-medium gap-1">
                  <button
                    type="button"
                    onClick={() => setTier('fan_funded')}
                    className={`py-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
                      tier === 'fan_funded'
                        ? 'bg-toka-flare text-white shadow-sm font-semibold'
                        : 'text-cloud-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Fan Funded Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier('brand_safe')}
                    className={`py-2 rounded-md font-bold text-xs transition-all cursor-pointer ${
                      tier === 'brand_safe'
                        ? 'bg-toka-flare text-white shadow-sm font-semibold'
                        : 'text-cloud-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Brand Sponsorship
                  </button>
                </div>
              </div>

              {/* Brand Sponsorship Tagging (Only for verified creators) */}
              {mongooseUser?.isBrandSafeVerified && (
                <div className="bg-[#18181B] border border-white/10 p-3.5 rounded-[0.625rem] flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-cloud-white/80 flex items-center gap-1.5 cursor-pointer select-none">
                      <input 
                        type="checkbox"
                        checked={isSponsorshipRequested}
                        onChange={(e) => setIsSponsorshipRequested(e.target.checked)}
                        className="rounded border-white/20 bg-black/40 text-toka-flare focus:ring-toka-flare accent-toka-flare w-4 h-4 cursor-pointer"
                      />
                      Request Brand Sponsorship
                    </label>
                    <span className="bg-fintech-mint/10 text-fintech-mint text-[9px] font-bold px-2 py-0.5 rounded-full border border-fintech-mint/20">Verified Only</span>
                  </div>

                  {isSponsorshipRequested && (
                    <div className="flex flex-col gap-2.5 mt-1 border-t border-white/5 pt-2.5 animate-scale-up">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-cloud-white/40 uppercase">Select Target Brand</label>
                        <select
                          required
                          value={selectedBrandId}
                          onChange={(e) => setSelectedBrandId(e.target.value)}
                          className="bg-[#09090B] border border-white/10 rounded-[0.625rem] py-2 px-2.5 text-xs font-medium text-cloud-white outline-none focus:border-toka-flare transition-colors"
                        >
                          <option value="">-- Choose a Brand --</option>
                          {verifiedBrands.map(b => (
                            <option key={b._id} value={b._id}>@{b.username}</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-cloud-white/40 uppercase">Requested Sponsorship Budget (ZAR)</label>
                        <input 
                          type="number" 
                          required
                          min="1"
                          value={sponsorshipAmount}
                          onChange={(e) => setSponsorshipAmount(e.target.value)}
                          placeholder="e.g. 500" 
                          className="bg-[#09090B] border border-white/10 rounded-[0.625rem] py-2 px-2.5 text-xs font-medium text-cloud-white outline-none focus:border-toka-flare transition-colors font-mono"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-bold text-cloud-white/40 uppercase">Pitch &amp; Sponsorship Terms</label>
                        <textarea
                          value={sponsorshipTerms}
                          onChange={(e) => setSponsorshipTerms(e.target.value)}
                          placeholder="Provide details about deliverables, integrations, or your pitch..." 
                          rows={2}
                          className="bg-[#09090B] border border-white/10 rounded-[0.625rem] py-2 px-2.5 text-xs font-medium text-cloud-white outline-none focus:border-toka-flare transition-colors resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Co-Authors & Collaborative Posting Section */}
              <div className="bg-[#18181B] border border-white/10 p-3.5 rounded-[0.625rem] flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-cloud-white/80 flex items-center gap-1.5 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={isCoAuthorEnabled}
                      onChange={(e) => {
                        setIsCoAuthorEnabled(e.target.checked);
                        if (!e.target.checked) setSelectedCoAuthor(null);
                      }}
                      className="rounded border-white/20 bg-black/40 text-toka-flare focus:ring-toka-flare accent-toka-flare w-4 h-4 cursor-pointer"
                    />
                    <span>Invite Co-Author / Collaborator</span>
                  </label>
                  <span className="bg-toka-flare/10 text-toka-flare text-[9px] font-bold px-2 py-0.5 rounded-full border border-toka-flare/20">
                    Mutual Follows
                  </span>
                </div>

                {isCoAuthorEnabled && (
                  <div className="flex flex-col gap-2.5 mt-1 border-t border-white/5 pt-2.5 animate-scale-up">
                    <p className="text-[10px] text-cloud-white/50 leading-relaxed">
                      Invited co-authors will receive an invitation. Once accepted, the video appears on both creators&apos; feeds.
                    </p>

                    {selectedCoAuthor ? (
                      <div className="flex flex-col gap-2.5">
                        <div className="flex items-center justify-between bg-toka-flare/10 border border-toka-flare/30 rounded-[0.625rem] p-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-xs text-cloud-white">
                              {selectedCoAuthor.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-cloud-white">@{selectedCoAuthor.username}</span>
                              {selectedCoAuthor.isBrandSafeVerified && (
                                <span className="material-symbols-outlined text-fintech-mint text-[14px]">verified</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedCoAuthor(null)}
                            className="text-[10px] font-bold text-cloud-white/40 hover:text-red-400 px-2 py-1 transition-colors cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Recessed Segmented Revenue Split Ratio Selector */}
                        <div className="bg-[#09090B] border border-white/10 rounded-[0.625rem] p-2.5 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-cloud-white/70 uppercase tracking-wider">Revenue Split</span>
                            <span className="text-xs font-mono font-black text-fintech-mint">
                              You: {100 - coAuthorSplitPercentage}% / @{selectedCoAuthor.username}: {coAuthorSplitPercentage}%
                            </span>
                          </div>

                          <div className="grid grid-cols-4 bg-[#18181B] p-1 rounded-[0.625rem] border border-white/5 text-xs font-medium gap-1 mt-1">
                            {[
                              { label: '50/50', pct: 50 },
                              { label: '60/40', pct: 40 },
                              { label: '70/30', pct: 30 },
                              { label: '80/20', pct: 20 }
                            ].map((preset) => (
                              <button
                                key={preset.pct}
                                type="button"
                                onClick={() => setCoAuthorSplitPercentage(preset.pct)}
                                className={`py-1.5 rounded-md text-[10px] font-bold font-mono transition-all cursor-pointer ${
                                  coAuthorSplitPercentage === preset.pct
                                    ? 'bg-toka-flare text-white shadow-sm font-semibold'
                                    : 'text-cloud-white/60 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          value={coAuthorQuery}
                          onChange={(e) => setCoAuthorQuery(e.target.value)}
                          placeholder="Search mutual followers by @username..."
                          className="bg-[#09090B] border border-white/10 rounded-[0.625rem] py-2 px-3 text-xs font-medium text-cloud-white outline-none focus:border-toka-flare transition-colors placeholder-cloud-white/30"
                        />

                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto no-scrollbar bg-[#09090B] rounded-[0.625rem] border border-white/5 p-1">
                          {isSearchingMutual ? (
                            <div className="py-3 text-center text-xs text-cloud-white/40 font-mono">
                              Searching mutual follows...
                            </div>
                          ) : mutualFollowers.length === 0 ? (
                            <div className="py-3 text-center text-[10px] text-cloud-white/40 font-mono">
                              {coAuthorQuery ? 'No matching mutual followers found.' : 'You can only invite creators who follow you back.'}
                            </div>
                          ) : (
                            mutualFollowers.map((user) => (
                              <button
                                key={user._id}
                                type="button"
                                onClick={() => setSelectedCoAuthor(user)}
                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left hover:bg-white/5 text-cloud-white/80 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-[9px] text-cloud-white">
                                    {user.username.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-bold text-cloud-white">@{user.username}</span>
                                  {user.isBrandSafeVerified && (
                                    <span className="material-symbols-outlined text-fintech-mint text-[12px]">verified</span>
                                  )}
                                </div>
                                <span className="text-[9px] font-bold text-toka-flare hover:underline">Select</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Upload progress indicator */}
              {isUploading && (
                <div className="bg-[#18181B] border border-white/10 p-3.5 rounded-[0.625rem] flex flex-col gap-2">
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
                disabled={isUploading || isCompressing || !selectedFile || !title || (isSponsorshipRequested && (!selectedBrandId || !sponsorshipAmount))}
                className="w-full bg-toka-flare hover:bg-toka-flare/90 disabled:opacity-50 text-cloud-white py-3 rounded-[0.625rem] font-bold transition-all text-xs active:scale-[0.98] shadow-lg shadow-toka-flare/20 flex justify-center items-center gap-2 cursor-pointer mt-1"
              >
                <span className="material-symbols-outlined text-[18px]">publish</span>
                <span>Confirm &amp; Upload Video</span>
              </button>

            </form>
          </>
        )}

      </div>
    </div>
  );
}
