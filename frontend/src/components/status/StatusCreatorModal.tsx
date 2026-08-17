"use client";
import React, { useState, useRef } from 'react';
import { useStatusStore, StatusSticker, StatusAudio } from '@/store/useStatusStore';
import { useAuth } from '@/context/AuthContext';
import { 
  X, 
  Type, 
  Image as ImageIcon, 
  Video, 
  Music, 
  Sparkles, 
  Smile, 
  Upload, 
  Check, 
  Trash2,
  Play,
  Pause,
  AlertCircle
} from 'lucide-react';

const GRADIENT_PRESETS = [
  { id: 'flare-sunset', name: 'Toka Flare', class: 'from-orange-600 via-amber-600 to-rose-700' },
  { id: 'boma-mesh', name: 'Midnight Boma', class: 'from-zinc-950 via-zinc-900 to-zinc-950' },
  { id: 'fintech-mint', name: 'Fintech Mint', class: 'from-emerald-700 via-teal-700 to-cyan-900' },
  { id: 'african-gold', name: 'African Gold', class: 'from-amber-500 via-yellow-600 to-orange-700' },
  { id: 'kigali-blue', name: 'Kigali Blue', class: 'from-blue-700 via-indigo-800 to-purple-900' },
  { id: 'afro-purple', name: 'Afro Purple', class: 'from-purple-800 via-fuchsia-700 to-pink-700' }
];

const AFRICAN_STICKER_PRESETS: Array<Omit<StatusSticker, 'posX' | 'posY' | 'scale' | 'rotation'>> = [
  { type: 'slang', text: 'Chai! 🔥', subtext: 'Big energy', variant: 'flare' },
  { type: 'slang', text: 'Lekker ✨', subtext: 'Top tier vibes', variant: 'mint' },
  { type: 'slang', text: 'Sharp! 🤙', subtext: 'All good', variant: 'gold' },
  { type: 'cultural', text: 'Ubuntu 🌍', subtext: 'Together we rise', variant: 'dark' },
  { type: 'cultural', text: 'Amapiano Vibes 🎹', subtext: 'Log drum season', variant: 'flare' },
  { type: 'slang', text: 'Wahala Free 🚫', subtext: 'Peace only', variant: 'mint' },
  { type: 'slang', text: 'Oya Now! 🚀', subtext: "Let's move", variant: 'gold' },
  { type: 'cultural', text: 'Ngiyabonga 🙏', subtext: 'Pure gratitude', variant: 'dark' }
];

const AUDIO_PRESETS: StatusAudio[] = [
  { title: 'Amapiano Piano Groove', artist: 'Toka Originals', audioUrl: 'https://assets.mixkit.co/active_storage/sfx/2874/2874-preview.mp3', duration: 15 },
  { title: 'Afrobeats Highlife Sun', artist: 'Lagos Collective', audioUrl: 'https://assets.mixkit.co/active_storage/sfx/2872/2872-preview.mp3', duration: 15 },
  { title: 'Gqom Pulse Durban', artist: 'Mzansi Beatlab', audioUrl: 'https://assets.mixkit.co/active_storage/sfx/2870/2870-preview.mp3', duration: 15 }
];

