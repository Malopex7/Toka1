"use client";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { getAnalyticsInstance } from "@/lib/firebase";
import { logEvent } from "firebase/analytics";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    
    // Report crash to Firebase Google Analytics Stability reporting
    try {
      const analytics = getAnalyticsInstance();
      if (analytics) {
        logEvent(analytics, "exception", {
          description: error.message || "Unknown client crash",
          fatal: true,
          componentStack: errorInfo.componentStack || ""
        });
        console.log("[Analytics] Client exception reported successfully");
      }
    } catch (e) {
      console.error("Failed to report exception to Analytics:", e);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-midnight-boma text-cloud-white gap-4 font-sans px-6 text-center select-none">
          <span className="material-symbols-outlined text-[64px] text-red-500 animate-bounce">heart_broken</span>
          <h1 className="text-xl font-black tracking-tight">Oops, something went wrong!</h1>
          <p className="text-xs text-cloud-white/60 max-w-sm">Toka encountered an unexpected client-side crash. We have automatically logged this exception for developer review.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2.5 bg-toka-flare hover:bg-toka-flare/90 rounded-xl font-bold transition-all text-xs active:scale-95 shadow-lg"
          >
            Refresh Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
