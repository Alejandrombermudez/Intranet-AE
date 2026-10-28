/**
 * LA HOJA DE CONCILIACIÓN EN EXCEL
 * ────────────────────────────────
 * Dos hojas, como la que armó a mano Administrativa para el piloto de siembra
 * en La Guajira, Las Dalias y Versalles (corte 23/10/2026):
 *   «Resumen»       elementos por estado y las cifras clave
 *   «Conciliación»  una fila por elemento: entregado, adicional, total a cargo,
 *                   consumido, devuelto, a cargo del personal, diferencia, estado
 * Los valores van calculados por la base (inventario.v_conciliacion_salida), no
 * como fórmulas: el archivo es un soporte, la fuente es la intranet.
 * Se arma en el navegador con SheetJS.
 */
import { ESTADOS, CLASES, type EstadoConciliacion, type FilaConciliacion, type Salida } from '@/lib/salidas'

const ORDEN_ESTADOS: EstadoConciliacion[] = [
  'sin_devolucion', 'falta_justificar', 'pendiente_conteo', 'devuelto_de_mas', 'a_cargo',
  'devuelto_sin_entrega', 'cuadra', 'consumido', 'sin_uso',
]

const fechaDMA = (iso: string | null | undefined) => {
  if (!iso) return ''
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

export async function libroConciliacion(
  salida: Pick<Salida, 'nombre' | 'fecha_salida' | 'fecha_cierre' | 'estado'>,
  filas: FilaConciliacion[],
  corte: string,
): Promise<Blob> {
  const XLSX = await import('xlsx')

  // ── Conciliación ──
  const cabecera = ['Categoría', 'Elemento', 'Clase', 'Unidad', 'Entregado inicial', 'Compra / entrega adicional', 'Total a cargo',
    'Consumido (app)', 'Devuelto', 'Por recibir', 'A cargo del personal', 'Dotación', 'Justificado', 'Sobrante devuelto',
    'Diferencia (sin explicar)', 'Estado', 'Observación']
  const cuerpo = filas.map((f) => [
    f.categoria ?? '', f.nombre, CLASES[f.clase]?.nombre ?? f.clase, f.unidad,
    f.inicial, f.adicional, f.total, f.consumido_app, f.devuelto, f.por_recibir, f.a_cargo, f.dotacion, f.justificado, f.sobrante,
    f.saldo, ESTADOS[f.estado]?.texto ?? f.estado, f.observacion ?? '',
  ])
  const hojaConc = XLSX.utils.aoa_to_sheet([
    [`Conciliación de materiales — ${salida.nombre}`],
    [`Salida: ${fechaDMA(salida.fecha_salida)}${salida.fecha_cierre ? ` · Cierre: ${fechaDMA(salida.fecha_cierre)}` : ' · Abierta'} · Corte: ${fechaDMA(corte)}. Generado por la intranet; la fuente son los movimientos y las actas.`],
    [],
    cabecera,
    ...cuerpo,
    [],
    ['Diferencia positiva = falta explicar (consumo, devolución o responsable). Negativa = se devolvió más de lo entregado.'],
  ])
  hojaConc['!cols'] = [14, 40, 12, 9, 10, 12, 10, 10, 10, 9, 11, 9, 10, 10, 12, 28, 60].map((wch) => ({ wch }))

  // ── Resumen ──
  const cuenta = new Map<EstadoConciliacion, number>()
  for (const f of filas) cuenta.set(f.estado, (cuenta.get(f.estado) ?? 0) + 1)
  const resumen: (string | number)[][] = [
    [`Resumen ejecutivo — ${salida.nombre}`],
    [`Corte: ${fechaDMA(corte)}. Se calcula de la hoja «Conciliación».`],
    [],
    ['Elementos por estado'],
    ['Estado', 'N.º de elementos'],
    ...ORDEN_ESTADOS.filter((e) => cuenta.has(e)).map((e) => [ESTADOS[e].texto, cuenta.get(e)!]),
    ['Total', filas.length],
    [],
    ['Para explicar'],
    ['Elemento', 'Estado', 'Diferencia', 'Unidad'],
    ...filas.filter((f) => ['sin_devolucion', 'falta_justificar', 'pendiente_conteo', 'devuelto_de_mas'].includes(f.estado))
      .map((f) => [f.nombre, ESTADOS[f.estado].texto, f.saldo, f.unidad]),
  ]
  const hojaRes = XLSX.utils.aoa_to_sheet(resumen)
  hojaRes['!cols'] = [{ wch: 44 }, { wch: 30 }, { wch: 12 }, { wch: 10 }]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hojaRes, 'Resumen')
  XLSX.utils.book_append_sheet(libro, hojaConc, 'Conciliación')
  const bytes = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

export const nombreArchivoConciliacion = (salida: Pick<Salida, 'nombre'>, corte: string) =>
  `Conciliacion_${salida.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^0-9A-Za-z]+/g, '_').slice(0, 50)}_${corte}.xlsx`
