"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/select";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { Cloud, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { machineSlotsLeft, useEntitlements } from "@/hooks/use-entitlements";
import { catalogForVendor } from "@/lib/printer-cloud/device-catalog";
import type { PrinterVendor, VendorProviderInfo } from "@/lib/printer-cloud/types";

type CloudDevice = {
  id: string;
  name: string;
  model: string | null;
  online: boolean;
  linked?: boolean;
};

type DevicesResult =
  | { devices: CloudDevice[]; vendor: PrinterVendor | null; reconnect: null }
  | { devices: []; vendor: PrinterVendor | null; reconnect: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initialAccountId?: string | null;
  initialMock?: boolean;
  reconnectAccountId?: string | null;
  reconnectVendor?: PrinterVendor | null;
};

function oauthStartUrl(vendor: PrinterVendor, reconnectAccountId?: string | null) {
  const query = reconnectAccountId ? `?reconnect=${reconnectAccountId}` : "";
  return `/api/integrations/printers/oauth/${vendor}/start${query}`;
}

export function CloudPrinterConnectModal({
  open,
  onOpenChange,
  onSaved,
  initialAccountId = null,
  initialMock = false,
  reconnectAccountId = null,
  reconnectVendor = null,
}: Props) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-lg">
        {open && (
          <ConnectFlow
            key={`${initialAccountId ?? "vendor"}-${reconnectAccountId ?? ""}`}
            accountId={initialAccountId}
            mock={initialMock}
            reconnectAccountId={reconnectAccountId}
            reconnectVendor={reconnectVendor}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </ModalContent>
    </Modal>
  );
}

function ConnectFlow({
  accountId: initialAccountId,
  mock,
  reconnectAccountId,
  reconnectVendor,
  onClose,
  onSaved,
}: {
  accountId: string | null;
  mock: boolean;
  reconnectAccountId: string | null;
  reconnectVendor: PrinterVendor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const [loginVendor, setLoginVendor] = useState<PrinterVendor | null>(
    initialAccountId ? null : reconnectVendor
  );
  const [loginReconnectId, setLoginReconnectId] = useState<string | null>(reconnectAccountId);

  const step = accountId ? "devices" : loginVendor ? "login" : "vendor";

  return (
    <>
      <ModalHeader
        title="Yazıcıları bağla"
        subtitle={
          step === "vendor"
            ? "Üretici hesabınızla giriş yapın"
            : step === "login"
              ? "Hesabınızla giriş yapın"
              : "Eklenecek yazıcıları seçin"
        }
      />
      {accountId ? (
        <DeviceStep
          accountId={accountId}
          mock={mock}
          onClose={onClose}
          onSaved={onSaved}
          onNeedLogin={(vendor) => {
            setLoginReconnectId(accountId);
            setAccountId(null);
            setLoginVendor(vendor);
          }}
        />
      ) : loginVendor ? (
        <AccountLoginStep
          vendor={loginVendor}
          reconnectAccountId={loginReconnectId}
          onBack={() => setLoginVendor(null)}
          onConnected={(id) => setAccountId(id)}
          onClose={onClose}
        />
      ) : (
        <VendorStep onClose={onClose} onAccountLogin={setLoginVendor} />
      )}
    </>
  );
}

function VendorStep({
  onClose,
  onAccountLogin,
}: {
  onClose: () => void;
  onAccountLogin: (vendor: PrinterVendor) => void;
}) {
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
  const loading = entLoading || providersLoading;

  return (
    <>
      <ModalBody className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : !cloudAllowed ? (
          <div className="space-y-3 rounded-2xl border border-sky-900/50 bg-sky-950/20 p-4">
            <p className="flex items-center gap-2 font-medium text-zinc-100">
              <Lock className="h-4 w-4 text-sky-400" /> Buluttan makine bağlama kilitli
            </p>
            <p className="text-sm text-zinc-400">
              Ücretsiz ve Starter planlarda Bambu / Creality hesabı bağlanamaz. Canlı takip için
              Atölye veya Filament Farm planına geçin.
            </p>
            <Link
              href="/billing?reason=cloud"
              className="inline-flex text-sm font-medium text-sky-400 hover:text-sky-300"
            >
              Planları gör →
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Yazıcınız Wi‑Fi ile üretici uygulamasına bağlıysa başka kurulum gerekmez. Hesabınızla
              giriş yapın, yazıcılarınız listelensin.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {providers.map((p) =>
                p.available ? (
                  p.auth === "account" ? (
                    <button
                      key={p.vendor}
                      type="button"
                      onClick={() => onAccountLogin(p.vendor)}
                      className="flex min-h-[120px] flex-col items-start justify-between rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4 text-left transition hover:border-emerald-600/60 hover:bg-zinc-900/70"
                    >
                      <span className="text-lg font-semibold text-zinc-100">{p.label}</span>
                      <span className="text-xs text-zinc-500">{p.label} hesabımla bağlan</span>
                    </button>
                  ) : (
                    <a
                      key={p.vendor}
                      href={oauthStartUrl(p.vendor)}
                      className="flex min-h-[120px] flex-col items-start justify-between rounded-2xl border border-zinc-700 bg-zinc-900/40 p-4 text-left transition hover:border-emerald-600/60 hover:bg-zinc-900/70"
                    >
                      <span className="text-lg font-semibold text-zinc-100">{p.label}</span>
                      <span className="text-xs text-zinc-500">{p.label} hesabımla bağlan</span>
                    </a>
                  )
                ) : (
                  <div
                    key={p.vendor}
                    aria-disabled
                    className="flex min-h-[120px] flex-col items-start justify-between rounded-2xl border border-zinc-800/60 bg-zinc-950/40 p-4 opacity-70"
                  >
                    <span className="text-lg font-semibold text-zinc-100">{p.label}</span>
                    <span className="text-xs text-zinc-500">Yakında</span>
                  </div>
                )
              )}
            </div>
            <SupportedModels />
          </div>
        )}
      </ModalBody>
      <ModalFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="ghost" onClick={onClose} className="sm:mr-auto">
          Kapat
        </Button>
      </ModalFooter>
    </>
  );
}

function SupportedModels() {
  const [open, setOpen] = useState(false);
  const bambu = catalogForVendor("bambu");
  const creality = catalogForVendor("creality");
  return (
    <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-3">
      <button
        type="button"
        className="w-full text-left text-xs font-medium text-zinc-400 hover:text-zinc-200"
        onClick={() => setOpen((v) => !v)}
      >
        Desteklenen modeller ({bambu.length + creality.length}+) {open ? "▴" : "▾"}
      </button>
      {open && (
        <div className="mt-3 grid gap-3 text-xs text-zinc-500 sm:grid-cols-2">
          <p>
            <span className="font-medium text-zinc-300">Bambu Lab: </span>
            {bambu.map((d) => d.name).join(", ")}
          </p>
          <p>
            <span className="font-medium text-zinc-300">Creality: </span>
            {creality.map((d) => d.name).join(", ")}
            . Cloud’a bağlı diğer modeller de listelenir.
          </p>
        </div>
      )}
    </div>
  );
}

function AccountLoginStep({
  vendor,
  reconnectAccountId,
  onBack,
  onConnected,
  onClose,
}: {
  vendor: PrinterVendor;
  reconnectAccountId: string | null;
  onBack: () => void;
  onConnected: (accountId: string) => void;
  onClose: () => void;
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

  return (
    <form onSubmit={handleSubmit}>
      <ModalBody className="space-y-3">
        <p className="text-sm text-zinc-400">
          {label} uygulamasındaki e-posta ve şifre. Şifre kaydedilmez; yalnızca oturum jetonu
          şifreli saklanır.
        </p>
        <div className="space-y-1">
          <Label htmlFor="cloud-email">E-posta</Label>
          <Input
            id="cloud-email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="cloud-password">Şifre</Label>
          <Input
            id="cloud-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {needsCode && (
          <div className="space-y-1">
            <Label htmlFor="cloud-code">E-posta doğrulama kodu</Label>
            <Input
              id="cloud-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="6 haneli kod"
            />
          </div>
        )}
      </ModalBody>
      <ModalFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="ghost" onClick={onBack} disabled={saving}>
          Geri
        </Button>
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Kapat
        </Button>
        <Button type="submit" disabled={saving} className="sm:ml-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : `${label} ile bağlan`}
        </Button>
      </ModalFooter>
    </form>
  );
}

