// Módulo de práctica de Compras e inventario. Datos inventados, todo en el navegador (localStorage).
// No hace ninguna petición de red: nada de lo que se haga aquí llega a Supabase ni a la intranet.
const D = window.DATOS
const LS = 'practica-inventario-v1'
const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmt = (n) => new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(n)
const pesos = (n) => '$ ' + new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(n)
const uid = () => Math.random().toString(36).slice(2, 10)
const hoy = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
const sumarDias = (f, n) => { const d = new Date(f + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10) }
const num = (v) => parseFloat(String(v).replace(',', '.'))
const norm = (s) => String(s).trim().toLowerCase()

// ───────── Reglas de la propuesta ─────────
const CLASES = { consumible: 'Consumible', herramienta: 'Herramienta', epp: 'EPP', equipo: 'Equipo' }
const DURABLES = new Set(['herramienta', 'epp', 'equipo'])
const TIPOS = { central: 'Central', proyecto: 'Proyecto', vivero: 'Vivero', campo: 'Salida de campo', sede: 'Sede' }
const PROYECTOS = { general: 'General (toda la organización)', conexion_biodiversa: 'Conexión Biodiversa', ley_arbol: 'Ley del Árbol', vivero: 'Vivero' }
const UNIDADES = ['Unidad', 'Par', 'Juego', 'Caja', 'Rollo', 'Bolsa', 'Bulto', 'Bidón', 'Envase', 'Kg', 'Litro']
const CATEGORIAS = ['combustible', 'cerramiento', 'hormiguicida', 'herbicida', 'fertilizante', 'enmienda', 'insumo de campo', 'por definir']
const MAPA_UNI = { und: 'Unidad', unidad: 'Unidad', rollo: 'Rollo', caja: 'Caja', par: 'Par', juego: 'Juego', kg: 'Kg', litros: 'Litro', envase: 'Envase', bolsa: 'Bolsa', bulto: 'Bulto', 'bidón': 'Bidón', 'presentación': 'Litro' }
const SE_GASTAN = new Set(['Pintura en aerosol', 'Puntillas (caja 400 g)'])
const REPOSICION_EPP_DIAS = 90

function claseDe(i) {
  const c = (i.categoria || '').toLowerCase()
  if (SE_GASTAN.has(i.nombre)) return 'consumible'
  return DURABLES.has(c) ? c : 'consumible'
}
function categoriaDe(i, clase) {
  if (clase !== 'consumible') return ''
  const c = (i.categoria || '').toLowerCase()
  return c && !DURABLES.has(c) ? c : SE_GASTAN.has(i.nombre) ? 'insumo de campo' : 'por definir'
}

// ───────── Datos de partida (inventados) ─────────
function semilla() {
  const bodegas = [
    { id: 'b-rec', nombre: 'Recepción', tipo: 'central', responsable: 'Katys', activa: true },
    { id: 'b-cb', nombre: 'Conexión Biodiversa', tipo: 'proyecto', responsable: 'Jarlison', activa: true },
    { id: 'b-la', nombre: 'Ley del Árbol', tipo: 'proyecto', responsable: 'Jarlison', activa: true },
    { id: 'b-viv', nombre: 'Vivero', tipo: 'vivero', responsable: 'Deivy Ortiz', activa: true },
    { id: 'b-esc', nombre: 'Escuela Bosque', tipo: 'sede', responsable: 'Jeffer', activa: true },
    { id: 'b-sal', nombre: 'Salida piloto · Guajira', tipo: 'campo', responsable: 'Por asignar', activa: true },
  ]
  const insumos = D.insumos.map((i) => {
    const clase = claseDe(i)
    return { id: 'i-' + i.id.slice(0, 8), nombre: i.nombre, clase, unidad: MAPA_UNI[(i.unidad || '').toLowerCase().trim()] || i.unidad, categoria: categoriaDe(i, clase), presentacion: i.presentacion || '', activo: true }
  })
  const S = { perfil: 'fin', bodegas, insumos, mov: [], facturas: [], entregas: [], hechos: {}, version: 1 }
  const ins = (n) => insumos.find((i) => i.nombre === n || i.nombre.startsWith(n))
  const mv = (tipo, nom, cant, o, d, extra = {}) => { const i = ins(nom); if (i) S.mov.push({ id: uid(), tipo, ins: i.id, cant, o, d, estado: 'confirmado', fecha: '2026-10-23', doc: 'Carga de ejemplo', nota: '', por: 'ejemplo', ...extra }) }
  ;[['Cal Dolomita', 40], ['Fertiorgánico', 60], ['Fertilizante 10-30-10', 20], ['Panzer (Glifosato Solución)', 6], ['Combustible', 80], ['Hormitek', 12],
    ['Pala ancha', 10], ['Azadón', 8], ['Peinilla', 12], ['Guantes de nitrilo', 40], ['Gafa de seguridad', 25], ['Botiquín', 4], ['Máquina ahoyadora', 2],
    ['Alambre de púas', 10], ['Poste plástico', 120], ['Cinta de peligro', 6]].forEach(([n, c]) => mv('entrada', n, c, null, 'b-rec', { doc: 'Factura de ejemplo' }))
  mv('traslado', 'Fertiorgánico', 20, 'b-rec', 'b-viv'); mv('traslado', 'Pala ancha', 3, 'b-rec', 'b-viv')
  mv('traslado', 'Cal Dolomita', 10, 'b-rec', 'b-la'); mv('traslado', 'Poste plástico', 40, 'b-rec', 'b-la'); mv('traslado', 'Alambre de púas', 4, 'b-rec', 'b-la')
  mv('traslado', 'Cal Dolomita', 8, 'b-rec', 'b-cb')
  mv('traslado', 'Fertiorgánico', 10, 'b-rec', 'b-la', { estado: 'en_transito', fecha: hoy(), doc: 'Remisión 001 (ejemplo)' })
  mv('traslado', 'Botiquín', 1, 'b-rec', 'b-esc')
  // La salida piloto gastó material que nunca se registró cómo llegó: saldos negativos para practicar la conciliación.
  mv('consumo', 'Fertiorgánico', 6, 'b-sal', null, { nota: 'Siembra piloto (ejemplo)' }); mv('consumo', 'Cinta de peligro', 1, 'b-sal', null, { nota: 'Cercado (ejemplo)' })
  mv('entrega', 'Pala ancha', 2, 'b-sal', null, { doc: 'Entrega a Operario 1 (ejemplo)' }); mv('entrega', 'Azadón', 1, 'b-sal', null, { doc: 'Entrega a Operario 2 (ejemplo)' })
  S.entregas.push({ id: uid(), ins: ins('Pala ancha').id, bodega: 'b-sal', persona: 'Operario 1', cant: 2, fecha: '2026-10-24', dev: false })
  S.entregas.push({ id: uid(), ins: ins('Azadón').id, bodega: 'b-sal', persona: 'Operario 2', cant: 1, fecha: '2026-10-24', dev: false })
  mv('entrega', 'Gafa de seguridad', 2, 'b-rec', null, { doc: 'Entrega a Operario 3 (ejemplo)', fecha: '2026-07-20' })
  S.entregas.push({ id: uid(), ins: ins('Gafa de seguridad').id, bodega: 'b-rec', persona: 'Operario 3', cant: 2, fecha: '2026-07-20', dev: false })
  return S
}

