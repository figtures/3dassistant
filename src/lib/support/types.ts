export type SupportCategory = "bridge" | "billing" | "order" | "other";

export type ClientDiagnostics = {
  route?: string;
  userAgent?: string;
  viewport?: { width: number; height: number };
  timezone?: string;
  locale?: string;
  clientErrors?: Array<{ at: string; message: string; source?: string }>;
  failedFetches?: Array<{ at: string; path: string; status: number }>;
  bridgeBundleCode?: string;
  errorFingerprints?: string[];
};

export type SupportReportDiagnostics = ClientDiagnostics & {
  userId?: string;
  userEmail?: string;
  planKey?: string;
  planName?: string;
  appVersion?: string;
  siteUrl?: string;
  machine?: {
    id: string;
    name?: string;
    vendor?: string;
    bridgeBinding?: {
      lastPushAt: string | null;
      deviceSerial?: string;
      lanHost?: string;
    } | null;
    lastTelemetryAt?: string | null;
  };
  bridge?: {
    id: string;
    label?: string;
    lastSeenAt: string | null;
    agentVersion?: string | null;
  } | null;
  linkedBridgeBundleId?: string;
  linkedBridgeBundleCode?: string;
  errorFingerprints?: string[];
};

export type SupportAttachmentMeta = {
  path: string;
  name: string;
  contentType: string;
  sizeBytes: number;
};
