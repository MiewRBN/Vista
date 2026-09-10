import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.18.93",
    "192.168.18.93:3000",
    "localhost",
    "127.0.0.1",
  ],
};

export default nextConfig;
