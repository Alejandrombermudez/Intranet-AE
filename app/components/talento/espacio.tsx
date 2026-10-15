'use client'
/**
 * MI ESPACIO — lo que ve cada persona al entrar a lo suyo.
 *
 * Primero su ÁREA (el módulo donde trabaja, con un botón para entrar), lo que
 * tiene pendiente y sus accesos rápidos; después «Mi información» (la foto y
 * la ficha) y lo demás: documentos, contratos, certificados y, si es
 * contratista, cuentas de cobro.
 *
 * Es solo la vista: recibe los datos y las acciones. La página
 * (/intranet/mi-perfil) los trae de /api/talento/mi-ficha y /api/users/me.
 */
import { useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Camera, CalendarDays, CarFront, Check, FileSignature, FileText, FolderOpen, LayoutGrid, Receipt,
  RefreshCw, UserRound,
} from 'lucide-react'
import { Aviso, Boton, Cabecera, Contenido, Pestanas, type Pestana } from '@/app/components/marca'
import type { Departamento } from '@/lib/departamentos'
import {
  TIPOS_DOCUMENTO_ARCHIVO, VINCULACION, completitud, contratoVigente, diasHasta, fechaLarga, nombreCompleto,
  type Certificado, type Contrato, type CuentaCobro, type DocumentoPersona, type Persona,
} from '@/lib/talento'
import { BarraCompletitud, FormularioFicha } from './ficha'
import { SeccionCertificados, SeccionContratos, SeccionCuentas, SeccionDocumentos } from './secciones'

export type TabEspacio = 'area' | 'informacion' | 'documentos' | 'contratos' | 'certificados' | 'cuentas'
export const TABS_ESPACIO: TabEspacio[] = ['area', 'informacion', 'documentos', 'contratos', 'certificados', 'cuentas']

export interface Expediente {
  persona: Persona; contratos: Contrato[]; documentos: DocumentoPersona[]
  cuentas: CuentaCobro[]; certificados: Certificado[]
}

interface Pendiente { texto: string; tab: TabEspacio; urgente?: boolean }

/** Lo que la persona tiene por hacer, de lo más urgente a lo menos. */
export function pendientesDe(exp: Expediente): Pendiente[] {
  const p = exp.persona
  const vigente = contratoVigente(exp.contratos)
  const esContratista = vigente?.vinculacion === 'contratista'
  const out: Pendiente[] = []
  const devueltas = exp.cuentas.filter((c) => c.estado === 'devuelta').length
  if (devueltas) out.push({ texto: `Corregir ${devueltas === 1 ? 'la cuenta de cobro devuelta' : `${devueltas} cuentas de cobro devueltas`}`, tab: 'cuentas', urgente: true })
  if (vigente?.fecha_fin) {
    const dias = diasHasta(vigente.fecha_fin)
    if (dias >= 0 && dias <= 30) out.push({ texto: `Tu contrato termina en ${dias} día${dias === 1 ? '' : 's'} (${fechaLarga(vigente.fecha_fin)})`, tab: 'contratos', urgente: dias <= 10 })
  }
  if (!p.autoriza_datos) out.push({ texto: 'Aceptar la autorización de tratamiento de datos', tab: 'informacion', urgente: true })
  const comp = completitud(p, esContratista)
  if (comp.faltan.length) out.push({ texto: `Completar tu información: faltan ${comp.faltan.length} dato${comp.faltan.length === 1 ? '' : 's'}`, tab: 'informacion' })
  if (!p.foto) out.push({ texto: 'Poner tu foto', tab: 'informacion' })
  for (const t of ['documento_identidad', 'rut', 'certificacion_bancaria']) {
    if (!exp.documentos.some((d) => d.tipo === t)) out.push({ texto: `Subir ${TIPOS_DOCUMENTO_ARCHIVO[t].toLowerCase()}`, tab: 'documentos' })
  }
  return out
}

