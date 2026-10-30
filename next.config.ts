import type { NextConfig } from "next";

const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public", // Donde pondrá los archivos de la app
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  swcMinify: true,
  disable: process.env.NODE_ENV === "development", // Desactivar en localhost para que no moleste
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  // Commit con el que se construye esta copia; /api/version devuelve el del despliegue vigente
  // y BotonActualizar los compara para avisar que hay una versión nueva.
  env: { NEXT_PUBLIC_VERSION: process.env.VERCEL_GIT_COMMIT_SHA ?? 'local' },
  // Config vacía de turbopack para silenciar el aviso de Next 16
  // (el plugin PWA inyecta webpack config solo en build, no en dev)
  turbopack: {},
};

export default withPWA(nextConfig);