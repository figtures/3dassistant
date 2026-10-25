"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  confidenceLabel,
  type VoiceFieldConfidence,
} from "@/lib/voice-confidence";
import type { VoiceParseSource } from "@/lib/voice-parse-client";
import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/utils";

const toneMap = {
  high: "success" as const,
  medium: "warning" as const,
  low: "default" as const,
};

interface VoiceParsePanelProps {
  isSupported: boolean;
  isListening: boolean;
  voiceText: string;
  onVoiceTextChange?: (text: string) => void;
  onVoiceBlur?: (text: string) => void;
  onToggleListen: () => void;
  placeholder?: string;
  matched?: string[];
  fieldConfidence?: VoiceFieldConfidence;
  parseSource?: VoiceParseSource;
  className?: string;
}

export function VoiceParsePanel({
  isSupported,
  isListening,
  voiceText,
  onVoiceTextChange,
  onVoiceBlur,
  onToggleListen,
  placeholder = "Türkçe konuşun veya yazın…",
  matched = [],
  fieldConfidence = {},
  parseSource,
  className,
}: VoiceParsePanelProps) {
  if (!isSupported) {
    return (
      <p className={cn("rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-400", className)}>
        Bu tarayıcı sesli girişi desteklemiyor. Chrome veya Edge kullanın.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-sky-500/25 bg-gradient-to-r from-sky-500/10 to-transparent p-3",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-sky-400">Sesli giriş</span>
              {parseSource === "llm" && (
                <Badge variant="success" className="text-[10px] px-1.5 py-0">
                  LLM
                </Badge>
              )}
              {parseSource === "rule" && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0">
                  Kural
                </Badge>
              )}
            </div>
            {isListening && (
              <span className="text-[11px] font-medium text-red-400 animate-pulse">Dinleniyor…</span>
            )}
          </div>
          <textarea
            value={voiceText}
            onChange={(e) => onVoiceTextChange?.(e.target.value)}
            onBlur={(e) => onVoiceBlur?.(e.target.value)}
            placeholder={placeholder}
            rows={2}
            className="w-full min-h-[52px] resize-none rounded-xl border border-sky-500/20 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-sky-500/40"
          />
          {(matched.length > 0 || Object.keys(fieldConfidence).length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {matched.map((m) => {
                const key = m.split(" (")[0].trim();
                const level = fieldConfidence[key] ?? (m.includes("(") ? "low" : "high");
                return (
                  <Badge key={m} variant={toneMap[level]} className="text-[10px] gap-1">
                    {m}
                    <span className="opacity-75">· {confidenceLabel(level)}</span>
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant={isListening ? "default" : "secondary"}
          size="sm"
          className="shrink-0 self-end sm:self-start gap-2"
          onClick={onToggleListen}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {isListening ? "Durdur" : "Dinle"}
        </Button>
      </div>
    </div>
  );
}
