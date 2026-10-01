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
          backgroundColor: "#061A39",
        }}
      >
        <img
          src="https://rallora.app/brand/rallora-logo-dark.svg"
          width="920"
          height="216"
          alt="Rallora"
        />
      </div>
    ),
    {
      width: 1024,
      height: 240,
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
