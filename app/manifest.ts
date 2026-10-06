import type { MetadataRoute } from "next";

/** Makes KASSIX installable ("Add to Home Screen" / "Install app"): it opens full-screen from its own icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KASSIX Point of Sale",
    short_name: "KASSIX",
    description: "A cash register on your computer, tablet or phone.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#008080",
    theme_color: "#008080",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Padded on teal so Android's round or squircle masks don't clip the window.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Android: long-press the home-screen icon to jump straight to these.
    shortcuts: [
      { name: "New sale", url: "/sale", icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png" }] },
      { name: "Sales", url: "/sales", icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png" }] },
      { name: "Products", url: "/products", icons: [{ src: "/icon.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
