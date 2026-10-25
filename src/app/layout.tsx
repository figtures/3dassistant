import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { getUiVersion } from "@/lib/flags/ui-version";
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

export const metadata: Metadata = {
  title: "3dassistant — 3D atölye ERP",
  description: "3D baskı atölyeleri için üretim, planlama ve filo yönetimi",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ui = await getUiVersion();

  return (
    <html
      lang="tr"
      data-ui={ui}
      data-theme="dark"
      data-density="comfortable"
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
