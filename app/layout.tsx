import type { Metadata, Viewport } from "next";
import { Silkscreen, VT323 } from "next/font/google";
import { PinchGuard } from "@/components/pinch-guard";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const silkscreen = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-silkscreen" });
const vt323 = VT323({ weight: "400", subsets: ["latin"], variable: "--font-vt323" });

export const metadata: Metadata = {
  title: { default: "KASSIX", template: "%s · KASSIX" },
  description: "KASSIX point of sale for small businesses.",
  // iPhone and iPad: a home-screen KASSIX opens full-screen, titled "KASSIX".
  appleWebApp: { title: "KASSIX", statusBarStyle: "default" },
};

// Like a native app: the app screens (and sign-in, billing) don't pinch- or double-tap-zoom, so a tap
// at the register never zooms the page. The public site re-enables zoom in app/(site)/layout.tsx.
// Edge to edge on iPhone: the taskbar and tab bar pad themselves clear of the home bar (safe-area insets).
export const viewport: Viewport = {
  themeColor: "#008080",
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${silkscreen.variable} ${vt323.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <PinchGuard />
      </body>
    </html>
  );
}
