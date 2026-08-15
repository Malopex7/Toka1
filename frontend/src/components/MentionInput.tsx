"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

interface UserSuggestion {
  _id: string;
  username: string;
  role: 'creator' | 'brand' | 'moderator' | 'fan';
  isBrandSafeVerified: boolean;
}

interface MentionInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  as?: 'input' | 'textarea';
  rows?: number;
  maxLength?: number;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  popoverPlacement?: 'top' | 'bottom';
}

export default function MentionInput({
  value,
  onChange,
  placeholder = '',
  className = '',
  as = 'input',
  rows = 3,
  maxLength,
  onKeyDown,
  disabled = false,
  autoFocus = false,
  popoverPlacement = 'top'
}: MentionInputProps) {
  const { firebaseUser, isAuthenticated } = useAuth();
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeMentionQuery, setActiveMentionQuery] = useState<string | null>(null);
  const [mentionStartIndex, setMentionStartIndex] = useState<number>(-1);
  const [isSearching, setIsSearching] = useState(false);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect mention token near cursor position
  const checkForMention = useCallback((text: string, cursorPosition: number) => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    // Matches @ preceded by start of string or whitespace, followed by alphanumeric/underscore
    const match = textBeforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_]*)$/);

    if (match) {
      const query = match[1]; // The text after @
      const atSymbolIndex = textBeforeCursor.lastIndexOf('@');
      setActiveMentionQuery(query);
      setMentionStartIndex(atSymbolIndex);
      setIsOpen(true);
    } else {
      setIsOpen(false);
      setActiveMentionQuery(null);
      setMentionStartIndex(-1);
      setSuggestions([]);
    }
  }, []);

  // Fetch suggestions from backend API
  useEffect(() => {
    if (!isOpen || activeMentionQuery === null || !isAuthenticated || !firebaseUser) {
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const token = await firebaseUser.getIdToken();
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/users/search?q=${encodeURIComponent(activeMentionQuery)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        const data = await res.json();
        if (data.status === 'success') {
          setSuggestions(data.data.users || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Failed to query user suggestions', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isOpen, activeMentionQuery, isAuthenticated, firebaseUser]);

  // Insert selected user into input value
  const handleSelectUser = (user: UserSuggestion) => {
    if (mentionStartIndex === -1 || !inputRef.current) return;

    const cursorPosition = inputRef.current.selectionStart || value.length;
    const textBeforeMention = value.slice(0, mentionStartIndex);
    const textAfterCursor = value.slice(cursorPosition);

    const newValue = `${textBeforeMention}@${user.username} ${textAfterCursor}`;
    onChange(newValue);

    setIsOpen(false);
    setActiveMentionQuery(null);
    setSuggestions([]);

    // Restore focus and position cursor right after the mention
    const newCursorPos = textBeforeMention.length + user.username.length + 2;
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 10);
  };

  // Keyboard navigation inside suggestions list
  const handleInternalKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (isOpen && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          handleSelectUser(suggestions[selectedIndex]);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    onChange(newVal);
    const cursorPos = e.target.selectionStart || newVal.length;
    checkForMention(newVal, cursorPos);
  };

  const handleInputClickOrKeyUp = (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const cursorPos = target.selectionStart || value.length;
    checkForMention(value, cursorPos);
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full">
      {as === 'textarea' ? (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={value}
          onChange={handleInputChange}
          onClick={handleInputClickOrKeyUp}
          onKeyUp={handleInputClickOrKeyUp}
          onKeyDown={handleInternalKeyDown}
          placeholder={placeholder}
          className={className}
          rows={rows}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      ) : (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={value}
          onChange={handleInputChange}
          onClick={handleInputClickOrKeyUp}
          onKeyUp={handleInputClickOrKeyUp}
          onKeyDown={handleInternalKeyDown}
          placeholder={placeholder}
          className={className}
          maxLength={maxLength}
          disabled={disabled}
          autoFocus={autoFocus}
        />
      )}

      {/* Mention Auto-Complete Popover */}
      {isOpen && (suggestions.length > 0 || isSearching) && (
        <div
          ref={popoverRef}
          className={`absolute left-0 right-0 z-50 bg-shaded-canopy/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto no-scrollbar ${
            popoverPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="px-3 py-1.5 border-b border-white/10 flex items-center justify-between text-[10px] text-cloud-white/40 font-mono uppercase tracking-wider select-none">
            <span>Tag Users</span>
            {isSearching && <span className="animate-spin material-symbols-outlined text-[12px]">progress_activity</span>}
          </div>

          {suggestions.length === 0 && isSearching ? (
            <div className="py-4 text-center text-xs text-cloud-white/40 font-mono">
              Searching creators...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="py-4 text-center text-xs text-cloud-white/40 font-mono">
              No matching users found
            </div>
          ) : (
            <div className="p-1 flex flex-col gap-0.5">
              {suggestions.map((user, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={user._id}
                    type="button"
                    onClick={() => handleSelectUser(user)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer select-none ${
                      isSelected ? 'bg-toka-flare/20 text-cloud-white' : 'text-cloud-white/80 hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-toka-flare to-orange-700 flex items-center justify-center font-bold text-[10px] text-cloud-white shrink-0">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="font-bold text-xs truncate">@{user.username}</span>
                        {user.isBrandSafeVerified && (
                          <span className="material-symbols-outlined text-fintech-mint text-[14px] shrink-0" title="Verified">
                            verified
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[9px] px-2 py-0.5 rounded-full font-mono uppercase font-bold tracking-wider shrink-0 ${
                        user.role === 'brand'
                          ? 'bg-amber-400/10 text-amber-400 border border-amber-400/30'
                          : 'bg-white/10 text-cloud-white/60'
                      }`}
                    >
                      {user.role}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
