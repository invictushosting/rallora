import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./onboarding.css";
import RalloraGuide from "./components/rallora-guide";
import ScrollToTop from "./components/scroll-to-top";
import NavigationLoader from "./components/navigation-loader";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rallora-rho.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Rallora",
  description: "Rallora. The connected padel league platform for clubs, players and communities.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Rallora",
    description: "Fixtures, league tables, results and club competitions. Padel, connected.",
    url: siteUrl,
    siteName: "Rallora",
    type: "website",
    images: [{
      url: "/brand/rallora-social.png",
      width: 1200,
      height: 630,
      alt: "Rallora: the padel league platform",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Rallora | The padel league platform",
    description: "Clubs. Players. Leagues. Connected.",
    images: ["/brand/rallora-social.png"],
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
      <body><ScrollToTop /><NavigationLoader />{children}<RalloraGuide /></body>
    </html>
  );
}
