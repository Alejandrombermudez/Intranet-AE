'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { Aviso, Boton, Cabecera, Cargando, Contenido, MarcaEstado, Seccion, Vacio } from '@/app/components/marca'
import { Check, Copy, KeyRound, Plus, RefreshCw, Trash2 } from 'lucide-react'

/**
 * Cuentas para iniciar sesión en el geovisor. Solo administradores.
 *
 * El geovisor no tiene registro: quien necesita entrar recibe aquí su usuario y
 * su contraseña. La contraseña se muestra UNA vez, al crearla o cambiarla; en
 * la base solo queda su huella y nadie puede volver a leerla. Estas cuentas no
 * son usuarios de la intranet ni de Supabase: solo abren el geovisor.
 * Ver docs/sql/migration_usuarios_geovisor.sql.
 */

interface Cuenta {
  id: string
  usuario: string
  nombre: string
  organizacion: string | null
  activo: boolean
  nota: string | null
  ultimo_ingreso: string | null
  bloqueado_hasta: string | null
  created_by: string | null
  created_at: string
}

const CLAVE_MINIMA = 10
const CAMPO = 'w-full border border-linea bg-white px-3 py-2 text-[13px] text-tinta outline-none transition-colors placeholder:text-tenue focus:border-bosque'
const ROTULO = 'mb-1.5 block text-[10px] uppercase tracking-[.16em] text-tenue'

/** 16 caracteres al azar, sin los que se confunden al dictarlos (0/O, 1/l/I). */
function claveAlAzar(): string {
  const letras = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const azar = crypto.getRandomValues(new Uint32Array(16))
  return Array.from(azar, (n) => letras[n % letras.length]).join('')
}

