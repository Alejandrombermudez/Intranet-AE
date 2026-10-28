/**
 * ACTAS DE SALIDAS A CAMPO EN PDF — entrega, entrega adicional, devolución y EPP
 * ─────────────────────────────────────────────────────────────────────────────
 * Se arman EN EL NAVEGADOR con jsPDF desde la foto fija que guarda la base
 * (`inventario.actas.datos`): el mismo acta produce siempre el mismo documento,
 * aunque el catálogo cambie después. Usan la misma plantilla (banda, isotipo,
 * pie con el lema) que las cuentas de cobro y los certificados.
 *
 * El PDF se imprime, se firma a mano y el escaneo se sube a la salida:
 * hasta entonces el acta queda «sin firma» en la intranet.
 */
import { MARCA } from '@/lib/expediente-formato'
import { fechaLarga } from '@/lib/talento'
import { MARGEN, UTIL, nuevoDoc, parrafo, plantilla, rgb, rotulo } from '@/lib/talento-pdf'
import { CLASES, TIPOS_ACTA, num, type Acta } from '@/lib/salidas'

export interface OrganizacionActa {
  razon_social?: string | null; nit?: string | null; direccion?: string | null
  ciudad?: string | null; telefono?: string | null; correo?: string | null
}

/** Qué se compromete a hacer quien recibe, según el tipo de acta. */
const COMPROMISO: Record<Acta['tipo'], string> = {
  entrega:
    'Quien recibe se hace responsable de los elementos relacionados, los usa en las actividades de la salida y devuelve a la bodega lo que no se consuma. Las herramientas y los elementos de protección personal (EPP) se devuelven al terminar; lo que se consuma, se instale, se dañe o se pierda se explica por escrito al cerrar la salida.',
  adicional:
    'Estos elementos se suman a lo entregado al inicio de la salida. Quien recibe responde por ellos en las mismas condiciones: lo que no se consuma, se devuelve; lo que falte, se explica por escrito.',
  devolucion:
    'Se devuelven a la bodega los elementos relacionados. Las cantidades se confirman contándolas al recibirlas: si lo contado difiere de lo aquí escrito, prevalece el conteo y la diferencia se explica al cerrar la salida.',
  epp:
    'Quien firma recibe a su nombre los elementos relacionados, se compromete a usarlos y cuidarlos, y a devolver, al terminar la labor, los que sean EPP o herramienta de trabajo. La dotación personal queda con quien la recibe.',
}

