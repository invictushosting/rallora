import type { Metadata } from "next";
import ProductLanding from "@/app/components/product-landing";

export const metadata: Metadata = {
  title: "Rallora Interclub | Rallora",
  description: "Future interclub padel competitions connecting clubs and champions.",
};

export default function Page() {
  return <ProductLanding product="interclub" />;
}
