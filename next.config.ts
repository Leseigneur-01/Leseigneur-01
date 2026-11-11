import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.pexels.com",
      },
    ],
  },
  // Les fichiers clients (jusqu'à 1 Go) sont streamés vers le disque : pas de limite de corps ici.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