function fecha(iso: string | null): string {
  if (!iso) return 'Nunca'
  return new Date(iso).toLocaleString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const bloqueada = (c: Cuenta) => !!c.bloqueado_hasta && new Date(c.bloqueado_hasta).getTime() > Date.now()

export default function UsuariosGeovisorPage() {
  const router = useRouter()
  const [autorizado, setAutorizado] = useState(false)
  const [cuentas, setCuentas] = useState<Cuenta[] | null>(null)
  const [faltaMigracion, setFaltaMigracion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const [nuevo, setNuevo] = useState({ nombre: '', organizacion: '', usuario: '', clave: '' })
  /** Lo que hay que entregarle a la persona. Se muestra una vez y se va al cerrar. */
  const [entrega, setEntrega] = useState<{ usuario: string; clave: string; motivo: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  /** Cuenta a la que se le está poniendo contraseña nueva, y cuenta que se va a borrar */
  const [cambiando, setCambiando] = useState<{ id: string; clave: string } | null>(null)
  const [borrando, setBorrando] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    const r = await fetchConSesion('/api/geovisor-usuarios')
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setError(j.error ?? 'No se pudo leer la lista de cuentas.'); setCuentas([]); return }
    setCuentas(j.usuarios ?? [])
    setFaltaMigracion(j.faltaMigracion === true)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      const { data: perfil } = await supabase.schema('people').from('user_profiles')
        .select('is_admin').eq('email', user.email).single()
      if (!perfil?.is_admin) { router.push('/intranet'); return }
      setAutorizado(true)
      setNuevo((n) => ({ ...n, clave: claveAlAzar() }))
      cargar()
    })
  }, [router, cargar])

  async function crear(e: React.FormEvent) {
    e.preventDefault()
    setOcupado(true); setError(null)
    const r = await fetchConSesion('/api/geovisor-usuarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nuevo),
    })
    const j = await r.json().catch(() => ({}))
    setOcupado(false)
    if (!r.ok) { setError(j.error ?? 'No se pudo crear la cuenta.'); return }
    setEntrega({ usuario: j.usuario.usuario, clave: nuevo.clave, motivo: 'Cuenta creada' })
    setNuevo({ nombre: '', organizacion: '', usuario: '', clave: claveAlAzar() })
    cargar()
  }

  async function cambiar(id: string, cambios: Record<string, unknown>): Promise<boolean> {
    setOcupado(true); setError(null)
    const r = await fetchConSesion(`/api/geovisor-usuarios/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cambios),
    })
    const j = await r.json().catch(() => ({}))
    setOcupado(false)
    if (!r.ok) { setError(j.error ?? 'No se pudo guardar el cambio.'); return false }
    cargar()
    return true
  }

  async function ponerClave(c: Cuenta, clave: string) {
    if (await cambiar(c.id, { clave })) {
      setEntrega({ usuario: c.usuario, clave, motivo: 'Contraseña cambiada' })
      setCambiando(null)
    }
  }

  async function borrar(id: string) {
    setOcupado(true); setError(null)
    const r = await fetchConSesion(`/api/geovisor-usuarios/${id}`, { method: 'DELETE' })
    const j = await r.json().catch(() => ({}))
    setOcupado(false); setBorrando(null)
    if (!r.ok) { setError(j.error ?? 'No se pudo borrar la cuenta.'); return }
    cargar()
  }

  function copiarEntrega() {
    if (!entrega) return
    navigator.clipboard?.writeText(`Usuario: ${entrega.usuario}\nContraseña: ${entrega.clave}`).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    }).catch(() => { /* sin permiso de portapapeles: se copia a mano */ })
  }

  if (!autorizado || cuentas === null) return <Cargando texto="Cargando las cuentas del geovisor…" />

  const claveCorta = nuevo.clave.length < CLAVE_MINIMA

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        compacta
        volver={{ href: '/intranet/sistema', label: 'El sistema' }}
        modulo="Tecnología"
        titulo="Usuarios del geovisor"
        descripcion="Quién puede iniciar sesión en el geovisor. El geovisor es público; la sesión agrega el nombre de la familia donde hay cesión de imagen, el código de cada polígono y la descarga de la tabla."
        cifras={[
          { n: cuentas.length, l: cuentas.length === 1 ? 'Cuenta' : 'Cuentas' },
          { n: cuentas.filter((c) => c.activo).length, l: 'Activas' },
        ]}
      />

      <Contenido className="space-y-10">
        {faltaMigracion && (
          <Aviso tono="ambar" titulo="Falta crear la tabla">
            Todavía no se puede crear ninguna cuenta: hay que correr{' '}
            <code>docs/sql/migration_usuarios_geovisor.sql</code> en el SQL Editor de Supabase.
          </Aviso>
        )}
        {error && <Aviso tono="arcilla" titulo="No se pudo">{error}</Aviso>}

        {/* Lo que hay que entregar: se ve una sola vez */}
        {entrega && (
          <div className="border border-bosque bg-white px-5 py-4">
            <p className="text-[10px] uppercase tracking-[.16em] text-bosque">{entrega.motivo} · cópiala ahora</p>
            <p className="mt-2 text-[13px] font-light leading-relaxed text-suave">
              Esta contraseña no se guarda y no se puede volver a ver. Entrégasela a la persona por un medio privado.
            </p>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
              <dt className="text-tenue">Usuario</dt><dd className="font-mono text-tinta">{entrega.usuario}</dd>
              <dt className="text-tenue">Contraseña</dt><dd className="font-mono text-tinta">{entrega.clave}</dd>
            </dl>
            <div className="mt-4 flex gap-2">
              <Boton onClick={copiarEntrega} icono={copiado ? <Check size={13} /> : <Copy size={13} />}>{copiado ? 'Copiado' : 'Copiar'}</Boton>
              <Boton variante="secundario" onClick={() => setEntrega(null)}>Ya la entregué</Boton>
            </div>
          </div>
        )}

        <Seccion titulo="Nueva cuenta" sub="El usuario puede ser un correo o un nombre corto. La contraseña propuesta es al azar; puedes cambiarla.">
          <form onSubmit={crear} className="grid grid-cols-1 gap-4 border border-fina bg-white p-5 sm:grid-cols-2">
            <label>
              <span className={ROTULO}>Nombre de la persona</span>
              <input required value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} className={CAMPO} placeholder="Ana Pérez" />
            </label>
            <label>
              <span className={ROTULO}>Organización</span>
              <input value={nuevo.organizacion} onChange={(e) => setNuevo({ ...nuevo, organizacion: e.target.value })} className={CAMPO} placeholder="Aliado o área" />
            </label>
            <label>
              <span className={ROTULO}>Usuario</span>
              <input required value={nuevo.usuario} onChange={(e) => setNuevo({ ...nuevo, usuario: e.target.value.toLowerCase().replace(/\s/g, '') })}
                autoCapitalize="none" spellCheck={false} className={`${CAMPO} font-mono`} placeholder="ana.perez@aliado.com" />
            </label>
            <label>
              <span className={ROTULO}>Contraseña (mínimo {CLAVE_MINIMA} caracteres)</span>
              <span className="flex gap-2">
                <input required value={nuevo.clave} onChange={(e) => setNuevo({ ...nuevo, clave: e.target.value })}
                  autoComplete="off" spellCheck={false} className={`${CAMPO} font-mono`} />
                <button type="button" title="Proponer otra" onClick={() => setNuevo({ ...nuevo, clave: claveAlAzar() })}
                  className="flex w-10 shrink-0 items-center justify-center border border-linea text-tenue transition-colors hover:text-tinta">
                  <RefreshCw size={14} />
                </button>
              </span>
            </label>
            <div className="sm:col-span-2">
              <Boton type="submit" disabled={ocupado || faltaMigracion || claveCorta || !nuevo.nombre.trim() || nuevo.usuario.length < 3}
                icono={<Plus size={13} />}>Crear cuenta</Boton>
            </div>
          </form>
        </Seccion>

        <Seccion titulo="Cuentas" sub="Desactivar una cuenta saca a la persona de inmediato; se puede volver a activar. Borrarla es definitivo.">
          {cuentas.length === 0 ? <Vacio>Todavía no hay cuentas</Vacio> : (
            <div className="border border-fina bg-white">
              {cuentas.map((c) => (
                <div key={c.id} className="border-b border-fina px-5 py-4 last:border-b-0">
                  <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                    <div className="min-w-0">
                      <p className="text-[14px] text-tinta">{c.nombre}{c.organizacion && <span className="text-tenue"> · {c.organizacion}</span>}</p>
                      <p className="mt-0.5 font-mono text-[12px] text-suave">{c.usuario}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-tenue">
                        <MarcaEstado color={`var(--color-${!c.activo ? 'tenue' : bloqueada(c) ? 'ambar' : 'bosque'})`}>
                          {!c.activo ? 'Desactivada' : bloqueada(c) ? `Bloqueada hasta ${fecha(c.bloqueado_hasta)}` : 'Activa'}
                        </MarcaEstado>
                        <span>Último ingreso: {fecha(c.ultimo_ingreso)}</span>
                        <span>Creada {fecha(c.created_at)}{c.created_by ? ` por ${c.created_by}` : ''}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Boton variante="secundario" disabled={ocupado} icono={<KeyRound size={13} />}
                        onClick={() => { setBorrando(null); setCambiando({ id: c.id, clave: claveAlAzar() }) }}>Nueva contraseña</Boton>
                      <Boton variante="secundario" disabled={ocupado} onClick={() => cambiar(c.id, { activo: !c.activo })}>
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </Boton>
                      <Boton variante="peligro" disabled={ocupado} icono={<Trash2 size={13} />}
                        onClick={() => { setCambiando(null); setBorrando(c.id) }}>Borrar</Boton>
                    </div>
                  </div>

                  {cambiando?.id === c.id && (
                    <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-fina pt-4">
                      <label className="min-w-[240px] flex-1">
                        <span className={ROTULO}>Contraseña nueva para {c.usuario}</span>
                        <input value={cambiando.clave} onChange={(e) => setCambiando({ id: c.id, clave: e.target.value })}
                          autoComplete="off" spellCheck={false} className={`${CAMPO} font-mono`} />
                      </label>
                      <Boton disabled={ocupado || cambiando.clave.length < CLAVE_MINIMA} onClick={() => ponerClave(c, cambiando.clave)}>Guardar</Boton>
                      <Boton variante="fantasma" onClick={() => setCambiando(null)}>Cancelar</Boton>
                    </div>
                  )}

                  {borrando === c.id && (
                    <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-fina pt-4">
                      <p className="text-[12.5px] text-suave">¿Borrar la cuenta de {c.nombre}? No se puede deshacer.</p>
                      <Boton variante="peligro" disabled={ocupado} onClick={() => borrar(c.id)}>Sí, borrar</Boton>
                      <Boton variante="fantasma" onClick={() => setBorrando(null)}>Cancelar</Boton>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Seccion>
      </Contenido>
    </div>
  )
}
