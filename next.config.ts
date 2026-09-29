import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev "N" badge sits bottom-left, exactly over the taskbar's Start button.
  devIndicators: false,
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No other site may frame KASSIX (clickjacking); X-Frame-Options covers older browsers.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Sends only the origin to other sites (YouTube's player needs it to play the embed).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
