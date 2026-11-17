import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import "./globals.css";
import "./onboarding.css";
import RalloraGuide from "./components/rallora-guide";
import ScrollToTop from "./components/scroll-to-top";
import NavigationLoader from "./components/navigation-loader";
import SuperAdminNavigation from "./components/super-admin-navigation";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.rallora.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Rallora",
  description: "Rallora. The connected padel league platform for clubs, players and communities.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon.ico?v=3", sizes: "any" },
      { url: "/brand/rallora-app-icon.svg?v=3", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png?v=3", sizes: "16x16", type: "image/png" }
    ],
    apple: [{ url: "/brand/apple-touch-icon-180.png?v=3", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Rallora",
    description: "Fixtures, league tables, results and club competitions. Padel, connected.",
    url: siteUrl,
    siteName: "Rallora",
    type: "website",
    images: [{
      url: "/brand/rallora-social-master-v3.png",
      width: 1200,
      height: 630,
      alt: "Rallora: the padel league platform",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rallora | The padel league platform",
    description: "Clubs. Players. Leagues. Connected.",
    images: ["/brand/rallora-social-master-v3.png"],
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
      <body><ScrollToTop /><NavigationLoader /><SuperAdminNavigation />{children}<Suspense fallback={null}><RalloraGuide /></Suspense></body>
    </html>
  );
}
