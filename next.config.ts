import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // initial-batch ルートが fetcher 経由で jsdom を使うため、バンドルせず Node の require を使う
  serverExternalPackages: ["jsdom"],
};

export default nextConfig;
