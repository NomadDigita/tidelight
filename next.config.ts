import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // The isolated build runner cannot capture tsc --showConfig correctly;
    // use TypeScript's compiler API, which is also the default for TS 6+.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
