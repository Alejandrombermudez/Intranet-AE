import { NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { renderizar } from '@/lib/sistema/markdown'
import { DOCUMENTOS } from '@/lib/sistema/bitacora'

/**
 * SERVIR UN DOCUMENTO MAESTRO
 * ───────────────────────────
 * Los documentos de arquitectura viven en `docs/*.md` y siguen siendo la fuente:
 * se editan ahí, con git encima. Esta ruta los lee del disco y los convierte a
 * HTML para mostrarlos dentro de la intranet — no guarda una copia, así que un
 * documento corregido en el repositorio queda corregido en la página.
 *
 * Solo se sirven los archivos declarados en `DOCUMENTOS`. El nombre que llega
 * por la URL nunca se usa para armar una ruta: se busca en esa lista y se usa
 * el de la lista. Así, pedir `../../.env` no encuentra nada que servir.
 */

export const dynamic = 'force-dynamic'

const CARPETA = path.join(process.cwd(), 'docs')

export async function GET(req: Request) {
  const pedido = new URL(req.url).searchParams.get('archivo') ?? ''

  const doc = DOCUMENTOS.find((d) => d.archivo === pedido)
  if (!doc) {
    return NextResponse.json(
      { error: 'Ese documento no está en la lista de documentos del sistema.' },
      { status: 404 },
    )
  }

  try {
    const crudo = await readFile(path.join(CARPETA, doc.archivo), 'utf-8')
    const { html, secciones } = renderizar(crudo)
    return NextResponse.json(
      { archivo: doc.archivo, titulo: doc.titulo, html, secciones },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      {
        error:
          `El documento «${doc.titulo}» está declarado pero no se encontró en la carpeta docs/. ` +
          'Puede que lo hayan movido o renombrado.',
      },
      { status: 404 },
    )
  }
}