function DeviceStep({
  accountId,
  mock,
  onClose,
  onSaved,
  onNeedLogin,
}: {
  accountId: string;
  mock: boolean;
  onClose: () => void;
  onSaved: () => void;
  onNeedLogin: (vendor: PrinterVendor) => void;
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
        return { devices: [], vendor: body.vendor ?? null, reconnect: body.error ?? "Yetki sona ermiş" };
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
      const count = (body.linked ?? []).length;
      toast.success(count > 0 ? `${count} yazıcı eklendi` : "Seçilen yazıcılar zaten bağlı");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hata");
    } finally {
      setSaving(false);
    }
  }

  if (data?.reconnect) {
    return (
      <>
        <ModalBody>
          <div className="space-y-2 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-4">
            <p className="font-medium text-zinc-100">Hesabı yeniden bağlamanız gerekiyor</p>
            <p className="text-sm text-zinc-400">{data.reconnect}</p>
          </div>
        </ModalBody>
        <ModalFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="ghost" onClick={onClose}>
            Kapat
          </Button>
          {data.vendor && (
            <Button type="button" className="sm:ml-auto" onClick={() => onNeedLogin(data.vendor!)}>
              Yeniden bağlan
            </Button>
          )}
        </ModalFooter>
      </>
    );
  }

  return (
    <>
      <ModalBody className="space-y-3">
        {mock && (
          <p className="text-xs text-amber-400/80">Geliştirme demo modu — sahte cihazlar listeleniyor.</p>
        )}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-400">{error.message}</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Bu hesapta yazıcı bulunamadı. Yazıcının üretici uygulamasına bağlı olduğundan emin olun.
          </p>
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-medium text-zinc-200">{devices.length} yazıcı bulundu</p>
              <p className={`text-xs ${overQuota ? "text-amber-400" : "text-zinc-500"}`}>
                Planınızda {slotsLeft} makine yeri var
              </p>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {devices.map((d) => (
                <label
                  key={d.id}
                  className={`flex items-start gap-3 rounded-xl border border-zinc-800/80 p-3 ${
                    d.linked ? "opacity-60" : "cursor-pointer hover:bg-zinc-900/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={d.linked}
                    checked={d.linked || selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                  />
                  <div>
                    <p className="font-medium text-zinc-100">{d.name}</p>
                    {d.model && <p className="text-xs text-zinc-500">{d.model}</p>}
                    <p className="text-xs text-zinc-500">
                      {d.linked ? "Zaten bağlı" : d.online ? "Çevrimiçi" : "Çevrimdışı"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
            {overQuota && (
              <p className="text-xs text-amber-400">
                Seçiminiz plan kotanızı aşıyor.{" "}
                <Link href="/billing" className="underline">
                  Planı yükseltin
                </Link>{" "}
                veya en fazla {slotsLeft} yazıcı seçin.
              </p>
            )}
            {linkable.length > 0 && slotsLeft === 0 && (
              <p className="text-xs text-amber-400">
                Makine kotanız dolu.{" "}
                <Link href="/billing" className="underline">
                  Planı yükseltin
                </Link>
              </p>
            )}
          </>
        )}
      </ModalBody>
      <ModalFooter className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          Kapat
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving || selected.size === 0 || overQuota}
          className="sm:ml-auto"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : devices.length > 0 && linkable.length === 0 ? (
            "Hepsi zaten bağlı"
          ) : (
            <>
              <Cloud className="h-4 w-4" />{" "}
              {selected.size === linkable.length ? "Tümünü ekle" : "Ekle"} ({selected.size})
            </>
          )}
        </Button>
      </ModalFooter>
    </>
  );
}
