'use client'
import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import type { Expediente, ZonaEvaluada } from '@/app/api/reporte/expediente/route'
import type { CapaCampo } from '@/app/components/MapaCampo'
import type { Geometry } from 'geojson'
import Isotipo from '@/app/components/Isotipo'
import {
  pares, adjuntos, etiqueta, valor, ha, fecha, SEMAFORO, ACCION, MARCA,
} from '@/lib/expediente-formato'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'

// Leaflet no sobrevive al render en servidor.
const MapaCampo = dynamic(() => import('@/app/components/MapaCampo'), {
  ssr: false,
  loading: () => <div className="w-full h-96 animate-pulse" style={{ background: '#e9e4da' }} />,
})

/**
 * Estilos de mapa en la paleta del manual, para que el mapa y el documento
 * hablen el mismo idioma. El SIG conserva aparte sus colores de campo.
 */
const MAPA_MARCA = {
  finca:      { color: MARCA.tinta,   weight: 1.6, dashArray: '7 5', fill: false },
  antes:      { color: MARCA.taupe,   weight: 1.4, dashArray: '3 4', fillColor: MARCA.taupe,   fillOpacity: 0.10 },
  confirmada: { color: MARCA.bosque,  weight: 2.2, fillColor: MARCA.bosque,  fillOpacity: 0.22 },
  modificada: { color: MARCA.pizarra, weight: 2.2, fillColor: MARCA.pizarra, fillOpacity: 0.22 },
  nueva:      { color: MARCA.musgo,   weight: 2.2, fillColor: MARCA.musgo,   fillOpacity: 0.22 },
  descartada: { color: MARCA.taupe,   weight: 1.6, dashArray: '4 5', fillColor: MARCA.taupe, fillOpacity: 0.14 },
}

// ─────────────────────────────────────────────────────────────────────────────
// Piezas del documento. Todo se apoya en tipografía y filetes: sin cajas de
// color, sin píldoras, sin iconos decorativos.
// ─────────────────────────────────────────────────────────────────────────────

/** Rótulo pequeño en versalitas con tracking amplio — el gesto del manual. */
function Rotulo({ children, tono = 'tenue' }: { children: React.ReactNode; tono?: 'tenue' | 'bosque' }) {
  return (
    <p className="ae-rotulo" style={{ color: tono === 'bosque' ? MARCA.bosque : 'var(--ae-tenue)' }}>
      {children}
    </p>
  )
}

function Seccion({ n, titulo, sub, children }: {
  n: string; titulo: string; sub?: string; children: React.ReactNode
}) {
  return (
    <section className="ae-seccion">
      <header className="ae-seccion-cab">
        <span className="ae-seccion-num">{n}</span>
        <h2 className="ae-seccion-tit">{titulo}</h2>
      </header>
      {sub && <p className="ae-seccion-sub">{sub}</p>}
      {children}
    </section>
  )
}

