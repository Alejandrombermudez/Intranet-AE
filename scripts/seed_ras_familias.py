"""
seed_ras_familias.py
====================
Lee 'Aliados RAS(Info_Predios).csv', transforma los campos al esquema
ras.familias de Supabase y sube los registros vía REST API.

Ejecución:
    python scripts/seed_ras_familias.py

Requisitos: solo librería estándar de Python (urllib + json).
"""

import csv
import json
import re
import urllib.request
import urllib.error
import os
import sys

# Forzar UTF-8 en consola Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Credenciales ──────────────────────────────────────────────────────────────
SUPABASE_URL = "https://lbxysovesmbgesxooghw.supabase.co"
SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not SERVICE_ROLE_KEY:
    sys.exit(
        "Falta SUPABASE_SERVICE_ROLE_KEY en el entorno.\n"
        "Ejemplo (PowerShell): $env:SUPABASE_SERVICE_ROLE_KEY = '...'"
    )

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "Aliados RAS(Info_Predios).csv")


# ── Helpers de parseo ─────────────────────────────────────────────────────────

def parse_decimal(value: str) -> float | None:
    """Convierte '46,2' o '46.2' a float. Retorna None si vacío o '-'."""
    v = value.strip().replace(",", ".").replace(" ", "")
    if not v or v == "-":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def parse_int(value: str) -> int | None:
    """Convierte cadena a int. Retorna None si vacío o '-'."""
    v = value.strip().replace(",", "").replace(".", "").replace(" ", "")
    if not v or v == "-":
        return None
    try:
        return int(float(v))
    except ValueError:
        return None


def parse_bool_yn(value: str) -> bool:
    """'Si' / 'Sí' → True; cualquier otra cosa → False."""
    return value.strip().lower() in ("si", "sí", "yes", "s")


def parse_ruta(value: str):
    """
    Extrae km y minutos del campo libre 'Ruta hacia Florencia/Morelia'.
    Ejemplos:
        '40km de Florencia. 1h30min'    → (40.0, 90)
        '34km de Florencia. 50 min'     → (34.0, 50)
        '10km entre Florencia. 15min'   → (10.0, 15)
        '42 km de Florenica 22km...'    → (42.0, 60)  (usa primer km)
    Retorna (km: float|None, minutos: int|None).
    """
    if not value.strip():
        return None, None

    # km: primer número seguido de "km"
    km_match = re.search(r"([\d,\.]+)\s*km", value, re.IGNORECASE)
    km = float(km_match.group(1).replace(",", ".")) if km_match else None

    # tiempo: buscar patrones como "1h30min", "1h 30min", "1h", "50 min", "45min"
    time_match = re.search(
        r"(\d+)\s*h(?:oras?)?\s*(\d+)?\s*min|(\d+)\s*min|(\d+)\s*h(?:oras?)?",
        value, re.IGNORECASE
    )
    minutos = None
    if time_match:
        if time_match.group(1) and time_match.group(2):   # Xh Ymin
            minutos = int(time_match.group(1)) * 60 + int(time_match.group(2))
        elif time_match.group(1) and not time_match.group(2):  # Xh solo
            minutos = int(time_match.group(1)) * 60
        elif time_match.group(3):                          # Xmin
            minutos = int(time_match.group(3))
        elif time_match.group(4):                          # Xh (grupo 4)
            minutos = int(time_match.group(4)) * 60

    return km, minutos


