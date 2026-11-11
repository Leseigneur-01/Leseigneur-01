import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // Preserve the Next starter rules while excluding generated Vite and private data.
  ...nextCoreWebVitals,
  globalIgnores([".next/**", "out/**", "build/**", "dist/**", "var/**", "next-env.d.ts"]),
  { rules: { "@next/next/no-html-link-for-pages": "off" } },
  {
    // The showcase is a Vite application, not a Next pages directory.
    files: ["src/**/*.{js,jsx}"],
    rules: {
      "@next/next/no-img-element": "off",
    },
  },
]);
