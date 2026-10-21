'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Loader2, Plus, RotateCcw, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { Aviso, Boton, Cabecera, Cargando, Contenido, Pestanas, Seccion, Vacio } from '@/app/components/marca'
import { TIPOS_ALERTA, type AccionAlerta, type AlertaVista, type EstadoAlerta } from '@/lib/alertas-juridica'

/**
 * ALERTAS DE JURÍDICA — lo que no cuadra en los datos de un predio.
 *
 * La lista sale de /api/juridica/alertas, que al abrir crea las que detectan
 * las reglas y cierra las que ya se corrigieron en la ficha. Aquí se trabajan:
 * aplicar la sugerencia, «ya lo corregí», «no es un problema» (con nota) o
 * registrar la finca que el SIG tiene y jurídica no. Nada se borra.
 */

const ORIGEN: Record<string, string> = {
  regla: 'Detectada por la intranet',
  elegibilidad_ldh: 'Cruce con el shapefile de Elegibilidad LDH (SIG)',
}

const ESTADOS: { id: EstadoAlerta; label: string }[] = [
  { id: 'abierta', label: 'Por revisar' },
  { id: 'resuelta', label: 'Resueltas' },
  { id: 'descartada', label: 'Descartadas' },
]

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

export default function AlertasJuridicaPage() {
  const router = useRouter()
  const [authReady, setAuthReady] = useState(false)
  const [alertas, setAlertas] = useState<AlertaVista[]>([])
  const [cargando, setCargando] = useState(true)
  const [faltaMigracion, setFaltaMigracion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState<EstadoAlerta>('abierta')

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .schema('people').from('user_profiles')
        .select('is_admin, department')
        .eq('email', user.email)
        .single()
      if (!profile?.is_admin && profile?.department !== 'Juridica') { router.push('/'); return }
      setAuthReady(true)
    })
  }, [router])

  const recargar = useCallback(async () => {
    setError(null)
    try {
      const r = await fetchConSesion('/api/juridica/alertas')
      const body = await r.json()
      if (!r.ok) throw new Error(body?.error ?? 'No se pudieron leer las alertas')
      setAlertas(body.alertas ?? [])
      setFaltaMigracion(!!body.falta_migracion)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron leer las alertas')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { if (authReady) recargar() }, [authReady, recargar])

  const cuenta = useMemo(() => {
    const c: Record<EstadoAlerta, number> = { abierta: 0, resuelta: 0, descartada: 0 }
    for (const a of alertas) c[a.estado]++
    return c
  }, [alertas])

  const visibles = alertas.filter((a) => a.estado === estado)

  if (!authReady) return <Cargando texto="Cargando las alertas…" />

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        ancho="estrecho"
        volver={{ href: '/intranet/juridica', label: 'Módulo jurídico' }}
        modulo="Módulo jurídico"
        titulo="Alertas de datos"
        descripcion="Lo que no cuadra en un predio y alguien de jurídica tiene que mirar. Se cierran solas cuando la ficha se corrige."
        cifras={ESTADOS.map((e) => ({ n: cuenta[e.id], l: e.label }))}
        pie={<Pestanas tono="oscuro" items={ESTADOS.map((e) => ({
          id: e.id, label: `${e.label} · ${cuenta[e.id]}`, activa: estado === e.id, onClick: () => setEstado(e.id),
        }))} />}
      />

      <Contenido ancho="estrecho">
        {faltaMigracion && (
          <Aviso tono="ambar" titulo="Falta crear la tabla" className="mb-8">
            Hay que correr <code>docs/sql/migration_alertas_juridica.sql</code> en Supabase para que las alertas se guarden.
          </Aviso>
        )}
        {error && <Aviso tono="arcilla" titulo="No se pudo" className="mb-8">{error}</Aviso>}

        {cargando ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-tenue" size={30} /></div>
        ) : visibles.length === 0 ? (
          <Vacio>{estado === 'abierta' ? 'No hay nada por revisar.' : 'Nada todavía.'}</Vacio>
        ) : (
          TIPOS_ALERTA.map(({ tipo, titulo, sub }) => {
            const delTipo = visibles.filter((a) => a.tipo === tipo)
            if (!delTipo.length) return null
            return (
              <Seccion key={tipo} n={String(delTipo.length)} titulo={titulo} sub={estado === 'abierta' ? sub : undefined}>
                <div className="space-y-3">
                  {delTipo.map((a) => <TarjetaAlerta key={a.id} alerta={a} onCambio={recargar} />)}
                </div>
              </Seccion>
            )
          })
        )}
      </Contenido>
    </div>
  )
}

