'use client'

/**
 * LA VISTA DE LA DOCUMENTACIÓN
 * ────────────────────────────
 * Separada de la página por la misma razón que el mapa: la página decide quién
 * entra, esto solo pinta. Así se puede revisar la vista sin pasar por el login.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MARCA } from '@/lib/expediente-formato'
import {
  BITACORA, DOCUMENTOS, FRENTES_ABIERTOS, TIPO_LABEL,
  fechaLarga, porMes,
  type Entrada, type TipoEntrada,
} from '@/lib/sistema/bitacora'
import { APP_POR_ID, ETAPA_POR_ID } from '@/lib/sistema/mapa'
import type { Seccion } from '@/lib/sistema/markdown'
import { TIPOGRAFIA, Plegable } from '../piezas'
import { FileText, Loader2 } from 'lucide-react'

const COLOR_TIPO: Record<TipoEntrada, string> = {
  decision: MARCA.pizarra,
  cambio: MARCA.bosque,
  problema: MARCA.marron,
  hito: MARCA.musgo,
}

// ─── Bitácora ─────────────────────────────────────────────────────────────────

export function Bitacora() {
  const [filtro, setFiltro] = useState<TipoEntrada | 'todo'>('todo')

  const entradas = useMemo(
    () => (filtro === 'todo' ? BITACORA : BITACORA.filter((e) => e.tipo === filtro)),
    [filtro],
  )
  const meses = useMemo(() => porMes(entradas), [entradas])

  const conteos = useMemo(() => {
    const c: Record<string, number> = { todo: BITACORA.length }
    for (const e of BITACORA) c[e.tipo] = (c[e.tipo] ?? 0) + 1
    return c
  }, [])

  return (
    <>
      <section className="pt-9 pb-6">
        <p className="max-w-[74ch] text-[14px] leading-relaxed" style={{ color: '#453f37' }}>
          Por qué el sistema es como es. Cada entrada dice qué pasaba antes y qué quedó — la primera
          mitad es la que normalmente se pierde, y es la que evita volver a discutir algo ya cerrado.
        </p>
      </section>

      {/* Frentes abiertos, primero: es lo que alguien necesita saber hoy */}
      <section className="mb-10">
        <h2
          className="mb-3 text-[13px] uppercase"
          style={{ letterSpacing: '.14em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: '#8a5f14' }}
        >
          Lo que hoy no funciona
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {FRENTES_ABIERTOS.map((f) => (
            <div
              key={f.id}
              className="rounded-xl p-4"
              style={{ background: '#f6f0e4', border: '1px solid #e6dcc6' }}
            >
              <h3
                className="text-[13.5px] leading-snug"
                style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
              >
                {f.titulo}
              </h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed" style={{ color: '#5d564b' }}>{f.cuerpo}</p>
              <p className="mt-2 text-[12px] leading-relaxed" style={{ color: '#8a5f14' }}>
                <b style={{ fontWeight: 600 }}>Cuesta:</b> {f.costo}
              </p>
              {f.etapas && f.etapas.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {f.etapas.map((id) => (
                    <Link
                      key={id}
                      href="/intranet/sistema"
                      className="rounded px-1.5 py-0.5 text-[10px] transition-opacity hover:opacity-70"
                      style={{ background: '#eee5d3', color: '#6f675c' }}
                    >
                      {ETAPA_POR_ID.get(id)?.nombre ?? id}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Filtros */}
      <div className="mb-6 flex flex-wrap gap-1.5" style={{ borderTop: '1px solid #e0d9cb', paddingTop: 20 }}>
        {(['todo', 'decision', 'cambio', 'hito', 'problema'] as const).map((t) => {
          const activo = filtro === t
          const label = t === 'todo' ? 'Todo' : TIPO_LABEL[t]
          return (
            <button
              key={t}
              onClick={() => setFiltro(t)}
              className="rounded-full px-3 py-1.5 text-[11.5px] transition-colors"
              style={{
                fontFamily: TIPOGRAFIA.titulo,
                fontWeight: 600,
                background: activo ? MARCA.tinta : '#ece5d8',
                color: activo ? MARCA.papel : '#6f675c',
              }}
            >
              {label} <span style={{ opacity: 0.6 }}>{conteos[t] ?? 0}</span>
            </button>
          )
        })}
      </div>

      {/* Línea de tiempo */}
      <div className="space-y-9">
        {meses.map(({ mes, etiqueta, entradas }) => (
          <section key={mes}>
            <h2
              className="mb-4 text-[11px] uppercase"
              style={{ letterSpacing: '.16em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: '#a39a8b' }}
            >
              {etiqueta}
            </h2>
            <div className="space-y-3">
              {entradas.map((e) => <TarjetaEntrada key={e.id} entrada={e} />)}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

function TarjetaEntrada({ entrada }: { entrada: Entrada }) {
  const color = COLOR_TIPO[entrada.tipo]
  return (
    <article
      className="rounded-xl p-5"
      style={{ background: '#faf8f3', border: '1px solid #e4ddcf', borderLeft: `3px solid ${color}` }}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className="text-[9.5px] uppercase"
          style={{ letterSpacing: '.13em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 700, color }}
        >
          {TIPO_LABEL[entrada.tipo]}
        </span>
        <span className="text-[11px]" style={{ color: '#a39a8b' }}>{fechaLarga(entrada.fecha)}</span>
        {entrada.abierto && (
          <span
            className="rounded px-1.5 py-0.5 text-[9.5px]"
            style={{ background: '#f4e7cd', color: '#8a5f14' }}
          >
            sigue abierto
          </span>
        )}
      </div>

      <h3
        className="text-[16px] leading-snug"
        style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
      >
        {entrada.titulo}
      </h3>

      <div className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
        <div>
          <div
            className="mb-1 text-[9px] uppercase"
            style={{ letterSpacing: '.17em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: '#a39a8b' }}
          >
            Qué pasaba
          </div>
          <p className="text-[12.5px] leading-relaxed" style={{ color: '#5d564b' }}>{entrada.porque}</p>
        </div>
        <div>
          <div
            className="mb-1 text-[9px] uppercase"
            style={{ letterSpacing: '.17em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: '#a39a8b' }}
          >
            Qué quedó
          </div>
          <p className="text-[12.5px] leading-relaxed" style={{ color: '#3b352e' }}>{entrada.quedo}</p>
        </div>
      </div>

      {(entrada.etapas?.length || entrada.apps?.length) && (
        <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
          {entrada.etapas?.map((id) => (
            <span
              key={id}
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{ background: '#ece5d8', color: '#6f675c' }}
            >
              {ETAPA_POR_ID.get(id)?.nombre ?? id}
            </span>
          ))}
          {entrada.apps?.map((id) => (
            <span
              key={id}
              className="rounded px-1.5 py-0.5 text-[10px]"
              style={{ background: '#e6ecec', color: MARCA.pizarra }}
            >
              {APP_POR_ID.get(id)?.nombre ?? id}
            </span>
          ))}
        </div>
      )}

      {entrada.detalle && (
        <div className="mt-2" style={{ borderTop: '1px solid #ece5d8' }}>
          <Plegable titulo="Detalle">
            <p className="pb-1 text-[12px] leading-relaxed" style={{ color: '#5d564b' }}>{entrada.detalle}</p>
          </Plegable>
        </div>
      )}
    </article>
  )
}

// ─── Documentos ───────────────────────────────────────────────────────────────

interface DocCargado {
  archivo: string
  titulo: string
  html: string
  secciones: Seccion[]
}

export function Documentos() {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [doc, setDoc] = useState<DocCargado | null>(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function abrir(archivo: string) {
    if (abierto === archivo) {
      setAbierto(null)
      setDoc(null)
      setError(null)
      return
    }
    setAbierto(archivo)
    setDoc(null)
    setError(null)
    setCargando(true)
    try {
      const r = await fetch(`/api/sistema/doc?archivo=${encodeURIComponent(archivo)}`)
      const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'No se pudo leer el documento.')
      setDoc(d as DocCargado)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el documento.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <>
      <section className="pt-9 pb-6">
        <p className="max-w-[74ch] text-[14px] leading-relaxed" style={{ color: '#453f37' }}>
          Los documentos de fondo del ecosistema. Se leen del repositorio cada vez que se abren, así que
          esta página no tiene una copia que se pueda quedar vieja: lo que se corrija allá, se corrige aquí.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <nav className="space-y-1.5 self-start lg:sticky lg:top-20">
          {DOCUMENTOS.map((d) => {
            const activo = abierto === d.archivo
            return (
              <button
                key={d.archivo}
                onClick={() => void abrir(d.archivo)}
                className="w-full rounded-lg p-3 text-left transition-all"
                style={{
                  background: activo ? '#f0ede3' : '#faf8f3',
                  border: `1px solid ${activo ? MARCA.bosque : '#e4ddcf'}`,
                }}
              >
                <div className="flex items-start gap-2">
                  <FileText size={14} style={{ color: '#a39a8b', marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div
                      className="text-[13px] leading-snug"
                      style={{ fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: MARCA.tinta }}
                    >
                      {d.titulo}
                    </div>
                    <p className="mt-1 text-[11.5px] leading-snug" style={{ color: '#8b8375' }}>
                      {d.de_que_trata}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </nav>

        <div>
          {!abierto && (
            <div
              className="rounded-xl p-10 text-center"
              style={{ background: '#faf8f3', border: '1px dashed #ddd5c7' }}
            >
              <p className="text-[13px]" style={{ color: '#8b8375' }}>
                Elige un documento de la lista para leerlo aquí.
              </p>
            </div>
          )}

          {cargando && (
            <div className="grid place-items-center py-16">
              <Loader2 className="animate-spin" size={22} style={{ color: MARCA.bosque }} />
            </div>
          )}

          {error && (
            <div className="rounded-xl p-5" style={{ background: '#f6ecec', border: '1px solid #e0cfcf' }}>
              <p className="text-[13px]" style={{ color: MARCA.marron }}>{error}</p>
            </div>
          )}

          {doc && !cargando && (
            <article
              className="doc rounded-xl px-8 py-7"
              style={{ background: '#faf8f3', border: '1px solid #e4ddcf' }}
            >
              <div
                className="mb-5 text-[10px] uppercase"
                style={{ letterSpacing: '.15em', fontFamily: TIPOGRAFIA.titulo, fontWeight: 600, color: '#a39a8b' }}
              >
                docs / {doc.archivo}
              </div>
              <div dangerouslySetInnerHTML={{ __html: doc.html }} />
            </article>
          )}
        </div>
      </div>

      <EstilosDocumento />
    </>
  )
}

/**
 * Estilos del documento renderizado. Van aquí y no en globals.css porque solo
 * aplican a esta vista, y así el markdown convertido no arrastra estilos al
 * resto de la intranet.
 */
function EstilosDocumento() {
  return (
    <style>{`
      .doc { color: #3b352e; font-size: 13.5px; line-height: 1.7; }
      .doc h1, .doc h2, .doc h3, .doc h4, .doc h5, .doc h6 {
        font-family: ${TIPOGRAFIA.titulo}; font-weight: 600; color: ${MARCA.tinta};
        line-height: 1.25; margin: 1.7em 0 .6em;
      }
      .doc h1 { font-size: 24px; margin-top: 0; }
      .doc h2 { font-size: 19px; padding-top: .5em; border-top: 1px solid #ece5d8; }
      .doc h3 { font-size: 16px; }
      .doc h4, .doc h5, .doc h6 { font-size: 14px; }
      .doc p { margin: .8em 0; }
      .doc ul, .doc ol { margin: .8em 0; padding-left: 1.4em; }
      .doc li { margin: .35em 0; }
      .doc ul { list-style: disc; }
      .doc ol { list-style: decimal; }
      .doc a { color: ${MARCA.pizarra}; text-decoration: underline; text-underline-offset: 2px; }
      .doc strong { font-weight: 600; color: ${MARCA.tinta}; }
      .doc del { color: #a39a8b; }
      .doc code {
        font-family: var(--font-geist-mono), ui-monospace, monospace;
        font-size: .88em; background: #efe9dc; padding: .12em .38em; border-radius: 3px;
        color: ${MARCA.pizarra};
      }
      .doc pre {
        background: #f0ece2; border: 1px solid #e4ddcf; border-radius: 8px;
        padding: 14px 16px; overflow-x: auto; margin: 1em 0;
      }
      .doc pre code { background: none; padding: 0; font-size: 11.5px; line-height: 1.55; color: #4a443b; }
      .doc blockquote {
        border-left: 3px solid #d9d0be; padding: .1em 0 .1em 1.1em; margin: 1.1em 0; color: #6f675c;
      }
      .doc blockquote p { margin: .5em 0; }
      .doc hr { border: none; border-top: 1px solid #e4ddcf; margin: 1.8em 0; }
      .doc .md-tabla { overflow-x: auto; margin: 1.1em 0; }
      .doc table { border-collapse: collapse; width: 100%; font-size: 12px; }
      .doc th, .doc td {
        border: 1px solid #e4ddcf; padding: 7px 10px; text-align: left; vertical-align: top;
      }
      .doc th {
        background: #f0ece2; font-family: ${TIPOGRAFIA.titulo}; font-weight: 600;
        font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: #6f675c;
      }
      .doc .md-nota {
        font-size: 10px; text-transform: uppercase; letter-spacing: .14em;
        color: #a39a8b; margin: 1em 0 -.6em;
      }
    `}</style>
  )
}
