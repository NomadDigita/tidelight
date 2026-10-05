import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tidelight — Market Research Desk",
    short_name: "Tidelight",
    description: "See the signal between sessions.",
    start_url: "/",
    display: "standalone",
    background_color: "#081316",
    theme_color: "#0b191b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
