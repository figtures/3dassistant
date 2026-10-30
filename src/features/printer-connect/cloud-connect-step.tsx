"use client";

import Link from "next/link";
import { Loader2, Cloud, Lock } from "lucide-react";
import { Button, FormField, Input } from "@/components/ds";
import type { PrinterVendor } from "@/lib/printer-cloud/types";
import {
  oauthStartUrl,
  useCloudAccountLogin,
  useCloudConnect,
  useCloudDeviceStep,
} from "@/features/printer-connect/use-cloud-connect";

type CloudConnectStepProps = {
  fixedVendor?: PrinterVendor | null;
  initialAccountId?: string | null;
  initialMock?: boolean;
  reconnectAccountId?: string | null;
  reconnectVendor?: PrinterVendor | null;
  onLinked: (machineIds: string[]) => void;
  onBack?: () => void;
};

export function CloudConnectStep({
  fixedVendor = null,
  initialAccountId = null,
  initialMock = false,
  reconnectAccountId = null,
  reconnectVendor = null,
  onLinked,
  onBack,
}: CloudConnectStepProps) {
  const cloud = useCloudConnect({
    initialAccountId,
    initialMock,
    reconnectAccountId,
    reconnectVendor,
    fixedVendor,
    onLinked,
  });

  if (cloud.step === "devices" && cloud.deviceStepProps) {
    return (
      <CloudDevicePanel {...cloud.deviceStepProps} onBack={onBack} />
    );
  }

  if (cloud.step === "login" && cloud.loginStepProps) {
    return <CloudLoginPanel {...cloud.loginStepProps} onBack={onBack ?? cloud.loginStepProps.onBack} />;
  }

  if (cloud.vendorStepProps) {
    return <CloudVendorPanel {...cloud.vendorStepProps} onBack={onBack} />;
  }

  return null;
}

function CloudVendorPanel({
  cloudAllowed,
  providers,
  loading,
  onAccountLogin,
  returnConnect,
  onBack,
}: {
  cloudAllowed: boolean;
  providers: { vendor: PrinterVendor; label: string; available: boolean; auth: string }[];
  loading: boolean;
  onAccountLogin: (v: PrinterVendor) => void;
  returnConnect: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : !cloudAllowed ? (
        <div className="space-y-3 rounded-xl border border-border bg-surface-inset p-4">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <Lock className="size-4 text-primary" aria-hidden />
            Buluttan makine bağlama kilitli
          </p>
          <p className="text-sm text-muted-foreground">
            Ücretsiz ve Starter planlarda Bambu / Creality hesabı bağlanamaz. Canlı takip için
            Atölye veya Filament Farm planına geçin.
          </p>
          <Link href="/billing?reason=cloud" className="text-sm font-medium text-primary hover:text-primary-hover">
            Planları gör →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
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
                    className="flex min-h-[100px] flex-col items-start justify-between rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-surface-inset"
                  >
                    <span className="text-base font-semibold text-foreground">{p.label}</span>
                    <span className="text-xs text-muted-foreground">{p.label} hesabımla bağlan</span>
                  </button>
                ) : (
                  <a
                    key={p.vendor}
                    href={oauthStartUrl(p.vendor, { returnConnect })}
                    className="flex min-h-[100px] flex-col items-start justify-between rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-surface-inset"
                  >
                    <span className="text-base font-semibold text-foreground">{p.label}</span>
                    <span className="text-xs text-muted-foreground">{p.label} hesabımla bağlan</span>
                  </a>
                )
              ) : (
                <div
                  key={p.vendor}
                  aria-disabled
                  className="flex min-h-[100px] flex-col items-start justify-between rounded-xl border border-border bg-muted/30 p-4 opacity-70"
                >
                  <span className="text-base font-semibold text-foreground">{p.label}</span>
                  <span className="text-xs text-muted-foreground">Yakında</span>
                </div>
              )
            )}
          </div>
        </div>
      )}
      {onBack ? (
        <Button type="button" variant="ghost" onClick={onBack}>
          Geri
        </Button>
      ) : null}
    </div>
  );
}

