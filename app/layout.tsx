import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./onboarding.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Rallora",
  description: "Rallora. The connected padel league platform for clubs, players and communities.",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Rallora",
    description: "Fixtures, league tables, results and club competitions. Padel, connected.",
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
  themeColor: "#061A39",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
