// Mismo formulario que ya usaba la intranet (lib/inspection-data.ts): 6 categorías y 5 fotos.
// Recepción (check in) lleva solo las categorías 1, 3, 5 y 6; devolución (check out), las seis.

export type TipoInspeccion = 'recepcion' | 'devolucion'
export type ClaveCategoria = 'cat1' | 'cat2' | 'cat3' | 'cat4' | 'cat5' | 'cat6'

export interface Categoria {
  clave: ClaveCategoria
  titulo: string
  grupo: string
  problemas: string[]
}

export const CATEGORIAS: Categoria[] = [
  {
    clave: 'cat1', titulo: 'Presentación y comodidad', grupo: 'Limpieza y confort',
    problemas: [
      'Suciedad excesiva — Interior',
      'Suciedad excesiva — Exterior',
      'Daños en tapicería o silletería suelta',
      'Aire acondicionado no enfría',
      'Vidrios con fisuras o quebrados',
      'Espejos sueltos o rotos',
    ],
  },
  {
    clave: 'cat2', titulo: 'Niveles y pérdidas de líquidos', grupo: 'Fluidos',
    problemas: [
      'Nivel bajo — Aceite',
      'Nivel bajo — Frenos',
      'Nivel bajo — Refrigerante',
      'Goteo visible (Piso manchado)',
      'Fuga activa (Manguera rota)',
      'Batería sulfatada o con nivel bajo',
      'Olor a combustible',
    ],
  },
  {
    clave: 'cat3', titulo: 'Tablero de control y eléctrico', grupo: 'Instrumentos y luces',
    problemas: [
      'Testigo encendido — Check Engine',
      'Testigo encendido — Aceite',
      'Testigo encendido — ABS',
      'Odómetro o Velocímetro no funciona',
      'Pito (Bocina) no suena',
      'Bombillo fundido — Altas',
      'Bombillo fundido — Bajas',
      'Bombillo fundido — Direccional',
      'Bombillo fundido — Freno',
      'Alarma de reversa inoperativa',
    ],
  },
  {
    clave: 'cat4', titulo: 'Seguridad activa (frenos y dirección)', grupo: 'Mecánica crítica',
    problemas: [
      'Pedal de freno "largo" o esponjoso',
      'Freno de mano no sostiene el vehículo',
      'Ruido extraño al frenar (Pastillas desgastadas)',
      'Dirección con juego (Vibración o desalineada)',
      'Amortiguadores con fuga o ruidosos',
    ],
  },
  {
    clave: 'cat5', titulo: 'Estado de llantas', grupo: 'Llantas y rines',
    problemas: [
      'Labrado inferior a 3mm (Lisa)',
      'Presión de aire baja',
      'Cortes, "chichones" o deformidades',
      'Rin golpeado o fisurado',
      'Repuesto desinflado o ausente',
    ],
  },
  {
    clave: 'cat6', titulo: 'Kit de carretera y documentos', grupo: 'Legal y emergencias',
    problemas: [
      'Extintor vencido o sin presión',
      'Botiquín incompleto',
      'Falta herramienta básica (Gato / Cruceta)',
      'Documento físico ausente — Tarjeta de propiedad',
      'Documento físico ausente — SOAT',
      'Documento físico ausente — Tecnomecánica',
      'Camilla ausente o en mal estado',
    ],
  },
]

export const CATEGORIAS_RECEPCION: ClaveCategoria[] = ['cat1', 'cat3', 'cat5', 'cat6']

export interface FotoSlot { clave: string; etiqueta: string; ayuda: string }

export const FOTOS: FotoSlot[] = [
  { clave: 'frontal',     etiqueta: 'Frontal',           ayuda: 'Vista delantera completa' },
  { clave: 'posterior',   etiqueta: 'Posterior',         ayuda: 'Vista trasera completa' },
  { clave: 'lateral_izq', etiqueta: 'Lateral izquierdo', ayuda: 'Costado del conductor' },
  { clave: 'lateral_der', etiqueta: 'Lateral derecho',   ayuda: 'Costado del pasajero' },
  { clave: 'tablero',     etiqueta: 'Tablero encendido', ayuda: 'Panel con el vehículo encendido' },
]

export interface DatosCategoria {
  status: 'ok' | 'issues'
  issues: string[]
  other: string
}

export type Categorias = Record<ClaveCategoria, DatosCategoria>

export function categoriasIniciales(): Categorias {
  const base = (): DatosCategoria => ({ status: 'ok', issues: [], other: '' })
  return { cat1: base(), cat2: base(), cat3: base(), cat4: base(), cat5: base(), cat6: base() }
}

const TERMINOS_VEHICULO = [
  'Acepto respetar todas las normas de tránsito, señales viales y límites de velocidad vigentes durante el uso del vehículo.',
  'Acepto mantener las distancias de seguridad, conducir de forma prudente y no operar el vehículo bajo efectos de ninguna sustancia.',
  'Acepto ser responsable de la integridad del vehículo, su combustible y su documentación durante todo el período de uso.',
  'Acepto notificar inmediatamente a la empresa sobre cualquier novedad, daño, incidente o accidente que ocurra.',
]

const TERMINOS_MOTO = [
  'Acepto utilizar el casco certificado durante toda la operación, sin excepción.',
  'Acepto respetar todas las normas de tránsito, señales viales y velocidades reglamentarias para circulación en motocicleta.',
  'Acepto no realizar maniobras peligrosas, mantener distancias seguras y no operar la motocicleta bajo efectos de ninguna sustancia.',
  'Acepto ser responsable de la integridad de la motocicleta y notificar inmediatamente a la empresa sobre cualquier novedad, daño o incidente.',
]

export function terminosDe(esMoto: boolean): string[] {
  return esMoto ? TERMINOS_MOTO : TERMINOS_VEHICULO
}
