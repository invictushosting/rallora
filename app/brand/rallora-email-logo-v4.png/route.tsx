import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div style={{ width: "1024px", height: "240px", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#061A39" }}>
        <svg width="920" height="216" viewBox="-40 -20 980 230" xmlns="http://www.w3.org/2000/svg">
          <g transform="translate(15,10) scale(.78)">
            <path fill="#FFFFFF" d="M45 23 H179 C199 23 214 38 214 58 V72 C214 90 204 104 188 110 L166 117 L139 82 H153 C161 82 167 77 167 69 C167 61 161 57 153 57 H74 C69 57 66 55 62 51 Z"/>
            <path fill="#FFFFFF" d="M77 82 H127 L178 142 C185 150 190 154 199 155 L186 174 C171 172 161 166 151 155 L117 117 C110 109 101 110 95 118 L72 151 H28 Z"/>
            <circle cx="198" cy="143" r="31" fill="#00B0FE"/>
            <path d="M174 130 C185 130 188 136 192 143 C197 152 203 156 218 156" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round"/>
          </g>
          <g transform="translate(270,27) scale(.78)">
            <path fill="#FFFFFF" d="M0 20h58c22 0 34 13 34 31 0 14-8 25-22 29l25 20H70L48 81H22v19H0V61h57c8 0 13-4 13-11s-5-11-13-11H0V20Z"/>
            <path fill="#FFFFFF" fillRule="evenodd" d="M0 100 39 20h18l40 80H73L48 48 24 100H0Zm33-25h30l8 17H25l8-17Z"/>
            <circle cx="152" cy="86" r="7" fill="#00B0FE"/>
            <path fill="#FFFFFF" d="M0 20h22v61h55v19H0V20Z" transform="translate(213 0)"/>
            <path fill="#FFFFFF" d="M0 20h22v61h55v19H0V20Z" transform="translate(302 0)"/>
            <circle cx="436" cy="60" r="40" fill="#00B0FE"/>
            <path d="M405 43 C419 43 423 51 428 60 C434 72 442 77 462 77" fill="none" stroke="#FFFFFF" strokeWidth="6.45" strokeLinecap="round"/>
            <path fill="#FFFFFF" d="M0 20h58c22 0 34 13 34 31 0 14-8 25-22 29l25 20H70L48 81H22v19H0V61h57c8 0 13-4 13-11s-5-11-13-11H0V20Z" transform="translate(493 0)"/>
            <path fill="#FFFFFF" fillRule="evenodd" d="M0 100 39 20h18l40 80H73L48 48 24 100H0Zm33-25h30l8 17H25l8-17Z" transform="translate(597 0)"/>
            <circle cx="645" cy="86" r="7" fill="#00B0FE"/>
          </g>
        </svg>
      </div>
    ),
    { width: 1024, height: 240, headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