let S = cargar()
function cargar() { try { const t = localStorage.getItem(LS); if (t) { const s = JSON.parse(t); if (s.version === 1) return s } } catch {} return semilla() }
function guardar() { try { localStorage.setItem(LS, JSON.stringify(S)) } catch {} }
const ui = { tab: 'guia', bodega: 'todas', clase: 'todas', q: '', kTipo: 'todos', borrador: null, soloUso: false }
const insumo = (id) => S.insumos.find((i) => i.id === id)
const bodega = (id) => S.bodegas.find((b) => b.id === id)
const hecho = (k) => { S.hechos[k] = true }

// ───────── Saldos (se calculan del kardex, nunca se guardan) ─────────
function saldos() {
  const m = {}
  const g = (b, i) => (m[b + '|' + i] ??= { b, i, saldo: 0, porRecibir: 0, entradas: 0, salidas: 0 })
  for (const x of S.mov) {
    if (x.estado === 'anulado' || x.estado === 'rechazado') continue
    if (x.d) { const r = g(x.d, x.ins); if (x.estado === 'en_transito') r.porRecibir += x.cant; else { r.saldo += x.cant; r.entradas += x.cant } }
    if (x.o) { const r = g(x.o, x.ins); r.saldo -= x.cant; r.salidas += x.cant }
  }
  return Object.values(m)
}
const saldoDe = (b, i) => saldos().find((r) => r.b === b && r.i === i)?.saldo ?? 0
const tieneMov = (id) => S.mov.some((x) => x.ins === id)

// ───────── Perfiles y permisos ─────────
const encargados = () => [...new Set(S.bodegas.filter((b) => b.activa && b.responsable && b.responsable !== 'Por asignar').map((b) => b.responsable))]
const esFin = () => S.perfil === 'fin'
const misBodegas = () => (esFin() ? S.bodegas.filter((b) => b.activa) : S.bodegas.filter((b) => b.activa && b.responsable === S.perfil))
const PESTANAS = [['guia', 'Guía', 1], ['inventario', 'Inventario', 1], ['kardex', 'Kardex', 1], ['compras', 'Compras', 0], ['catalogo', 'Catálogo', 0], ['bodegas', 'Bodegas', 0], ['entregas', 'Entregas', 1], ['conciliacion', 'Conciliación', 0]]
const permitida = (id) => esFin() || PESTANAS.find((p) => p[0] === id)?.[2] === 1

// ───────── Diálogos y avisos ─────────
let tAviso
function aviso(t) { const a = $('#aviso'); a.textContent = t; a.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(() => { a.hidden = true }, 3500) }
function campoHTML(c) {
  const id = 'f-' + c.id, v = c.value ?? ''
  let inp
  if (c.type === 'select') inp = `<select id="${id}" name="${c.id}">${c.options.map(([val, lab]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`
  else if (c.type === 'textarea') inp = `<textarea id="${id}" name="${c.id}" rows="2" placeholder="${esc(c.ph || '')}">${esc(v)}</textarea>`
  else inp = `<input id="${id}" name="${c.id}" type="${c.type || 'text'}" value="${esc(v)}" ${c.type === 'number' ? 'step="any" min="0"' : ''} placeholder="${esc(c.ph || '')}">`
  return `<label class="campo" for="${id}"><span>${esc(c.label)}</span>${inp}${c.ayuda ? `<small>${c.ayuda}</small>` : ''}</label>`
}
function formulario(titulo, campos, enviar, boton = 'Guardar', intro = '') {
  const dlg = $('#dlg')
  dlg.innerHTML = `<form id="f" method="dialog"><h3>${esc(titulo)}</h3>${intro ? `<p class="tenue chico">${intro}</p>` : ''}${campos.map(campoHTML).join('')}<p class="err" id="err" hidden></p><div class="acc"><button type="button" class="btn sec" id="cancelar">Cancelar</button><button class="btn" type="submit">${esc(boton)}</button></div></form>`
  const f = $('#f')
  $('#cancelar').onclick = () => dlg.close()
  f.onsubmit = (e) => {
    e.preventDefault()
    const v = {}; campos.forEach((c) => { v[c.id] = f.elements[c.id].value })
    try { const r = enviar(v); if (r === false) return } catch (err) { const e2 = $('#err'); e2.textContent = err.message; e2.hidden = false; return }
    dlg.close(); guardar(); render()
  }
  dlg.showModal()
  f.querySelector('input,select,textarea')?.focus()
}
const opts = (arr) => arr.map((x) => (Array.isArray(x) ? x : [x, x]))
const optsIns = (filtro = () => true) => S.insumos.filter((i) => i.activo && filtro(i)).map((i) => [i.id, `${i.nombre} (${i.unidad})`])
const optsBod = (lista = S.bodegas.filter((b) => b.activa)) => lista.map((b) => [b.id, b.nombre])
const cantidadValida = (v, max, etiqueta = 'La cantidad') => {
  const c = num(v)
  if (!(c > 0)) throw new Error(`${etiqueta} debe ser mayor que cero.`)
  if (max !== undefined && c > max + 1e-9) throw new Error(`${etiqueta} (${fmt(c)}) es mayor que lo que hay en la bodega (${fmt(max)}).`)
  return c
}

