import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "GSM Padel League Hub",
  description: "Private club league manager for GSM Padel",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "GSM Padel League Hub",
    description: "Club padel league tables, fixtures, results and cup hub.",
    url: siteUrl,
    siteName: "GSM Padel League Hub",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: "GSM Padel",
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
