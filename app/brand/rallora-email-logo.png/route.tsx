import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1024px",
          height: "240px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <img
          src="https://rallora.app/brand/rallora-logo-dark.svg"
          width="1024"
          height="240"
          alt="Rallora"
        />
      </div>
    ),
    {
      width: 1024,
      height: 240,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
