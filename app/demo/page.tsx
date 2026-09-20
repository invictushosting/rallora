import type { Metadata } from "next";
import DemoClub from "./demo-club";

export const metadata: Metadata = {
  title: "Try Rallora | Demo club",
  description: "Explore a fictional padel club: fixtures, results and league tables, with captain and organiser previews. No login required.",
};

export default function DemoPage() {
  return <DemoClub />;
}
