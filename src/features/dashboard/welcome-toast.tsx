"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export function WelcomeToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current) return;
    if (searchParams.get("welcome") !== "1") return;
    shown.current = true;
    toast.success("Kurulum tamamlandı!", {
      description: "3D Assistant'a hoş geldiniz. Dashboard'dan atölyenizi yönetmeye başlayın.",
    });
    const url = new URL(window.location.href);
    url.searchParams.delete("welcome");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [router, searchParams]);

  return null;
}
