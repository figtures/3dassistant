import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Providers } from "@/components/providers";
import { getUiVersion } from "@/lib/flags/ui-version";
import { parseUiDensity } from "@/lib/shell/density-cookie";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://3dasisstant.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "3D Asisstant — 3D atölye ERP",
    template: "%s · 3D Asisstant",
  },
  description: "3D baskı atölyeleri için üretim, planlama ve filo yönetimi",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ui = await getUiVersion();
  const jar = await cookies();
  const density = parseUiDensity(jar.get("pf_density")?.value);

  return (
    <html
      lang="tr"
      data-ui={ui}
      data-theme="dark"
      data-density={density}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className={
          ui === "v2"
            ? "min-h-full flex flex-col bg-background text-foreground"
            : "min-h-full flex flex-col bg-zinc-950 text-zinc-100"
        }
      >
        <Providers uiVersion={ui}>{children}</Providers>
      </body>
    </html>
  );
}
