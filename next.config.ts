import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep these external so their bundled worker/asset files (e.g. pdf-parse's
  // PDF worker) resolve from node_modules at runtime instead of being traced
  // into the server chunks, where they go missing.
  serverExternalPackages: ["better-sqlite3", "pdf-parse", "mammoth", "sharp"],
};

export default nextConfig;
