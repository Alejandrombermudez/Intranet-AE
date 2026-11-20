'use client'
import { useMemo, useState } from 'react'
import { Boxes, Car, FileText, Package, Settings, ShieldCheck, Smartphone, Tent, Users } from 'lucide-react'
import { Aviso, Boton, Cabecera, Cargando, Contenido, Pestanas, type Pestana } from '@/app/components/marca'
import { pesos } from '@/lib/administrativa'
import { useAccesoFinanciero, useCatalogo } from './comun'
import Compras from './compras'
import Inventario from './inventario'
import SalidasCampo from './salidas'
import CatalogoInsumos from './catalogo'
import AppCampo from './campo'
import Talento, { Configuracion } from './talento'

/**
 * MÓDULO ADMINISTRATIVO Y FINANCIERO
 * ──────────────────────────────────
 * Lo hacen las mismas personas —administrativa, talento humano y logística son
 * un solo equipo—. Arriba van pocos botones, uno por área (2026-11-20, a pedido
 * del usuario: siete pestañas sueltas confundían):
 *
 *   Inventario y compras  todo lo de bodega, con sus pestañas adentro:
 *       Compras             facturas electrónicas DIAN → gasto e inventario
 *       Inventario          saldo por bodega, repartir a los proyectos, kardex
 *       Salidas a campo     entrega, consumo, devolución y cierre, con actas
 *       App de campo        quién entra a la app de actividades y qué registró
 *       Elementos y bodegas el catálogo
 *   Talento humano        fichas, contratos, certificados y cuentas de cobro (Financiero y Ejecutivo)
 *   Vehículos             /vehiculos, la app aparte
 *   Tratamiento de datos  lo que ya tenía Financiero en el tablero (no Logística)
 *   Configuración         razón social, NIT, quién firma y su firma, enlace de cuentas de cobro (como Talento humano)
 *
 * Logística (Katys) ve solo Inventario y compras —sin los consolidados en pesos— y Vehículos.
 */
type Tab = 'compras' | 'inventario' | 'salidas' | 'campo' | 'catalogo' | 'talento' | 'config'
const TABS: Tab[] = ['compras', 'inventario', 'salidas', 'campo', 'catalogo', 'talento', 'config']

export default function AdministrativaPage() {
  const { listo, perfil, veTotales } = useAccesoFinanciero()
  // Talento humano ve datos personales y salarios: solo Financiero y Ejecutivo (PUEDE.talentoHumano).
  const veTalento = perfil?.department === 'Financiero' || perfil?.department === 'Ejecutivo'
  const veDatos = !!perfil && (perfil.is_admin || perfil.department === 'Financiero')
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
  // Quien no ve talento humano y llega con ?tab=talento cae en Compras.
  const vista: Tab = (tab === 'talento' || tab === 'config') && !veTalento ? 'compras' : tab
  const enBodega = vista !== 'talento' && vista !== 'config'

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

  // Arriba: un botón por área. Las de bodega van adentro de «Inventario y compras».
  const pestanas: Pestana[] = [
    { id: 'bodega', label: 'Inventario y compras', icono: <Boxes size={13} />, activa: enBodega, onClick: () => { if (!enBodega) cambiar('compras') } },
    ...(veTalento ? [{ id: 'talento', label: 'Talento humano', icono: <Users size={13} />, activa: vista === 'talento', onClick: () => cambiar('talento') }] : []),
    { id: 'vehiculos', label: 'Vehículos', icono: <Car size={13} />, href: '/vehiculos' },
    // Lo que el departamento ya tenía en el tablero general de la intranet.
    ...(veDatos ? [{ id: 'datos', label: 'Tratamiento de datos', icono: <ShieldCheck size={13} />, href: '/intranet?modulo=financiero' }] : []),
    ...(veTalento ? [{ id: 'config', label: 'Configuración', icono: <Settings size={13} />, activa: vista === 'config', onClick: () => cambiar('config') }] : []),
  ]
  const deBodega: Pestana[] = [
    { id: 'compras', label: 'Compras', icono: <FileText size={13} />, activa: vista === 'compras', onClick: () => cambiar('compras') },
    { id: 'inventario', label: 'Inventario', icono: <Boxes size={13} />, activa: vista === 'inventario', onClick: () => cambiar('inventario') },
    { id: 'salidas', label: 'Salidas a campo', icono: <Tent size={13} />, activa: vista === 'salidas', onClick: () => cambiar('salidas') },
    { id: 'campo', label: 'App de campo', icono: <Smartphone size={13} />, activa: vista === 'campo', onClick: () => cambiar('campo') },
    { id: 'catalogo', label: 'Elementos y bodegas', icono: <Package size={13} />, activa: vista === 'catalogo', onClick: () => cambiar('catalogo') },
  ]

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        ancho="amplio"
        volver={{ href: '/intranet', label: 'Intranet' }}
        modulo="Administrativa y financiera"
        titulo={vista === 'talento' ? 'Talento humano' : vista === 'config' ? 'Configuración' : 'Inventario y compras'}
        descripcion={vista === 'config'
          ? 'Los datos de la organización y quién firma: con ellos salen los certificados, las cuentas de cobro y las actas, todos en la hoja membrete.'
          : vista === 'talento'
          ? 'La ficha de cada persona, sus contratos de planta o de prestación de servicios, los certificados laborales y las cuentas de cobro de los contratistas.'
          : 'La factura electrónica entra como gasto e inventario; el inventario se reparte a las bodegas de cada proyecto y la app de campo descuenta lo que se gasta en los núcleos.'}
        cifras={cat.faltaMigracion || !enBodega || !veTotales ? undefined : cifras}
        acciones={vista === 'compras' && !cat.faltaMigracion
          ? <Boton variante="luz" href="/intranet/administrativa/facturas/nueva" icono={<FileText size={13} />}>Subir factura</Boton>
          : undefined}
        pie={<Pestanas tono="oscuro" items={pestanas} />}
      />
      <Contenido ancho="amplio">
        {enBodega && <div className="mb-8"><Pestanas items={deBodega} /></div>}
        {cat.faltaMigracion && enBodega && (
          <Aviso tono="ambar" titulo="El módulo todavía no tiene dónde guardar" className="mb-8">
            {cat.aviso}
          </Aviso>
        )}
        {error && <Aviso tono="arcilla" className="mb-8">{error}</Aviso>}

        {vista === 'talento' && <Talento />}
        {vista === 'config' && <Configuracion />}
        {!cat.faltaMigracion && (
          <>
            {vista === 'compras' && <Compras cat={cat} veTotales={veTotales} />}
            {vista === 'inventario' && <Inventario cat={cat} recargar={recargar} veTotales={veTotales} />}
            {vista === 'salidas' && <SalidasCampo cat={cat} recargar={recargar} />}
            {vista === 'campo' && <AppCampo cat={cat} recargar={recargar} veTotales={veTotales} />}
            {vista === 'catalogo' && <CatalogoInsumos cat={cat} recargar={recargar} />}
          </>
        )}
      </Contenido>
    </div>
  )
}