function CloudLoginPanel({
  vendor,
  reconnectAccountId,
  onBack,
  onConnected,
  showBack,
}: {
  vendor: PrinterVendor;
  reconnectAccountId: string | null;
  onBack: () => void;
  onConnected: (id: string) => void;
  showBack: boolean;
}) {
  const login = useCloudAccountLogin({ vendor, reconnectAccountId, onConnected });

  return (
    <form onSubmit={login.handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {login.label} uygulamasındaki e-posta ve şifre. Şifre kaydedilmez; yalnızca oturum jetonu
        şifreli saklanır.
      </p>
      <FormField label="E-posta" required>
        {(field) => (
          <Input
            {...field}
            id="cloud-email"
            type="email"
            autoComplete="username"
            value={login.email}
            onChange={(e) => login.setEmail(e.target.value)}
            required
          />
        )}
      </FormField>
      <FormField label="Şifre" required>
        {(field) => (
          <Input
            {...field}
            id="cloud-password"
            type="password"
            autoComplete="current-password"
            value={login.password}
            onChange={(e) => login.setPassword(e.target.value)}
            required
          />
        )}
      </FormField>
      {login.needsCode ? (
        <FormField label="E-posta doğrulama kodu">
          {(field) => (
            <Input
              {...field}
              id="cloud-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={login.verificationCode}
              onChange={(e) => login.setVerificationCode(e.target.value)}
              placeholder="6 haneli kod"
            />
          )}
        </FormField>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {showBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={login.saving}>
            Geri
          </Button>
        ) : null}
        <Button type="submit" disabled={login.saving} loading={login.saving} className="sm:ml-auto">
          {`${login.label} ile bağlan`}
        </Button>
      </div>
    </form>
  );
}

function CloudDevicePanel({
  accountId,
  mock,
  onNeedLogin,
  onLinked,
  onBack,
}: {
  accountId: string;
  mock: boolean;
  onNeedLogin: (vendor: PrinterVendor, reconnectId: string) => void;
  onLinked?: (machineIds: string[]) => void;
  onBack?: () => void;
}) {
  const step = useCloudDeviceStep({ accountId, mock, onNeedLogin, onLinked });

  if (step.data?.reconnect) {
    return (
      <div className="space-y-4">
        <div className="space-y-2 rounded-xl border border-warning/30 bg-warning-subtle p-4">
          <p className="font-medium text-foreground">Hesabı yeniden bağlamanız gerekiyor</p>
          <p className="text-sm text-muted-foreground">{step.data.reconnect}</p>
        </div>
        {step.data.vendor ? (
          <Button type="button" onClick={() => step.onNeedLogin(step.data!.vendor!)}>
            Yeniden bağlan
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {mock ? (
        <p className="text-xs text-warning">Geliştirme demo modu — sahte cihazlar listeleniyor.</p>
      ) : null}
      {step.isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : step.error ? (
        <p className="text-sm text-destructive">{step.error.message}</p>
      ) : step.devices.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Bu hesapta yazıcı bulunamadı. Yazıcının üretici uygulamasına bağlı olduğundan emin olun.
        </p>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-medium text-foreground">{step.devices.length} yazıcı bulundu</p>
            <p className={`text-xs ${step.overQuota ? "text-warning" : "text-muted-foreground"}`}>
              Planınızda {step.slotsLeft} makine yeri var
            </p>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {step.devices.map((d) => (
              <label
                key={d.id}
                className={`flex items-start gap-3 rounded-lg border border-border p-3 ${
                  d.linked ? "opacity-60" : "cursor-pointer hover:bg-surface-inset"
                }`}
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  disabled={d.linked}
                  checked={d.linked || step.selected.has(d.id)}
                  onChange={() => step.toggle(d.id)}
                />
                <div>
                  <p className="font-medium text-foreground">{d.name}</p>
                  {d.model ? <p className="text-xs text-muted-foreground">{d.model}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {d.linked ? "Zaten bağlı" : d.online ? "Çevrimiçi" : "Çevrimdışı"}
                  </p>
                </div>
              </label>
            ))}
          </div>
          {step.overQuota ? (
            <p className="text-xs text-warning">
              Seçiminiz plan kotanızı aşıyor.{" "}
              <Link href="/billing" className="underline">
                Planı yükseltin
              </Link>{" "}
              veya en fazla {step.slotsLeft} yazıcı seçin.
            </p>
          ) : null}
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={step.saving}>
            Geri
          </Button>
        ) : null}
        <Button
          type="button"
          onClick={() => void step.handleSave()}
          disabled={step.saving || step.selected.size === 0 || step.overQuota}
          loading={step.saving}
          className="sm:ml-auto"
        >
          <Cloud className="size-4" aria-hidden />
          {step.selected.size === step.linkable.length ? "Tümünü ekle" : "Ekle"} ({step.selected.size})
        </Button>
      </div>
    </div>
  );
}