def transform_row(row: dict) -> dict:
    """Transforma una fila del CSV al dict para ras.familias."""

    km, minutos = parse_ruta(row.get("Ruta hacia Florencia/Morelia desde el predio (Distancia (km)/ tiempo (min))", ""))

    # acuerdo_conservacion: True si la celda tiene texto (no vacía)
    firma = row.get("Firma de acuerdo de conservación", "").strip()
    tiene_acuerdo = bool(firma) and firma.lower() not in ("", "-", "n/a")

    return {
        # ── Identificación ────────────────────────────────────────────────────
        "nombre_propietario":     row.get("Propietario ", "").strip(),
        "tipo_documento":         row.get("Documento de identificación", "").strip() or None,
        "numero_documento":       row.get("Número de identificación", "").strip() or None,
        "telefono":               row.get("Telefono de contacto", "").strip() or None,
        "nucleo":                 row.get("Núcleo", "").strip() or None,
        "departamento":           row.get("Departamento", "").strip() or None,
        "municipio":              row.get("Municipio", "").strip(),
        "vereda":                 row.get("Vereda", "").strip() or None,
        "nombre_finca":           row.get("Nombre del predio ", "").strip() or None,

        # ── Hogar & Economía ──────────────────────────────────────────────────
        "adultos":                parse_int(row.get("Cantidad de personas que viven en el predio", "")) or 0,
        "ninos":                  parse_int(row.get("Cantidad de niños", "")) or 0,
        "cant_mujeres":           parse_int(row.get("Cantidad de mujeres", "")) or 0,
        "cant_hombres":           parse_int(row.get("Cantidad de hombres", "")) or 0,
        "actividad_economica":    row.get("Actividad económica", "").strip() or None,
        "empleos_locales":        0,   # no presente en el CSV
        "tiene_espacio_vegetal":  parse_bool_yn(row.get("¿Cuenta con espacio para tratar el material vegetal?", "")),

        # ── Predio & Inventario ───────────────────────────────────────────────
        "ha_bosque":              parse_decimal(row.get("Área de bosque aproximada (ha)", "")) or 0.0,
        "ha_potreros":            parse_decimal(row.get("Área de no bosque (ha)", "")) or 0.0,
        "ha_otras":               0.0,
        "bajo_conservacion":      True,   # todos están en el programa
        "acuerdo_conservacion":   tiene_acuerdo,
        "num_individuos":         parse_int(row.get("Número de individuos", "")) or 0,
        "num_especies_inventario":parse_int(row.get("Número de especies", "")) or 0,
        "area_bosque_recorrida":  parse_decimal(row.get("Área de bosque recorrida (ha)", "")),
        "distancia_florencia_km": km,
        "tiempo_florencia_min":   minutos,

        # ── Conservación (defaults) ───────────────────────────────────────────
        "arboles_semilleros":     0,
        "especies_forestales":    0,

        # ── Biodiversidad (defaults) ──────────────────────────────────────────
        "otros_indices":          None,
    }


# ── Verificar registros existentes ────────────────────────────────────────────

def fetch_existing_names() -> set[str]:
    """Retorna el set de nombre_propietario ya en ras.familias."""
    url = f"{SUPABASE_URL}/rest/v1/familias?select=nombre_propietario"
    req = urllib.request.Request(url, headers={
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Accept-Profile": "ras",
    })
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            return {r["nombre_propietario"] for r in data if r.get("nombre_propietario")}
    except Exception as e:
        print(f"⚠️  No se pudo verificar registros existentes: {e}")
        return set()


# ── Insertar lote ─────────────────────────────────────────────────────────────

def insert_batch(records: list[dict]) -> tuple[int, list[str]]:
    """Inserta los registros vía REST API. Retorna (insertados, errores)."""
    url = f"{SUPABASE_URL}/rest/v1/familias"
    payload = json.dumps(records).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "apikey": SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
            "Content-Profile": "ras",
            "Prefer": "return=minimal",
        },
    )

    try:
        with urllib.request.urlopen(req) as resp:
            return len(records), []
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return 0, [f"HTTP {e.code}: {body}"]


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("📂 Leyendo CSV...")
    with open(CSV_PATH, encoding="cp1252") as f:
        reader = csv.DictReader(f, delimiter=";")
        rows = list(reader)

    # Renombrar columnas con caracteres especiales que pueden variar
    # cp1252 los lee bien, pero por si acaso normalizamos
    print(f"   {len(rows)} filas encontradas en el CSV.\n")

    print("🔍 Verificando registros existentes en ras.familias...")
    existing = fetch_existing_names()
    if existing:
        print(f"   Ya existen {len(existing)} propietario(s):")
        for name in sorted(existing):
            print(f"     • {name}")
    else:
        print("   Tabla vacía — se insertarán todos los registros.")

    print()

    records = []
    skipped = []

    for row in rows:
        transformed = transform_row(row)
        nombre = transformed["nombre_propietario"]

        if not nombre:
            skipped.append("(fila sin nombre de propietario)")
            continue

        if nombre in existing:
            skipped.append(f"  ↩  Ya existe: {nombre}")
            continue

        records.append(transformed)

    if skipped:
        print("⏭  Registros omitidos:")
        for s in skipped:
            print(f"     {s}")
        print()

    if not records:
        print("✅ No hay registros nuevos que insertar.")
        return

    print(f"📤 Insertando {len(records)} registro(s):")
    for r in records:
        print(f"   • {r['nombre_propietario']} — {r['municipio']}, {r['departamento']}")

    print()
    inserted, errors = insert_batch(records)

    if errors:
        print("❌ Error al insertar:")
        for err in errors:
            print(f"   {err}")
    else:
        print(f"✅ {inserted} familia(s) insertada(s) correctamente en ras.familias.")

    # Guardar JSON de respaldo
    json_path = os.path.join(os.path.dirname(__file__), "ras_familias_seed.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2, default=str)
    print(f"💾 Datos guardados en {json_path}")


if __name__ == "__main__":
    main()
