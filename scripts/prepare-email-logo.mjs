import { mkdir, writeFile } from "node:fs/promises";

const source = "https://rallora.app/brand/rallora-email-logo-v5.png";
const output = new URL("../public/brand/rallora-email-logo-final.png", import.meta.url);

const response = await fetch(source, { cache: "no-store" });
if (!response.ok) throw new Error(`Failed to fetch approved email logo: ${response.status}`);

const contentType = response.headers.get("content-type") || "";
if (!contentType.toLowerCase().startsWith("image/png")) {
  throw new Error(`Expected image/png, received ${contentType || "unknown"}`);
}

const bytes = new Uint8Array(await response.arrayBuffer());
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
if (bytes.length < pngSignature.length || !pngSignature.every((v, i) => bytes[i] === v)) {
  throw new Error("Approved email logo response is not a valid PNG");
}

await mkdir(new URL("../public/brand/", import.meta.url), { recursive: true });
await writeFile(output, bytes);
console.log(`Prepared static email logo (${bytes.length} bytes)`);