export async function pdfActa(a: Pick<Acta, 'numero' | 'tipo' | 'fecha' | 'datos' | 'notas' | 'creado_por' | 'id'>, org: OrganizacionActa = {}): Promise<Blob> {
  const d = a.datos
  const t = TIPOS_ACTA[a.tipo]
  const doc = await nuevoDoc()
  const razon = org.razon_social || 'Amazonía Emprende'
  let y = await plantilla(doc, {
    org, tipo: t.titulo, referencia: a.numero,
    legal: `Generada en la intranet de ${razon}${a.creado_por ? ` por ${a.creado_por}` : ''}. Referencia ${a.id.slice(0, 8).toUpperCase()}. Se imprime, se firma y el escaneo se sube a la salida.`,
  })

  doc.setFont('helvetica', 'bold'); doc.setFontSize(19); doc.setTextColor(...rgb(MARCA.bosque))
  doc.text(t.nombre, MARGEN, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...rgb(MARCA.tinta))
  doc.text(`${org.ciudad || 'Florencia'}, ${fechaLarga(a.fecha)}`, MARGEN, y + 7)

  // Datos de la salida, en dos columnas.
  y += 16
  const campo = (rot: string, valor: string | null | undefined, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...rgb(MARCA.musgo))
    doc.text(rot.toUpperCase(), x, yy, { charSpace: 0.9 })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...rgb(MARCA.tinta))
    doc.text(doc.splitTextToSize(valor || '—', UTIL / 2 - 4), x, yy + 5)
  }
  const col2 = MARGEN + UTIL / 2
  campo('Salida', d.salida, MARGEN, y)
  campo('Responsable de la salida', d.responsable, col2, y)
  // Un nombre largo de salida ocupa dos líneas: la fila siguiente baja con él.
  y += doc.splitTextToSize(d.salida || '', UTIL / 2 - 4).length > 1 ? 19 : 14
  if (a.tipo === 'epp') {
    campo('Recibe', d.trabajador, MARGEN, y)
    campo('Documento', d.trabajador_documento, col2, y)
  } else {
    campo(a.tipo === 'devolucion' ? 'Sale de la salida' : 'Sale de la bodega', d.origen, MARGEN, y)
    campo(a.tipo === 'devolucion' ? 'Vuelve a la bodega' : 'Entra a la salida', d.destino, col2, y)
  }
  y += 14

  // Los elementos.
  rotulo(doc, 'Elementos', y)
  const { default: autoTable } = await import('jspdf-autotable')
  autoTable(doc, {
    startY: y + 3,
    margin: { left: MARGEN, right: MARGEN, bottom: 30 },
    head: [['#', 'Elemento', 'Clase', 'Unidad', 'Cantidad']],
    body: d.items.map((i, k) => [String(k + 1), i.nombre, CLASES[i.clase]?.nombre ?? i.clase, i.unidad, num(i.cantidad)]),
    theme: 'plain',
    styles: { font: 'helvetica', fontSize: 9.5, textColor: rgb(MARCA.tinta), cellPadding: { top: 2.2, bottom: 2.2, left: 2, right: 2 }, lineColor: rgb(MARCA.taupe), lineWidth: 0 },
    headStyles: { fontStyle: 'bold', fontSize: 8, textColor: rgb(MARCA.musgo), fillColor: rgb(MARCA.papel) },
    columnStyles: { 0: { cellWidth: 9 }, 2: { cellWidth: 26 }, 3: { cellWidth: 22 }, 4: { cellWidth: 22, halign: 'right', fontStyle: 'bold' } },
    didParseCell: (h) => { if (h.section === 'head' && h.column.index === 4) h.cell.styles.halign = 'right' },
    didDrawCell: (h) => {
      if (h.section === 'body') {
        doc.setDrawColor(...rgb(MARCA.hueso)); doc.setLineWidth(0.2)
        doc.line(h.cell.x, h.cell.y + h.cell.height, h.cell.x + h.cell.width, h.cell.y + h.cell.height)
      }
    },
  })
  y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 20) + 8

  y = parrafo(doc, COMPROMISO[a.tipo], y, { tam: 8.8, interlinea: 4.4 })
  if (a.notas) { y += 3; y = parrafo(doc, `Observaciones: ${a.notas}`, y, { tam: 8.8, interlinea: 4.4 }) }

  // Firmas. Si la tabla fue larga, pasan a una hoja nueva.
  if (y > 222) { doc.addPage(); y = 40 }
  const yf = Math.max(y + 16, 224)
  const firmaDe = (x: number, rol: string, nombre: string | null, extra?: string | null) => {
    doc.setDrawColor(...rgb(MARCA.tinta)); doc.setLineWidth(0.3)
    doc.line(x, yf, x + UTIL / 2 - 10, yf)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...rgb(MARCA.tinta))
    doc.text(rol, x, yf + 5)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5)
    if (nombre) doc.text(doc.splitTextToSize(nombre, UTIL / 2 - 10), x, yf + 9.5)
    if (extra) doc.text(extra, x, yf + 14)
  }
  if (a.tipo === 'devolucion') {
    firmaDe(MARGEN, 'Entrega', d.responsable, 'Responsable de la salida')
    firmaDe(col2, 'Recibe y cuenta', null, d.destino)
  } else if (a.tipo === 'epp') {
    firmaDe(MARGEN, 'Entrega', null, razon)
    firmaDe(col2, 'Recibe', d.trabajador, d.trabajador_documento)
  } else {
    firmaDe(MARGEN, 'Entrega', null, d.origen)
    firmaDe(col2, 'Recibe', d.responsable, 'Responsable de la salida')
  }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...rgb(MARCA.oliva))
  doc.text(`Acta ${a.numero} · una copia queda con quien recibe y otra en administrativa`, MARGEN, yf + 22)
  return doc.output('blob')
}

export const nombreArchivoActa = (a: Pick<Acta, 'numero'>) => `Acta-${a.numero}.pdf`
