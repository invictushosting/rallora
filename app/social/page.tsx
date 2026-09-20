import type { Metadata } from "next";
import ProductLanding from "@/app/components/product-landing";

export const metadata: Metadata = {
  title: "Rallora Social | Rallora",
  description: "Create club news and share-ready results for the channels your players use.",
};

export default function Page() {
  return <ProductLanding product="social" />;
}
