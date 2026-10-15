'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { Aviso, Boton, Cabecera, Cargando, Contenido } from '@/app/components/marca'
import { supabase } from '@/lib/supabase'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { DEPARTAMENTOS, type Departamento } from '@/lib/departamentos'
import { TABS_ESPACIO, VistaEspacio, type Expediente, type TabEspacio } from '@/app/components/talento/espacio'
import { useCarga } from '@/app/intranet/administrativa/comun'

/**
 * MI ESPACIO — lo de cada persona.
 * ──────────────────────────────
 * Cualquiera que entre con su correo @amazoniaemprende.com llega aquí desde la
 * página de inicio: primero su área (el módulo donde trabaja), sus pendientes
 * y accesos rápidos; después su información con su foto, sus documentos,
 * contratos, certificados y —si es contratista— cuentas de cobro.
 * Todo pasa por /api/talento/*, que decide con la sesión: nadie ve aquí lo de
 * otra persona. La vista está en app/components/talento/espacio.tsx.
 */
export default function MiEspacio() {
  const router = useRouter()
  const [listo, setListo] = useState(false)
  const [tab, setTab] = useState<TabEspacio>(() => {
    if (typeof window === 'undefined') return 'area'
    const t = new URLSearchParams(window.location.search).get('tab') as TabEspacio | null
    return t && TABS_ESPACIO.includes(t) ? t : 'area'
  })
  const [proyectos, setProyectos] = useState<{ codigo: string; nombre: string }[]>([])
  const [perfil, setPerfil] = useState<{ department: string | null; is_admin: boolean } | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.push('/'); return }
      setListo(true)
      const r = await fetch('/api/users/me', { headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => null)
      if (r?.ok) setPerfil(await r.json())
    })
    supabase.schema('catalogo').from('proyectos').select('codigo, nombre').order('orden')
      .then(({ data }) => setProyectos(data ?? []))
  }, [router])

  const { data: exp, error, recargar } = useCarga<(Expediente & { faltaMigracion?: boolean; aviso?: string }) | null>(
    listo ? '/api/talento/mi-ficha' : null,
    (j) => (j.persona || j.faltaMigracion ? (j as unknown as Expediente & { faltaMigracion?: boolean; aviso?: string }) : null),
    'No se pudo abrir tu información.')

  if (!listo || (!exp && !error)) return <Cargando texto="Abriendo tu espacio…" />

  if (!exp || exp.faltaMigracion || !exp.persona) {
    return (
      <div className="min-h-screen bg-papel">
        <Cabecera ancho="normal" volver={{ href: '/', label: 'Inicio' }} modulo="Mi espacio" titulo="Mi espacio" compacta />
        <Contenido><Aviso tono={exp?.faltaMigracion ? 'ambar' : 'arcilla'}>{exp?.aviso ?? error}</Aviso></Contenido>
      </div>
    )
  }

  const cambiar = (t: TabEspacio) => {
    setTab(t)
    const u = new URL(window.location.href); u.searchParams.set('tab', t); window.history.replaceState(null, '', u.toString())
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardar(datos: Record<string, unknown>): Promise<string | null> {
    const r = await fetchConSesion('/api/talento/mi-ficha', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return j.error ?? 'No se pudo guardar.'
    await recargar()
    return null
  }

  const departamento: Departamento | null = DEPARTAMENTOS.find((d) => d.id === perfil?.department) ?? null

  return (
    <VistaEspacio
      exp={exp}
      departamento={departamento}
      esAdmin={!!perfil?.is_admin}
      proyectos={proyectos}
      tab={tab}
      onTab={cambiar}
      onGuardarFicha={guardar}
      onFoto={async (foto) => {
        const e = await guardar({ foto })
        return e && /autorización/.test(e) ? 'Para guardar tu foto, primero acepta la autorización de datos en «Mi información» y guarda.' : e
      }}
      onRecargar={recargar}
      accionesCabecera={<BotonMicrosoft />}
      aviso={exp.cuentas.some((c) => c.estado === 'devuelta') && tab !== 'cuentas' ? (
        <Aviso tono="arcilla" className="mb-8" titulo="Tienes una cuenta de cobro devuelta">
          Talento humano pidió corregirla. Ábrela en la pestaña Cuentas de cobro.
        </Aviso>
      ) : undefined}
    />
  )
}

/**
 * Trae de Microsoft 365 el cargo, los teléfonos, la oficina y la foto. Pide de
 * nuevo el inicio de sesión con el permiso User.Read (lectura del propio
 * perfil): el inicio de sesión normal no lo pide, así que si Microsoft no lo
 * diera, solo falla este botón y nadie se queda sin entrar.
 */
function BotonMicrosoft() {
  const [ocupado, setOcupado] = useState(false)
  async function traer() {
    setOcupado(true)
    try { sessionStorage.setItem('ae:siguiente', '/intranet/mi-perfil?tab=informacion') } catch { /* sin storage vuelve al inicio */ }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: 'email profile User.Read' },
    })
    if (error) { alert('No se pudo conectar con Microsoft: ' + error.message); setOcupado(false) }
  }
  return <Boton variante="claro" icono={<RefreshCw size={13} />} disabled={ocupado} onClick={traer}>{ocupado ? 'Conectando…' : 'Traer de Microsoft 365'}</Boton>
}
