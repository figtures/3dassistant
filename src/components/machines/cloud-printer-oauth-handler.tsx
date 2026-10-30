"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

type Props = {
  onConnected: (accountId: string, mock: boolean, vendor: string | null) => void;
};

export function CloudPrinterOAuthHandler({ onConnected }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const error = searchParams.get("oauth_error");
    if (error) {
      toast.error(decodeURIComponent(error));
      router.replace("/machines");
      return;
    }

    const connected = searchParams.get("connected");
    const accountId = searchParams.get("account");
    if (connected === "1" && accountId) {
      const mock = searchParams.get("mock") === "1";
      onConnected(accountId, mock, searchParams.get("vendor"));
      router.replace("/machines");
    }
  }, [searchParams, router, onConnected]);

  return null;
}