/** La foto en círculo. Con `onCambiar`, un botón encima para poner otra. */
export function FotoPersona({ persona, tam = 96, onCambiar, claro = false }: {
  persona: Pick<Persona, 'foto' | 'nombres' | 'email'>; tam?: number; onCambiar?: (dataUrl: string) => void; claro?: boolean
}) {
  const archivo = useRef<HTMLInputElement>(null)
  const inicial = (persona.nombres ?? persona.email).charAt(0).toUpperCase()
  return (
    <span className="relative inline-block shrink-0" style={{ width: tam, height: tam }}>
      {persona.foto
        // eslint-disable-next-line @next/next/no-img-element -- foto en base64 guardada en la ficha
        ? <img src={persona.foto} alt="" className={`h-full w-full rounded-full object-cover ring-2 ${claro ? 'ring-linea' : 'ring-hueso/40'}`} />
        : <span className={`grid h-full w-full place-items-center rounded-full font-display font-semibold ring-2 ${claro ? 'bg-hueso text-bosque ring-linea' : 'bg-bosque text-hueso ring-hueso/40'}`} style={{ fontSize: tam * 0.38 }}>{inicial}</span>}
      {onCambiar && (
        <>
          <button type="button" title="Cambiar la foto" onClick={() => archivo.current?.click()}
            className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-ambar text-tinta shadow-md transition-transform hover:scale-105">
            <Camera size={15} />
          </button>
          <input ref={archivo} type="file" accept="image/*" className="hidden"
            onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onCambiar(await recortarFoto(f)) }} />
        </>
      )}
    </span>
  )
}

/** Recorta al centro en cuadrado de 320 px y la deja en JPEG liviano (~30 KB). */
export function recortarFoto(f: File): Promise<string> {
  return new Promise((ok, mal) => {
    const img = new Image()
    img.onload = () => {
      const lado = Math.min(img.width, img.height), L = 320
      const c = document.createElement('canvas'); c.width = L; c.height = L
      c.getContext('2d')!.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, L, L)
      ok(c.toDataURL('image/jpeg', 0.85))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = mal
    img.src = URL.createObjectURL(f)
  })
}

