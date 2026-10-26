import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // o pdfjs lê o PDF do ERP no servidor; fica fora do empacotamento (carrega do node_modules)
  serverExternalPackages: ["pdfjs-dist"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
