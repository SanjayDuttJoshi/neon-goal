import type { NextConfig } from "next";

/** GitHub Pages serves the game from /<repo-name>; `npm run deploy` sets this, local builds stay at /. */
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "";

const NEXT_CONFIG: NextConfig = {
  output: "export",
  basePath: BASE_PATH,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default NEXT_CONFIG;
