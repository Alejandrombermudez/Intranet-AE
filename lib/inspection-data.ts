export type InspectionType = 'recepcion' | 'devolucion'
export type CategoryStatus = 'ok' | 'issues'
export type CategoryKey = 'cat1' | 'cat2' | 'cat3' | 'cat4' | 'cat5' | 'cat6'

export interface CategoryData {
  status: CategoryStatus
  issues: string[]
  other: string
}

export type InspectionCategories = Record<CategoryKey, CategoryData>

export interface CategoryConfig {
  key: CategoryKey
  title: string
  mainCategory: string
  icon: string        // Nombre del ícono Lucide
  issues: string[]
}

export interface PhotoSlotConfig {
  key: string
  label: string
  hint: string
}

// ─── 6 categorías del formulario ────────────────────────────────────────────

export const INSPECTION_CATEGORIES: CategoryConfig[] = [
  {
    key: 'cat1',
    title: 'Presentación & Comodidad',
    mainCategory: 'Limpieza y Confort',
    icon: 'Sparkles',
    issues: [
      'Suciedad excesiva — Interior',
      'Suciedad excesiva — Exterior',
      'Daños en tapicería o silletería suelta',
      'Aire acondicionado no enfría',
      'Vidrios con fisuras o quebrados',
      'Espejos sueltos o rotos',
    ],
  },
  {
    key: 'cat2',
    title: 'Niveles y Pérdidas de Líquidos',
    mainCategory: 'Fluidos',
    icon: 'Droplets',
    issues: [
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
    key: 'cat3',
    title: 'Tablero de Control y Eléctrico',
    mainCategory: 'Instrumentos y Luces',
    icon: 'Gauge',
    issues: [
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
    key: 'cat4',
    title: 'Seguridad Activa (Frenos y Dirección)',
    mainCategory: 'Mecánica Crítica',
    icon: 'ShieldAlert',
    issues: [
      'Pedal de freno "largo" o esponjoso',
      'Freno de mano no sostiene el vehículo',
      'Ruido extraño al frenar (Pastillas desgastadas)',
      'Dirección con juego (Vibración o desalineada)',
      'Amortiguadores con fuga o ruidosos',
    ],
  },
  {
    key: 'cat5',
    title: 'Estado de Llantas',
    mainCategory: 'Llantas y Rines',
    icon: 'CircleDashed',
    issues: [
      'Labrado inferior a 3mm (Lisa)',
      'Presión de aire baja',
      'Cortes, "chichones" o deformidades',
      'Rin golpeado o fisurado',
      'Repuesto desinflado o ausente',
    ],
  },
  {
    key: 'cat6',
    title: 'Kit de Carretera y Documentos',
    mainCategory: 'Legal y Emergencias',
    icon: 'FolderCheck',
    issues: [
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

// ─── 5 slots de fotos ────────────────────────────────────────────────────────

export const PHOTO_SLOTS: PhotoSlotConfig[] = [
  { key: 'frontal',      label: 'Frontal',             hint: 'Vista delantera completa del vehículo' },
  { key: 'posterior',    label: 'Posterior',            hint: 'Vista trasera completa del vehículo' },
  { key: 'lateral_izq',  label: 'Lateral Izquierdo',   hint: 'Costado conductor / izquierdo' },
  { key: 'lateral_der',  label: 'Lateral Derecho',     hint: 'Costado pasajero / derecho' },
  { key: 'tablero',      label: 'Tablero Encendido',   hint: 'Panel de instrumentos con vehículo encendido' },
]

// ─── Estado inicial de categorías ───────────────────────────────────────────

export function getDefaultCategories(): InspectionCategories {
  return {
    cat1: { status: 'ok', issues: [], other: '' },
    cat2: { status: 'ok', issues: [], other: '' },
    cat3: { status: 'ok', issues: [], other: '' },
    cat4: { status: 'ok', issues: [], other: '' },
    cat5: { status: 'ok', issues: [], other: '' },
    cat6: { status: 'ok', issues: [], other: '' },
  }
}
