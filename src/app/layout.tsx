import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Orbitron, Rajdhani } from "next/font/google";
import "./globals.css";

const ORBITRON = Orbitron({ variable: "--font-orbitron", subsets: ["latin"], weight: ["500", "700", "900"] });
const RAJDHANI = Rajdhani({ variable: "--font-rajdhani", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const JETBRAINS = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], weight: ["500", "700"] });

export const metadata: Metadata = {
  title: "NEON GOAL — Trail Soccer Arena",
  description: "Draw neon trails, bounce the ball, score goals. Free multiplayer with friends — Solo, Duo, Squad and Chaar Kone.",
};

export const viewport: Viewport = {
  themeColor: "#02030a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html lang="en" className={`${ORBITRON.variable} ${RAJDHANI.variable} ${JETBRAINS.variable} h-full antialiased`}>
    <body className="min-h-full bg-void">{children}</body>
  </html>
);

export default RootLayout;
