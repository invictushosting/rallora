import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./onboarding.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Rallora",
  description: "Club league, fixtures, tables, results and sponsor management by Protego Solutions Ltd.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Rallora",
    description: "Club league tables, fixtures, results and competition hub.",
    url: siteUrl,
    siteName: "Rallora",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: "Rallora",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#2458ff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
