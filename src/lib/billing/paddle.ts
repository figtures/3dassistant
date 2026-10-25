const REQUEST_TIMEOUT_MS = 15_000;

export function paddleEnvironment(): "sandbox" | "production" {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox";
}

function apiBase(): string {
  return paddleEnvironment() === "production"
    ? "https://api.paddle.com"
    : "https://sandbox-api.paddle.com";
}

export function isPaddleConfigured(): boolean {
  return Boolean(
    process.env.PADDLE_API_KEY?.trim() &&
      process.env.PADDLE_WEBHOOK_SECRET?.trim() &&
      process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim()
  );
}

export class PaddleApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message);
    this.name = "PaddleApiError";
  }
}

async function paddleRequest<T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown) {
  const key = process.env.PADDLE_API_KEY?.trim();
  if (!key) throw new PaddleApiError("Ödeme sistemi yapılandırılmadı", 503, null);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Paddle-Version": "1",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      data?: T;
      error?: { code?: string; detail?: string };
    };
    if (!res.ok || json.data === undefined) {
      console.error("[paddle]", method, path, res.status, json.error?.code, json.error?.detail);
      throw new PaddleApiError(
        "Ödeme sağlayıcısına ulaşılamadı, lütfen tekrar deneyin",
        res.status,
        json.error?.code ?? null
      );
    }
    return json.data;
  } finally {
    clearTimeout(timer);
  }
}

export async function createCheckoutTransaction(input: {
  priceId: string;
  userId: string;
  customerId: string | null;
}): Promise<{ id: string }> {
  const data = await paddleRequest<{ id: string }>("POST", "/transactions", {
    items: [{ price_id: input.priceId, quantity: 1 }],
    collection_mode: "automatic",
    custom_data: { user_id: input.userId },
    ...(input.customerId ? { customer_id: input.customerId } : {}),
  });
  return { id: data.id };
}

export async function changeSubscriptionPrice(subscriptionId: string, priceId: string) {
  await paddleRequest("PATCH", `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    items: [{ price_id: priceId, quantity: 1 }],
    proration_billing_mode: "prorated_immediately",
  });
}

export async function createPortalSession(
  customerId: string,
  subscriptionIds: string[]
): Promise<string> {
  const data = await paddleRequest<{ urls: { general: { overview: string } } }>(
    "POST",
    `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
    subscriptionIds.length ? { subscription_ids: subscriptionIds } : {}
  );
  return data.urls.general.overview;
}

export type PaddlePrice = {
  id: string;
  unit_price: { amount: string; currency_code: string };
  billing_cycle: { interval: "day" | "week" | "month" | "year"; frequency: number } | null;
};

export async function listPrices(ids: string[]): Promise<PaddlePrice[]> {
  if (ids.length === 0) return [];
  return paddleRequest<PaddlePrice[]>(
    "GET",
    `/prices?id=${ids.map(encodeURIComponent).join(",")}&per_page=${ids.length}`
  );
}
