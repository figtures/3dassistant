"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ds";
import { WizardSteps, type WizardStepDef } from "@/components/v2/wizard/wizard-steps";
import { useEntitlements } from "@/hooks/use-entitlements";
import { VendorStep } from "@/features/printer-connect/vendor-step";
import { MethodStep } from "@/features/printer-connect/method-step";
import { CloudConnectStep } from "@/features/printer-connect/cloud-connect-step";
import { BridgeConnectStep } from "@/features/printer-connect/bridge-connect-step";
import { ManualStep } from "@/features/printer-connect/manual-step";
import { VerifyStep } from "@/features/printer-connect/verify-step";
import {
  vendorToPrinterCloudVendor,
  type ConnectMethod,
  type ConnectVendor,
} from "@/features/printer-connect/methods";
import type { PrinterVendor } from "@/lib/printer-cloud/types";
import { PrinterConnectOAuthHandler } from "@/features/printer-connect/printer-connect-oauth-handler";

export type PrinterConnectWizardMode = "dialog" | "page" | "embedded";

const WIZARD_STEPS: WizardStepDef[] = [
  { id: "vendor", label: "Yazıcı" },
  { id: "method", label: "Yöntem" },
  { id: "connect", label: "Bağlan" },
  { id: "verify", label: "Doğrula" },
  { id: "done", label: "Bitti" },
];

type Phase = "vendor" | "method" | "connect" | "verify" | "done";

type PrinterConnectWizardProps = {
  mode?: PrinterConnectWizardMode;
  onClose?: () => void;
  /** OAuth / dış dönüş sonrası bulut adımı */
  initialAccountId?: string | null;
  initialMock?: boolean;
  reconnectAccountId?: string | null;
  reconnectVendor?: PrinterVendor | null;
  initialConnectVendor?: ConnectVendor | null;
};

function phaseIndex(phase: Phase): number {
  return WIZARD_STEPS.findIndex((s) => s.id === phase);
}

