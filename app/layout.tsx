import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./onboarding.css";
import RalloraGuide from "./components/rallora-guide";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://rallora-rho.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Rallora | Padel league management for clubs",
  description: "Run padel leagues, results, captain workflows and club social content in one connected platform. Rallora is now onboarding pilot clubs.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Rallora | The smarter way to run padel leagues",
    description: "League management, results, captain workflows and social content for padel clubs. Now onboarding pilot clubs.",
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
    title: "Rallora | The smarter way to run padel leagues",
    description: "League management, results, captain workflows and social content for padel clubs.",
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
      <body>{children}<RalloraGuide /></body>
    </html>
  );
}
