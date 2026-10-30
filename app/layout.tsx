import type { Metadata, Viewport } from "next";
import { Fraunces, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import InstallPrompt from "./components/InstallPrompt";
import RegistroAcceso from "./components/RegistroAcceso";
import BotonActualizar from "./components/BotonActualizar";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Poppins para el cuerpo y la interfaz, como en los documentos de la organización;
// Fraunces —una serif de trazo suave— para los títulos (clase font-titulo, y h1/h2).
// Hasta el 2026-10-15 los títulos iban en Josefin Sans; lo que todavía pide
// --font-josefin (Reporte, mapa del sistema) recibe Poppins (ver app/globals.css).
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["SOFT", "opsz"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Intranet AE",
  description: "Intranet de Amazonía Emprende",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Intranet AE",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f3f32",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistMono.variable} ${poppins.variable} ${fraunces.variable} antialiased`}
      >
        {children}
        <InstallPrompt />
        <BotonActualizar />
        <RegistroAcceso />
      </body>
    </html>
  );
}
