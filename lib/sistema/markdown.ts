/**
 * MARKDOWN → HTML, lo justo
 * ─────────────────────────
 * Los documentos maestros del ecosistema viven en `docs/*.md` y siguen siendo la
 * fuente: se editan ahí, viven en git y no se duplican en la base. Esta página
 * los muestra, no los reemplaza — y para mostrarlos hay que convertirlos.
 *
 * Es un renderizador a la medida de ESOS archivos, no un markdown completo:
 * encabezados, párrafos, listas, tablas, citas, código, enlaces, negrita y
 * cursiva. Es lo que usan. Se escribió a mano en vez de traer una librería
 * porque son sesenta líneas de lógica y una dependencia menos que actualizar.
 *
 * Todo el texto se escapa ANTES de aplicar formato: el HTML que salga de aquí
 * solo contiene las etiquetas que este archivo genera, nunca las que vengan
 * escritas dentro del documento.
 */

function escapar(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Formato dentro de una línea. Recibe texto YA escapado.
 * El código va primero y se aparta, para que un `**` dentro de un fragmento de
 * código no se convierta en negrita.
 */
function linea(txt: string): string {
  // Los enlaces van PRIMERO, sobre la linea completa. En estos documentos es
  // corriente que el texto del enlace sea un nombre de archivo entre comillas
  // invertidas — [`../OTRO.md`](../OTRO.md) —, y partir por comillas antes de
  // convertirlo dejaria el corchete en un tramo y el parentesis en otro.
  // Convertido el enlace, las comillas de adentro caen dentro de la etiqueta y
  // se vuelven <code>, que es justo lo que se quiere.
  const conEnlaces = enlaces(txt)

  // Ahora si: los tramos en posicion impar son codigo y no reciben ningun otro
  // formato. Asi, un ** dentro de un fragmento de codigo se queda como esta
  // escrito en vez de volverse negrita.
  const tramos = conEnlaces.split('`')
  return tramos
    .map((tramo, i) => {
      // Un backtick suelto al final no abre codigo: es texto.
      const esCodigo = i % 2 === 1 && i < tramos.length - 1
      return esCodigo ? `<code>${tramo}</code>` : enfasis(tramo)
    })
    .join('')
}

/** Enlaces. Solo pasan destinos que no ejecutan nada, aunque el documento
 *  traiga escrito lo contrario. Recibe texto YA escapado. */
function enlaces(txt: string): string {
  return txt.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, texto: string, destino: string) => {
    const limpio = destino.trim()
    const seguro =
      /^(https?:\/\/|\/|#|[\w./-]+\.md)/i.test(limpio) && !/^javascript:|^data:/i.test(limpio)
    if (!seguro) return texto
    const externo = /^https?:\/\//i.test(limpio)
    const attrs = externo ? ' target="_blank" rel="noopener noreferrer"' : ''
    return `<a href="${limpio}"${attrs}>${texto}</a>`
  })
}

/** Negrita, cursiva y tachado. Recibe texto YA escapado y sin fragmentos de codigo. */
function enfasis(txt: string): string {
  return txt
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
}

/** Una fila de tabla markdown → celdas, sin los pipes de los bordes. */
function celdas(fila: string): string[] {
  return fila
    .replace(/^\s*\|/, '')
    .replace(/\|\s*$/, '')
    .split('|')
    .map((c) => c.trim())
}

const esSeparadorDeTabla = (l: string) => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-')

export interface Seccion {
  /** Para el índice lateral. */
  id: string
  titulo: string
  nivel: number
}

export interface DocRenderizado {
  html: string
  secciones: Seccion[]
}

function idDeTitulo(texto: string, usados: Set<string>): string {
  const base =
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'seccion'
  let id = base
  let n = 2
  while (usados.has(id)) id = `${base}-${n++}`
  usados.add(id)
  return id
}