// ───────── Acciones del inventario ─────────
function nuevoTraslado(ob, ii) {
  const origenes = misBodegas()
  formulario('Nuevo traslado', [
    { id: 'ins', label: 'Elemento', type: 'select', options: optsIns(), value: ii },
    { id: 'o', label: 'Sale de', type: 'select', options: optsBod(origenes), value: ob },
    { id: 'd', label: 'Va a', type: 'select', options: optsBod() },
    { id: 'cant', label: 'Cantidad', type: 'number' },
    { id: 'doc', label: 'Documento o remisión', ph: 'Ej: Remisión 002' },
  ], (v) => {
    if (v.o === v.d) throw new Error('La bodega de origen y la de destino no pueden ser la misma.')
    const c = cantidadValida(v.cant, saldoDe(v.o, v.ins))
    S.mov.push({ id: uid(), tipo: 'traslado', ins: v.ins, cant: c, o: v.o, d: v.d, estado: 'en_transito', fecha: hoy(), doc: v.doc, nota: '', por: etiquetaPerfil() })
    hecho('traslado'); aviso('Traslado enviado. Queda «por recibir» hasta que la bodega de destino lo acepte.')
  }, 'Enviar', 'El material sale de la bodega de origen ya, pero no cuenta en la de destino hasta que alguien lo reciba.')
}
function recibir(id, aceptar) {
  const m = S.mov.find((x) => x.id === id)
  m.estado = aceptar ? 'confirmado' : 'rechazado'; m.recibido = etiquetaPerfil()
  if (aceptar) hecho('recibido')
  guardar(); render(); aviso(aceptar ? 'Traslado recibido: ya cuenta en el saldo.' : 'Traslado rechazado: el material vuelve a la bodega de origen.')
}
function nuevoConsumo(b, i) {
  const ins = insumo(i)
  formulario('Registrar consumo', [
    { id: 'cant', label: `Cantidad gastada (${ins.unidad})`, type: 'number' },
    { id: 'nota', label: 'En qué se usó', type: 'textarea', ph: 'Ej: Plateo y abonado, lote 3' },
  ], (v) => {
    const c = cantidadValida(v.cant, saldoDe(b, i))
    if (!v.nota.trim()) throw new Error('Escribe en qué se usó el material.')
    S.mov.push({ id: uid(), tipo: 'consumo', ins: i, cant: c, o: b, d: null, estado: 'confirmado', fecha: hoy(), doc: '', nota: v.nota.trim(), por: etiquetaPerfil() })
    hecho('consumo'); aviso('Consumo registrado.')
  }, 'Registrar', `${esc(ins.nombre)} en ${esc(bodega(b).nombre)}. En producción esto llega solo desde la app de campo.`)
}
function ajustar(b, i) {
  const ins = insumo(i), actual = saldoDe(b, i)
  formulario('Ajuste por conteo', [
    { id: 'conteo', label: `Conteo físico (${ins.unidad})`, type: 'number', ayuda: `El sistema dice ${fmt(actual)}.` },
    { id: 'motivo', label: 'Motivo del ajuste', type: 'textarea', ph: 'Ej: Conteo de fin de mes' },
  ], (v) => {
    const c = num(v.conteo); if (!(c >= 0)) throw new Error('Escribe el conteo físico (puede ser cero).')
    if (!v.motivo.trim()) throw new Error('El ajuste necesita un motivo.')
    const delta = c - actual; if (Math.abs(delta) < 1e-9) throw new Error('El conteo coincide con el sistema: no hay nada que ajustar.')
    S.mov.push({ id: uid(), tipo: 'ajuste', ins: i, cant: Math.abs(delta), o: delta < 0 ? b : null, d: delta > 0 ? b : null, estado: 'confirmado', fecha: hoy(), doc: '', nota: v.motivo.trim(), por: etiquetaPerfil() })
    hecho('ajuste'); aviso(`Ajuste de ${delta > 0 ? '+' : ''}${fmt(delta)} registrado. El saldo queda en ${fmt(c)}.`)
  }, 'Aplicar ajuste', 'Un ajuste no borra nada: queda en el kardex con su motivo.')
}
const etiquetaPerfil = () => (esc ? (esFin() ? 'Financiera' : S.perfil) : '')

// ───────── Vistas ─────────
function pillClase(c) { return `<span class="pill ${c}">${CLASES[c]}</span>` }

function vGuia() {
  const T = [
    ['perfil', 'Probar como encargado de bodega', 'Cambia «Practicas como» arriba a un encargado y mira qué pestañas ve.', 'inventario', 0],
    ['insumo', 'Crear un insumo en el catálogo', 'Nombre, clase, unidad y categoría de la lista cerrada.', 'catalogo', 1],
    ['factura', 'Registrar una factura de compra', 'Usa «Cargar factura de ejemplo» para ver cómo se convierte kg en bultos.', 'compras', 1],
    ['traslado', 'Enviar un traslado de Recepción a un proyecto', 'El material sale ya, pero no cuenta en el destino todavía.', 'inventario', 0],
    ['recibido', 'Recibir un traslado', 'Hay uno de ejemplo en «Por recibir». Acéptalo como encargado de Ley del Árbol.', 'inventario', 0],
    ['consumo', 'Registrar un consumo', 'Solo los consumibles se gastan.', 'inventario', 0],
    ['entrega', 'Entregar una herramienta o un EPP a una persona', 'Queda a su nombre hasta que lo devuelva.', 'entregas', 0],
    ['devolucion', 'Registrar la devolución', 'El elemento vuelve al saldo de la bodega.', 'entregas', 0],
    ['ajuste', 'Hacer un ajuste por conteo', 'Cuando lo contado no coincide con el sistema.', 'inventario', 1],
    ['conciliar', 'Conciliar un saldo negativo', 'La salida piloto tiene materiales con saldo negativo.', 'conciliacion', 1],
    ['anular', 'Anular una factura o un traslado', 'Anular no borra: deja rastro y motivo.', 'compras', 1],
  ]
  const listos = T.filter((t) => S.hechos[t[0]]).length
  return `
  <section class="vidrio panel">
    <div class="cab-sec"><h2>Tu práctica</h2><span class="tenue">${listos} de ${T.length} tareas</span></div>
    <div class="barra" role="progressbar" aria-valuenow="${listos}" aria-valuemax="${T.length}"><i style="width:${(listos / T.length) * 100}%"></i></div>
    <p class="tenue">Hazlas en cualquier orden. Los datos son inventados: si algo sale mal, «Empezar de nuevo» (arriba) devuelve todo al inicio.</p>
    <ul class="tareas">${T.map(([k, t, d, tab, fin]) => `<li class="tarea ${S.hechos[k] ? 'hecha' : ''}"><span class="marca">✓</span><div><b>${t}</b><small>${d}${fin ? ' · como Financiera' : ''}</small></div><button class="btn sec mini" data-ir="${tab}" data-fin="${fin}">Ir</button></li>`).join('')}</ul>
  </section>
  <section class="vidrio panel">
    <h2>Cómo leer el módulo</h2>
    <div class="glos">
      <div><b>Saldo</b>Entradas menos salidas del kardex. Nadie lo escribe a mano: se corrige con un ajuste por conteo.</div>
      <div><b>Consumible</b>Se gasta: abono, cal, combustible, alambre. Sale por consumo.</div>
      <div><b>Herramienta, EPP, equipo</b>Se prestan: salen por entrega a una persona y vuelven por devolución.</div>
      <div><b>Por recibir</b>Un traslado enviado que la bodega de destino aún no acepta. Ya salió del origen.</div>
      <div><b>Factor</b>Cuánto inventario entra por cada unidad facturada. 1000 kg de cal en bultos de 50 kg: factor 0,02.</div>
      <div><b>Anular</b>Nada se borra. Lo anulado no cuenta, pero queda en el kardex con su motivo.</div>
    </div>
  </section>
  <section class="vidrio panel">
    <h2>Quién ve qué</h2>
    <table><thead><tr><th>Perfil</th><th>Puede</th></tr></thead><tbody>
      <tr><td>Financiera</td><td>Todo: compras, catálogo, bodegas, ajustes, conciliación, anulaciones y kardex.</td></tr>
      <tr><td>Encargado de bodega</td><td>Ver el inventario de su bodega, enviar y recibir traslados, registrar consumos y entregas. No ajusta ni anula.</td></tr>
    </tbody></table>
    <p class="chico tenue">Responsables de práctica: ${S.bodegas.filter((b) => b.activa).map((b) => `${esc(b.nombre)}: ${esc(b.responsable)}`).join(' · ')}.</p>
  </section>`
}

