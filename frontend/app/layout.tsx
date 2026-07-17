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
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ffffff'><path d='M10.2 3c0-1.105.696-2 1.8-2s1.8.895 1.8 2l.2 8c0-.364.5-5.66.5-6c0-1 .595-2 1.7-2s1.8.895 1.8 2v7.268c.083-.048.3-3.846.3-4.268c0-1 .263-2 1.2-2c.938 0 1.5.895 1.5 2v6a8 8 0 0 1-8 8h-.674a8 8 0 0 1-7.155-4.422l-2.842-5.684c-.364-.728-.084-1.668.72-2.024c.423-.187.897-.292 1.343-.15c1.108.353.944.86 1.608 1.49V5c0-1.105.695-2 1.8-2c1 0 1.609 1.315 1.7 2c.125.938.5 5.634.5 5.998z'/></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

import Script from "next/script";
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
        <Script id="anti-devtools" strategy="beforeInteractive">
          {`
            document.addEventListener("contextmenu", e => e.preventDefault());
            document.addEventListener("keydown", e => {
              if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "C" || e.key === "c" || e.key === "J" || e.key === "j")) || (e.ctrlKey && e.key === "U")) {
                e.preventDefault();
              }
            });
          `}
        </Script>
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