export function renderizar(markdown: string): DocRenderizado {
  const lineas = markdown.replace(/\r\n/g, '\n').split('\n')
  const salida: string[] = []
  const secciones: Seccion[] = []
  const idsUsados = new Set<string>()

  let i = 0
  while (i < lineas.length) {
    const l = lineas[i]

    // ── Bloque de código ────────────────────────────────────────────────────
    if (/^\s*```/.test(l)) {
      const lenguaje = l.replace(/^\s*```/, '').trim()
      const cuerpo: string[] = []
      i++
      while (i < lineas.length && !/^\s*```/.test(lineas[i])) cuerpo.push(lineas[i++])
      i++ // la línea de cierre
      // Los diagramas mermaid de los documentos se muestran como texto: aquí no
      // hay nada que los dibuje, y esconderlos sería peor que mostrarlos crudos.
      const etiqueta = lenguaje === 'mermaid' ? '<p class="md-nota">Diagrama (texto)</p>' : ''
      salida.push(`${etiqueta}<pre><code>${escapar(cuerpo.join('\n'))}</code></pre>`)
      continue
    }

    // ── Encabezado ──────────────────────────────────────────────────────────
    const enc = l.match(/^(#{1,6})\s+(.*)$/)
    if (enc) {
      const nivel = enc[1].length
      const texto = linea(escapar(enc[2].trim()))
      const id = idDeTitulo(enc[2], idsUsados)
      if (nivel <= 3) secciones.push({ id, titulo: enc[2].replace(/[`*]/g, '').trim(), nivel })
      salida.push(`<h${nivel} id="${id}">${texto}</h${nivel}>`)
      i++
      continue
    }

    // ── Línea horizontal ────────────────────────────────────────────────────
    if (/^\s*([-*_])\1{2,}\s*$/.test(l)) {
      salida.push('<hr />')
      i++
      continue
    }

    // ── Tabla ───────────────────────────────────────────────────────────────
    if (l.includes('|') && i + 1 < lineas.length && esSeparadorDeTabla(lineas[i + 1])) {
      const encabezados = celdas(l)
      i += 2
      const filas: string[][] = []
      while (i < lineas.length && lineas[i].includes('|') && lineas[i].trim() !== '') {
        filas.push(celdas(lineas[i]))
        i++
      }
      const th = encabezados.map((c) => `<th>${linea(escapar(c))}</th>`).join('')
      const tr = filas
        .map((f) => `<tr>${f.map((c) => `<td>${linea(escapar(c))}</td>`).join('')}</tr>`)
        .join('')
      salida.push(`<div class="md-tabla"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`)
      continue
    }

    // ── Cita ────────────────────────────────────────────────────────────────
    if (/^\s*>/.test(l)) {
      const cuerpo: string[] = []
      while (i < lineas.length && /^\s*>/.test(lineas[i])) {
        cuerpo.push(lineas[i].replace(/^\s*>\s?/, ''))
        i++
      }
      const interior = renderizar(cuerpo.join('\n')).html
      salida.push(`<blockquote>${interior}</blockquote>`)
      continue
    }

    // ── Listas ──────────────────────────────────────────────────────────────
    const vinieta = /^(\s*)([-*+]|\d+\.)\s+(.*)$/
    if (vinieta.test(l)) {
      const ordenada = /^\s*\d+\./.test(l)
      const items: string[] = []
      while (i < lineas.length && vinieta.test(lineas[i])) {
        const m = lineas[i].match(vinieta)!
        let texto = m[3]
        i++
        // Continuación indentada del mismo punto.
        while (i < lineas.length && /^\s{2,}\S/.test(lineas[i]) && !vinieta.test(lineas[i])) {
          texto += ' ' + lineas[i].trim()
          i++
        }
        items.push(`<li>${linea(escapar(texto))}</li>`)
      }
      const t = ordenada ? 'ol' : 'ul'
      salida.push(`<${t}>${items.join('')}</${t}>`)
      continue
    }

    // ── Línea en blanco ─────────────────────────────────────────────────────
    if (l.trim() === '') {
      i++
      continue
    }

    // ── Párrafo ─────────────────────────────────────────────────────────────
    const parrafo: string[] = []
    while (
      i < lineas.length &&
      lineas[i].trim() !== '' &&
      !/^\s*(#{1,6}\s|>|```)/.test(lineas[i]) &&
      !vinieta.test(lineas[i]) &&
      !/^\s*([-*_])\1{2,}\s*$/.test(lineas[i])
    ) {
      parrafo.push(lineas[i])
      i++
    }
    salida.push(`<p>${linea(escapar(parrafo.join(' ')))}</p>`)
  }

  return { html: salida.join('\n'), secciones }
}
