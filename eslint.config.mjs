import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  {
    rules: {
      // Existing data-loading effects intentionally reset local view state.
      // Refactor these incrementally with route-level tests instead of changing
      // production behaviour as part of the lint-tool migration.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["app/clubs/gsm-padel/legacy/page.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "next-env.d.ts",
    "debug-supabase.cjs",
    "scripts/apply-*.cjs",
  ]),
]);