export function VistaEspacio({
  exp, departamento, esAdmin, proyectos, tab, onTab, onGuardarFicha, onFoto, onRecargar, accionesCabecera, aviso,
}: {
  exp: Expediente
  departamento: Departamento | null
  esAdmin: boolean
  proyectos: { codigo: string; nombre: string }[]
  tab: TabEspacio
  onTab: (t: TabEspacio) => void
  onGuardarFicha: (datos: Record<string, unknown>) => Promise<string | null>
  /** Poner otra foto (dataURL) o quitarla (null): devuelve el error, si hubo. */
  onFoto: (foto: string | null) => Promise<string | null>
  onRecargar: () => void
  accionesCabecera?: ReactNode
  aviso?: ReactNode
}) {
  const p = exp.persona
  const vigente = contratoVigente(exp.contratos)
  const esContratista = vigente?.vinculacion === 'contratista'
  const comp = completitud(p, esContratista)
  const pendientes = pendientesDe(exp)
  const cargo = vigente?.cargo ?? p.m365?.cargo ?? null
  const [errorFoto, setErrorFoto] = useState<string | null>(null)

  async function cambiarFoto(f: string | null) {
    setErrorFoto(null)
    const e = await onFoto(f)
    if (e) setErrorFoto(e)
  }

  const pestanas: Pestana[] = [
    { id: 'area', label: 'Mi área', icono: <LayoutGrid size={13} /> },
    { id: 'informacion', label: 'Mi información', icono: <UserRound size={13} /> },
    { id: 'documentos', label: 'Documentos', icono: <FolderOpen size={13} /> },
    { id: 'contratos', label: 'Contratos', icono: <FileSignature size={13} /> },
    { id: 'certificados', label: 'Certificados', icono: <FileText size={13} /> },
    ...(esContratista || exp.cuentas.length ? [{ id: 'cuentas', label: 'Cuentas de cobro', icono: <Receipt size={13} /> }] : []),
  ].map((x) => ({ ...x, activa: tab === x.id, onClick: () => onTab(x.id as TabEspacio) }))

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        ancho="normal"
        volver={{ href: '/', label: 'Inicio' }}
        modulo="Mi espacio"
        titulo={
          <span className="flex items-center gap-6">
            <FotoPersona persona={p} tam={104} onCambiar={cambiarFoto} />
            <span className="min-w-0">
              <span className="block">{nombreCompleto(p)}</span>
              <span className="mt-2 block font-sans text-[13px] font-light tracking-normal text-hueso/80">
                {[cargo, departamento?.nombre].filter(Boolean).join(' · ') || 'Sin cargo ni área registrados'}
              </span>
            </span>
          </span>
        }
        descripcion={<span className="text-hueso/60">{p.email}</span>}
        cifras={[
          { n: departamento?.nombre ?? '—', l: 'Mi área' },
          { n: vigente ? VINCULACION[vigente.vinculacion] : '—', l: 'Vinculación' },
          { n: `${comp.total ? Math.round((comp.llenos / comp.total) * 100) : 100} %`, l: 'Mi información completa' },
          { n: pendientes.length, l: 'Pendientes' },
        ]}
        acciones={accionesCabecera}
        pie={<Pestanas tono="oscuro" items={pestanas} />}
      />
      <Contenido ancho="normal">
        {aviso}
        {errorFoto && <Aviso tono="arcilla" className="mb-6">{errorFoto}</Aviso>}

        {tab === 'area' && (
          <MiArea exp={exp} departamento={departamento} esAdmin={esAdmin} pendientes={pendientes} onTab={onTab} esContratista={esContratista} />
        )}

        {tab === 'informacion' && (
          <>
            <div className="mb-10 flex flex-wrap items-center gap-8 border border-linea bg-white px-6 py-5">
              <FotoPersona persona={p} tam={88} onCambiar={cambiarFoto} claro />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold text-tinta">Tu foto</p>
                <p className="max-w-[52ch] text-[12.5px] font-light text-suave">
                  Sale en tu espacio, en el tablero de talento humano y en la página de inicio. Toca la cámara para poner otra;
                  se recorta cuadrada.
                </p>
                {p.foto && p.m365?.foto_propia && (
                  <button type="button" className="mt-2 text-[10.5px] uppercase tracking-[.14em] text-tenue hover:text-tinta" onClick={() => cambiarFoto(null)}>
                    Quitarla y usar la de Microsoft 365
                  </button>
                )}
              </div>
              <div className="w-full max-w-xs"><BarraCompletitud persona={p} esContratista={esContratista} /></div>
            </div>
            <FormularioFicha key={p.updated_at} persona={p} modo="persona" esContratista={esContratista} onGuardar={onGuardarFicha} />
          </>
        )}
        {tab === 'documentos' && <SeccionDocumentos documentos={exp.documentos} personaId={p.id} modo="persona" onCambio={onRecargar} />}
        {tab === 'contratos' && <SeccionContratos contratos={exp.contratos} personaId={p.id} modo="persona" proyectos={proyectos} onCambio={onRecargar} />}
        {tab === 'certificados' && (
          <SeccionCertificados certificados={exp.certificados} personaId={p.id} modo="persona"
            hayContratos={exp.contratos.some((c) => c.estado !== 'anulado')} onCambio={onRecargar} />
        )}
        {tab === 'cuentas' && <SeccionCuentas cuentas={exp.cuentas} contratos={exp.contratos} persona={p} modo="persona" onCambio={onRecargar} />}
      </Contenido>
    </div>
  )
}