export default function StatusCreatorModal() {
  const { isCreatorOpen, closeCreator, fetchStatusFeed } = useStatusStore();
  const { mongooseUser } = useAuth();

  const [mode, setMode] = useState<'text' | 'media'>('text');
  
  // Text Mode State
  const [textContent, setTextContent] = useState<string>('');
  const [selectedGradient, setSelectedGradient] = useState<string>(GRADIENT_PRESETS[0].class);
  const [fontFamily, setFontFamily] = useState<'sans' | 'serif' | 'mono'>('sans');
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('center');

  // Media Mode State
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [caption, setCaption] = useState<string>('');

  // Creative Tools
  const [activeStickers, setActiveStickers] = useState<StatusSticker[]>([]);
  const [showStickerPicker, setShowStickerPicker] = useState<boolean>(false);
  const [selectedAudio, setSelectedAudio] = useState<StatusAudio | null>(null);
  const [showAudioPicker, setShowAudioPicker] = useState<boolean>(false);
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);

  // Upload State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isCreatorOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 30 * 1024 * 1024) {
      setErrorMessage('File exceeds 30MB maximum limit');
      return;
    }

    setErrorMessage('');
    setMediaFile(file);
    const isVid = file.type.startsWith('video/');
    setMediaType(isVid ? 'video' : 'image');
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const handleAddSticker = (preset: typeof AFRICAN_STICKER_PRESETS[0]) => {
    const newSticker: StatusSticker = {
      ...preset,
      posX: 50,
      posY: 50 + (activeStickers.length * 10) % 30,
      scale: 1,
      rotation: (activeStickers.length % 2 === 0 ? 1 : -1) * (activeStickers.length * 4)
    };
    setActiveStickers([...activeStickers, newSticker]);
    setShowStickerPicker(false);
  };

  const handleRemoveSticker = (idx: number) => {
    setActiveStickers(activeStickers.filter((_, i) => i !== idx));
  };

  const toggleAudioPreview = (audio: StatusAudio) => {
    if (playingAudioUrl === audio.audioUrl) {
      audioPreviewRef.current?.pause();
      setPlayingAudioUrl(null);
    } else {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.src = audio.audioUrl;
        audioPreviewRef.current.play();
      }
      setPlayingAudioUrl(audio.audioUrl);
    }
  };

  const handlePublish = async () => {
    setErrorMessage('');
    if (mode === 'text' && !textContent.trim()) {
      setErrorMessage('Please enter some text for your status');
      return;
    }
    if (mode === 'media' && !mediaFile) {
      setErrorMessage('Please select a photo or video to upload');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', mode === 'text' ? 'text' : mediaType);

      if (mode === 'text') {
        formData.append('textContent', textContent.trim());
        formData.append(
          'textStyle',
          JSON.stringify({
            backgroundGradient: selectedGradient,
            fontFamily,
            textColor: '#FAFAFA',
            alignment
          })
        );
      } else {
        if (mediaFile) formData.append('media', mediaFile);
        if (caption.trim()) formData.append('caption', caption.trim());
      }

      if (activeStickers.length > 0) {
        formData.append('stickers', JSON.stringify(activeStickers));
      }

      if (selectedAudio) {
        formData.append('audio', JSON.stringify(selectedAudio));
      }

      const { auth } = await import('@/lib/firebase');
      const token = await auth.currentUser?.getIdToken();

      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const res = await fetch(`${apiBase}/api/status/create`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || 'Failed to post status');
      }

      // Success
      await fetchStatusFeed();
      closeCreator();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to publish status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in select-none">
      <div className="relative w-full max-w-md bg-[#09090B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#18181B]/50">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-toka-flare" />
            <h2 className="text-sm font-bold text-cloud-white">Create 24h Story</h2>
          </div>
          <button
            onClick={closeCreator}
            className="w-7 h-7 rounded-full text-cloud-white/60 hover:text-cloud-white hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Recessed Segmented Mode Switch Track */}
        <div className="p-2.5 bg-[#09090B] border-b border-white/10">
          <div className="grid grid-cols-2 bg-[#18181B] p-1 rounded-[0.625rem] border border-white/5 gap-1">
            <button
              onClick={() => setMode('text')}
              className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'text'
                  ? 'bg-toka-flare text-white shadow-sm font-semibold'
                  : 'text-cloud-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Text Story</span>
            </button>
            <button
              onClick={() => setMode('media')}
              className={`py-1.5 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mode === 'media'
                  ? 'bg-toka-flare text-white shadow-sm font-semibold'
                  : 'text-cloud-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Photo / Video</span>
            </button>
          </div>
        </div>

        {/* --- Live Preview Stage (9:16 Aspect Ratio) --- */}
        <div className="relative w-full aspect-[9/16] max-h-[420px] bg-black overflow-hidden flex items-center justify-center border-b border-white/10 mx-auto">
          
          {mode === 'text' ? (
            <div className={`w-full h-full p-6 flex items-center justify-center bg-gradient-to-br ${selectedGradient} relative`}>
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                maxLength={300}
                placeholder="What's on your mind? (Visible to followers for 24h)..."
                className={`w-full bg-transparent resize-none outline-none text-xl font-bold text-cloud-white placeholder-cloud-white/60 drop-shadow-md text-${alignment} ${
                  fontFamily === 'serif' ? 'font-serif' : fontFamily === 'mono' ? 'font-mono' : 'font-sans'
                }`}
                rows={5}
              />
            </div>
          ) : (
            <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
              {mediaPreviewUrl ? (
                mediaType === 'video' ? (
                  <video src={mediaPreviewUrl} autoPlay loop muted className="w-full h-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={mediaPreviewUrl} alt="Upload preview" className="w-full h-full object-cover" />
                )
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-2 text-cloud-white/50 cursor-pointer p-6 text-center hover:text-cloud-white transition-colors"
                >
                  <Upload className="w-10 h-10 text-toka-flare" />
                  <span className="text-xs font-semibold">Tap to select photo or short video (max 30s)</span>
                  <span className="text-[10px] text-cloud-white/40">MP4, WEBM, JPG, PNG up to 30MB</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}

          {/* Render Active Stickers onto Live Preview */}
          {activeStickers.map((stk, idx) => (
            <div
              key={idx}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto group cursor-pointer"
              style={{
                left: `${stk.posX}%`,
                top: `${stk.posY}%`,
                transform: `translate(-50%, -50%) rotate(${stk.rotation}deg)`
              }}
            >
              <div className="px-3 py-1.5 rounded-xl bg-toka-flare text-white font-extrabold text-xs shadow-lg flex items-center gap-1.5">
                <span>{stk.text}</span>
                <button
                  onClick={() => handleRemoveSticker(idx)}
                  className="p-0.5 rounded-full bg-black/40 hover:bg-black text-white"
                  title="Remove sticker"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}

          {/* Attached Audio Badge on Preview */}
          {selectedAudio && (
            <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] text-cloud-white">
              <Music className="w-3 h-3 text-toka-flare animate-pulse" />
              <span className="truncate max-w-[160px]">{selectedAudio.title}</span>
              <button
                onClick={() => setSelectedAudio(null)}
                className="hover:text-rose-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* --- Customization Controls Panel --- */}
        <div className="p-3.5 space-y-3 bg-shaded-canopy/40 overflow-y-auto max-h-48 no-scrollbar">
          
          {/* TEXT MODE CONTROLS */}
          {mode === 'text' && (
            <div className="space-y-2.5">
              {/* Gradient Selector */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {GRADIENT_PRESETS.map((grad) => (
                  <button
                    key={grad.id}
                    onClick={() => setSelectedGradient(grad.class)}
                    className={`w-7 h-7 rounded-full bg-gradient-to-br ${grad.class} flex-shrink-0 flex items-center justify-center transition-all ${
                      selectedGradient === grad.class ? 'ring-2 ring-cloud-white scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={grad.name}
                  >
                    {selectedGradient === grad.class && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                ))}
              </div>

              {/* Typography Styles */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-[#09090B] p-1 rounded-[0.625rem] border border-white/5 text-xs">
                  <button
                    onClick={() => setFontFamily('sans')}
                    className={`px-2 py-1 rounded-md transition-all cursor-pointer ${fontFamily === 'sans' ? 'bg-toka-flare text-white font-bold' : 'text-white/60 hover:text-white'}`}
                  >
                    Sans
                  </button>
                  <button
                    onClick={() => setFontFamily('serif')}
                    className={`px-2 py-1 rounded-md font-serif transition-all cursor-pointer ${fontFamily === 'serif' ? 'bg-toka-flare text-white font-bold' : 'text-white/60 hover:text-white'}`}
                  >
                    Serif
                  </button>
                  <button
                    onClick={() => setFontFamily('mono')}
                    className={`px-2 py-1 rounded-md font-mono transition-all cursor-pointer ${fontFamily === 'mono' ? 'bg-toka-flare text-white font-bold' : 'text-white/60 hover:text-white'}`}
                  >
                    Mono
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-[#09090B] p-1 rounded-[0.625rem] border border-white/5 text-xs">
                  {(['left', 'center', 'right'] as const).map((align) => (
                    <button
                      key={align}
                      onClick={() => setAlignment(align)}
                      className={`px-2 py-1 rounded-md capitalize transition-all cursor-pointer ${alignment === align ? 'bg-toka-flare text-white font-bold' : 'text-white/60 hover:text-white'}`}
                    >
                      {align}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MEDIA MODE CONTROLS */}
          {mode === 'media' && (
            <div className="space-y-2">
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={150}
                placeholder="Add a caption..."
                className="w-full bg-[#09090B] px-3 py-2 rounded-[0.625rem] text-xs text-cloud-white placeholder-cloud-white/40 border border-white/10 outline-none focus:border-toka-flare"
              />
              {mediaPreviewUrl && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-toka-flare hover:underline font-medium cursor-pointer"
                >
                  Change media file
                </button>
              )}
            </div>
          )}

          {/* Creative Suite Actions: Slang Stickers & Music Pickers */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/5">
            <button
              onClick={() => {
                setShowStickerPicker(!showStickerPicker);
                setShowAudioPicker(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-midnight-boma hover:bg-white/10 border border-white/10 text-xs text-cloud-white/90 flex items-center gap-1.5"
            >
              <Smile className="w-3.5 h-3.5 text-amber-400" />
              <span>African Stickers</span>
            </button>

            <button
              onClick={() => {
                setShowAudioPicker(!showAudioPicker);
                setShowStickerPicker(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-midnight-boma hover:bg-white/10 border border-white/10 text-xs text-cloud-white/90 flex items-center gap-1.5"
            >
              <Music className="w-3.5 h-3.5 text-fintech-mint" />
              <span>{selectedAudio ? 'Audio Attached' : 'Attach Sound'}</span>
            </button>
          </div>

          {/* African Slang Stickers Picker Drawer */}
          {showStickerPicker && (
            <div className="p-2.5 rounded-xl bg-midnight-boma border border-white/10 grid grid-cols-2 gap-2 animate-in fade-in">
              {AFRICAN_STICKER_PRESETS.map((stk, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAddSticker(stk)}
                  className="p-2 rounded-lg bg-shaded-canopy hover:bg-white/10 text-left flex flex-col border border-white/5 transition-all"
                >
                  <span className="text-xs font-bold text-cloud-white">{stk.text}</span>
                  <span className="text-[10px] text-cloud-white/60">{stk.subtext}</span>
                </button>
              ))}
            </div>
          )}

          {/* Sound Snippets Picker Drawer */}
          {showAudioPicker && (
            <div className="p-2.5 rounded-xl bg-midnight-boma border border-white/10 space-y-2 animate-in fade-in">
              {AUDIO_PRESETS.map((aud, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-lg bg-shaded-canopy border border-white/5"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAudioPreview(aud)}
                      className="w-7 h-7 rounded-full bg-toka-flare text-white flex items-center justify-center"
                    >
                      {playingAudioUrl === aud.audioUrl ? (
                        <Pause className="w-3.5 h-3.5" />
                      ) : (
                        <Play className="w-3.5 h-3.5 ml-0.5" />
                      )}
                    </button>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-cloud-white">{aud.title}</span>
                      <span className="text-[10px] text-cloud-white/60">{aud.artist}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedAudio(aud);
                      setShowAudioPicker(false);
                    }}
                    className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-fintech-mint hover:text-black text-xs font-semibold text-cloud-white transition-colors"
                  >
                    Select
                  </button>
                </div>
              ))}
            </div>
          )}

          {errorMessage && (
            <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-950/40 p-2 rounded-lg border border-rose-800/30">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-white/10 bg-[#18181B]/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] text-cloud-white/60">
            <span className="w-2 h-2 rounded-full bg-fintech-mint" />
            <span>Followers only • 24h</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={closeCreator}
              className="px-3.5 py-1.5 rounded-[0.625rem] text-xs font-medium text-cloud-white/70 hover:bg-white/10 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handlePublish}
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-[0.625rem] bg-toka-flare hover:bg-toka-flare/90 active:scale-95 text-white text-xs font-bold shadow-lg shadow-toka-flare/20 disabled:opacity-50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : (
                <span>Publish Story</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