function TarjetaAlerta({ alerta: a, onCambio }: { alerta: AlertaVista; onCambio: () => Promise<void> }) {
  const [trabajando, setTrabajando] = useState<AccionAlerta | null>(null)
  const [descartando, setDescartando] = useState(false)
  const [nota, setNota] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function hacer(accion: AccionAlerta, conNota?: string) {
    setTrabajando(accion); setError(null)
    try {
      const r = await fetchConSesion(`/api/juridica/alertas/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion, nota: conNota }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? 'No se pudo guardar')
      setDescartando(false); setNota('')
      await onCambio()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setTrabajando(null)
    }
  }

  const d = a.datos as Record<string, string | number | undefined>
  const p = a.predio
  const lugar = (mun?: string | null, ver?: string | null) => [mun, ver].filter(Boolean).join(' · ')
  const abierta = a.estado === 'abierta'
  const ocupada = trabajando !== null

  return (
    <article className="vidrio rounded-2xl px-5 py-4">
      {/* De qué predio (o de qué finca del SIG, si todavía no hay predio) */}
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        {p ? (
          <Link href={`/intranet/juridica/${p.id}`} className="font-medium text-tinta hover:underline">
            {p.nombre_predio?.trim() || 'Sin nombre'}
          </Link>
        ) : (
          <span className="font-medium text-tinta">{String(d.finca ?? 'Finca sin nombre')}</span>
        )}
        <span className="text-[12px] text-suave">
          {[p ? p.propietario : d.propietario, p ? lugar(p.municipio, p.vereda) : lugar(String(d.municipio ?? ''), String(d.vereda ?? ''))]
            .filter(Boolean).join(' · ')}
          {!p && d.area_ha ? ` · ${Number(d.area_ha).toLocaleString('es-CO', { maximumFractionDigits: 1 })} ha` : ''}
        </span>
      </div>

      <p className="text-[14px] text-tinta">{a.titulo}</p>
      {a.detalle && <p className="mt-0.5 text-[12.5px] font-light leading-relaxed text-suave">{a.detalle}</p>}
      {a.otro_predio && (
        <p className="mt-1 text-[12.5px] text-suave">
          El otro: <Link href={`/intranet/juridica/${a.otro_predio.id}`} className="text-bosque hover:underline">
            {a.otro_predio.nombre_predio ?? 'Sin nombre'}
          </Link>{a.otro_predio.propietario ? ` · ${a.otro_predio.propietario}` : ''}
        </p>
      )}
      {a.valor_sugerido && abierta && (
        <p className="mt-1.5 text-[12.5px] text-tinta">Sugerido: <strong className="font-medium">«{a.valor_sugerido}»</strong></p>
      )}
      <p className="mt-2 text-[11px] text-tenue">{ORIGEN[a.origen] ?? a.origen} · {fecha(a.created_at)}</p>

      {!abierta && (
        <p className="mt-2 text-[12.5px] text-suave">
          {a.estado === 'resuelta' ? 'Resuelta' : 'Descartada'}
          {a.resuelta_por ? ` por ${a.resuelta_por}` : ''}{a.resuelta_at ? `, ${fecha(a.resuelta_at)}` : ''}
          {a.nota ? <> — «{a.nota}»</> : null}
        </p>
      )}

      {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}

      {/* Acciones */}
      {abierta ? (
        descartando ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              autoFocus value={nota} onChange={(e) => setNota(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && nota.trim()) hacer('descartar', nota) ; if (e.key === 'Escape') setDescartando(false) }}
              placeholder="¿Por qué no es un problema? (p. ej. «el nombre de jurídica es el de la escritura»)"
              className="w-full flex-1 rounded-xl border border-linea bg-white px-3 py-2 text-[13px] focus:border-bosque focus:outline-none"
            />
            <div className="flex gap-2">
              <Boton variante="secundario" onClick={() => hacer('descartar', nota)} disabled={!nota.trim() || ocupada}
                icono={trabajando === 'descartar' ? <Loader2 size={13} className="animate-spin" /> : undefined}>Descartar</Boton>
              <Boton variante="fantasma" onClick={() => setDescartando(false)} disabled={ocupada}>Volver</Boton>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {a.tipo === 'sin_predio' && (
              <Boton href={`/intranet/juridica/nuevo?alerta=${a.id}${d.aliado_id ? `&aliado=${d.aliado_id}` : ''}`} icono={<Plus size={13} />}>
                Registrar predio
              </Boton>
            )}
            {a.valor_sugerido && a.predio_id && (
              <Boton onClick={() => hacer('aplicar')} disabled={ocupada}
                icono={trabajando === 'aplicar' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}>
                Aplicar «{a.valor_sugerido}»
              </Boton>
            )}
            {p && (
              <Boton variante="secundario" href={`/intranet/juridica/${p.id}/editar`} icono={<ExternalLink size={13} />}>
                Abrir la ficha
              </Boton>
            )}
            <Boton variante="secundario" onClick={() => hacer('resolver')} disabled={ocupada}
              icono={trabajando === 'resolver' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}>
              Ya lo corregí
            </Boton>
            <Boton variante="fantasma" onClick={() => setDescartando(true)} disabled={ocupada} icono={<X size={13} />}>
              No es un problema
            </Boton>
          </div>
        )
      ) : (
        <div className="mt-3">
          <Boton variante="fantasma" onClick={() => hacer('reabrir')} disabled={ocupada}
            icono={trabajando === 'reabrir' ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}>
            Reabrir
          </Boton>
        </div>
      )}
    </article>
  )
}
