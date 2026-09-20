import type { Metadata } from "next";
import ProductLanding from "@/app/components/product-landing";

export const metadata: Metadata = {
  title: "Rallora Leagues | Rallora",
  description: "League, fixtures and competition management for padel clubs.",
};

export default function Page() {
  return <ProductLanding product="leagues" />;
}
