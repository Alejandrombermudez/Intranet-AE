import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Intranet AE",
  description: "Plataforma de gestión",
  manifest: "/manifest.json", // Conectamos el manifiesto
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Intranet AE",
  },
};

export const viewport: Viewport = {
  themeColor: "#15803d", // Color verde de la barra de estado en Android
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false, // Evita que hagan zoom y se sienta como app nativa
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