function vInventario() {
  const bs = misBodegas()
  const chips = [['todas', 'Todas']].concat(bs.map((b) => [b.id, b.nombre])).map(([id, t]) => `<button class="chip" aria-pressed="${ui.bodega === id}" data-bod="${id}">${esc(t)}</button>`).join('')
  const chipsC = [['todas', 'Todas las clases'], ...Object.entries(CLASES)].map(([id, t]) => `<button class="chip" aria-pressed="${ui.clase === id}" data-cl="${id}">${t}</button>`).join('')
  const ids = new Set(bs.map((b) => b.id)), q = norm(ui.q)
  const todas = saldos().filter((r) => ids.has(r.b) && (ui.bodega === 'todas' || r.b === ui.bodega) && (r.saldo !== 0 || r.porRecibir > 0))
  const filas = todas.filter((r) => { const i = insumo(r.i); return i && (ui.clase === 'todas' || i.clase === ui.clase) && (!q || norm(i.nombre).includes(q)) })
    .sort((a, b) => insumo(a.i).nombre.localeCompare(insumo(b.i).nombre) || bodega(a.b).nombre.localeCompare(bodega(b.b).nombre))
  const porRecibir = S.mov.filter((m) => m.estado === 'en_transito' && ids.has(m.d))
  return `
  ${porRecibir.length ? `<section class="vidrio panel"><h2>Por recibir <span class="pill transito">${porRecibir.length}</span></h2>
    <div class="tabla-w"><table><thead><tr><th>Elemento</th><th class="num">Cantidad</th><th>De</th><th>A</th><th>Documento</th><th></th></tr></thead><tbody>
    ${porRecibir.map((m) => `<tr><td>${esc(insumo(m.ins).nombre)}</td><td class="num">${fmt(m.cant)} ${esc(insumo(m.ins).unidad)}</td><td>${esc(bodega(m.o).nombre)}</td><td>${esc(bodega(m.d).nombre)}</td><td>${esc(m.doc)}</td>
    <td><div class="fila-acc"><button class="btn mini" data-rec="${m.id}" data-ok="1">Aceptar</button><button class="btn sec mini" data-rec="${m.id}" data-ok="0">Rechazar</button></div></td></tr>`).join('')}</tbody></table></div></section>` : ''}
  <section class="vidrio panel">
    <div class="cab-sec"><h2>Inventario por bodega</h2><div class="fila-acc"><input type="search" id="q" placeholder="Buscar elemento" value="${esc(ui.q)}" aria-label="Buscar elemento"><button class="btn" data-act="traslado-nuevo">Nuevo traslado</button></div></div>
    <div class="filtros">${chips}</div><div class="filtros">${chipsC}</div>
    <div class="tabla-w"><table><thead><tr><th>Elemento</th><th>Clase</th><th>Bodega</th><th class="num">Saldo</th><th class="num">Por recibir</th><th></th></tr></thead><tbody>
    ${filas.map((r) => { const i = insumo(r.i), b = bodega(r.b)
      return `<tr class="${r.saldo < 0 ? 'neg-fila' : ''}"><td>${esc(i.nombre)}</td><td>${pillClase(i.clase)}</td><td>${esc(b.nombre)}</td><td class="num ${r.saldo < 0 ? 'neg' : ''}">${fmt(r.saldo)} ${esc(i.unidad)}</td><td class="num">${r.porRecibir ? fmt(r.porRecibir) : ''}</td>
      <td><div class="fila-acc">${r.saldo > 0 ? `<button class="btn sec mini" data-act="traslado" data-b="${r.b}" data-i="${r.i}">Trasladar</button>` : ''}${r.saldo > 0 && i.clase === 'consumible' ? `<button class="btn sec mini" data-act="consumo" data-b="${r.b}" data-i="${r.i}">Consumo</button>` : ''}${esFin() ? `<button class="btn sec mini" data-act="ajuste" data-b="${r.b}" data-i="${r.i}">Ajustar</button>` : ''}</div></td></tr>` }).join('') || '<tr><td colspan="6" class="vacio">Nada con ese filtro.</td></tr>'}
    </tbody></table></div>
    <p class="chico tenue">Las filas en rojo tienen saldo negativo: se concilian en la pestaña Conciliación.</p>
  </section>`
}

function vKardex() {
  const ids = new Set(misBodegas().map((b) => b.id))
  const tipos = [['todos', 'Todos'], ['entrada', 'Entradas'], ['traslado', 'Traslados'], ['consumo', 'Consumos'], ['ajuste', 'Ajustes'], ['entrega', 'Entregas'], ['devolucion', 'Devoluciones']]
  const lista = S.mov.filter((m) => (esFin() || ids.has(m.o) || ids.has(m.d)) && (ui.kTipo === 'todos' || m.tipo === ui.kTipo)).slice().reverse()
  return `<section class="vidrio panel"><h2>Kardex</h2>
    <p class="tenue">Cada movimiento de inventario, del más reciente al más antiguo. Nada se borra.</p>
    <div class="filtros">${tipos.map(([id, t]) => `<button class="chip" aria-pressed="${ui.kTipo === id}" data-kt="${id}">${t}</button>`).join('')}</div>
    <div class="tabla-w"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Elemento</th><th class="num">Cant.</th><th>Origen → Destino</th><th>Estado</th><th>Detalle</th><th></th></tr></thead><tbody>
    ${lista.map((m) => { const i = insumo(m.ins)
      const pu = m.estado === 'en_transito' ? 'transito' : m.estado === 'anulado' ? 'anulado' : m.estado === 'rechazado' ? 'mal' : 'ok'
      const puedeAnular = esFin() && (m.estado === 'confirmado' || m.estado === 'en_transito') && !m.fact && !['entrega', 'devolucion'].includes(m.tipo) && m.por !== 'ejemplo'
      return `<tr><td>${m.fecha}</td><td>${m.tipo}</td><td>${esc(i?.nombre)}</td><td class="num">${fmt(m.cant)}</td><td>${esc(m.o ? bodega(m.o)?.nombre : '—')} → ${esc(m.d ? bodega(m.d)?.nombre : '—')}</td><td><span class="pill ${pu}">${m.estado.replace('_', ' ')}</span></td><td class="chico">${esc([m.doc, m.nota, m.motivoAnul ? 'Anulado: ' + m.motivoAnul : ''].filter(Boolean).join(' · '))}</td>
      <td>${puedeAnular ? `<button class="btn sec mini" data-act="anular-mov" data-id="${m.id}">Anular</button>` : ''}</td></tr>` }).join('') || '<tr><td colspan="8" class="vacio">Sin movimientos.</td></tr>'}
    </tbody></table></div></section>`
}

