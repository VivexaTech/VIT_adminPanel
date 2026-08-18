import type { NextConfig } from "next";

/**
 * firebase-admin must stay external on Vercel so Next does not bundle its
 * CommonJS tree. Combined with package.json "overrides" pinning jose@4.15.9,
 * this avoids ERR_REQUIRE_ESM from jwks-rsa requiring ESM-only jose@6.
 */

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "firebase-admin",
    "firebase-admin/app",
    "firebase-admin/auth",
    "firebase-admin/firestore",
    "@google-cloud/firestore",
    "@google-cloud/storage",
    "google-gax",
    "jwks-rsa",
    "jose",
  ],

  async headers() {
    return [
      {
        source: "/api/student/grade-test",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "POST, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
        ],
      },
    ];
  },
};

export default nextConfig;