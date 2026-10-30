"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type Props = {
  onConnected: (accountId: string, mock: boolean, vendor: string | null) => void;
};

export function PrinterConnectOAuthHandler({ onConnected }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const error = searchParams.get("oauth_error");
    if (error) {
      toast.error(decodeURIComponent(error));
      router.replace(pathname === "/machines/connect" ? "/machines/connect" : "/machines");
      return;
    }

    const connected = searchParams.get("connected");
    const accountId = searchParams.get("account");
    const resume = searchParams.get("connect") === "resume";

    if (connected === "1" && accountId) {
      const mock = searchParams.get("mock") === "1";
      onConnected(accountId, mock, searchParams.get("vendor"));
      if (resume || pathname === "/machines/connect") {
        router.replace("/machines/connect?connect=resume");
      } else {
        router.replace("/machines");
      }
    }
  }, [searchParams, router, onConnected, pathname]);

  return null;
}
