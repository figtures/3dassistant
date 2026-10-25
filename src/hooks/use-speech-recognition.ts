"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface UseSpeechRecognitionOptions {
  onResult?: (transcript: string) => void;
  onInterim?: (transcript: string) => void;
  lang?: string;
}

export function useSpeechRecognition({
  onResult,
  onInterim,
  lang = "tr-TR",
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<InstanceType<
    typeof window.SpeechRecognition | typeof window.webkitSpeechRecognition
  > | null>(null);
  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);

  useEffect(() => {
    onResultRef.current = onResult;
    onInterimRef.current = onInterim;
  }, [onResult, onInterim]);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.lang = lang;
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let full = "";
        for (let i = 0; i < event.results.length; i++) {
          full += event.results[i][0].transcript;
        }
        full = full.trim();
        setTranscript(full);

        const last = event.results[event.results.length - 1];
        if (last?.isFinal) {
          onResultRef.current?.(full);
        } else {
          onInterimRef.current?.(full);
        }
      };

      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => {
        setIsListening(false);
      };
      recognitionRef.current = recognition;
    }
  }, [lang]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      setTranscript("");
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        /* already started */
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => setTranscript(""), []);

  return {
    isListening,
    isSupported,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
    setTranscript,
  };
}
