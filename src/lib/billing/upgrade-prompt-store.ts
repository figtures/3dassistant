"use client";

import { create } from "zustand";
import type { BillableFeature } from "@/lib/billing/features";

export type UpgradePromptPayload = {
  feature: BillableFeature;
  message?: string;
};

type UpgradePromptState = {
  open: boolean;
  payload: UpgradePromptPayload | null;
  show: (payload: UpgradePromptPayload) => void;
  close: () => void;
};

export const useUpgradePromptStore = create<UpgradePromptState>((set) => ({
  open: false,
  payload: null,
  show: (payload) => set({ open: true, payload }),
  close: () => set({ open: false, payload: null }),
}));
