import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./styles/signum-globals.css";
import "./styles/transitions.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Signum - LSM",
  description: "Reconocimiento de lenguaje de señas mexicano en tiempo real",
};

import { FluidBackground } from "@/components/layout/FluidBackground";
import { PageTransition } from "@/components/layout/PageTransition";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen bg-transparent text-gray-900">
        <FluidBackground />
        <svg style={{ position: "fixed", width: 0, height: 0 }}>
          <filter id="glass-blur" x="0" y="0" width="100%" height="100%" filterUnits="objectBoundingBox">
            <feTurbulence type="fractalNoise" baseFrequency="0.003 0.007" numOctaves="1" result="turbulence" />
            <feDisplacementMap in="SourceGraphic" in2="turbulence" scale="40" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </svg>
        <PageTransition>{children}</PageTransition>
      </body>
    </html>
  );
}
