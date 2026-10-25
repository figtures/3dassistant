"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const { overflow, paddingRight } = document.body.style;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = overflow;
      document.body.style.paddingRight = paddingRight;
    };
  }, [locked]);
}

export function Modal({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <ModalContext.Provider value={{ open, setOpen: onOpenChange }}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
      >
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          onClick={() => onOpenChange(false)}
          aria-hidden
        />
        <div className="relative z-50 flex w-full max-w-[1080px] max-h-[min(880px,calc(100dvh-2rem))] flex-col items-center animate-fade-up sm:max-h-[min(880px,calc(100dvh-3rem))]">
          {children}
        </div>
      </div>
    </ModalContext.Provider>
  );
}

export function ModalContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 max-h-full w-full flex-col overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950 shadow-2xl",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ModalHeader({
  title,
  subtitle,
  onClose,
}: {
  title: string;
  subtitle?: string;
  onClose?: () => void;
}) {
  const ctx = useContext(ModalContext);

  return (
    <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800/80 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-4">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold tracking-tight text-zinc-50">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose ?? (() => ctx?.setOpen(false))}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
        aria-label="Kapat"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

export function ModalBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6",
        className
      )}
    >
      {children}
    </div>
  );
}

export function ModalFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-zinc-800/80 bg-zinc-950/95 px-4 py-3 sm:px-6 sm:py-3.5",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function useModal() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  return { open, setOpen, toggle };
}
