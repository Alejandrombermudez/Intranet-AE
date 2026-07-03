import type { Especie } from '@/lib/catalogo'

/** Pill de color — usado para origen (catálogo/RAS/vivero) y alertas (IUCN/CITES). */
export function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${color}1a`, color }}>
      {children}
    </span>
  )
}

/** Tarjeta label+value — usada en las grillas de atributos de una especie. */
export function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-stone-50 rounded-xl p-3">
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-stone-800 capitalize">{value}</p>
    </div>
  )
}

/**
 * Ficha de una especie: badges de origen/amenaza + nombre + descripción + grid de atributos.
 * No incluye la foto ni el botón de subir/cambiar — eso es específico de la página de catálogo.
 * Se reutiliza en el panel de árbol seleccionado (ficha de conservación) con la misma especie.
 */
export function EspecieInfoBlock({ especie: sel }: { especie: Especie }) {
  return (
    <div className="p-6">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {sel.en_catalogo && <Badge color="#0d7377">Catálogo botánico</Badge>}
        {sel.en_ras && <Badge color="#15803d">RAS · {sel.n_arboles_ras} árb.</Badge>}
        {sel.en_vivero && <Badge color="#b45309">Vivero</Badge>}
        {sel.iucn && ['NT', 'VU', 'EN', 'CR', 'DD'].includes(sel.iucn) && <Badge color="#dc2626">IUCN {sel.iucn}</Badge>}
        {sel.cites && sel.cites.toLowerCase() !== 'na' && <Badge color="#dc2626">CITES</Badge>}
      </div>
      <h2 className="text-2xl font-black text-stone-900 leading-tight">
        {sel.nombres_comunes?.join(' · ') || '—'}
      </h2>
      <p className="italic text-stone-500 mb-4">
        {sel.nombre_cientifico}{sel.autor ? ` ${sel.autor}` : ''} {sel.familia ? `· ${sel.familia}` : ''}
      </p>

      {sel.descripcion && <p className="text-sm text-stone-700 leading-relaxed mb-4">{sel.descripcion}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {sel.orden && <Field label="Orden" value={sel.orden} />}
        {sel.iucn && <Field label="IUCN" value={sel.iucn} />}
        {sel.cites && sel.cites.toLowerCase() !== 'na' && <Field label="CITES" value={sel.cites} />}
        {sel.amenaza && <Field label="Amenaza (Res. 1912)" value={sel.amenaza} />}
        {sel.rol_sucesional && <Field label="Grupo funcional" value={sel.rol_sucesional} />}
        {sel.origen && <Field label="Origen" value={sel.origen} />}
        {sel.dispersion && <Field label="Dispersión" value={sel.dispersion} />}
        {sel.polinizacion && <Field label="Polinización" value={sel.polinizacion} />}
        {sel.usos?.length ? <Field label="Usos" value={sel.usos.join(', ')} /> : null}
        {sel.tipo_semilla && <Field label="Tipo de semilla" value={sel.tipo_semilla} />}
        {sel.tratamiento_pregerminativo && <Field label="Tratamiento pregerminativo" value={sel.tratamiento_pregerminativo} />}
        {sel.habito && <Field label="Hábito" value={sel.habito} />}
        {sel.especie_anterior && <Field label="Especie anterior" value={sel.especie_anterior} />}
      </div>

      {!sel.descripcion && !sel.en_catalogo && (
        <p className="text-xs text-stone-400 mt-4">
          Especie añadida desde {sel.en_vivero ? 'vivero' : 'RAS'} — pendiente de ficha botánica (descripción, usos, foto).
        </p>
      )}
    </div>
  )
}
