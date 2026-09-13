'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Loader2, Search, ImageOff, Upload, X, Trees, Sprout, BookOpen,
} from 'lucide-react'
import { Cabecera, Cargando } from '@/app/components/marca'
import {
  fetchEspecies, filtrarEspecies, cambiarFoto,
  type Especie, type OrigenFiltro,
} from '@/lib/catalogo'
import { Badge, EspecieInfoBlock } from '@/app/components/EspecieInfo'

const PRIMARY = '#2f3f32'

// Compresión cliente (Canvas) — calidad alta para fichas de catálogo
async function compressImage(file: File, maxW = 1400, q = 0.85): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxW / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], 'foto.jpg', { type: 'image/jpeg' }) : file),
        'image/jpeg', q,
      )
    }
    img.onerror = () => resolve(file)
    img.src = URL.createObjectURL(file)
  })
}

export default function CatalogoPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [especies, setEspecies] = useState<Especie[]>([])
  const [origen, setOrigen] = useState<OrigenFiltro>('todas')
  const [familia, setFamilia] = useState('')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Especie | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase
        .schema('people').from('user_profiles').select('is_admin, department').eq('email', user.email).single()
      if (!profile?.is_admin && profile?.department !== 'RAS') { router.push('/'); return }
      setEspecies(await fetchEspecies())
      setLoading(false)
    }
    init()
  }, [router])

  const familias = useMemo(
    () => Array.from(new Set(especies.map((e) => e.familia).filter(Boolean))).sort() as string[],
    [especies],
  )
  const filtradas = useMemo(
    () => filtrarEspecies(especies, origen, familia, q),
    [especies, origen, familia, q],
  )

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !sel) return
    setUploading(true)
    const comp = await compressImage(file)
    const url = await cambiarFoto(sel.id, comp)
    setUploading(false)
    if (url) {
      setEspecies((prev) => prev.map((x) => x.id === sel.id ? { ...x, foto_url: url } : x))
      setSel((s) => s ? { ...s, foto_url: url } : s)
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  if (loading) {
    return (
      <Cargando texto="Cargando el catálogo…" />
    )
  }

  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        volver={{ href: '/intranet/ras', label: 'RAS' }}
        modulo="Maestro de especies"
        titulo="Catálogo de especies"
        descripcion={`${filtradas.length} de ${especies.length} especies`}
      />

      {/* Filtros: quedan fijos arriba al desplazarse, como antes en la cabecera. */}
      <div className="sticky top-0 z-20 border-b border-stone-200 bg-papel/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 py-4 flex flex-col sm:flex-row gap-3">
          <div className="flex rounded-xl border-2 border-stone-200 overflow-hidden text-sm font-bold">
            {([['todas', 'Todas', BookOpen], ['ras', 'RAS', Trees], ['vivero', 'Vivero', Sprout]] as const).map(([val, label, Icon]) => (
              <button key={val} onClick={() => setOrigen(val)}
                className={`flex items-center gap-1.5 px-4 py-2 transition-colors ${origen === val ? 'text-white' : 'text-stone-500 hover:bg-stone-50'}`}
                style={origen === val ? { backgroundColor: PRIMARY } : undefined}>
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <select value={familia} onChange={(e) => setFamilia(e.target.value)}
            className="px-3 py-2 rounded-xl border-2 border-stone-200 text-sm font-semibold text-stone-700 focus:border-primary focus:outline-none bg-white">
            <option value="">Todas las familias ({familias.length})</option>
            {familias.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nombre común o científico…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border-2 border-stone-200 text-sm focus:border-primary focus:outline-none" />
          </div>
        </div>
      </div>

      {/* Grid */}
      <main className="max-w-6xl mx-auto px-6 py-6 sm:px-10">
        {filtradas.length === 0 ? (
          <p className="text-center text-stone-400 py-16">Sin especies para este filtro.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtradas.map((e) => (
              <button key={e.id} onClick={() => setSel(e)}
                className="group text-left bg-white rounded-2xl border border-stone-200 shadow-sm hover:shadow-md hover:border-primary transition-all overflow-hidden">
                <div className="aspect-[4/3] bg-stone-100 flex items-center justify-center overflow-hidden">
                  {e.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.foto_url} alt={e.nombre_cientifico} loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="flex flex-col items-center text-stone-300">
                      <ImageOff size={28} /><span className="text-[10px] mt-1 font-bold">Sin foto</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-black text-stone-800 text-sm leading-tight truncate">
                    {e.nombres_comunes?.[0] || e.nombre_cientifico}
                  </p>
                  <p className="italic text-xs text-stone-500 truncate">{e.nombre_cientifico}</p>
                  <p className="text-[11px] text-stone-400 mt-0.5 truncate">{e.familia || '—'}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {e.en_catalogo && <Badge color="#2f3f32">Catálogo</Badge>}
                    {e.en_ras && <Badge color="#15803d">RAS</Badge>}
                    {e.en_vivero && <Badge color="#b45309">Vivero</Badge>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Detalle */}
      {sel && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => setSel(null)}>
          <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
            onClick={(ev) => ev.stopPropagation()}>
            <div className="relative">
              <div className="aspect-[16/9] bg-stone-100 flex items-center justify-center overflow-hidden sm:rounded-t-3xl">
                {sel.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sel.foto_url} alt={sel.nombre_cientifico} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-stone-300"><ImageOff size={40} /><span className="text-xs mt-1 font-bold">Sin foto</span></div>
                )}
              </div>
              <button onClick={() => setSel(null)}
                className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60">
                <X size={18} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-60"
                style={{ backgroundColor: PRIMARY }}>
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? 'Subiendo…' : (sel.foto_url ? 'Cambiar foto' : 'Subir foto')}
              </button>
            </div>

            <EspecieInfoBlock especie={sel} />
          </div>
        </div>
      )}
    </div>
  )
}
