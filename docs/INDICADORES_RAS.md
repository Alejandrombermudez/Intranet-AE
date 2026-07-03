# Indicadores y bioindicadores — RAS (Red de Árboles Semilleros)

> Qué índices se calculan desde el inventario de árboles, **cómo** se calculan, **qué significan**, y **qué falta** para estandarizar la información en RAS y en Vivero.
>
> **Fecha:** 2026-06-28 · Datos: `migracion_RAS_arboles.xlsx` · Cálculo: `docs/sql/migration_ras_arboles.sql` (vista `ras.v_indicadores_predio`).

---

## 1. Idea general

Cada predio es un conjunto de árboles. Estos indicadores resumen, con un número por predio, **cuánta biodiversidad** hay, **cómo está estructurada** y **qué valor de conservación** tiene. Se calculan sobre `ras.arboles_semilleros`.

| Símbolo | Significado |
|---|---|
| N | nº de árboles del predio |
| S | nº de especies distintas (riqueza) |
| nᵢ | nº de árboles de la especie i |
| pᵢ | proporción de la especie i = nᵢ/N |

---

## 2. Índices de diversidad (no necesitan espacio — ya se calculan)

Se construyen solo con conteos de individuos por especie.

### Riqueza de especies (S) — "Especies forestales"
- **Qué mide:** cuántas especies distintas hay.
- **Cómo:** contar especies distintas.
- **Significado:** la medida más básica de biodiversidad. Más especies = más diverso.

### Abundancia (N) — "Árboles semilleros"
- **Qué mide:** cuántos árboles hay.
- **Cómo:** contar árboles.
- **Significado:** esfuerzo de conservación / tamaño de la red en el predio.

### Índice de Shannon (H')
- **Qué mide:** diversidad combinando **riqueza** y **equidad** (qué tan repartidos están los árboles entre las especies).
- **Cómo:** `H' = −Σ pᵢ·ln(pᵢ)`.
- **Significado:** sube cuando hay muchas especies y ninguna domina. Rango típico ~1.5 (pobre) a ~3.5+ (muy diverso). En estos predios da 2.4–3.3 (alto).

### Índice de Simpson (1−D)
- **Qué mide:** probabilidad de que dos árboles al azar sean de **especies distintas**.
- **Cómo:** `1 − Σ nᵢ(nᵢ−1) / N(N−1)`.
- **Significado:** 0 a 1; cerca de 1 = muy diverso. Pesa más la **dominancia** que Shannon.

### Equidad de Pielou (J')
- **Qué mide:** qué tan **parejo** está repartido (no si hay muchas especies, sino si están equilibradas).
- **Cómo:** `J' = H' / ln(S)`.
- **Significado:** 0 a 1. Distingue "diverso y equilibrado" de "diverso pero dominado por una especie".

### Índice de Margalef
- **Qué mide:** riqueza **ajustada por el esfuerzo** (nº de árboles).
- **Cómo:** `(S−1) / ln(N)`.
- **Significado:** permite comparar de forma justa predios con muy distinto número de árboles.

---

## 3. Índices de estructura (no necesitan espacio — ya se calculan)

### Área basal total (m²)
- **Qué mide:** "madera en pie" → proxy de biomasa y, a futuro, de **carbono**.
- **Cómo:** `Σ AB`, con `AB = π·(DAP/200)²` por árbol.
- **Significado:** estructura/robustez del bosque; base del futuro MRV de carbono.

### DAP medio / máximo y árboles grandes (DAP ≥ 50 cm)
- **Qué mide:** grosor de los troncos / presencia de árboles maduros o emergentes.
- **Cómo:** promedio, máximo y conteo de DAP ≥ 50.
- **Significado:** madurez del rodal.

### Altura media / máxima
- **Qué mide:** estructura vertical (dosel).

---

## 4. Conservación y bioindicadores

### Especies fuera de catálogo (rareza)
- **Qué mide:** especies no presentes en el catálogo base → posibles hallazgos.
- **Estado:** ✅ se calcula (cruce con el catálogo).

### Especies CITES
- **Qué mide:** especies de comercio regulado (valor de conservación).
- **Estado:** ⚠️ parcial — el catálogo trae `cites_status` casi vacío; hay que revisarlo.

### Árboles con epífitas / líquenes
- **Qué mide:** los **líquenes son bioindicadores de calidad del aire**; las epífitas, de humedad y madurez.
- **Cómo:** árboles cuya columna "especies asociadas" menciona líquenes/epífitas/orquídeas.
- **Estado:** ⚠️ hoy solo hay dato en el núcleo Solano.

---

## 5. Índices ESPACIALES (cruzando puntos × polígonos)

Tenemos las coordenadas de 523 árboles (Piedemonte) y los **polígonos de conservación de los 17 predios**. Cruzándolos en PostGIS:

| Índice / operación | Qué da | Necesita |
|---|---|---|
| **Densidad real (árb/ha)** | árboles ÷ área real del polígono de conservación (`ST_Area`) | polígono cargado a `geo.zonas` |
| **Asignación de predio por geometría** (`ST_Contains`) | a qué predio pertenece cada árbol, sin depender del nombre | polígono + punto |
| **Control de calidad** (`ST_Contains`) | árboles cuya coordenada cae fuera de su predio | polígono + punto |
| **IVI (Índice de Valor de Importancia)** | importancia de cada especie = abundancia rel. + dominancia rel. + **frecuencia** rel. | la frecuencia necesita **parcelas**; se aproxima con una **cuadrícula** recortada al polígono |
| **Clark-Evans (vecino más cercano)** | si los semilleros están **agregados (<1), aleatorios (≈1) o uniformes (>1)** | puntos |
| **Conectividad** (`ST_Distance`) | distancias entre semilleros de la misma especie (corredores) | puntos |

