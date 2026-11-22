import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aegis AI Governance Platform",
    short_name: "Aegis",
    description:
      "Evidence-based enterprise AI governance and agent appraisal platform operationalising FRAME and AAEF.",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1120",
    theme_color: "#0072B2",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
