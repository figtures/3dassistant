"use client";

import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { machineSlotsLeft, useEntitlements } from "@/hooks/use-entitlements";
import { catalogForVendor } from "@/lib/printer-cloud/device-catalog";
import type { PrinterVendor, VendorProviderInfo } from "@/lib/printer-cloud/types";

export type CloudDevice = {
  id: string;
  name: string;
  model: string | null;
  online: boolean;
  linked?: boolean;
};

type DevicesResult =
  | { devices: CloudDevice[]; vendor: PrinterVendor | null; reconnect: null }
  | { devices: []; vendor: PrinterVendor | null; reconnect: string };

export type CloudConnectStep = "vendor" | "login" | "devices";

export function oauthStartUrl(
  vendor: PrinterVendor,
  opts?: { reconnectAccountId?: string | null; returnConnect?: boolean }
) {
  const params = new URLSearchParams();
  if (opts?.reconnectAccountId) {
    params.set("reconnect", opts.reconnectAccountId);
  }
  if (opts?.returnConnect) {
    params.set("return", "connect");
  }
  const q = params.toString();
  return `/api/integrations/printers/oauth/${vendor}/start${q ? `?${q}` : ""}`;
}

type UseCloudConnectOptions = {
  initialAccountId?: string | null;
  initialMock?: boolean;
  reconnectAccountId?: string | null;
  reconnectVendor?: PrinterVendor | null;
  /** Sihirbazda yalnızca bu üretici (vendor adımı atlanır). */
  fixedVendor?: PrinterVendor | null;
  onLinked?: (machineIds: string[]) => void;
};

export function useCloudConnect({
  initialAccountId = null,
  initialMock = false,
  reconnectAccountId = null,
  reconnectVendor = null,
  fixedVendor = null,
  onLinked,
}: UseCloudConnectOptions) {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const [loginVendor, setLoginVendor] = useState<PrinterVendor | null>(
    initialAccountId ? null : reconnectVendor ?? fixedVendor
  );
  const [loginReconnectId, setLoginReconnectId] = useState<string | null>(reconnectAccountId);
  const mock = initialMock;

  const step: CloudConnectStep = accountId
    ? "devices"
    : loginVendor
      ? "login"
      : fixedVendor
        ? "login"
        : "vendor";

  const effectiveLoginVendor = loginVendor ?? fixedVendor;

  const { data: ent, isLoading: entLoading } = useEntitlements();
  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ["printer-providers"],
    queryFn: async (): Promise<VendorProviderInfo[]> => {
      const res = await fetch("/api/integrations/printers/accounts", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Üretici listesi alınamadı");
      return data.providers ?? [];
    },
  });

  const cloudAllowed = ent?.entitlements.cloudMonitoring ?? false;
  const providersLoadingState = entLoading || providersLoading;

  function beginAccountLogin(vendor: PrinterVendor) {
    setLoginVendor(vendor);
  }

  function backFromLogin() {
    if (fixedVendor) return;
    setLoginVendor(null);
  }

  function onAccountConnected(id: string) {
    setAccountId(id);
    setLoginVendor(null);
  }

  function onNeedLogin(vendor: PrinterVendor, reconnectId: string) {
    setLoginReconnectId(reconnectId);
    setAccountId(null);
    setLoginVendor(vendor);
  }

  return {
    step,
    accountId,
    mock,
    cloudAllowed,
    providers,
    providersLoading: providersLoadingState,
    effectiveLoginVendor,
    loginReconnectId,
    beginAccountLogin,
    backFromLogin,
    onAccountConnected,
    onNeedLogin,
    deviceStepProps: accountId
      ? {
          accountId,
          mock,
          onNeedLogin,
          onLinked: (ids: string[]) => {
            queryClient.invalidateQueries({ queryKey: ["machines"] });
            onLinked?.(ids);
          },
        }
      : null,
    loginStepProps: effectiveLoginVendor
      ? {
          vendor: effectiveLoginVendor,
          reconnectAccountId: loginReconnectId,
          onBack: backFromLogin,
          onConnected: onAccountConnected,
          showBack: !fixedVendor,
        }
      : null,
    vendorStepProps:
      step === "vendor"
        ? {
            cloudAllowed,
            providers,
            loading: providersLoadingState,
            onAccountLogin: beginAccountLogin,
            returnConnect: true,
          }
        : null,
    supportedModels: () => ({ bambu: catalogForVendor("bambu"), creality: catalogForVendor("creality") }),
    slotsLeft: machineSlotsLeft(ent) ?? 0,
  };
}

