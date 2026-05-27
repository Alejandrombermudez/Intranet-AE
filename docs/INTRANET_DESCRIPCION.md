# Intranet Amazonia Emprende — Descripción funcional

**Versión actual:** v1.1  
**Fecha:** Mayo 2026

---

## ¿Qué es?

Una plataforma interna de gestión corporativa para el equipo de Amazonia Emprende. Centraliza cuatro grandes frentes: reserva y control de flota vehicular, seguimiento de trabajo de campo ambiental, coordinación ejecutiva de reuniones y gestión de usuarios internos. El acceso requiere cuenta corporativa de Microsoft 365.

---

## Tipos de usuario

| Tipo | Quién es | Qué puede hacer |
|---|---|---|
| **Visitante** | Cualquier persona con el link | Ver disponibilidad del calendario, llenar formulario de consentimiento |
| **Usuario autenticado** | Staff con cuenta MS365 | Reservar vehículos, hacer inspecciones, ver sus sesiones del ejecutivo |
| **Usuario de departamento** | Staff con departamento asignado | Todo lo anterior + acceso a su módulo específico |
| **Administrador** | `is_admin = true` | Acceso total: gestión de usuarios, todos los módulos, estadísticas globales |

---

## Frente 1 — Flota vehicular

### Calendario de reservas
- Acceso público (sin login). Muestra disponibilidad de los 4 vehículos de la organización en tiempo real.
- Los usuarios autenticados pueden crear, ver y eliminar sus propias reservas.
- **Vehículos:** Chevrolet Samurai, Camioneta Foton (bloqueada lunes y martes), Suzuki DR 150, Yamaha XTZ-150.
- Cada reserva incluye: vehículo, nombre del solicitante, fechas, propósito.

### Validación de reservas (inspecciones)
- Acceso solo para usuarios autenticados.
- Se activa el día de la reserva (recepción) o al devolver el vehículo (devolución).
- Es un formulario de 8 pasos que registra el estado del vehículo:
  - **6 categorías de inspección:** Presentación, Niveles y Líquidos, Tablero y Eléctrico, Seguridad Activa, Llantas, Kit y Documentos.
  - **Fotos:** 5 ángulos (frontal, posterior, lateral izquierdo, lateral derecho, tablero).
  - **Kilometraje** del vehículo al momento de la inspección.
  - Cada categoría registra si está OK o tiene problemas, con descripción libre de los hallazgos.
- Las inspecciones quedan vinculadas a la reserva y al usuario.

---

## Frente 2 — Módulo RAS (Restauración Ambiental y Social)

Acceso: administradores o usuarios con `departamento = RAS`.

### Familias de Restauración / Siembra
Gestión de familias vinculadas a procesos de restauración activa:
- Datos por familia: propietario, municipio, vereda, nombre de la finca.
- Áreas en hectáreas: potreros, bosque, otras, área de restauración.
- Parcelas de monitoreo, plántulas sembradas, especies sembradas.
- Plan de restauración (documento vinculado).
- Shapefiles: polígono de finca y polígono de área de restauración.
- Fotos del predio.

### Familias de Conservación
Gestión de familias bajo acuerdos de conservación:
- Datos por familia: propietario, municipio, vereda, nombre de la finca.
- Áreas en hectáreas: potreros, bosque, otras.
- Árboles semilleros, especies forestales, otros índices de biodiversidad.
- Shapefiles: polígono de finca y polígono de conservación.
- Fotos del predio.

### Completitud de datos
- Vista que muestra qué familias tienen campos vacíos (sin shapefile, sin área registrada, etc.).
- Ordenadas de mayor a menor número de campos faltantes.
- Acceso directo al formulario de edición para completar la información.

### Mis Sesiones (pestaña dentro del módulo RAS)
- Vista de lectura. Muestra las sesiones de seguimiento que el ejecutivo haya creado para el equipo RAS.

---

## Frente 3 — Módulo Ejecutivo

Acceso: administradores o usuarios con `departamento = Ejecutivo`.

### Panel de seguimiento de reuniones
Herramienta para que el ejecutivo lleve un registro estructurado de indicaciones y acuerdos con cada persona del equipo.

**Lista de personas (panel izquierdo)**
- Muestra todos los usuarios con acceso a la intranet.
- Buscador por nombre o email.
- El propio ejecutivo aparece en la lista (para crear notas personales o de prueba).

**Sesiones (panel derecho)**
- Al seleccionar una persona, se muestran sus sesiones.
- Cada sesión tiene: título, fecha, notas generales.
- Dos pestañas: **Activas** (últimos 90 días) e **Histórico** (todas).
- Se pueden crear nuevas sesiones y eliminar las existentes.

