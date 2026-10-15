'use client'
import { useMemo, useState } from 'react'
import { Boxes, FileText, Package, Smartphone, Truck, Users } from 'lucide-react'
import { Aviso, Boton, Cabecera, Cargando, Contenido, Pestanas, type Pestana } from '@/app/components/marca'
import { pesos } from '@/lib/administrativa'
import { useAccesoFinanciero, useCatalogo } from './comun'
import Compras from './compras'
import Inventario from './inventario'
import CatalogoInsumos from './catalogo'
import AppCampo from './campo'
import Talento from './talento'

/**
 * MÓDULO ADMINISTRATIVO Y FINANCIERO
 * ──────────────────────────────────
 * Lo hacen las mismas personas —administrativa, talento humano y logística son
 * un solo equipo—, así que es un solo módulo con un solo departamento
 * (`Financiero` en people.user_profiles) y pestañas por tarea:
 *
 *   Compras     facturas electrónicas DIAN → gasto e inventario
 *   Inventario  saldo por bodega, repartir a los proyectos, kardex
 *   App de campo  quién entra a la app de actividades y qué registró
 *   Catálogo    insumos y bodegas
 *   Flota y datos  lo que ya tenía Financiero en el tablero (carros, tratamiento de datos)
 *   Talento humano  fichas, contratos, certificados y cuentas de cobro (solo Financiero y Ejecutivo)
 */
type Tab = 'compras' | 'inventario' | 'campo' | 'catalogo' | 'talento'
const TABS: Tab[] = ['compras', 'inventario', 'campo', 'catalogo', 'talento']

export default function AdministrativaPage() {
  const { listo, perfil } = useAccesoFinanciero()
  // Talento humano ve datos personales y salarios: solo Financiero y Ejecutivo (PUEDE.talentoHumano).
  const veTalento = perfil?.department === 'Financiero' || perfil?.department === 'Ejecutivo'
  const { cat, cargando, error, recargar } = useCatalogo(listo)
  // La pestaña va en la dirección (?tab=…) para volver al mismo sitio al recargar.
  // En el servidor no hay dirección: arranca en Compras, y mientras se verifica el
  // acceso solo se pinta «Cargando», así que no hay diferencia que hidratar.
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'compras'
    const t = new URLSearchParams(window.location.search).get('tab') as Tab | null
    return t && TABS.includes(t) ? t : 'compras'
  })
  const cambiar = (t: Tab) => {
    setTab(t)
    const u = new URL(window.location.href)
    u.searchParams.set('tab', t)
    window.history.replaceState(null, '', u.toString())
  }

  const cifras = useMemo(() => {
    const costo = new Map(cat.insumos.map((i) => [i.id, Number(i.costo_promedio) || 0]))
    const valor = cat.existencias.reduce((s, e) => s + Math.max(0, Number(e.saldo)) * (costo.get(e.insumo_id) ?? 0), 0)
    const enCamino = cat.existencias.filter((e) => Number(e.por_recibir) > 0).length
    const faltantes = cat.existencias.filter((e) => Number(e.saldo) < -0.0001).length
    return [
      { n: pesos(valor), l: 'Valor en bodegas' },
      { n: cat.insumos.filter((i) => i.activo).length, l: 'Insumos en catálogo' },
      { n: cat.bodegas.filter((b) => b.activo).length, l: 'Bodegas' },
      { n: enCamino, l: 'Envíos por recibir' },
      { n: faltantes, l: 'Saldos en negativo' },
    ]
  }, [cat])

  if (!listo || cargando) return <Cargando texto="Abriendo el módulo…" />

  const pestanas: Pestana[] = [
    { id: 'compras', label: 'Compras', icono: <FileText size={13} />, activa: tab === 'compras', onClick: () => cambiar('compras') },
    { id: 'inventario', label: 'Inventario', icono: <Boxes size={13} />, activa: tab === 'inventario', onClick: () => cambiar('inventario') },
    { id: 'campo', label: 'App de campo', icono: <Smartphone size={13} />, activa: tab === 'campo', onClick: () => cambiar('campo') },
    { id: 'catalogo', label: 'Insumos y bodegas', icono: <Package size={13} />, activa: tab === 'catalogo', onClick: () => cambiar('catalogo') },
    ...(veTalento ? [{ id: 'talento', label: 'Talento humano', icono: <Users size={13} />, activa: tab === 'talento', onClick: () => cambiar('talento') }] : []),
    // Lo que el departamento ya tenía en el tablero general de la intranet.
    { id: 'flota', label: 'Flota y datos', icono: <Truck size={13} />, href: '/intranet?modulo=financiero' },
  ]

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        ancho="amplio"
        volver={{ href: '/intranet', label: 'Intranet' }}
        modulo="Administrativa y financiera"
        titulo={tab === 'talento' ? 'Talento humano' : 'Compras e inventario'}
        descripcion={tab === 'talento'
          ? 'La ficha de cada persona, sus contratos de planta o de prestación de servicios, los certificados laborales y las cuentas de cobro de los contratistas.'
          : 'La factura electrónica entra como gasto e inventario; el inventario se reparte a las bodegas de cada proyecto y la app de campo descuenta lo que se gasta en los núcleos.'}
        cifras={cat.faltaMigracion || tab === 'talento' ? undefined : cifras}
        acciones={tab === 'compras' && !cat.faltaMigracion
          ? <Boton variante="luz" href="/intranet/administrativa/facturas/nueva" icono={<FileText size={13} />}>Subir factura</Boton>
          : undefined}
        pie={<Pestanas tono="oscuro" items={pestanas} />}
      />
      <Contenido ancho="amplio">
        {cat.faltaMigracion && tab !== 'talento' && (
          <Aviso tono="ambar" titulo="El módulo todavía no tiene dónde guardar" className="mb-8">
            {cat.aviso}
          </Aviso>
        )}
        {error && <Aviso tono="arcilla" className="mb-8">{error}</Aviso>}

        {tab === 'talento' && veTalento && <Talento />}
        {!cat.faltaMigracion && (
          <>
            {tab === 'compras' && <Compras cat={cat} />}
            {tab === 'inventario' && <Inventario cat={cat} recargar={recargar} />}
            {tab === 'campo' && <AppCampo cat={cat} recargar={recargar} />}
            {tab === 'catalogo' && <CatalogoInsumos cat={cat} recargar={recargar} />}
          </>
        )}
      </Contenido>
    </div>
  )
}
