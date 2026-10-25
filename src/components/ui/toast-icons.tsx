"use client";

import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Loader2,
} from "lucide-react";

/** Sonner toast ikonları — tutarlı boyut ve stroke */
export const toastIcons = {
  success: <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={2.25} />,
  error: <XCircle className="h-4 w-4 text-red-400" strokeWidth={2.25} />,
  warning: <AlertCircle className="h-4 w-4 text-amber-400" strokeWidth={2.25} />,
  info: <Info className="h-4 w-4 text-sky-400" strokeWidth={2.25} />,
  loading: <Loader2 className="h-4 w-4 animate-spin text-zinc-400" strokeWidth={2.25} />,
};
