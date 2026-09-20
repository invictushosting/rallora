type RalloraLogoProps = {
  variant?: "light" | "dark";
  width?: number;
  className?: string;
};

/**
 * Approved Rallora racket-R artwork, traced from the supplied v1 brand board.
 * "light" = navy + cyan for pale surfaces; "dark" = white + cyan on navy.
 * Custom wordmark must always use the artwork, never recreated as live text.
 */
export default function RalloraLogo({
  variant = "light", width = 218, className,
}: RalloraLogoProps) {
  return <img
    src={`/brand/rallora-horizontal-${variant}.svg`}
    alt="Rallora"
    width={width}
    height={Math.round(width * 167 / 581)}
    className={className}
    style={{ display: "block", width, maxWidth: "100%", height: "auto" }}
  />;
}
