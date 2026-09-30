import Image from "next/image";

type RalloraLogoProps = {
  variant?: "light" | "dark";
  width?: number;
  className?: string;
};

/**
 * Rallora approved board-exact master artwork.
 * Uses the locked PNG masters uploaded to public/brand.
 * Do not redraw or recreate the wordmark or ball in code.
 */
export default function RalloraLogo({
  variant = "light", width = 218, className,
}: RalloraLogoProps) {
  return <Image
    src={`/brand/rallora-horizontal-${variant}.png`}
    alt="Rallora"
    width={width}
    height={Math.round(width * 115 / 462)}
    className={className}
    style={{ display: "block", width, maxWidth: "100%", height: "auto" }}
    priority
  />;
}
