'use client'
import { use, useEffect, useState } from 'react'
import { FileSignature, FileText, FolderOpen, Receipt, UserRound } from 'lucide-react'
import { Aviso, Boton, Cabecera, Cargando, Contenido, Pestanas, type Pestana } from '@/app/components/marca'
import { fetchConSesion } from '@/lib/fetch-sesion'
import { supabase } from '@/lib/supabase'
import { BarraCompletitud, FormularioFicha } from '@/app/components/talento/ficha'
import { SeccionCertificados, SeccionContratos, SeccionCuentas, SeccionDocumentos } from '@/app/components/talento/secciones'
import { FotoPersona } from '@/app/components/talento/espacio'
import { VINCULACION, contratoVigente, nombreCompleto, type Certificado, type Contrato, type CuentaCobro, type DocumentoPersona, type Persona } from '@/lib/talento'
import { useAccesoFinanciero, useCarga } from '../../comun'

/**
 * La ficha de una persona, vista por talento humano: lo mismo que ella ve en
 * «Mi perfil», más registrar y terminar contratos, revisar sus cuentas de cobro,
 * expedirle certificados y las notas internas. La autorización de datos no se
 * toca desde aquí: solo la da la persona.
 */
type Tab = 'ficha' | 'documentos' | 'contratos' | 'certificados' | 'cuentas'
interface Expediente { persona: Persona; contratos: Contrato[]; documentos: DocumentoPersona[]; cuentas: CuentaCobro[]; certificados: Certificado[] }

export default function PersonaRRHH({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { listo } = useAccesoFinanciero()
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'ficha'
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null
    return t && ['ficha', 'documentos', 'contratos', 'certificados', 'cuentas'].includes(t) ? t : 'ficha'
  })
  const [proyectos, setProyectos] = useState<{ codigo: string; nombre: string }[]>([])
  useEffect(() => {
    supabase.schema('catalogo').from('proyectos').select('codigo, nombre').order('orden').then(({ data }) => setProyectos(data ?? []))
  }, [])
  const { data: exp, error, recargar } = useCarga<Expediente | null>(
    listo ? `/api/talento/personas/${id}` : null, (j) => (j.persona ? (j as unknown as Expediente) : null), 'No se pudo abrir la ficha.')

  if (!listo || (!exp && !error)) return <Cargando texto="Abriendo la ficha…" />
  if (!exp) {
    return (
      <div className="min-h-screen bg-papel">
        <Cabecera compacta volver={{ href: '/intranet/administrativa?tab=talento', label: 'Talento humano' }} modulo="Talento humano" titulo="Ficha" />
        <Contenido><Aviso tono="arcilla">{error}</Aviso></Contenido>
      </div>
    )
  }

  const p = exp.persona
  const vigente = contratoVigente(exp.contratos)
  const esContratista = vigente?.vinculacion === 'contratista'
  const pestanas: Pestana[] = [
    { id: 'ficha', label: 'Ficha', icono: <UserRound size={13} />, activa: tab === 'ficha', onClick: () => setTab('ficha') },
    { id: 'documentos', label: `Documentos (${exp.documentos.length})`, icono: <FolderOpen size={13} />, activa: tab === 'documentos', onClick: () => setTab('documentos') },
    { id: 'contratos', label: 'Contratos', icono: <FileSignature size={13} />, activa: tab === 'contratos', onClick: () => setTab('contratos') },
    { id: 'certificados', label: 'Certificados', icono: <FileText size={13} />, activa: tab === 'certificados', onClick: () => setTab('certificados') },
    { id: 'cuentas', label: 'Cuentas de cobro', icono: <Receipt size={13} />, activa: tab === 'cuentas', onClick: () => setTab('cuentas') },
  ]

  async function guardar(datos: Record<string, unknown>): Promise<string | null> {
    const r = await fetchConSesion(`/api/talento/personas/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return j.error ?? 'No se pudo guardar.'
    await recargar()
    return null
  }
  async function activar(activo: boolean) {
    if (!activo && !confirm('¿Marcar a esta persona como retirada? Su ficha y su historial quedan.')) return
    const e = await guardar({ activo })
    if (e) alert(e)
  }

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        ancho="normal"
        volver={{ href: '/intranet/administrativa?tab=talento', label: 'Talento humano' }}
        modulo={p.activo ? 'Talento humano · Ficha' : 'Talento humano · Ficha · Retirada'}
        titulo={
          <span className="flex items-center gap-5">
            <FotoPersona persona={p} tam={88} onCambiar={async (foto) => { const e = await guardar({ foto }); if (e) alert(e) }} />
            <span>{nombreCompleto(p)}</span>
          </span>
        }
        descripcion={<>{vigente ? `${vigente.cargo} · ${VINCULACION[vigente.vinculacion]}` : 'Sin contrato vigente'} · {p.email}{p.celular ? ` · ${p.celular}` : ''}</>}
        acciones={<Boton variante="claro" onClick={() => activar(!p.activo)}>{p.activo ? 'Marcar retirada' : 'Reactivar'}</Boton>}
        pie={<Pestanas tono="oscuro" items={pestanas} />}
      />
      <Contenido ancho="normal">
        {tab === 'ficha' && (
          <>
            <div className="mb-10 max-w-md"><BarraCompletitud persona={p} esContratista={esContratista} /></div>
            <FormularioFicha key={p.updated_at} persona={p} modo="rrhh" esContratista={esContratista} onGuardar={guardar} />
          </>
        )}
        {tab === 'documentos' && <SeccionDocumentos documentos={exp.documentos} personaId={p.id} modo="rrhh" onCambio={recargar} />}
        {tab === 'contratos' && <SeccionContratos contratos={exp.contratos} personaId={p.id} modo="rrhh" proyectos={proyectos} onCambio={recargar} />}
        {tab === 'certificados' && (
          <SeccionCertificados certificados={exp.certificados} personaId={p.id} modo="rrhh"
            hayContratos={exp.contratos.some((c) => c.estado !== 'anulado')} onCambio={recargar} />
        )}
        {tab === 'cuentas' && <SeccionCuentas cuentas={exp.cuentas} contratos={exp.contratos} persona={p} modo="rrhh" onCambio={recargar} />}
      </Contenido>
    </div>
  )
}