**Indicaciones dentro de cada sesión**
- Cada sesión puede tener múltiples indicaciones (ítems de acción).
- Cada indicación tiene: descripción, plataforma asociada (ej. Slack, Notion, WhatsApp), estado.
- **Estados (ciclo inline con clic):** Pendiente → Hecho → Cancelado → Pendiente.
- Se pueden agregar y eliminar indicaciones individualmente.

### Mis Sesiones (vista de cualquier usuario autenticado)
- En los módulos de cada departamento aparece una pestaña "Mis Sesiones".
- Es solo lectura: el usuario ve las sesiones que el ejecutivo creó para él, con sus indicaciones y estados.
- No puede crear ni modificar nada desde esta vista.

---

## Frente 4 — Panel de Administración

Acceso: solo administradores (`is_admin = true`).

### Gestión de usuarios
- Lista de todos los perfiles registrados con: nombre, email, departamento, rol, estado de administrador, acceso a intranet, último login.
- Edición inline de cada usuario: cambiar departamento, rol, permisos de administrador y acceso a intranet.

### Módulo Financiero (si el admin tiene departamento Financiero)

**Estadísticas de inspecciones vehiculares**
- Total de inspecciones realizadas.
- Proporción de inspecciones sin vs. con problemas (gráfico de torta).
- Ranking de categorías con más incidencias (gráfico de barras).
- Top 10 de problemas más frecuentes por nombre.
- Galería de fotos: última recepción vs. última devolución de cada vehículo.
- Tabla completa de inspecciones con todos los detalles.

**Documentos vehiculares**
- Fechas de vencimiento de SOAT y Tecnomecánica por vehículo.
- Alerta visual para documentos que vencen en menos de 30 días.
- Edición directa de fechas desde el panel.

**Registros de tratamiento de datos**
- Formulario público de consentimiento (link compartible: `/consentimiento`).
- Lista de todos los registros con filtros por período.
- Exportación a Excel o PDF.
- Eliminación individual de registros.

---

## Base de datos — Estructura de schemas

| Schema | Tablas principales | Contenido | Estado |
|---|---|---|---|
| `people` | `user_profiles` (13 filas) | Perfiles de usuarios internos | ✅ |
| `fleet` | `vehicle_reservations` (30), `vehicle_inspections` (3) | Reservas e inspecciones | ✅ — `vehicle_documents` pendiente de crear |
| `ejecutivo` | `sesiones` (1), `indicaciones` (2) | Seguimiento ejecutivo | ✅ — `migration_v2.sql` pendiente |
| `siembra` | `familias` (9), `predios` (6), `evaluaciones_campo` (10), `monitoreos` (1), `fotos_predio` (9) | Módulo restauración | ✅ |
| `ras` | `familias` (17), fotos/monitoreos sin filas aún | Familias en conservación | ✅ |
| `public` | `consentimientos` (4), `proyecciones` (3) | Tablas transversales | ✅ |

---

## Flujos principales

### Reservar un vehículo
1. Usuario autenticado entra al calendario
2. Selecciona vehículo disponible + fechas + propósito
3. La reserva aparece en el calendario para todos

### Inspeccionar un vehículo
1. El día de la reserva, el conductor entra a "Validar mi Reserva"
2. Selecciona su reserva activa y el tipo (recepción o devolución)
3. Completa el formulario de 8 pasos
4. Sube fotos y registra el kilometraje
5. El registro queda vinculado a la reserva

### Registrar una sesión ejecutiva
1. Ejecutivo abre su módulo, selecciona una persona del listado
2. Crea una sesión con título y fecha
3. Agrega indicaciones una a una con descripción y plataforma
4. A medida que avanza el trabajo, cicla el estado de cada indicación (clic directo)
5. La persona puede ver sus sesiones en su pestaña "Mis Sesiones" (solo lectura)

### Completar datos de una familia RAS
1. Usuario RAS entra a su módulo → pestaña Completitud
2. Ve qué familias tienen campos vacíos y cuáles son
3. Clic en "Completar" → formulario de edición de la familia
4. Guarda los datos faltantes

---

## Tecnología (referencia para diseño)

- **Stack:** Next.js (App Router), TypeScript, React
- **Base de datos:** PostgreSQL vía Supabase
- **Autenticación:** Microsoft 365 / Azure AD (OAuth)
- **Almacenamiento de archivos:** Supabase Storage (fotos de inspección, fotos de familias, shapefiles)
- **Estilos:** Tailwind CSS 4
- **Gráficos:** Recharts
- **Exportación:** Excel (XLSX), PDF (jsPDF)
- **Íconos:** Lucide React
- **Color principal:** `#0d7377` (verde azulado)
