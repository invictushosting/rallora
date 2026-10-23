import type { Metadata } from "next";
import HelpCentre from "./help-centre";
import { safeClubSlug } from "@/lib/help";
export const metadata: Metadata = { title: "Help centre | Rallora", description: "Step-by-step Rallora guides for players, captains and club organisers, including Playtomic setup." };
export default async function HelpPage({ searchParams }: { searchParams: Promise<{ club?: string }> }) {
  const { club } = await searchParams;
  return <HelpCentre club={safeClubSlug(club)} />;
}
