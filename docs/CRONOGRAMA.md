# Cronograma — Ecosistema Amazonía Emprende

> Estimación a ritmo sostenible, con el modelo de trabajo **usuario + IA**: el usuario prueba, detecta fallos y define la arquitectura; el asistente genera el desarrollo.
> **Fecha:** 2026-06-14 · **Gantt:** [`../../arquitectura-visual/cronograma.svg`](../../arquitectura-visual/cronograma.svg) · **Excel para presentar:** `arquitectura-visual/cronograma_actividades.xlsx`

---

## Resumen

**20 semanas (16 jun – 31 oct 2026)**, construidas en el **orden del proceso**: primero jurídica y la unificación de datos, después el módulo SIG, luego la aplicación de campo y por último el plan de siembra y el vivero. Cada fase se apoya en la anterior.

| Fase | Semanas | Contenido | Entrega |
|------|---------|-----------|---------|
| **1 · Jurídica y datos base** | 1–4 | Diseñar el modelo central (aliados, predios, expedientes); migrar los datos actuales; conectar jurídica, siembra y conservación | Datos unificados sin duplicados (sem 4) |
| **2 · Módulo SIG** | 5–9 | Habilitar PostGIS; desglosar los `.zip` (geometría + atributos); automatizar reproyección y metadatos; cargar zonas y publicarlas en el geovisor | Zonas en la base y en el geovisor (sem 9) |
| **3 · Aplicación de campo** | 10–13 | Ajustes a la app; corrección de zonas en campo (sin señal, con GPS) | Zonas corregidas desde campo (sem 13) |
| **4 · Plan de siembra y vivero** | 14–20 | Catálogo de especies; modelos florísticos y cálculo de demanda; recepción, lotes y costeo del vivero; conexión plan–vivero | Plan y vivero conectados (sem 20) |

El detalle semana a semana está en `cronograma_actividades.xlsx`.

**Avance (2026-06-19):** Fase 1 en marcha — el modelo central `core` (aliados/predios/expedientes) está construido y el **módulo Jurídico ya opera sobre él en producción** (cutover completo, verificado con un caso real; subida de PDF/imagen/Word). Falta conectar campo/siembra y conservación al expediente. Detalle de lo hecho: `CORE_MIGRACION.md`.

---

## Por qué 20 semanas y no 12 meses

La cifra anterior (12 meses) era para un desarrollador humano tradicional. Con el modelo usuario + IA:

- Lo que se acelera mucho: escribir el código (schemas, migraciones, componentes, lógica de cálculo, integraciones).
- Lo que marca el ritmo real (no se acelera): probar con datos reales y corregir; la migración de datos sin romper producción; la corrección de zonas en campo; y las dependencias externas (reunión con el SIG, app de campo de otra persona, despliegues).

---

## Riesgos a vigilar

- **Migrar los datos** (unificar aliados/predios) sin afectar lo que está en producción.
- **Corregir zonas en campo sin señal** (edición de geometría offline; hay que probarla en terreno).
- **Dependencias externas**: la información que entregue el SIG y los tiempos de la app de campo que lleva otra persona.

## Segunda etapa (después)

El cierre del proceso —aval de CorpoAmazonia, monitoreo de siembras y medición de carbono (MRV)— se construye en una segunda etapa, una vez el flujo principal esté en operación.

---

> Cronograma vivo: si cambia la fecha de inicio o la disponibilidad para probar, se reajusta el Gantt y el Excel.
