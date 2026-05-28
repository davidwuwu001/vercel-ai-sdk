"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square } from "lucide-react";
import { VoiceClient, type VoiceRecognitionState } from "@/lib/voice/client";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  onError?: (error: string) => void;
  language?: string;
  continuous?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_CLASSES: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "size-10",
  md: "size-14",
  lg: "size-20",
  xl: "size-28",
};

const ICON_SIZES: Record<"sm" | "md" | "lg" | "xl", number> = {
  sm: 16,
  md: 24,
  lg: 32,
  xl: 40,
};

export function VoiceInputButton({
  onTranscript,
  onError,
  language = "zh-CN",
  continuous = false,
  size = "xl",
  className = "",
}: VoiceInputButtonProps) {
  const [state, setState] = useState<VoiceRecognitionState>("idle");
  const [isSupported, setIsSupported] = useState<boolean | null>(() => VoiceClient.isRecognitionSupported());
  const clientRef = useRef<VoiceClient | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    const initClient = () => {
      if (!isSupported) return;

      clientRef.current = new VoiceClient({
        lang: language,
        continuous,
        interimResults: true,
      });
    };

    initClient();

    return () => {
      clientRef.current?.destroy();
    };
  }, [isSupported, language, continuous]);

  const handleStart = useCallback(() => {
    if (!clientRef.current || isListeningRef.current) return;

    setState("listening");
    isListeningRef.current = true;

    clientRef.current.startListening(
      (text, isFinal) => {
        if (isFinal) {
          onTranscript(text);
          setState("idle");
          isListeningRef.current = false;
        } else {
          setState("processing");
        }
      },
      (error) => {
        onError?.(error);
        setState("idle");
        isListeningRef.current = false;
      }
    );
  }, [onTranscript, onError]);

  const handleStop = useCallback(() => {
    if (!clientRef.current) return;
    clientRef.current.stopListening();
    setState("idle");
    isListeningRef.current = false;
  }, []);

  const handleClick = () => {
    if (state === "listening" || isListeningRef.current) {
      handleStop();
    } else {
      handleStart();
    }
  };

  if (isSupported === null) {
    return (
      <button
        className={`${SIZE_CLASSES[size]} rounded-full border-2 border-dashed border-[var(--border)] bg-transparent flex items-center justify-center ${className}`}
        disabled
      >
        <Mic className="text-[var(--text-subtle)]" size={ICON_SIZES[size]} />
      </button>
    );
  }

  if (!isSupported) {
    return (
      <button
        className={`${SIZE_CLASSES[size]} rounded-full border-2 border-[var(--border)] bg-[var(--panel-soft)] flex items-center justify-center ${className}`}
        disabled
        title="Speech recognition not supported in this browser"
      >
        <MicOff className="text-[var(--text-subtle)]" size={ICON_SIZES[size]} />
      </button>
    );
  }

  const isListening = state === "listening";
  const isProcessing = state === "processing";

  return (
    <button
      onClick={handleClick}
      className={`
        ${SIZE_CLASSES[size]} rounded-full flex items-center justify-center
        transition-all duration-200
        ${
          isListening
            ? "border-2 border-[var(--hot)] bg-[var(--hot)]/20 shadow-[0_0_30px_rgba(232,100,247,0.4)]"
            : isProcessing
            ? "border-2 border-[var(--accent-strong)] bg-[var(--accent-strong)]/20 shadow-[0_0_30px_rgba(34,211,238,0.4)]"
            : "border-2 border-[var(--border-strong)] bg-[var(--panel-soft)] hover:bg-[var(--panel-tint)]"
        }
        ${className}
      `}
      title={isListening ? "Stop listening" : "Start voice input"}
    >
      {isListening ? (
        <Square className="text-[var(--hot)]" size={ICON_SIZES[size] * 0.5} />
      ) : (
        <Mic
          className={`${
            isProcessing ? "text-[var(--accent-strong)]" : "text-[var(--accent)]"
          }`}
          size={ICON_SIZES[size]}
        />
      )}
    </button>
  );
}

interface VoiceWaveformProps {
  isActive: boolean;
  barCount?: number;
  className?: string;
}

function WaveformBar({ isActive, index }: { isActive: boolean; index: number }) {
  const height = isActive ? `${20 + ((index * 7) % 24)}px` : "8px";
  
  return (
    <div
      className={`
        w-1 rounded-full transition-all duration-200
        ${
          isActive
            ? "bg-[var(--accent)] animate-[voice-bar_0.6s_ease-in-out_infinite]"
            : "bg-[var(--text-subtle)]/30"
        }
      `}
      style={{
        height,
        animationDelay: isActive ? `${index * 0.1}s` : undefined,
      }}
    />
  );
}

export function VoiceWaveform({
  isActive,
  barCount = 5,
  className = "",
}: VoiceWaveformProps) {
  return (
    <div className={`flex items-center justify-center gap-1 ${className}`}>
      {Array.from({ length: barCount }).map((_, i) => (
        <WaveformBar key={i} isActive={isActive} index={i} />
      ))}
    </div>
  );
}