> **Nota sobre el IVI:** la "frecuencia" del IVI **no** es la proporción de individuos que usa Shannon; es la **presencia en unidades de espacio** (parcelas). Por eso requiere parcelas o una cuadrícula sobre las coordenadas. El tamaño de celda afecta el resultado; el índice de Clark-Evans es la alternativa sin ese sesgo.

**Densidad — estado real del dato:** `ras.familias` ya tiene `ha_bosque` (16/17) y `area_bosque_recorrida` (15/17). El denominador correcto es **`area_bosque_recorrida`** (lo efectivamente inventariado), no el bosque total. Los predios que no son familia (Solano, Escuela Bosque, Gestar Green, Wilder Mahecha) no tienen área → densidad pendiente hasta darlos de alta.

---

## 6. Estado de calculabilidad (resumen)

| Indicador | Estado | Qué falta |
|---|---|---|
| Riqueza, Abundancia, Familias, Géneros | ✅ vista SQL | — |
| Shannon, Simpson, Pielou, Margalef | ✅ vista SQL | — |
| Área basal, DAP, árboles grandes, altura | ✅ vista SQL | — |
| Especies fuera de catálogo | ✅ | — |
| Densidad (árb/ha) | ⚠️ | denominador (`area_bosque_recorrida`) + dar de alta predios sin familia |
| Epífitas/líquenes | ⚠️ | dato solo en Solano |
| % rol sucesional (madurez) | ❌ | rol pionera/intermedia/tardía por especie (catálogo) |
| Especies amenazadas (UICN/Res. 1912) | ❌ | categoría de amenaza por especie (catálogo) |
| CITES | ⚠️ | completar `cites_status` |
| IVI completo / Clark-Evans / densidad real | ⚠️ | cargar polígonos + puntos a PostGIS |
| Carbono | ❌ | ecuaciones alométricas + densidad de madera |

---

## 7. Qué necesitamos para ESTANDARIZAR la información

### 7.1 En RAS (árboles)

1. **Cerrar determinaciones pendientes:** 244 árboles sin especie (170 a nivel de género/`sp.` + 74 vacíos), concentrados en pocos géneros: **Parkia, Pouteria, Eschweilera, Nectandra, Swartzia, Ocotea, Inga, Guarea**. Sube directamente la riqueza y todos los índices de diversidad.
2. **GPS de Solano:** 275 árboles sin coordenada → no se pueden mapear ni cruzar espacialmente.
3. **Corregir placas duplicadas:** 7 códigos repetidos (Gestar Green 9/16/17/27/44/54 y Solano 681). Ver hoja "No ingresados".
4. **Predios sin familia:** dar de alta como predio/familia los que faltan (todo Solano, Escuela Bosque, Gestar Green, Wilder Mahecha) para tener su área y enlazar `familia_id`.
5. **Cargar los polígonos** (finca/conservación, ya existen los 17 .zip) a `geo.zonas` para densidad real y cruces espaciales.

### 7.2 En Vivero

1. **Corregir errores de escritura** de nombres científicos (8): `Couropita`→*Couroupita*, `Clarisia rasemosa`→*racemosa*, `Bixa orelllana`→*orellana*, `Enterolobium shomburki`→*schomburgkii*, `Cariodendrum orinocensis`→*Caryodendron orinocense*, `Theobroma grandiflora`→*grandiflorum*, `Zigia longifilia`→*Zygia longifolia*, `Pouroma`→*Pourouma*.
2. **Alinear las especies al maestro** `catalogo.especies` (mismo `especie_id`) para que vivero, plan y RAS hablen el mismo idioma.
3. **Aprovechar lo que vivero ya tiene** y RAS no: **rol sucesional** y **tipo de almacenamiento de semilla** (para ~31 especies).

### 7.3 Maestro compartido `catalogo.especies` (lo que une vivero + RAS)

Estructura canónica por especie (lo que **todas deberían tener**) y de dónde sale hoy:

| Campo | Lo tienen | Falta pedir a la botánica |
|---|---|---|
| nombre científico, género, epíteto, familia, nombre común | casi todas | completar 244 determinaciones |
| autor, descripción, usos, foto | solo catálogo (97) | ficha de las 39 especies fuera de catálogo |
| **rol sucesional** (pionera/intermedia/tardía) | ~31 (vivero) | el resto |
| **categoría de amenaza** (UICN / Res. 1912 de 2017) | nadie | **todas** |
| CITES | casi vacío | revisar |
| hábito (árbol/palma/…) | implícito | normalizar |
| tipo de semilla, semillas/kg, % germinación, días | ~31 (vivero) | el resto (para vivero/plan) |
| aplica Ley del árbol | nadie | definir |

> La plantilla por especie con celdas verdes/rojas (qué tiene / qué falta) está en `estructura_especies.xlsx` (hoja "Especies determinadas") y la lista de determinaciones pendientes en "Por determinar". Es lo que se le entrega a la botánica para completar.

---

## 8. Archivos relacionados

- `migracion_RAS_arboles.xlsx` — hoja **Migrar ahora** (819 árboles), **No ingresados** (8), **Indicadores por predio**.
- `docs/sql/migration_ras_arboles.sql` — tabla `ras.arboles_semilleros` + vista `ras.v_indicadores_predio`.
- `estructura_especies.xlsx` — estructura y vacíos por especie.
- `ARQUITECTURA_DATOS.md` §2.3 (`catalogo.especies`) y §4 (dominio Conservación / RAS).