function vCompras() {
  const b = ui.borrador
  const total = (l) => l.reduce((s, x) => s + x.cant * x.precio, 0)
  const borrador = b ? `
  <section class="vidrio panel"><h2>Nueva factura de compra</h2>
    <p class="tenue">En producción aquí se sube el .zip o el XML de la DIAN y los datos se leen solos. En la práctica se teclean o se carga una factura de ejemplo.</p>
    <div class="grid2">
      <label class="campo-inline">Proveedor<input type="text" data-d="prov" value="${esc(b.prov)}"></label>
      <label class="campo-inline">NIT<input type="text" data-d="nit" value="${esc(b.nit)}"></label>
      <label class="campo-inline">Número de factura<input type="text" data-d="num" value="${esc(b.num)}" placeholder="Ej: FE-1024"></label>
      <label class="campo-inline">Fecha<input type="date" data-d="fecha" value="${esc(b.fecha)}"></label>
      <label class="campo-inline">Proyecto al que se carga<select data-d="proy"><option value="">— elige —</option>${Object.entries(PROYECTOS).map(([k, t]) => `<option value="${k}"${b.proy === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
    </div>
    <div class="cab-sec"><h3>Líneas</h3><div class="fila-acc"><button class="btn sec mini" data-act="linea">Agregar línea</button><button class="btn sec mini" data-act="ejemplo">Cargar factura de ejemplo</button></div></div>
    <div class="tabla-w"><table><thead><tr><th>Descripción</th><th class="num">Cant. facturada</th><th class="num">Precio</th><th>Qué es</th><th>Entra a</th><th></th></tr></thead><tbody>
    ${b.lineas.map((l, k) => { const i = insumo(l.ins)
      return `<tr><td>${esc(l.desc)}</td><td class="num">${fmt(l.cant)} ${esc(l.uf)}</td><td class="num">${pesos(l.precio)}</td><td>${l.clase === 'inventario' ? `Inventario: ${esc(i?.nombre)}<br><span class="chico tenue">× ${l.factor} = ${fmt(l.cant * l.factor)} ${esc(i?.unidad)}</span>` : 'Gasto (no se almacena)'}</td><td>${l.clase === 'inventario' ? esc(bodega(l.bod)?.nombre) : '—'}</td><td><button class="btn sec mini" data-quitar="${k}">Quitar</button></td></tr>` }).join('') || '<tr><td colspan="6" class="vacio">Agrega al menos una línea.</td></tr>'}
    </tbody></table></div>
    <div class="cab-sec"><b>Total: ${pesos(total(b.lineas))}</b><div class="fila-acc"><button class="btn sec" data-act="cancelar-factura">Cancelar</button><button class="btn" data-act="guardar-factura">Registrar factura</button></div></div>
    <p class="err" id="err-f" hidden></p>
  </section>` : ''
  return `${borrador}
  <section class="vidrio panel"><div class="cab-sec"><h2>Facturas registradas</h2>${b ? '' : '<button class="btn" data-act="nueva-factura">Registrar factura</button>'}</div>
    <div class="tabla-w"><table><thead><tr><th>Número</th><th>Proveedor</th><th>Fecha</th><th>Proyecto</th><th class="num">Total</th><th>Estado</th><th></th></tr></thead><tbody>
    ${S.facturas.slice().reverse().map((f) => `<tr><td>${esc(f.num)}</td><td>${esc(f.prov)}</td><td>${f.fecha}</td><td>${esc(PROYECTOS[f.proy])}</td><td class="num">${pesos(f.total)}</td><td><span class="pill ${f.estado === 'anulada' ? 'anulado' : 'ok'}">${f.estado}</span></td>
    <td>${f.estado === 'registrada' ? `<button class="btn sec mini" data-act="anular-factura" data-id="${f.id}">Anular</button>` : esc(f.motivo || '')}</td></tr>`).join('') || '<tr><td colspan="7" class="vacio">Todavía no hay facturas en la práctica. Registra la primera.</td></tr>'}
    </tbody></table></div></section>`
}

function vCatalogo() {
  const q = norm(ui.q)
  const chipsC = [['todas', 'Todas'], ...Object.entries(CLASES)].map(([id, t]) => `<button class="chip" aria-pressed="${ui.clase === id}" data-cl="${id}">${t}</button>`).join('')
  const lista = S.insumos.filter((i) => (ui.clase === 'todas' || i.clase === ui.clase) && (!q || norm(i.nombre).includes(q)))
  return `<section class="vidrio panel"><div class="cab-sec"><h2>Catálogo de insumos</h2><div class="fila-acc"><input type="search" id="q" placeholder="Buscar insumo" value="${esc(ui.q)}" aria-label="Buscar insumo"><button class="btn" data-act="insumo-nuevo">Nuevo insumo</button></div></div>
    <p class="tenue">Es la lista cerrada: en campo no se escriben insumos a mano. Clase, unidad y categoría salen de listas fijas.</p>
    <div class="filtros">${chipsC}</div>
    <div class="tabla-w"><table><thead><tr><th>Insumo</th><th>Clase</th><th>Unidad</th><th>Categoría</th><th>Estado</th><th></th></tr></thead><tbody>
    ${lista.map((i) => `<tr><td>${esc(i.nombre)}${i.presentacion ? `<div class="chico tenue">${esc(i.presentacion)}</div>` : ''}</td><td>${pillClase(i.clase)}</td><td>${esc(i.unidad)}</td><td>${esc(i.categoria || '—')}${i.categoria === 'por definir' ? ' <span class="pill mal">definir</span>' : ''}</td><td><span class="pill ${i.activo ? 'ok' : 'anulado'}">${i.activo ? 'activo' : 'inactivo'}</span></td>
    <td><div class="fila-acc"><button class="btn sec mini" data-act="insumo-editar" data-id="${i.id}">Editar</button><button class="btn sec mini" data-act="insumo-estado" data-id="${i.id}">${i.activo ? 'Desactivar' : 'Activar'}</button></div></td></tr>`).join('')}
    </tbody></table></div></section>`
}

function vBodegas() {
  const sal = saldos()
  const grupos = Object.entries(TIPOS).map(([t, tt]) => ({ t, tt, bs: S.bodegas.filter((b) => b.tipo === t) })).filter((g) => g.bs.length)
  return `<section class="vidrio panel"><div class="cab-sec"><h2>Bodegas</h2><button class="btn" data-act="bodega-nueva">Nueva bodega</button></div>
    <p class="tenue">Agrupadas por tipo. Cada una tiene una persona responsable.</p>
    ${grupos.map((g) => `<div class="grupo-b"><div class="rot2">${g.tt}</div>
      ${g.bs.map((b) => { const s = sal.filter((r) => r.b === b.id), n = s.filter((r) => r.saldo > 0).length
        return `<div class="b-card"><div><b>${esc(b.nombre)}</b><div class="chico tenue">Responsable: ${esc(b.responsable || 'Por asignar')}${b.proyecto ? ' · ' + esc(PROYECTOS[b.proyecto]) : ''}</div></div>
        <div class="fila-acc"><span class="pill ${b.activa ? 'ok' : 'anulado'}">${b.activa ? n + ' con saldo' : 'inactiva'}</span><button class="btn sec mini" data-act="bodega-editar" data-id="${b.id}">Editar</button><button class="btn sec mini" data-act="bodega-estado" data-id="${b.id}">${b.activa ? 'Desactivar' : 'Activar'}</button></div></div>` }).join('')}</div>`).join('')}
  </section>`
}

function vEntregas() {
  const ids = new Set(misBodegas().map((b) => b.id))
  const lista = S.entregas.filter((e) => ids.has(e.bodega) && (!ui.soloUso || !e.dev))
  return `<section class="vidrio panel"><div class="cab-sec"><h2>Entregas: quién tiene qué <span class="nuevo-tag">nuevo</span></h2><div class="fila-acc"><button class="chip" aria-pressed="${ui.soloUso}" data-uso="1">Solo en uso</button><button class="btn" data-act="entrega-nueva">Entregar</button></div></div>
    <p class="tenue">Herramientas, EPP y equipos se entregan a una persona y vuelven a bodega. Los EPP llevan fecha de reposición (${REPOSICION_EPP_DAS_TEXTO()}).</p>
    <div class="tabla-w"><table><thead><tr><th>Elemento</th><th>Clase</th><th>Responsable</th><th>Bodega</th><th class="num">Cant.</th><th>Entregado</th><th>Reposición</th><th></th></tr></thead><tbody>
    ${lista.slice().reverse().map((e) => { const i = insumo(e.ins), rep = i.clase === 'epp' ? sumarDias(e.fecha, REPOSICION_EPP_DIAS) : null, vencida = rep && !e.dev && rep < hoy()
      return `<tr><td>${esc(i.nombre)}</td><td>${pillClase(i.clase)}</td><td>${esc(e.persona)}</td><td>${esc(bodega(e.bodega).nombre)}</td><td class="num">${fmt(e.cant)}</td><td>${e.fecha}</td><td>${rep ? (e.dev ? '—' : `${rep} ${vencida ? '<span class="pill mal">por reponer</span>' : ''}`) : '—'}</td>
      <td>${e.dev ? '<span class="pill ok">devuelto</span>' : `<button class="btn sec mini" data-act="devolver" data-id="${e.id}">Registrar devolución</button>`}</td></tr>` }).join('') || '<tr><td colspan="8" class="vacio">Sin entregas.</td></tr>'}
    </tbody></table></div></section>`
}
const REPOSICION_EPP_DAS_TEXTO = () => `cada ${REPOSICION_EPP_DIAS} días`

function vConciliacion() {
  const neg = saldos().filter((r) => r.saldo < -1e-9)
  return `<section class="vidrio panel"><h2>Conciliar saldos negativos</h2>
    <p class="tenue">Un saldo negativo significa que salió más de lo que se registró como entrada: el material llegó sin que nadie lo anotara. Cuenta lo que hay y aplica el ajuste, o registra de dónde vino.</p>
    ${neg.length ? '' : '<div class="ejemplo">No hay saldos negativos. La conciliación está al día.</div>'}
    ${neg.length ? `<div class="tabla-w"><table><thead><tr><th>Elemento</th><th>Bodega</th><th class="num">Entradas</th><th class="num">Salidas</th><th class="num">Saldo</th><th>Conteo físico</th><th></th></tr></thead><tbody>
    ${neg.map((r) => { const i = insumo(r.i), k = r.b + '|' + r.i
      return `<tr class="neg-fila"><td>${esc(i.nombre)}</td><td>${esc(bodega(r.b).nombre)}</td><td class="num">${fmt(r.entradas)}</td><td class="num">${fmt(r.salidas)}</td><td class="num neg">${fmt(r.saldo)} ${esc(i.unidad)}</td>
      <td><input type="number" min="0" step="any" id="c-${esc(k)}" placeholder="Conteo" aria-label="Conteo de ${esc(i.nombre)}"></td>
      <td><div class="fila-acc"><button class="btn mini" data-act="conciliar" data-b="${r.b}" data-i="${r.i}">Aplicar ajuste</button><button class="btn sec mini" data-act="conciliar-origen" data-b="${r.b}" data-i="${r.i}">Vino de otra bodega</button></div></td></tr>` }).join('')}</tbody></table></div>` : ''}
  </section>`
}

// ───────── Eventos ─────────
document.addEventListener('click', (e) => {
  const t = e.target.closest('button'); if (!t) return
  const d = t.dataset
  if (d.pest) { ui.tab = d.pest; return render() }
  if (d.ir) { if (d.fin === '1' && !esFin()) { S.perfil = 'fin'; guardar() } ui.tab = d.ir; return render() }
  if (d.bod) { ui.bodega = d.bod; return render() }
  if (d.cl) { ui.clase = d.cl; return render() }
  if (d.kt) { ui.kTipo = d.kt; return render() }
  if (d.uso) { ui.soloUso = !ui.soloUso; return render() }
  if (d.rec) return recibir(d.rec, d.ok === '1')
  if (d.quitar) { ui.borrador.lineas.splice(Number(d.quitar), 1); return render() }
  if (t.id === 'reiniciar') return reiniciar(t)
  if (d.act) acciones[d.act]?.(d)
})
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { ui.q = e.target.value; const p = e.target.selectionStart; render(); const q = $('#q'); q.focus(); try { q.setSelectionRange(p, p) } catch {} }
  if (e.target.dataset?.d && ui.borrador) ui.borrador[e.target.dataset.d] = e.target.value
})
document.addEventListener('change', (e) => { if (e.target.dataset?.d && ui.borrador) ui.borrador[e.target.dataset.d] = e.target.value })
$('#perfil').addEventListener('change', (e) => { S.perfil = e.target.value; if (!esFin()) hecho('perfil'); ui.bodega = 'todas'; if (!permitida(ui.tab)) ui.tab = 'inventario'; guardar(); render() })
let tReset
function reiniciar(btn) {
  if (btn.dataset.seguro) { clearTimeout(tReset); S = semilla(); guardar(); ui.tab = 'guia'; ui.borrador = null; ui.bodega = 'todas'; ui.clase = 'todas'; ui.q = ''; render(); return aviso('Práctica reiniciada con los datos de partida.') }
  btn.dataset.seguro = '1'; btn.textContent = '¿Seguro? Pulsa otra vez'; btn.classList.add('peligro')
  tReset = setTimeout(() => { delete btn.dataset.seguro; btn.textContent = 'Empezar de nuevo'; btn.classList.remove('peligro') }, 4000)
}

const nuevoBorrador = () => ({ prov: '', nit: '', num: '', fecha: hoy(), proy: '', lineas: [] })
const acciones = {
  'traslado-nuevo': () => nuevoTraslado(misBodegas()[0]?.id, S.insumos[0]?.id),
  traslado: (d) => nuevoTraslado(d.b, d.i),
  consumo: (d) => nuevoConsumo(d.b, d.i),
  ajuste: (d) => ajustar(d.b, d.i),
  'anular-mov': (d) => formulario('Anular movimiento', [{ id: 'motivo', label: 'Motivo', type: 'textarea' }], (v) => {
    if (!v.motivo.trim()) throw new Error('Escribe el motivo de la anulación.')
    const m = S.mov.find((x) => x.id === d.id); m.estado = 'anulado'; m.motivoAnul = v.motivo.trim(); hecho('anular'); aviso('Movimiento anulado: ya no cuenta, pero queda en el kardex.')
  }, 'Anular'),
  'nueva-factura': () => { ui.borrador = nuevoBorrador(); render() },
  'cancelar-factura': () => { ui.borrador = null; render() },
  ejemplo: () => {
    const ins = (n) => S.insumos.find((i) => i.nombre.startsWith(n))
    ui.borrador = { prov: 'Agroinsumos El Surco S.A.S. (ejemplo)', nit: '900123456', num: 'FE-' + (1000 + Math.floor(Math.random() * 900)), fecha: hoy(), proy: 'ley_arbol', lineas: [
      { desc: 'Cal dolomita a granel', cant: 1000, uf: 'kg', precio: 900, clase: 'inventario', ins: ins('Cal Dolomita')?.id, factor: 0.02, bod: 'b-rec' },
      { desc: 'Flete Florencia–Morelia', cant: 1, uf: 'servicio', precio: 180000, clase: 'gasto', ins: '', factor: 1, bod: '' },
      { desc: 'Guantes de nitrilo (caja x 50)', cant: 2, uf: 'caja', precio: 85000, clase: 'inventario', ins: ins('Guantes de nitrilo')?.id, factor: 50, bod: 'b-rec' },
    ] }
    render(); aviso('Factura de ejemplo cargada. Fíjate en el factor de la cal: 1000 kg × 0,02 = 20 bultos.')
  },
  linea: () => formulario('Agregar línea', [
    { id: 'desc', label: 'Descripción (como viene en la factura)' },
    { id: 'cant', label: 'Cantidad facturada', type: 'number' },
    { id: 'uf', label: 'Unidad de la factura', ph: 'kg, caja, galón…' },
    { id: 'precio', label: 'Precio unitario (COP)', type: 'number' },
    { id: 'clase', label: 'Qué es esta línea', type: 'select', options: [['inventario', 'Inventario: entra a una bodega'], ['gasto', 'Gasto: se paga pero no se almacena']] },
    { id: 'ins', label: 'Insumo del catálogo (solo inventario)', type: 'select', options: [['', '—']].concat(optsIns()) },
    { id: 'factor', label: 'Factor (solo inventario)', type: 'number', value: 1, ayuda: 'Unidades de inventario por cada unidad facturada. Ej: 1000 kg de cal contados en bultos de 50 kg → 0,02.' },
    { id: 'bod', label: 'Entra a la bodega (solo inventario)', type: 'select', options: optsBod(), value: 'b-rec' },
  ], (v) => {
    if (!v.desc.trim()) throw new Error('Escribe la descripción.')
    const cant = num(v.cant), precio = num(v.precio); if (!(cant > 0)) throw new Error('La cantidad debe ser mayor que cero.'); if (!(precio >= 0)) throw new Error('Escribe el precio unitario.')
    const factor = num(v.factor)
    if (v.clase === 'inventario') { if (!v.ins) throw new Error('Una línea de inventario necesita el insumo del catálogo.'); if (!(factor > 0)) throw new Error('El factor debe ser mayor que cero.') }
    ui.borrador.lineas.push({ desc: v.desc.trim(), cant, uf: v.uf.trim() || 'unidad', precio, clase: v.clase, ins: v.ins, factor: v.clase === 'inventario' ? factor : 1, bod: v.bod })
  }, 'Agregar'),
  'guardar-factura': () => {
    const b = ui.borrador, err = (m) => { const p = $('#err-f'); p.textContent = m; p.hidden = false }
    if (!b.prov.trim() || !b.nit.trim() || !b.num.trim()) return err('Faltan el proveedor, el NIT o el número de factura.')
    if (!b.fecha) return err('Falta la fecha.')
    if (!b.proy) return err('Elige el proyecto al que se carga la factura (o «General»).')
    if (!b.lineas.length) return err('Agrega al menos una línea.')
    if (S.facturas.some((f) => f.estado === 'registrada' && norm(f.nit) === norm(b.nit) && norm(f.num) === norm(b.num))) return err('Esa factura ya está registrada: la misma factura no entra dos veces.')
    const f = { id: uid(), prov: b.prov.trim(), nit: b.nit.trim(), num: b.num.trim(), fecha: b.fecha, proy: b.proy, total: b.lineas.reduce((s, l) => s + l.cant * l.precio, 0), estado: 'registrada', lineas: b.lineas }
    S.facturas.push(f)
    b.lineas.filter((l) => l.clase === 'inventario').forEach((l) => S.mov.push({ id: uid(), tipo: 'entrada', ins: l.ins, cant: l.cant * l.factor, o: null, d: l.bod, estado: 'confirmado', fecha: b.fecha, doc: 'Factura ' + f.num, nota: '', por: etiquetaPerfil(), fact: f.id }))
    hecho('factura'); ui.borrador = null; guardar(); render(); aviso('Factura registrada. Las líneas de inventario ya entraron a la bodega.')
  },
  'anular-factura': (d) => formulario('Anular factura', [{ id: 'motivo', label: 'Motivo', type: 'textarea' }], (v) => {
    if (!v.motivo.trim()) throw new Error('Escribe el motivo de la anulación.')
    const f = S.facturas.find((x) => x.id === d.id); f.estado = 'anulada'; f.motivo = v.motivo.trim()
    S.mov.filter((m) => m.fact === f.id).forEach((m) => { m.estado = 'anulado'; m.motivoAnul = 'Factura anulada' })
    hecho('anular'); aviso('Factura anulada. Sus entradas ya no cuentan en el saldo.')
  }, 'Anular', 'Anular no borra: la factura y sus entradas quedan marcadas como anuladas.'),
  'insumo-nuevo': () => formInsumo(),
  'insumo-editar': (d) => formInsumo(insumo(d.id)),
  'insumo-estado': (d) => { const i = insumo(d.id); i.activo = !i.activo; guardar(); render(); aviso(i.activo ? 'Insumo activado.' : 'Insumo desactivado: ya no se ofrece al registrar.') },
  'bodega-nueva': () => formBodega(),
  'bodega-editar': (d) => formBodega(bodega(d.id)),
  'bodega-estado': (d) => {
    const b = bodega(d.id)
    if (b.activa && saldos().some((r) => r.b === b.id && (r.saldo !== 0 || r.porRecibir > 0))) return aviso('No se puede desactivar una bodega con existencias. Traslada o ajusta primero.')
    b.activa = !b.activa; guardar(); render()
  },
  'entrega-nueva': () => {
    const bs = misBodegas()
    formulario('Entregar a una persona', [
      { id: 'ins', label: 'Elemento', type: 'select', options: optsIns((i) => DURABLES.has(i.clase)) },
      { id: 'bodega', label: 'Sale de la bodega', type: 'select', options: optsBod(bs) },
      { id: 'persona', label: 'Persona que lo recibe' },
      { id: 'cant', label: 'Cantidad', type: 'number', value: 1 },
    ], (v) => {
      if (!v.persona.trim()) throw new Error('Escribe quién recibe el elemento.')
      const c = cantidadValida(v.cant, saldoDe(v.bodega, v.ins))
      S.entregas.push({ id: uid(), ins: v.ins, bodega: v.bodega, persona: v.persona.trim(), cant: c, fecha: hoy(), dev: false })
      S.mov.push({ id: uid(), tipo: 'entrega', ins: v.ins, cant: c, o: v.bodega, d: null, estado: 'confirmado', fecha: hoy(), doc: 'Entrega a ' + v.persona.trim(), nota: '', por: etiquetaPerfil() })
      hecho('entrega'); aviso('Entrega registrada a nombre de ' + v.persona.trim() + '.')
    }, 'Entregar', 'Solo herramientas, EPP y equipos. Lo que se gasta (consumibles) sale por consumo.')
  },
  devolver: (d) => {
    const e = S.entregas.find((x) => x.id === d.id); e.dev = true; e.fechaDev = hoy()
    S.mov.push({ id: uid(), tipo: 'devolucion', ins: e.ins, cant: e.cant, o: null, d: e.bodega, estado: 'confirmado', fecha: hoy(), doc: 'Devolución de ' + e.persona, nota: '', por: etiquetaPerfil() })
    hecho('devolucion'); guardar(); render(); aviso('Devolución registrada: el elemento vuelve al saldo de la bodega.')
  },
  conciliar: (d) => {
    const inp = document.getElementById('c-' + d.b + '|' + d.i), c = inp ? num(inp.value) : NaN
    if (!(c >= 0)) { aviso('Escribe primero el conteo físico (puede ser cero).'); return inp?.focus() }
    const actual = saldoDe(d.b, d.i), delta = c - actual
    S.mov.push({ id: uid(), tipo: 'ajuste', ins: d.i, cant: Math.abs(delta), o: delta < 0 ? d.b : null, d: delta > 0 ? d.b : null, estado: 'confirmado', fecha: hoy(), doc: 'Conciliación', nota: 'Conteo físico ' + fmt(c), por: etiquetaPerfil() })
    hecho('conciliar'); guardar(); render(); aviso('Saldo conciliado: queda en ' + fmt(c) + '.')
  },
  'conciliar-origen': (d) => {
    const falta = -saldoDe(d.b, d.i), ins = insumo(d.i)
    formulario('Registrar de dónde vino', [
      { id: 'o', label: 'Salió de la bodega', type: 'select', options: optsBod(S.bodegas.filter((b) => b.activa && b.id !== d.b)) },
      { id: 'cant', label: `Cantidad (${ins.unidad})`, type: 'number', value: falta },
    ], (v) => {
      const c = cantidadValida(v.cant, saldoDe(v.o, d.i))
      S.mov.push({ id: uid(), tipo: 'traslado', ins: d.i, cant: c, o: v.o, d: d.b, estado: 'confirmado', fecha: hoy(), doc: 'Conciliación', nota: 'Traslado de origen que no se había registrado', por: etiquetaPerfil() })
      hecho('conciliar'); aviso('Traslado de origen registrado.')
    }, 'Registrar', `${esc(ins.nombre)} en ${esc(bodega(d.b).nombre)} tiene ${fmt(falta)} ${esc(ins.unidad)} gastados sin entrada. Si vinieron de otra bodega, el traslado explica el saldo.`)
  },
}

function formInsumo(x) {
  formulario(x ? 'Editar insumo' : 'Nuevo insumo', [
    { id: 'nombre', label: 'Nombre', value: x?.nombre },
    { id: 'clase', label: 'Clase', type: 'select', options: Object.entries(CLASES), value: x?.clase || 'consumible', ayuda: 'Consumible se gasta; herramienta, EPP y equipo se entregan y se devuelven.' },
    { id: 'unidad', label: 'Unidad de conteo', type: 'select', options: opts(UNIDADES), value: x?.unidad || 'Unidad' },
    { id: 'categoria', label: 'Categoría (solo consumibles)', type: 'select', options: [['', '—']].concat(opts(CATEGORIAS)), value: x?.categoria || '' },
    { id: 'presentacion', label: 'Presentación (opcional)', value: x?.presentacion, ph: 'Ej: Bulto x 50 kg' },
  ], (v) => {
    const n = v.nombre.trim(); if (!n) throw new Error('Escribe el nombre.')
    if (S.insumos.some((i) => i !== x && norm(i.nombre) === norm(n))) throw new Error('Ya existe un insumo con ese nombre.')
    if (v.clase === 'consumible' && !v.categoria) throw new Error('Un consumible necesita categoría (o «por definir»).')
    if (x && x.unidad !== v.unidad && tieneMov(x.id)) throw new Error('No se puede cambiar la unidad: este insumo ya tiene movimientos y los saldos dejarían de ser correctos.')
    if (x && x.clase !== v.clase && tieneMov(x.id)) throw new Error('No se puede cambiar la clase de un insumo que ya tiene movimientos.')
    const dato = { nombre: n, clase: v.clase, unidad: v.unidad, categoria: v.clase === 'consumible' ? v.categoria : '', presentacion: v.presentacion.trim() }
    if (x) Object.assign(x, dato); else { S.insumos.push({ id: 'i-' + uid(), activo: true, ...dato }); hecho('insumo') }
    aviso(x ? 'Insumo actualizado.' : 'Insumo creado. Ya se puede usar en facturas y traslados.')
  })
}
function formBodega(x) {
  formulario(x ? 'Editar bodega' : 'Nueva bodega', [
    { id: 'nombre', label: 'Nombre (corto)', value: x?.nombre },
    { id: 'tipo', label: 'Tipo', type: 'select', options: Object.entries(TIPOS), value: x?.tipo || 'proyecto' },
    { id: 'responsable', label: 'Responsable', value: x?.responsable === 'Por asignar' ? '' : x?.responsable, ph: 'Nombre de la persona' },
    { id: 'proyecto', label: 'Proyecto (solo tipo proyecto)', type: 'select', options: [['', '—']].concat(Object.entries(PROYECTOS).filter(([k]) => k !== 'general')), value: x?.proyecto || '' },
  ], (v) => {
    const n = v.nombre.trim(); if (!n) throw new Error('Escribe el nombre.')
    if (n.length > 32) throw new Error('El nombre es muy largo: máximo 32 caracteres.')
    if (S.bodegas.some((b) => b !== x && norm(b.nombre) === norm(n))) throw new Error('Ya existe una bodega con ese nombre.')
    if (!v.responsable.trim()) throw new Error('Toda bodega necesita una persona responsable.')
    const dato = { nombre: n, tipo: v.tipo, responsable: v.responsable.trim(), proyecto: v.tipo === 'proyecto' ? v.proyecto : '' }
    if (x) Object.assign(x, dato); else S.bodegas.push({ id: 'b-' + uid(), activa: true, ...dato })
    aviso(x ? 'Bodega actualizada.' : 'Bodega creada.')
  })
}

// ───────── Pintado ─────────
const VISTAS = { guia: vGuia, inventario: vInventario, kardex: vKardex, compras: vCompras, catalogo: vCatalogo, bodegas: vBodegas, entregas: vEntregas, conciliacion: vConciliacion }
function render() {
  if (!permitida(ui.tab)) ui.tab = 'guia'
  $('#pestanas').innerHTML = PESTANAS.filter(([id]) => permitida(id)).map(([id, t]) => `<button class="pest" role="tab" aria-selected="${ui.tab === id}" data-pest="${id}">${t}</button>`).join('')
  $('#perfil').innerHTML = [['fin', 'Financiera (Mafe, Katys, Rocío)']].concat(encargados().map((n) => [n, 'Encargado: ' + n])).map(([v, t]) => `<option value="${esc(v)}"${S.perfil === v ? ' selected' : ''}>${esc(t)}</option>`).join('')
  document.getElementById('contenido').innerHTML = VISTAS[ui.tab]()
  guardar()
}
render()
