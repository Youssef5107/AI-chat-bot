import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/chat": ["./node_modules/onnxruntime-node/bin/napi-v3/**/*"],
  },
};

export default nextConfig;