function PrinterConnectWizardInner({
  mode = "page",
  onClose,
  initialAccountId = null,
  initialMock = false,
  reconnectAccountId = null,
  reconnectVendor = null,
  initialConnectVendor = null,
}: PrinterConnectWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { data: ent } = useEntitlements();
  const cloudMonitoring = ent?.entitlements.cloudMonitoring ?? false;

  const reconnectCloudVendor = reconnectVendor ?? null;
  const initialVendorFromReconnect: ConnectVendor | null =
    reconnectCloudVendor === "bambu"
      ? "bambu"
      : reconnectCloudVendor === "creality"
        ? "creality"
        : null;

  const [phase, setPhase] = useState<Phase>(() => {
    if (initialAccountId || reconnectAccountId) return "connect";
    if (searchParams.get("connect") === "resume") return "connect";
    return "vendor";
  });
  const [vendor, setVendor] = useState<ConnectVendor | null>(
    initialConnectVendor ?? initialVendorFromReconnect
  );
  const [method, setMethod] = useState<ConnectMethod | null>(
    initialAccountId || reconnectAccountId ? "cloud" : null
  );
  const [machineIds, setMachineIds] = useState<string[]>([]);
  const [manualOnly, setManualOnly] = useState(false);
  const [cloudAccountId, setCloudAccountId] = useState<string | null>(
    initialAccountId ?? reconnectAccountId
  );
  const [cloudMock, setCloudMock] = useState(initialMock);

  const titleRef = useRef<HTMLHeadingElement>(null);
  const stepHeadingId = "printer-connect-step-title";

  useEffect(() => {
    titleRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    const resume = searchParams.get("connect") === "resume";
    const account = searchParams.get("account");
    const mock = searchParams.get("mock") === "1";
    if (resume && account) {
      setCloudAccountId(account);
      setCloudMock(mock);
      setMethod("cloud");
      const v = searchParams.get("vendor");
      if (v === "bambu" || v === "creality" || v === "prusa" || v === "other") {
        setVendor(v);
      }
      setPhase("connect");
    }
  }, [searchParams]);

  const cloudVendor = useMemo((): PrinterVendor | null => {
    if (!vendor) return null;
    return vendorToPrinterCloudVendor(vendor);
  }, [vendor]);

  const goDone = useCallback(() => {
    setPhase("done");
    queryClient.invalidateQueries({ queryKey: ["machines"] });
  }, [queryClient]);

  const handleLinked = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) {
        goDone();
        return;
      }
      setMachineIds(ids);
      setManualOnly(false);
      setPhase("verify");
    },
    [goDone]
  );

  const handleManualSaved = useCallback((id: string) => {
    setMachineIds([id]);
    setManualOnly(true);
    setPhase("verify");
  }, []);

  const handleOAuthConnected = useCallback(
    (accountId: string, mock: boolean, vendorParam: string | null) => {
      setCloudAccountId(accountId);
      setCloudMock(mock);
      setMethod("cloud");
      if (
        vendorParam === "bambu" ||
        vendorParam === "creality" ||
        vendorParam === "prusa" ||
        vendorParam === "other"
      ) {
        setVendor(vendorParam);
      }
      setPhase("connect");
    },
    []
  );

  const stepIndex = phaseIndex(phase);

  const stepTitle = useMemo(() => {
    switch (phase) {
      case "vendor":
        return "Yazıcınız hangisi?";
      case "method":
        return "Nasıl bağlanalım?";
      case "connect":
        return "Bağlantıyı tamamlayın";
      case "verify":
        return "Canlı veriyi doğrulayın";
      case "done":
        return "Yazıcı hazır";
      default:
        return "Yazıcı bağla";
    }
  }, [phase]);

  const content = (
    <div className={mode === "embedded" ? "space-y-4" : "space-y-6"}>
      {mode !== "embedded" ? (
        <WizardSteps
          steps={WIZARD_STEPS}
          currentIndex={stepIndex}
          headingId={stepHeadingId}
        />
      ) : null}

      <header className="space-y-1">
        <h2
          ref={titleRef}
          id={stepHeadingId}
          tabIndex={-1}
          className="text-lg font-semibold tracking-tight text-foreground outline-none sm:text-xl"
        >
          {stepTitle}
        </h2>
        {phase === "vendor" ? (
          <p className="text-sm text-muted-foreground">
            Tek akışta bulut, köprü veya elle ekleme.
          </p>
        ) : null}
      </header>

      {phase === "vendor" ? (
        <VendorStep
          value={vendor}
          onSelect={(v) => {
            setVendor(v);
            setPhase("method");
          }}
        />
      ) : null}

      {phase === "method" && vendor ? (
        <MethodStep
          vendor={vendor}
          cloudMonitoring={cloudMonitoring}
          selected={method}
          onSelect={(m) => {
            setMethod(m);
            setPhase("connect");
          }}
          onBack={() => setPhase("vendor")}
        />
      ) : null}

      {phase === "connect" && method === "cloud" && cloudVendor ? (
        <CloudConnectStep
          fixedVendor={cloudVendor}
          initialAccountId={cloudAccountId}
          initialMock={cloudMock}
          reconnectAccountId={reconnectAccountId}
          reconnectVendor={reconnectCloudVendor}
          onLinked={handleLinked}
          onBack={() => setPhase(vendor ? "method" : "vendor")}
        />
      ) : null}

      {phase === "connect" && vendor && method === "cloud" && !cloudVendor && !cloudAccountId ? (
        <p className="text-sm text-muted-foreground">
          Bu marka için bulut bağlantısı yok. Köprü veya elle eklemeyi seçin.
        </p>
      ) : null}

      {phase === "connect" && method === "bridge" ? (
        <BridgeConnectStep onLinked={handleLinked} onBack={() => setPhase("method")} />
      ) : null}

      {phase === "connect" && method === "manual" ? (
        <ManualStep onSaved={handleManualSaved} onBack={() => setPhase("method")} />
      ) : null}

      {phase === "verify" ? (
        <VerifyStep
          machineIds={machineIds}
          manualOnly={manualOnly}
          onVerified={goDone}
          onSkip={goDone}
        />
      ) : null}

      {phase === "done" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Yazıcınız filo listesinde. Planlamada kullanmaya başlayabilirsiniz.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setPhase("vendor");
                setVendor(null);
                setMethod(null);
                setMachineIds([]);
                setCloudAccountId(null);
              }}
            >
              Bir yazıcı daha bağla
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (mode === "dialog") onClose?.();
                else router.push("/machines");
              }}
              className="sm:ml-auto"
            >
              Makinelere git
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  if (mode === "page") {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-10 pt-2">
        <div className="flex items-center justify-between gap-4">
          <Link href="/machines" className="text-sm text-muted-foreground hover:text-foreground">
            ← Makineler
          </Link>
          {onClose ? (
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Kapat
            </Button>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Yazıcı bağla</h1>
        {content}
        <Suspense fallback={null}>
          <PrinterConnectOAuthHandler onConnected={handleOAuthConnected} />
        </Suspense>
      </div>
    );
  }

  return (
    <>
      {content}
      <Suspense fallback={null}>
        <PrinterConnectOAuthHandler onConnected={handleOAuthConnected} />
      </Suspense>
    </>
  );
}

export function PrinterConnectWizard(props: PrinterConnectWizardProps) {
  return (
    <Suspense fallback={null}>
      <PrinterConnectWizardInner {...props} />
    </Suspense>
  );
}
