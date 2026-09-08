import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Alta de opciones en los catálogos parametrizables desde la UI
 * (el botón «+ Agregar» de HOJA 1).
 *
 *   catalogo.proyectos            → Conexión Biodiversa, Ley del Árbol…
 *   catalogo.fuentes_informacion  → socialización veredal, comunitaria,
 *                                   Lácteos del Hogar…
 *
 * La LECTURA no pasa por aquí: los catálogos son públicos para lectura y el
 * cliente los trae directo con supabase (ver lib/parametros.ts). Aquí solo la
 * escritura, porque agregar una opción afecta a todo el ecosistema y conviene
 * que el código (slug) lo genere un único lugar.
 */

const LISTAS = ['proyectos', 'fuentes_informacion'] as const
type Lista = (typeof LISTAS)[number]

/**
 * Nombre → código estable: sin tildes, minúsculas, separado por guion bajo.
 * «Lácteos del Hogar», «lacteos del hogar» y «LÁCTEOS DEL HOGAR» dan todos
 * `lacteos_del_hogar`, así que reescribir la misma opción no parte los filtros
 * en dos: se reutiliza la que ya existe.
 */
function aCodigo(nombre: string): string {
  return nombre
    .normalize('NFD').replace(/[̀-ͯ]/g, '')   // quita las tildes ya separadas por NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

async function authorize(supabase: ReturnType<typeof createServerSupabaseClient>, email: string) {
  const { data: profile, error } = await supabase
    .schema('people').from('user_profiles')
    .select('is_admin, department')
    .eq('email', email)
    .single()
  if (error || (!profile?.is_admin && profile?.department !== 'Juridica')) return false
  return true
}

// POST /api/catalogo/parametros — { lista, nombre, created_by }
export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Datos requeridos' }, { status: 400 })

    const lista = String(body.lista ?? '') as Lista
    if (!LISTAS.includes(lista)) {
      return NextResponse.json({ error: 'Catálogo no válido' }, { status: 400 })
    }

    const email: string | null = body.created_by ?? null
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    const ok = await authorize(supabase, email)
    if (!ok) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

    const nombre = String(body.nombre ?? '').trim().replace(/\s+/g, ' ')
    if (!nombre) return NextResponse.json({ error: 'Escribe el nombre de la opción' }, { status: 400 })
    const codigo = aCodigo(nombre)
    if (!codigo) {
      return NextResponse.json({ error: 'El nombre debe tener al menos una letra o número' }, { status: 400 })
    }

    const columnas = 'id, codigo, nombre, descripcion, activo, orden'

    // Si ya existe ese código, devolverlo en vez de fallar: para quien está en el
    // formulario el resultado buscado es el mismo (queda esa opción seleccionada),
    // y así no se crean gemelas por diferencias de tildes o mayúsculas.
    const { data: existente } = await supabase
      .schema('catalogo').from(lista)
      .select(columnas)
      .eq('codigo', codigo)
      .maybeSingle()
    if (existente) {
      // Una opción retirada que alguien vuelve a agregar se reactiva.
      if ((existente as { activo: boolean }).activo === false) {
        const { data: reactivada } = await supabase
          .schema('catalogo').from(lista)
          .update({ activo: true })
          .eq('codigo', codigo)
          .select(columnas)
          .single()
        return NextResponse.json(reactivada ?? existente, { status: 200 })
      }
      return NextResponse.json(existente, { status: 200 })
    }

    // Las opciones nuevas van al final del desplegable: las semilla (10, 20, 30)
    // conservan el orden pensado y lo agregado se acumula debajo.
    const { data: ultima } = await supabase
      .schema('catalogo').from(lista)
      .select('orden')
      .order('orden', { ascending: false })
      .limit(1)
      .maybeSingle()
    const orden = ((ultima as { orden: number } | null)?.orden ?? 0) + 10

    const { data: creada, error } = await supabase
      .schema('catalogo').from(lista)
      .insert({ codigo, nombre, orden, created_by: email })
      .select(columnas)
      .single()

    if (error) {
      // La tabla no existe todavía: 42P01 lo dice Postgres, PGRST205 lo dice
      // PostgREST cuando ni siquiera está en su caché de esquema. Sin este caso
      // el mensaje que llega a la abogada es "schema cache", que no le dice nada.
      if (error.code === '42P01' || error.code === 'PGRST205') {
        return NextResponse.json(
          { error: 'El catálogo todavía no existe en la base de datos: falta correr docs/sql/migration_proyecto_fuente.sql.' },
          { status: 500 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(creada, { status: 201 })
  } catch (err) {
    console.error('POST /api/catalogo/parametros error:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
