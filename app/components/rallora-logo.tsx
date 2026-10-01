import Image from "next/image";

type RalloraLogoProps = {
  variant?: "light" | "dark";
  width?: number;
  className?: string;
};

/**
 * Rallora Gold Master artwork.
 * Uses the approved v3.1 Safe Canvas production SVGs in public/brand.
 * Do not redraw, trace or recreate the R, wordmark or ball in code.
 */
export default function RalloraLogo({
  variant = "light", width = 218, className,
}: RalloraLogoProps) {
  return <Image
    src={`/brand/rallora-logo-${variant}.svg`}
    alt="Rallora"
    width={width}
    height={Math.round(width * 230 / 980)}
    className={className}
    style={{ display: "block", width, maxWidth: "100%", height: "auto" }}
    priority
  />;
}
