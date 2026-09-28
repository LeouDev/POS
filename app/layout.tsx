import type { Metadata, Viewport } from "next";
import { Silkscreen, VT323 } from "next/font/google";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const silkscreen = Silkscreen({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-silkscreen" });
const vt323 = VT323({ weight: "400", subsets: ["latin"], variable: "--font-vt323" });

export const metadata: Metadata = {
  title: { default: "KASSIX", template: "%s · KASSIX" },
  description: "KASSIX point of sale for small businesses.",
};

export const viewport: Viewport = { themeColor: "#008080" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${silkscreen.variable} ${vt323.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
