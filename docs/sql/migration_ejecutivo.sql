-- ============================================================
-- MIGRACIÓN: Schema ejecutivo — Sesiones e Indicaciones
-- Proyecto: Intranet Amazonia Emprende
-- Fecha: Mayo 2026
-- ============================================================

CREATE SCHEMA IF NOT EXISTS ejecutivo;

-- ─── Tabla: sesiones ─────────────────────────────────────────────────────────

CREATE TABLE ejecutivo.sesiones (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ejecutivo_id UUID NOT NULL REFERENCES people.user_profiles(id) ON DELETE CASCADE,
  persona_id   UUID NOT NULL REFERENCES people.user_profiles(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL,
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  notas        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Tabla: indicaciones ─────────────────────────────────────────────────────

CREATE TABLE ejecutivo.indicaciones (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sesion_id   UUID NOT NULL REFERENCES ejecutivo.sesiones(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  plataforma  TEXT,
  estado      TEXT NOT NULL DEFAULT 'pendiente'
                CHECK (estado IN ('pendiente', 'hecho', 'cancelado')),
  orden       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_sesiones_ejecutivo ON ejecutivo.sesiones(ejecutivo_id);
CREATE INDEX idx_sesiones_persona   ON ejecutivo.sesiones(persona_id);
CREATE INDEX idx_sesiones_fecha     ON ejecutivo.sesiones(fecha DESC);
CREATE INDEX idx_indicaciones_sesion ON ejecutivo.indicaciones(sesion_id);

-- ─── Triggers updated_at ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION ejecutivo.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sesiones_updated_at
  BEFORE UPDATE ON ejecutivo.sesiones
  FOR EACH ROW EXECUTE FUNCTION ejecutivo.set_updated_at();

CREATE TRIGGER trg_indicaciones_updated_at
  BEFORE UPDATE ON ejecutivo.indicaciones
  FOR EACH ROW EXECUTE FUNCTION ejecutivo.set_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE ejecutivo.sesiones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ejecutivo.indicaciones ENABLE ROW LEVEL SECURITY;

-- La autorización real se maneja en las API routes (service_role bypass RLS).
-- Estas políticas son defensivas para acceso directo autenticado.
CREATE POLICY "sesiones_select" ON ejecutivo.sesiones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "indicaciones_select" ON ejecutivo.indicaciones
  FOR SELECT TO authenticated USING (true);

-- ─── Permisos ─────────────────────────────────────────────────────────────────

GRANT USAGE ON SCHEMA ejecutivo TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ejecutivo
  TO authenticated, service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA ejecutivo
  TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA ejecutivo
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA ejecutivo
  GRANT USAGE ON SEQUENCES TO authenticated, service_role;
