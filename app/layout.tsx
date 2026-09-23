import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://cha-dictionary.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "英漢詞典 · English → 香港繁體",
  description:
    "A fast English to Hong Kong Traditional Chinese dictionary with CEFR levels, CC-CEDICT glosses, and offline support.",
  applicationName: "英漢詞典",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "英漢詞典",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "zh_HK",
    url: siteUrl,
    siteName: "英漢詞典",
    title: "英漢詞典 · English → 香港繁體",
    description:
      "Look up English words with 香港繁體 translations, CEFR levels, and examples. Works offline on the MTR.",
  },
  twitter: {
    card: "summary_large_image",
    title: "英漢詞典 · English → 香港繁體",
    description:
      "Look up English words with 香港繁體 translations, CEFR levels, and examples.",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#C0362B" },
    { media: "(prefers-color-scheme: dark)", color: "#1A1916" },
  ],
};

const themeScript = `(function(){try{var k="cha-theme";var s=localStorage.getItem(k);var t=s==="dark"||s==="light"?s:(matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light");document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
