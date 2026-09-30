import Image from "next/image";

type RalloraLogoProps = {
  variant?: "light" | "dark";
  width?: number;
  className?: string;
};

/**
 * Approved Rallora wordmark from the locked brand board.
 * "light" = navy + cyan for pale surfaces; "dark" = white + cyan on navy.
 * Custom wordmark must always use the artwork, never recreated as live text.
 */
export default function RalloraLogo({
  variant = "light", width = 218, className,
}: RalloraLogoProps) {
  return <Image
    src={`/brand/rallora-horizontal-${variant}.svg`}
    alt="Rallora"
    width={width}
    height={Math.round(width * 120 / 620)}
    className={className}
    style={{ display: "block", width, maxWidth: "100%", height: "auto" }}
  />;
}
