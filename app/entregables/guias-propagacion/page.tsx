/**
 * GUÍAS DE PROPAGACIÓN — entregable del BID Lab (Componente 3, Centro de Semillas Nativas).
 *
 * Página pública de solo lectura, para compartir el enlace con el BID y aliados.
 * No muestra ni enlaza nada de la intranet. Lista los PDF que haya en
 * public/entregables/guias-propagacion/ al construir: para cambiar una guía basta
 * reemplazar el archivo (mismo nombre) y desplegar.
 *
 * Los PDF no entran en la caché del service worker (ver publicExcludes en next.config.ts).
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import { Download, FileText } from 'lucide-react'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Guías de propagación — Amazonía Emprende',
  description: 'Guías de propagación de especies nativas amazónicas. Centro de Semillas Nativas, Amazonía Emprende.',
  robots: { index: false, follow: false },
}

const CARPETA = 'entregables/guias-propagacion'

type Guia = { archivo: string; especie: string; mb: string }

// Los archivos van sin tildes (así los entregó el diseñador); aquí se escriben bien.
const NOMBRE_PROPIO: Record<string, string> = {
  'Bala de Canon': 'Bala de cañón',
  'Copoazu': 'Copoazú',
}

function leerGuias(): Guia[] {
  const dir = path.join(process.cwd(), 'public', CARPETA)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .map((archivo) => {
      const especie = archivo
        .replace(/\.pdf$/i, '')
        .replace(/^gu[ií]a[-_ ]de[-_ ]propagaci[oó]n[-_ ]*/i, '')
        .replace(/\s*\(\d+\)$/, '')
        .replace(/[-_]+/g, ' ')
        .trim()
      const mb = (fs.statSync(path.join(dir, archivo)).size / 1048576).toFixed(1).replace('.', ',')
      return { archivo, especie: NOMBRE_PROPIO[especie] ?? (especie || archivo), mb }
    })
    .sort((a, b) => a.especie.localeCompare(b.especie, 'es'))
}

export default function GuiasPropagacion() {
  const guias = leerGuias()
  return (
    <div className="min-h-screen bg-papel">
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-8">
        <header className="mb-6">
          <p className="text-[10.5px] font-medium uppercase tracking-[.2em] text-musgo">Amazonía Emprende · Centro de Semillas Nativas</p>
          <h1 className="mt-1 font-titulo text-[2rem] font-semibold leading-tight text-bosque">Guías de propagación</h1>
          <p className="mt-2 text-[14px] text-suave">
            Protocolos técnicos para viveristas: de la semilla a la plántula, especie por especie.
            {guias.length > 0 && ` ${guias.length} guías.`}
          </p>
        </header>

        {guias.length === 0 ? (
          <p className="rounded-2xl border border-linea bg-white px-4 py-6 text-center text-[14px] text-suave">Las guías se publican pronto.</p>
        ) : (
          <ul className="space-y-2.5">
            {guias.map((g) => {
              const url = `/${CARPETA}/${encodeURIComponent(g.archivo)}`
              return (
                <li key={g.archivo} className="flex items-center gap-3 rounded-2xl border border-linea bg-white px-4 py-3">
                  <FileText className="h-5 w-5 shrink-0 text-musgo" aria-hidden />
                  <a href={url} target="_blank" rel="noopener" className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-bosque">{g.especie}</span>
                    <span className="block text-[12px] text-suave">PDF · {g.mb} MB · abrir</span>
                  </a>
                  <a href={url} download className="rounded-xl p-2 text-suave transition hover:bg-bosque/5 hover:text-bosque" aria-label={`Descargar guía de ${g.especie}`}>
                    <Download className="h-5 w-5" />
                  </a>
                </li>
              )
            })}
          </ul>
        )}

        <p className="mt-8 text-[12px] text-suave">Con el apoyo de BID Lab.</p>
      </div>
    </div>
  )
}
