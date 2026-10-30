"use client";

import type { PlanKey } from "@/lib/billing/plans";

type PaddleGlobal = {
  Environment: { set: (env: string) => void };
  Initialize: (opts: {
    token: string;
    eventCallback?: (event: { name?: string }) => void;
  }) => void;
  Checkout: {
    open: (opts: {
      transactionId: string;
      settings?: { displayMode?: "overlay"; locale?: string; theme?: "dark" | "light" };
    }) => void;
  };
};

declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

const PADDLE_TOKEN = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
const PADDLE_ENV =
  process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox";

let paddleInitialized = false;
let onCheckoutCompleted: (() => void) | null = null;

export function setPaddleCheckoutCompletedHandler(handler: (() => void) | null) {
  onCheckoutCompleted = handler;
}

export function initPaddleCheckout(onReady: () => void) {
  const paddle = window.Paddle;
  if (!paddle || !PADDLE_TOKEN) return;
  if (!paddleInitialized) {
    if (PADDLE_ENV === "sandbox") paddle.Environment.set("sandbox");
    paddle.Initialize({
      token: PADDLE_TOKEN,
      eventCallback: (event) => {
        if (event.name === "checkout.completed") onCheckoutCompleted?.();
      },
    });
    paddleInitialized = true;
  }
  onReady();
}

export function openPaddleCheckout(transactionId: string) {
  if (!window.Paddle) {
    throw new Error("Ödeme penceresi yüklenemedi, sayfayı yenileyip tekrar deneyin");
  }
  window.Paddle.Checkout.open({
    transactionId,
    settings: { displayMode: "overlay", locale: "tr", theme: "dark" },
  });
}

export function isPaddleClientConfigured(): boolean {
  return Boolean(PADDLE_TOKEN?.trim());
}

export const AWAIT_WEBHOOK_MS = 90_000;
export const AWAIT_POLL_MS = 3_000;

export type { PlanKey };