export function useCloudDeviceStep({
  accountId,
  mock,
  onNeedLogin,
  onLinked,
}: {
  accountId: string;
  mock: boolean;
  onNeedLogin: (vendor: PrinterVendor, reconnectId: string) => void;
  onLinked?: (machineIds: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const { data: ent } = useEntitlements();
  const slotsLeft = machineSlotsLeft(ent) ?? 0;
  const [selection, setSelection] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["printer-devices", accountId],
    retry: false,
    queryFn: async (): Promise<DevicesResult> => {
      const res = await fetch(`/api/integrations/printers/accounts/${accountId}/devices`, {
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.reconnect) {
        return {
          devices: [],
          vendor: body.vendor ?? null,
          reconnect: body.error ?? "Yetki sona ermiş",
        };
      }
      if (!res.ok) throw new Error(body.error ?? "Cihazlar alınamadı");
      return { devices: body.devices ?? [], vendor: body.vendor ?? null, reconnect: null };
    },
  });

  const devices = data?.devices ?? [];
  const linkable = devices.filter((d) => !d.linked);
  const selected = selection ?? new Set(linkable.slice(0, slotsLeft).map((d) => d.id));
  const overQuota = selected.size > slotsLeft;

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  }

  async function handleSave() {
    if (selected.size === 0) {
      toast.error("En az bir yazıcı seçin");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/printers/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integration_account_id: accountId,
          devices: devices
            .filter((d) => selected.has(d.id))
            .map((d) => ({
              external_device_id: d.id,
              external_device_name: d.name,
              machine_name: d.name,
            })),
        }),
      });
      const body = await res.json().catch(() => ({}));
      queryClient.invalidateQueries({ queryKey: ["entitlements"] });
      queryClient.invalidateQueries({ queryKey: ["printer-devices", accountId] });
      if (!res.ok) throw new Error(body.error ?? "Kayıt başarısız");
      const linked = (body.linked ?? []) as { machine_id: string }[];
      const ids = linked.map((l) => l.machine_id).filter(Boolean);
      const count = ids.length;
      toast.success(count > 0 ? `${count} yazıcı eklendi` : "Seçilen yazıcılar zaten bağlı");
      onLinked?.(ids);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setSaving(false);
    }
  }

  return {
    data,
    devices,
    linkable,
    selected,
    overQuota,
    slotsLeft,
    mock,
    isLoading,
    error,
    saving,
    toggle,
    handleSave,
    onNeedLogin: (vendor: PrinterVendor) => onNeedLogin(vendor, accountId),
  };
}

export function useCloudAccountLogin({
  vendor,
  reconnectAccountId,
  onConnected,
}: {
  vendor: PrinterVendor;
  reconnectAccountId: string | null;
  onConnected: (accountId: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [needsCode, setNeedsCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const label = vendor === "bambu" ? "Bambu Lab" : "Creality";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/integrations/printers/accounts/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor,
          email,
          password,
          verificationCode: verificationCode.trim() || undefined,
          reconnectAccountId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409 && body.needsVerification) {
        setNeedsCode(true);
        toast.error(body.error ?? "E-posta doğrulama kodu gerekli");
        return;
      }
      if (!res.ok) throw new Error(body.error ?? "Giriş başarısız");
      if (!body.account?.id) throw new Error("Hesap kaydedilemedi");
      toast.success(`${label} hesabı bağlandı`);
      onConnected(body.account.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Hata");
    } finally {
      setSaving(false);
    }
  }

  return {
    label,
    email,
    setEmail,
    password,
    setPassword,
    verificationCode,
    setVerificationCode,
    needsCode,
    saving,
    handleSubmit,
  };
}
