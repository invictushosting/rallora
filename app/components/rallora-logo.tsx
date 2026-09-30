import Image from "next/image";

type RalloraLogoProps = {
  variant?: "light" | "dark";
  width?: number;
  className?: string;
};

/**
 * Rallora Brand Master v2 artwork.
 * Uses the approved transparent production masters in public/brand.
 * Do not redraw, trace or recreate the R, wordmark or ball in code.
 */
export default function RalloraLogo({
  variant = "light", width = 218, className,
}: RalloraLogoProps) {
  return <Image
    src={`/brand/rallora-horizontal-${variant}-transparent.png`}
    alt="Rallora"
    width={width}
    height={Math.round(width * 115 / 462)}
    className={className}
    style={{ display: "block", width, maxWidth: "100%", height: "auto" }}
    priority
  />;
}