/** La primera pestaña: dónde trabaja la persona y qué tiene pendiente. */
function MiArea({ exp, departamento, esAdmin, pendientes, onTab, esContratista }: {
  exp: Expediente; departamento: Departamento | null; esAdmin: boolean; pendientes: Pendiente[]
  onTab: (t: TabEspacio) => void; esContratista: boolean
}) {
  const vigente = contratoVigente(exp.contratos)
  return (
    <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr]">
      <div className="space-y-8">
        {/* El área */}
        <section className="relative overflow-hidden border border-linea bg-white px-7 py-7">
          <span className="absolute left-0 top-0 h-full w-1 bg-bosque" />
          <p className="text-[10px] uppercase tracking-[.2em] text-tenue">Tu área</p>
          {departamento ? (
            <>
              <h2 className="mt-2 font-display text-[2rem] font-bold leading-tight text-tinta">{departamento.nombre}</h2>
              <p className="mt-2 max-w-[56ch] text-[13px] font-light leading-relaxed text-suave">{departamento.que}</p>
              {departamento.ruta && (
                <div className="mt-6"><Boton href={departamento.ruta} icono={<ArrowRight size={13} />}>Entrar al módulo</Boton></div>
              )}
              {esAdmin && (
                <p className="mt-5 text-[11.5px] text-tenue">Como administrador ves además los demás módulos desde la <Link href="/intranet" className="underline">intranet</Link>.</p>
              )}
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-[1.6rem] font-semibold leading-tight text-tinta">Todavía sin área asignada</h2>
              <p className="mt-2 max-w-[56ch] text-[13px] font-light leading-relaxed text-suave">
                Un administrador de la intranet te asigna el área en la que trabajas; con eso aparece aquí el módulo de tu equipo.
                Mientras tanto, desde aquí manejas tu información, tus contratos y tus certificados.
              </p>
            </>
          )}
        </section>

        {/* La vinculación */}
        <section className="border border-linea bg-white px-7 py-6">
          <p className="text-[10px] uppercase tracking-[.2em] text-tenue">Tu vinculación</p>
          {vigente ? (
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-display text-xl font-semibold text-tinta">{vigente.cargo}</p>
                <p className="text-[12.5px] text-suave">{VINCULACION[vigente.vinculacion]} · desde el {fechaLarga(vigente.fecha_inicio)}{vigente.fecha_fin ? ` hasta el ${fechaLarga(vigente.fecha_fin)}` : ', sin fecha de terminación'}</p>
              </div>
              <Boton variante="secundario" onClick={() => onTab('contratos')}>Ver contrato</Boton>
            </div>
          ) : (
            <p className="mt-3 text-[12.5px] text-suave">Talento humano todavía no ha cargado tu contrato.</p>
          )}
        </section>

        {/* Accesos rápidos */}
        <section>
          <p className="mb-3 text-[10px] uppercase tracking-[.2em] text-tenue">Accesos rápidos</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Acceso icono={<FileText size={16} />} titulo="Certificado laboral" sub="Generarlo al momento" onClick={() => onTab('certificados')} />
            {esContratista && <Acceso icono={<Receipt size={16} />} titulo="Cuenta de cobro" sub="Pasarla con tus datos ya puestos" onClick={() => onTab('cuentas')} />}
            <Acceso icono={<CalendarDays size={16} />} titulo="Calendario de vehículos" sub="Qué vehículo está libre" href="/calendar" />
            <Acceso icono={<CarFront size={16} />} titulo="Validar mi reserva" sub="Inspección de recepción y devolución" href="/validar-reserva" />
          </div>
        </section>
      </div>

      {/* Pendientes */}
      <aside className="h-fit border border-linea bg-white">
        <p className="border-b border-linea px-6 py-4 font-display text-lg font-semibold text-tinta">Pendientes</p>
        {pendientes.length === 0 ? (
          <p className="flex items-center gap-2 px-6 py-6 text-[13px] text-bosque"><Check size={16} /> Nada pendiente. Todo al día.</p>
        ) : (
          <ul>
            {pendientes.map((x, i) => (
              <li key={i}>
                <button type="button" onClick={() => onTab(x.tab)}
                  className="group flex w-full items-center gap-3 border-b border-fina px-6 py-3.5 text-left last:border-0 hover:bg-papel">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${x.urgente ? 'bg-red-600' : 'bg-ambar'}`} />
                  <span className="flex-1 text-[13px] text-tinta">{x.texto}</span>
                  <ArrowRight size={14} className="text-tenue transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-linea px-6 py-4">
          <button type="button" onClick={() => onTab('informacion')} className="flex items-center gap-2 text-[10.5px] uppercase tracking-[.14em] text-tenue hover:text-tinta">
            <RefreshCw size={12} /> Actualizar mi información
          </button>
        </div>
      </aside>
    </div>
  )
}

function Acceso({ icono, titulo, sub, href, onClick }: { icono: ReactNode; titulo: string; sub: string; href?: string; onClick?: () => void }) {
  const cls = 'group flex items-center gap-4 border border-linea bg-white px-5 py-4 text-left transition-colors hover:border-bosque'
  const cuerpo = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center bg-hueso text-bosque">{icono}</span>
      <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-tinta">{titulo}</span><span className="block text-[11.5px] text-tenue">{sub}</span></span>
      <ArrowRight size={14} className="text-tenue transition-transform group-hover:translate-x-0.5" />
    </>
  )
  return href ? <Link href={href} className={cls}>{cuerpo}</Link> : <button type="button" onClick={onClick} className={cls}>{cuerpo}</button>
}
