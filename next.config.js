const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Service workers are a nuisance in dev (stale caching mid-edit), and
  // Coolify's health check / local `npm run build` verification here both
  // run with NODE_ENV=production, so this only ever activates for real
  // builds.
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = withPWA(nextConfig);