/** Rejilla etiqueta/valor, separada por filetes en vez de por recuadros. */
function Ficha({ datos, vacio = 'Sin información registrada' }: {
  datos: { clave: string; etiqueta: string; valor: string | null; largo: boolean }[]
  vacio?: string
}) {
  if (!datos.length) return <p className="ae-vacio">{vacio}</p>
  return (
    <dl className="ae-ficha">
      {datos.map(d => (
        <div key={d.clave} className={d.largo ? 'ae-campo ae-campo-ancho' : 'ae-campo'}>
          <dt>{d.etiqueta}</dt>
          <dd>{d.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="ae-bloque">
      <Rotulo tono="bosque">{titulo}</Rotulo>
      {children}
    </div>
  )
}

/** Marca de estado: un cuadro de color y la palabra. Nada más. */
function Marca({ hex, children }: { hex: string; children: React.ReactNode }) {
  return (
    <span className="ae-marca">
      <i style={{ background: hex }} />{children}
    </span>
  )
}

function Galeria({ items }: { items: { clave: string; etiqueta: string; url: string }[] }) {
  if (!items.length) return null
  return (
    <div className="ae-galeria">
      {items.map(f => (
        <figure key={f.clave + f.url}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={f.url} alt={f.etiqueta} />
          <figcaption>{f.etiqueta}</figcaption>
        </figure>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * El expediente del predio como documento corporativo, construido sobre el
 * Manual de Identidad de Marca 2024: hueso y verde bosque, Josefin Sans para
 * los títulos y Poppins para el cuerpo. No sabe de rutas ni de sesión — recibe
 * el expediente ya armado.
 */
export default function InformeExpediente({ exp }: { exp: Expediente }) {
  // ── Cartografía: finca de fondo, zonas encima, y el antes/después de campo ──
  const capas = useMemo<CapaCampo[]>(() => {
    if (!exp) return []
    const out: CapaCampo[] = []
    // Una geometría rota no puede tumbar el informe entero: Leaflet lanza
    // "Invalid GeoJSON object" y se lleva por delante toda la página.
    const usable = (g: unknown): g is Geometry =>
      !!g && typeof g === 'object' && typeof (g as { type?: unknown }).type === 'string'
    for (const z of exp.zonas) {
      if (!usable(z.geojson)) continue
      out.push({
        id: z.id,
        geom: z.geojson,
        tipo: z.tipo === 'finca' ? 'finca' : z.estado === 'descartada' ? 'descartada' : 'confirmada',
        etiqueta: `${z.nombre ?? z.tipo ?? 'Zona'} · ${ha(z.area_ha)}`,
      })
    }
    for (const r of exp.revisiones) {
      if (usable(r.geom_original)) {
        out.push({ id: `antes-${r.zona_id ?? r.created_at}`, geom: r.geom_original, tipo: 'antes', etiqueta: 'Como la propuso la oficina' })
      }
      if (usable(r.geom_corregida) && r.accion !== 'confirmada') {
        out.push({
          id: `dsp-${r.zona_id ?? r.created_at}`,
          geom: r.geom_corregida,
          tipo: r.accion === 'nueva' ? 'nueva' : r.accion === 'descartada' ? 'descartada' : 'modificada',
          etiqueta: `${ACCION[r.accion]?.label ?? r.accion} en terreno`,
        })
      }
    }
    return out
  }, [exp])

  const zonasSiembra = useMemo(() => exp.zonas.filter(z => z.tipo !== 'finca'), [exp])
  const finca = useMemo(() => exp.zonas.find(z => z.tipo === 'finca') ?? null, [exp])

  const areaSiembra = useMemo(
    () => zonasSiembra.filter(z => z.estado !== 'descartada')
      .reduce((s, z) => s + Number(z.area_ha ?? 0), 0), [zonasSiembra])

  const conteoAcciones = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of exp.revisiones) c[r.accion] = (c[r.accion] ?? 0) + 1
    return Object.entries(c).map(([accion, n]) => ({
      accion: ACCION[accion]?.label ?? accion, n, hex: ACCION[accion]?.hex ?? MARCA.taupe,
    }))
  }, [exp])

  const datosZonas = useMemo(() =>
    zonasSiembra.map((z, i) => ({
      nombre: z.nombre ?? `Zona ${i + 1}`,
      area: Number(z.area_ha ?? 0),
      hex: z.estado === 'descartada' ? MARCA.taupe : z.estado === 'validada' ? MARCA.bosque : MARCA.musgo,
    })), [zonasSiembra])

  /** La evaluación biofísica viene por zona; se cruza con la zona del SIG para
   *  titular cada bloque con el nombre real en vez de "zona 1". */
  const evalPorZona = useMemo(() => {
    const mapa = new Map(exp.zonas.map(z => [z.id, z]))
    return (exp.evaluacion?.zonas ?? []).map((ze: ZonaEvaluada) => ({
      ...ze, zona: ze.zona_id ? mapa.get(ze.zona_id) ?? null : null,
    }))
  }, [exp])

  const p = exp.predio
  const sem = exp.juridica.analisis?.semaforo as string | undefined
  const semCfg = sem ? SEMAFORO[sem] : undefined
  const ubicacion = [p.vereda, p.municipio, p.departamento].filter(Boolean).join(' · ')

  const SECCIONES_ENCUESTA = [
    { id: 'general',    titulo: 'Ubicación, acceso y servicios' },
    { id: 'vivienda',   titulo: 'Vivienda y saneamiento' },
    { id: 'familia',    titulo: 'Hogar, salud y educación' },
    { id: 'economia',   titulo: 'Economía del predio' },
    { id: 'ganaderia',  titulo: 'Ganadería' },
    { id: 'tecnologia', titulo: 'Tecnología y manejo' },
    { id: 'bosque',     titulo: 'Bosque, ambiente y asociatividad' },
  ]

  const faltantes = [
    !exp.juridica.analisis && 'Estudio jurídico del folio',
    !exp.juridica.antecedentes && 'Consulta de listas restrictivas del propietario',
    !finca && 'Polígono del predio cargado por el SIG',
    zonasSiembra.length === 0 && 'Zonas de siembra delimitadas',
    !exp.evaluacion && 'Evaluación biofísica de campo',
    !exp.encuesta && 'Encuesta socioeconómica',
    exp.revisiones.length === 0 && zonasSiembra.length > 0 && 'Verificación de las zonas en terreno',
    'Plan de siembra, vivero y ejecución',
  ].filter(Boolean) as string[]

  return (
    <article className="ae-doc">

      {/* ══════════ PORTADA ══════════ */}
      <header className="ae-portada">
        <div className="ae-portada-top">
          <Isotipo className="ae-portada-iso" />
          <p className="ae-portada-marca">Amazonía Emprende</p>
        </div>

        <div className="ae-portada-cuerpo">
          <p className="ae-portada-kicker">Expediente del predio</p>
          <h1 className="ae-portada-tit">{p.nombre_predio ?? 'Predio sin nombre'}</h1>
          <p className="ae-portada-sub">{exp.propietario?.nombre_completo ?? 'Propietario sin registrar'}</p>
          {ubicacion && <p className="ae-portada-ubi">{ubicacion}</p>}
        </div>

        <div className="ae-portada-pie">
          <dl className="ae-cifras">
            <div>
              <dt>Área registral</dt>
              <dd>{ha(p.area_registral)}</dd>
            </div>
            <div>
              <dt>Área medida</dt>
              <dd>{ha(finca?.area_ha ?? null)}</dd>
            </div>
            <div>
              <dt>Área de siembra</dt>
              <dd>{ha(areaSiembra || null)}</dd>
            </div>
            <div>
              <dt>Zonas delimitadas</dt>
              <dd>{zonasSiembra.length}</dd>
            </div>
          </dl>
          <p className="ae-portada-nota">
            Documento generado el {fecha(exp.generado_en)} a partir de la base de datos del
            ecosistema. Todo su contenido proviene de jurídica, del equipo SIG o del evaluador
            de campo; nada se digita en este informe.
          </p>
        </div>
      </header>

      {/* ══════════ 01 · PREDIO ══════════ */}
      <Seccion n="01" titulo="Identificación del predio">
        <Bloque titulo="Datos del predio">
          <Ficha datos={[
            { clave: 'nombre', etiqueta: 'Nombre del predio', valor: p.nombre_predio, largo: false },
            { clave: 'dep', etiqueta: 'Departamento', valor: p.departamento, largo: false },
            { clave: 'mun', etiqueta: 'Municipio', valor: p.municipio, largo: false },
            { clave: 'ver', etiqueta: 'Vereda', valor: p.vereda, largo: false },
            { clave: 'zae', etiqueta: 'Núcleo', valor: p.zona_ae, largo: false },
            { clave: 'mat', etiqueta: 'Matrícula inmobiliaria', valor: p.matricula_inmobiliaria, largo: false },
            { clave: 'mats', etiqueta: 'Matrículas del englobe', valor: valor(p.matriculas), largo: false },
            { clave: 'cat', etiqueta: 'Código catastral', valor: p.codigo_catastral, largo: false },
            { clave: 'areg', etiqueta: 'Área registral', valor: p.area_registral ? ha(p.area_registral) : null, largo: false },
            { clave: 'alta', etiqueta: 'Ingresó al sistema', valor: fecha(p.created_at), largo: false },
          ].filter(d => d.valor)} />
        </Bloque>

        <Bloque titulo="Propietario">
          <Ficha datos={[
            { clave: 'nom', etiqueta: 'Nombre completo', valor: exp.propietario?.nombre_completo ?? null, largo: false },
            { clave: 'tp', etiqueta: 'Tipo de persona', valor: exp.propietario?.tipo_persona ?? null, largo: false },
            { clave: 'doc', etiqueta: 'Documento', valor: exp.propietario
                ? [exp.propietario.tipo_documento, exp.propietario.numero_documento].filter(Boolean).join(' ') || null : null, largo: false },
            { clave: 'tel', etiqueta: 'Teléfono', valor: exp.propietario?.telefono ?? null, largo: false },
            { clave: 'mail', etiqueta: 'Correo', valor: exp.propietario?.email ?? null, largo: false },
          ].filter(d => d.valor)} />
          {exp.copropietarios.length > 0 && (
            <div className="ae-campo ae-campo-ancho" style={{ marginTop: '.7rem' }}>
              <dt>Copropietarios</dt>
              <dd>{exp.copropietarios.map(c =>
                `${c.nombre_completo ?? 'Sin nombre'}${c.rol ? ` (${c.rol})` : ''}${c.cuota_pct ? ` — ${c.cuota_pct}%` : ''}`
              ).join(' · ')}</dd>
            </div>
          )}
        </Bloque>

        {exp.expediente && (
          <Bloque titulo="Estado en el proceso">
            <Ficha datos={pares(exp.expediente as unknown as Record<string, unknown>)} />
          </Bloque>
        )}
      </Seccion>

      {/* ══════════ 02 · JURÍDICA ══════════ */}
      <Seccion n="02" titulo="Situación jurídica"
        sub="Debida diligencia, estudio de títulos y antecedentes de la persona.">
        {semCfg && (
          <p className="ae-semaforo">
            <Marca hex={semCfg.hex}>Semáforo {semCfg.label.toLowerCase()}</Marca>
          </p>
        )}
        <Bloque titulo="Debida diligencia">
          <Ficha datos={pares(exp.juridica.debida_diligencia)} />
          <Galeria items={adjuntos(exp.juridica.debida_diligencia)} />
        </Bloque>
        <Bloque titulo="Análisis jurídico del folio">
          <Ficha datos={pares(exp.juridica.analisis)} />
        </Bloque>
        <Bloque titulo="Antecedentes de la persona">
          <Ficha datos={pares(exp.juridica.antecedentes)}
            vacio="No se ha corrido la consulta de listas restrictivas." />
        </Bloque>
      </Seccion>

      {/* ══════════ 03 · CARTOGRAFÍA ══════════ */}
      <Seccion n="03" titulo="Cartografía del predio"
        sub="El polígono del predio y las zonas de siembra, con lo que el terreno corrigió encima.">
        {capas.length > 0 ? (
          <>
            <MapaCampo capas={capas} estilos={MAPA_MARCA} className="ae-mapa" />
            <ul className="ae-leyenda">
              {[
                ['Predio', MARCA.tinta], ['Propuesta de la oficina', MARCA.taupe],
                ['Confirmada', MARCA.bosque], ['Modificada en terreno', MARCA.pizarra],
                ['Nueva desde campo', MARCA.musgo], ['Descartada', MARCA.taupe],
              ].map(([t, c]) => (
                <li key={t as string}><i style={{ background: c as string }} />{t}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="ae-vacio">El SIG todavía no ha cargado geometrías para este predio.</p>
        )}

        {zonasSiembra.length > 0 && (
          <>
            <Bloque titulo="Zonas de siembra">
              <div className="ae-tabla-cont">
                <table className="ae-tabla">
                  <thead>
                    <tr>
                      <th>Zona</th><th>Tipo</th><th>Estado</th>
                      <th className="num">Área (ha)</th><th className="num">Perímetro (m)</th>
                      <th>Qué dijo el terreno</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zonasSiembra.map((z, i) => {
                      const rev = exp.revisiones.filter(r => r.zona_id === z.id).at(-1)
                      const a = rev ? ACCION[rev.accion] : null
                      return (
                        <tr key={z.id}>
                          <td className="nom">{z.nombre ?? `Zona ${i + 1}`}</td>
                          <td>{z.tipo ?? '—'}</td>
                          <td>{z.estado ?? '—'}</td>
                          <td className="num">{z.area_ha != null ? z.area_ha.toLocaleString('es-CO', { maximumFractionDigits: 2 }) : '—'}</td>
                          <td className="num">{z.perimetro_m != null ? Math.round(z.perimetro_m).toLocaleString('es-CO') : '—'}</td>
                          <td>{a ? <Marca hex={a.hex}>{a.label}</Marca> : <span className="ae-tenue">Sin revisar</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Bloque>

            <div className="ae-figuras">
              <div>
                <Rotulo tono="bosque">Área por zona (ha)</Rotulo>
                <ResponsiveContainer width="100%" height={Math.max(130, datosZonas.length * 30)}>
                  <BarChart data={datosZonas} layout="vertical" margin={{ left: 4, right: 40, top: 6, bottom: 2 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="nombre" width={112}
                      tick={{ fontSize: 10, fill: '#5c554b', fontFamily: 'var(--font-poppins)' }}
                      axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => [`${Number(v ?? 0).toFixed(2)} ha`, 'Área']}
                      contentStyle={{ fontSize: 11, borderRadius: 0, border: `1px solid ${MARCA.taupe}`, fontFamily: 'var(--font-poppins)' }} />
                    <Bar dataKey="area" isAnimationActive={false} barSize={13}>
                      {datosZonas.map((d, i) => <Cell key={i} fill={d.hex} />)}
                      <LabelList dataKey="area" position="right"
                        formatter={(v) => Number(v ?? 0).toFixed(1)}
                        style={{ fontSize: 10, fill: '#5c554b', fontFamily: 'var(--font-poppins)' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {conteoAcciones.length > 0 && (
                <div>
                  <Rotulo tono="bosque">Decisión del terreno</Rotulo>
                  <ResponsiveContainer width="100%" height={Math.max(130, conteoAcciones.length * 34)}>
                    <BarChart data={conteoAcciones} layout="vertical" margin={{ left: 4, right: 40, top: 6, bottom: 2 }}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="accion" width={92}
                        tick={{ fontSize: 10, fill: '#5c554b', fontFamily: 'var(--font-poppins)' }}
                        axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v) => [`${Number(v ?? 0)} revisiones`, '']}
                        contentStyle={{ fontSize: 11, borderRadius: 0, border: `1px solid ${MARCA.taupe}`, fontFamily: 'var(--font-poppins)' }} />
                      <Bar dataKey="n" isAnimationActive={false} barSize={13}>
                        {conteoAcciones.map((d, i) => <Cell key={i} fill={d.hex} />)}
                        <LabelList dataKey="n" position="right"
                          style={{ fontSize: 10, fill: '#5c554b', fontFamily: 'var(--font-poppins)' }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </Seccion>

      {/* ══════════ 04 · TERRENO ══════════ */}
      {exp.revisiones.length > 0 && (
        <Seccion n="04" titulo="Correcciones hechas en terreno"
          sub="La oficina propone las zonas y quien está parado en el predio decide. Ninguna de las dos versiones se borra.">
          <div className="ae-bitacora">
            {exp.revisiones.map((r, i) => {
              const a = ACCION[r.accion]
              const zona = exp.zonas.find(z => z.id === r.zona_id)
              return (
                <div key={i} className="ae-entrada">
                  <div className="ae-entrada-cab">
                    <Marca hex={a?.hex ?? MARCA.taupe}>{a?.label ?? r.accion}</Marca>
                    <strong>{zona?.nombre ?? (r.zona_id ? 'Zona del SIG' : 'Zona nueva de campo')}</strong>
                    <span className="ae-tenue">
                      {fecha(r.fecha ?? r.created_at)}
                      {r.evaluador ? ` · ${r.evaluador}` : ''}
                      {r.metodo ? ` · ${r.metodo}` : ''}
                    </span>
                  </div>
                  {r.area_ha_campo != null && (
                    <p className="ae-entrada-area">
                      Área medida en terreno <strong>{ha(r.area_ha_campo)}</strong>
                      {zona?.area_ha != null && <span className="ae-tenue"> · estimada por la oficina {ha(zona.area_ha)}</span>}
                    </p>
                  )}
                  {r.observaciones && <p className="ae-entrada-obs">{r.observaciones}</p>}
                </div>
              )
            })}
          </div>
        </Seccion>
      )}

      {/* ══════════ 05 · BIOFÍSICA ══════════ */}
      {exp.evaluacion && (
        <Seccion n="05" titulo="Evaluación biofísica en campo"
          sub="Formato AE-CAMPO-001, diligenciado zona por zona sobre el terreno.">
          <Bloque titulo="Datos de la visita">
            {/* La sección 1 del formato repite fecha y evaluadores que ya están
                en columnas propias: se queda la versión formateada. */}
            <Ficha datos={(() => {
              const propios = [
                { clave: 'fecha_visita', etiqueta: 'Fecha de la visita', valor: exp.evaluacion!.fecha_visita ? fecha(exp.evaluacion!.fecha_visita) : null, largo: false },
                { clave: 'evaluador_1', etiqueta: 'Evaluador 1', valor: exp.evaluacion!.evaluador_1, largo: false },
                { clave: 'evaluador_2', etiqueta: 'Evaluador 2', valor: exp.evaluacion!.evaluador_2, largo: false },
                { clave: 'num_zonas_eval', etiqueta: 'Zonas evaluadas', valor: exp.evaluacion!.num_zonas_eval != null ? String(exp.evaluacion!.num_zonas_eval) : null, largo: false },
              ].filter(d => d.valor)
              const ya = new Set(propios.map(d => d.clave))
              return [...propios, ...pares(exp.evaluacion!.seccion_1).filter(d => !ya.has(d.clave))]
            })()} />
          </Bloque>

          {pares(exp.evaluacion.seccion_2).length > 0 && (
            <Bloque titulo="Disposición social y mano de obra">
              <Ficha datos={pares(exp.evaluacion.seccion_2)} />
            </Bloque>
          )}

          {evalPorZona.map((ze, i) => (
            <div key={i} className="ae-zona">
              <div className="ae-zona-cab">
                <h3>{ze.zona?.nombre ?? `Zona ${ze.zona_numero ?? i + 1}`}</h3>
                <span className="ae-tenue">
                  {ze.area_ha_sig != null ? `${ha(ze.area_ha_sig)} según el SIG` : 'Sin área del SIG'}
                  {ze.zona?.estado ? ` · ${ze.zona.estado}` : ''}
                </span>
              </div>
              {[
                ['Suelo y agua', ze.suelo],
                ['Cobertura vegetal y fauna', ze.cobertura],
                ['Acceso y logística', ze.logistica],
                ['Riesgos', ze.riesgos],
              ].map(([titulo, datos]) => {
                const ps = pares(datos as Record<string, unknown> | null)
                const ad = adjuntos(datos as Record<string, unknown> | null)
                if (!ps.length && !ad.length) return null
                return (
                  <Bloque key={titulo as string} titulo={titulo as string}>
                    <Ficha datos={ps} />
                    <Galeria items={ad} />
                  </Bloque>
                )
              })}
            </div>
          ))}

          {pares(exp.evaluacion.seccion_6).length > 0 && (
            <Bloque titulo="Riesgos y restricciones del predio">
              <Ficha datos={pares(exp.evaluacion.seccion_6)} />
            </Bloque>
          )}

          {(exp.evaluacion.firmas.eval1 || exp.evaluacion.firmas.eval2 || exp.evaluacion.firmas.propietario) && (
            <div className="ae-firmas">
              {([['eval1', 'Evaluador 1'], ['eval2', 'Evaluador 2'], ['propietario', 'Propietario']] as const)
                .map(([k, lbl]) => {
                  const url = exp.evaluacion!.firmas[k]
                  return (
                    <figure key={k}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {url ? <img src={url} alt={lbl} /> : <span className="ae-firma-vacia" />}
                      <figcaption>{lbl}</figcaption>
                    </figure>
                  )
                })}
            </div>
          )}
        </Seccion>
      )}

      {/* ══════════ 06 · SOCIOECONÓMICA ══════════ */}
      {exp.encuesta && (
        <Seccion n="06" titulo="Caracterización socioeconómica"
          sub={`Encuesta diligenciada${exp.encuesta.encuestador ? ` por ${exp.encuesta.encuestador}` : ''} el ${fecha(exp.encuesta.fecha_encuesta)}.`}>
          {SECCIONES_ENCUESTA.map(s => {
            const ps = pares(exp.encuesta!.secciones[s.id])
            if (!ps.length) return null
            return (
              <Bloque key={s.id} titulo={s.titulo}>
                <Ficha datos={ps} />
              </Bloque>
            )
          })}

          {exp.encuesta.cultivos.length > 0 && (
            <Bloque titulo="Cultivos del predio">
              <div className="ae-tabla-cont">
                <table className="ae-tabla">
                  <thead>
                    <tr>
                      {['cultivo', 'area_ha', 'anio_siembra', 'densidad', 'rendimiento', 'destino'].map(c => (
                        <th key={c}>{etiqueta(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {exp.encuesta.cultivos.map((c, i) => (
                      <tr key={i}>
                        {['cultivo', 'area_ha', 'anio_siembra', 'densidad', 'rendimiento', 'destino'].map((k, j) => (
                          <td key={k} className={j === 0 ? 'nom' : undefined}>{valor(c[k]) ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Bloque>
          )}

          {exp.encuesta.step_completed != null && exp.encuesta.step_completed < 7 && (
            <p className="ae-aviso">
              La encuesta quedó a medias en el dispositivo (paso {exp.encuesta.step_completed} de 7);
              por eso hay bloques sin información.
            </p>
          )}
        </Seccion>
      )}

      {/* ══════════ 07 · FOTOS ══════════ */}
      {exp.fotos.length > 0 && (
        <Seccion n="07" titulo="Registro fotográfico">
          <div className="ae-galeria ae-galeria-grande">
            {exp.fotos.map((f, i) => (
              <figure key={i}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.categoria ?? 'Foto del predio'} />
                <figcaption>{f.categoria ?? 'Sin categoría'}</figcaption>
              </figure>
            ))}
          </div>
        </Seccion>
      )}

      {/* ══════════ CIERRE ══════════ */}
      <section className="ae-cierre">
        <Rotulo tono="bosque">Pendiente de este predio</Rotulo>
        <ul className="ae-pendientes">
          {faltantes.map(f => <li key={f}>{f}</li>)}
        </ul>
        <div className="ae-colofon">
          <Isotipo className="ae-colofon-iso" />
          <div>
            <p className="ae-colofon-slogan">Inspirar · Nutrir · Actuar</p>
            <p className="ae-colofon-meta">
              Expediente {p.id} · generado el {fecha(exp.generado_en)} · amazoniaemprende.com
            </p>
          </div>
        </div>
      </section>

      <style jsx global>{`
        /* ═══════════════════════════════════════════════════════════════
           Sistema visual del Manual de Identidad de Marca 2024.
           Josefin Sans para títulos, Poppins para cuerpo. Paleta terrosa.
           Sin píldoras, sin cajas de color: filetes y tipografía.
           ═══════════════════════════════════════════════════════════════ */
        .ae-doc {
          --ae-papel:  ${MARCA.papel};
          --ae-hueso:  ${MARCA.hueso};
          --ae-tinta:  ${MARCA.tinta};
          --ae-suave:  #4a453f;
          --ae-tenue:  #7d7669;
          --ae-linea:  #d8d1c4;
          --ae-fina:   #e6e0d5;
          --ae-bosque: ${MARCA.bosque};

          background: var(--ae-papel);
          color: var(--ae-tinta);
          font-family: var(--font-poppins), system-ui, sans-serif;
          font-size: 13px;
          line-height: 1.62;
          max-width: 60rem;
          margin: 0 auto;
          padding: 0 0 4rem;
        }
        .ae-doc *, .ae-doc *::before, .ae-doc *::after { box-sizing: border-box; }
        .ae-tenue { color: var(--ae-tenue); }

        .ae-rotulo {
          font-family: var(--font-josefin), sans-serif;
          font-size: 10px; font-weight: 600; letter-spacing: .2em;
          text-transform: uppercase; margin: 0 0 .85rem;
        }

        /* ── Portada ── */
        .ae-portada {
          background: var(--ae-tinta); color: var(--ae-hueso);
          padding: 3.4rem 3.2rem 2.6rem; margin-bottom: 3.4rem;
          display: flex; flex-direction: column; gap: 3rem;
        }
        .ae-portada-top { display: flex; align-items: center; gap: .85rem; }
        .ae-portada-iso { width: 26px; height: 32px; color: var(--ae-hueso); flex: none; }
        .ae-portada-marca {
          font-family: var(--font-josefin), sans-serif;
          font-size: 12px; font-weight: 600; letter-spacing: .26em;
          text-transform: uppercase; margin: 0; color: var(--ae-hueso);
        }
        .ae-portada-kicker {
          font-family: var(--font-poppins), sans-serif;
          font-size: 10.5px; letter-spacing: .28em; text-transform: uppercase;
          color: ${MARCA.taupe}; margin: 0 0 1.1rem;
        }
        .ae-portada-tit {
          font-family: var(--font-josefin), sans-serif;
          font-size: clamp(2.6rem, 7vw, 4.1rem); font-weight: 700;
          line-height: .98; letter-spacing: .01em; margin: 0 0 1rem;
          color: #fff; text-wrap: balance;
        }
        .ae-portada-sub {
          font-size: 1.05rem; font-weight: 300; margin: 0; color: var(--ae-hueso);
        }
        .ae-portada-ubi {
          font-size: .8rem; letter-spacing: .08em; text-transform: uppercase;
          color: ${MARCA.taupe}; margin: .5rem 0 0;
        }
        .ae-portada-pie { border-top: 1px solid rgba(228,222,210,.22); padding-top: 1.7rem; }
        .ae-cifras {
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0; margin: 0 0 1.6rem;
        }
        .ae-cifras > div {
          padding: 0 1.1rem; min-width: 0;
          border-left: 1px solid rgba(228,222,210,.22);
        }
        .ae-cifras > div:first-child { padding-left: 0; border-left: 0; }
        .ae-cifras dt {
          font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase;
          color: ${MARCA.taupe}; margin-bottom: .4rem;
        }
        .ae-cifras dd {
          font-family: var(--font-josefin), sans-serif;
          font-size: 1.5rem; font-weight: 700; margin: 0; color: #fff;
          font-variant-numeric: tabular-nums; line-height: 1;
        }
        .ae-portada-nota {
          font-size: 10.5px; line-height: 1.6; color: ${MARCA.taupe};
          max-width: 52ch; margin: 0; font-weight: 300;
        }

        /* ── Secciones ── */
        .ae-seccion { padding: 0 3.2rem; margin-bottom: 3rem; }
        .ae-seccion-cab {
          display: flex; align-items: baseline; gap: 1.1rem;
          border-bottom: 1px solid var(--ae-linea);
          padding-bottom: .7rem; margin-bottom: 1.5rem;
        }
        .ae-seccion-num {
          font-family: var(--font-josefin), sans-serif;
          font-size: 13px; font-weight: 700; letter-spacing: .18em;
          color: var(--ae-bosque); flex: none;
        }
        .ae-seccion-tit {
          font-family: var(--font-josefin), sans-serif;
          font-size: 1.45rem; font-weight: 600; letter-spacing: .02em;
          margin: 0; line-height: 1.15;
        }
        .ae-seccion-sub {
          font-size: 12px; color: var(--ae-suave); font-weight: 300;
          max-width: 68ch; margin: -.6rem 0 1.5rem;
        }

        .ae-bloque { margin-bottom: 1.7rem; break-inside: avoid; }
        .ae-vacio { font-size: 12px; color: var(--ae-tenue); font-style: italic; margin: 0; }
        .ae-aviso {
          font-size: 11.5px; color: var(--ae-suave); font-weight: 300;
          border-left: 2px solid ${MARCA.ambar}; padding: .1rem 0 .1rem .9rem; margin: 1.2rem 0 0;
        }

        /* ── Fichas etiqueta/valor ── */
        /* Sin filete por celda: cuando una fila no llena las tres columnas las
           rayas quedan desparejas. Un solo filete arriba y aire entre filas. */
        .ae-ficha {
          display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
          column-gap: 1.6rem; row-gap: 1rem; margin: 0;
          border-top: 1px solid var(--ae-fina); padding-top: .85rem;
        }
        .ae-campo { min-width: 0; }
        .ae-campo-ancho { grid-column: 1 / -1; }
        .ae-ficha dt, .ae-campo dt {
          font-size: 9px; font-weight: 500; letter-spacing: .13em;
          text-transform: uppercase; color: var(--ae-tenue); margin-bottom: .18rem;
        }
        .ae-ficha dd, .ae-campo dd {
          margin: 0; font-size: 12px; color: var(--ae-tinta);
          overflow-wrap: break-word; white-space: pre-line;
        }

        /* ── Marca de estado ── */
        .ae-marca {
          display: inline-flex; align-items: center; gap: .45rem;
          font-size: 11px; color: var(--ae-tinta); white-space: nowrap;
        }
        .ae-marca > i { width: 7px; height: 7px; flex: none; display: inline-block; }
        .ae-semaforo { margin: 0 0 1.4rem; font-size: 12px; }

        /* ── Mapa y leyenda ── */
        .ae-mapa {
          width: 100%; height: 24rem; border: 1px solid var(--ae-linea);
          margin-bottom: .7rem; z-index: 0;
        }
        .ae-leyenda {
          list-style: none; display: flex; flex-wrap: wrap; gap: .35rem 1.3rem;
          padding: 0; margin: 0 0 1.9rem; font-size: 10px;
          letter-spacing: .04em; color: var(--ae-suave);
        }
        .ae-leyenda li { display: flex; align-items: center; gap: .4rem; }
        .ae-leyenda i { width: 12px; height: 2px; display: inline-block; }

        /* ── Tablas ── */
        .ae-tabla-cont { overflow-x: auto; }
        .ae-tabla {
          width: 100%; border-collapse: collapse; font-size: 11.5px; min-width: 34rem;
        }
        .ae-tabla th {
          text-align: left; font-size: 9px; font-weight: 500; letter-spacing: .13em;
          text-transform: uppercase; color: var(--ae-tenue);
          padding: 0 .9rem .55rem 0; border-bottom: 1px solid var(--ae-linea);
          white-space: nowrap;
        }
        .ae-tabla td {
          padding: .55rem .9rem .55rem 0; border-bottom: 1px solid var(--ae-fina);
          color: var(--ae-suave); vertical-align: top;
        }
        .ae-tabla td.nom { color: var(--ae-tinta); font-weight: 500; }
        .ae-tabla .num { text-align: right; font-variant-numeric: tabular-nums; padding-right: .9rem; }

        /* ── Figuras ── */
        .ae-figuras {
          display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 2rem; margin-top: 1.9rem; break-inside: avoid;
        }

        /* ── Bitácora de terreno ── */
        .ae-bitacora { border-top: 1px solid var(--ae-fina); }
        .ae-entrada {
          padding: .85rem 0; border-bottom: 1px solid var(--ae-fina); break-inside: avoid;
        }
        .ae-entrada-cab {
          display: flex; flex-wrap: wrap; align-items: baseline; gap: .3rem .9rem;
        }
        .ae-entrada-cab strong { font-size: 12.5px; font-weight: 500; }
        .ae-entrada-cab .ae-tenue { font-size: 10.5px; }
        .ae-entrada-area { font-size: 11px; color: var(--ae-suave); margin: .3rem 0 0; }
        .ae-entrada-obs {
          font-size: 11.5px; color: var(--ae-suave); margin: .35rem 0 0;
          white-space: pre-line; font-weight: 300;
        }

        /* ── Zona evaluada ── */
        .ae-zona { margin-bottom: 2rem; break-inside: avoid; }
        .ae-zona-cab {
          display: flex; align-items: baseline; gap: .9rem;
          border-bottom: 1px solid var(--ae-linea); padding-bottom: .45rem; margin-bottom: 1.1rem;
        }
        .ae-zona-cab h3 {
          font-family: var(--font-josefin), sans-serif;
          font-size: 1.05rem; font-weight: 600; margin: 0; letter-spacing: .02em;
        }
        .ae-zona-cab span { font-size: 10.5px; }

        /* ── Galerías y firmas ── */
        .ae-galeria {
          display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: .9rem; margin-top: .8rem;
        }
        .ae-galeria-grande { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .ae-galeria figure { margin: 0; break-inside: avoid; }
        .ae-galeria img {
          width: 100%; height: 7rem; object-fit: cover;
          border: 1px solid var(--ae-linea); background: var(--ae-hueso); display: block;
        }
        .ae-galeria-grande img { height: 10rem; }
        .ae-galeria figcaption {
          font-size: 9.5px; color: var(--ae-tenue); margin-top: .3rem;
          letter-spacing: .05em;
        }
        .ae-firmas {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem;
          margin-top: 2.2rem; break-inside: avoid;
        }
        .ae-firmas figure { margin: 0; text-align: center; }
        .ae-firmas img { height: 3.6rem; width: 100%; object-fit: contain; display: block; }
        .ae-firma-vacia { display: block; height: 3.6rem; }
        .ae-firmas figcaption {
          font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase;
          color: var(--ae-tenue); border-top: 1px solid var(--ae-tinta);
          padding-top: .4rem; margin-top: .1rem;
        }

        /* ── Cierre ── */
        .ae-cierre { padding: 2.2rem 3.2rem 0; border-top: 1px solid var(--ae-linea); }
        .ae-pendientes {
          list-style: none; padding: 0; margin: 0 0 2.6rem;
          font-size: 12px; color: var(--ae-suave); columns: 2; column-gap: 2.4rem;
        }
        .ae-pendientes li {
          padding: .3rem 0 .3rem .95rem; position: relative;
          break-inside: avoid; font-weight: 300;
        }
        .ae-pendientes li::before {
          content: ''; position: absolute; left: 0; top: .78em;
          width: 5px; height: 1px; background: ${MARCA.taupe};
        }
        .ae-colofon {
          display: flex; align-items: center; gap: 1rem;
          border-top: 1px solid var(--ae-linea); padding-top: 1.2rem;
        }
        .ae-colofon-iso { width: 20px; height: 25px; color: var(--ae-bosque); flex: none; }
        .ae-colofon-slogan {
          font-family: var(--font-josefin), sans-serif;
          font-size: 11px; font-weight: 600; letter-spacing: .22em;
          text-transform: uppercase; color: var(--ae-bosque); margin: 0;
        }
        .ae-colofon-meta { font-size: 9.5px; color: var(--ae-tenue); margin: .15rem 0 0; }

        /* ── Pantallas estrechas ── */
        @media (max-width: 760px) {
          .ae-portada { padding: 2.2rem 1.4rem 1.8rem; gap: 2rem; }
          .ae-seccion, .ae-cierre { padding-left: 1.4rem; padding-right: 1.4rem; }
          .ae-ficha { grid-template-columns: 1fr; }
          .ae-figuras { grid-template-columns: 1fr; gap: 1.4rem; }
          .ae-galeria { grid-template-columns: repeat(2, 1fr); }
          .ae-pendientes { columns: 1; }
          .ae-cifras { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: 1.2rem; }
        }

        /* ── Impresión ── */
        @media print {
          @page { size: A4; margin: 16mm 15mm; }
          /* La portada es su propia hoja, a sangre, como en el manual. */
          @page portada { margin: 0; }
          html, body { background: #fff !important; }
          .ae-doc {
            max-width: none; font-size: 9.6pt; line-height: 1.5;
            background: #fff; padding: 0;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
          }
          .ae-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* La portada ocupa su propia hoja, como en el manual. */
          .ae-portada {
            page: portada; margin: 0; padding: 30mm 22mm 24mm;
            min-height: 296mm; break-after: page;
            justify-content: space-between;
          }
          .ae-portada-tit { font-size: 40pt; }
          .ae-seccion, .ae-cierre { padding-left: 0; padding-right: 0; }
          .ae-seccion { margin-bottom: 9mm; }
          .ae-seccion-cab { break-after: avoid; }
          .ae-bloque, .ae-zona, .ae-entrada, .ae-figuras,
          .ae-firmas, .ae-galeria figure { break-inside: avoid; }
          /* En papel las tablas no pueden hacer scroll: se dejan encoger. */
          .ae-tabla-cont { overflow: visible !important; }
          .ae-tabla { min-width: 0 !important; font-size: 8.4pt; }
          .ae-mapa { height: 88mm; break-inside: avoid; }
          .ae-galeria img { height: 34mm; }
          .ae-galeria-grande img { height: 46mm; }
          .ae-cierre { break-inside: avoid; }
          /* En impresión el ancho de página (180 mm ≈ 680 px) dispara la media
             query de pantalla estrecha y colapsaba todo a una columna. Aquí se
             reafirma la retícula de escritorio. */
          .ae-cifras { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; row-gap: 0 !important; }
          .ae-ficha { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .ae-figuras { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 2rem !important; }
          .ae-galeria { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; }
          .ae-galeria-grande { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .ae-pendientes { columns: 2 !important; }
        }
      `}</style>
    </article>
  )
}
