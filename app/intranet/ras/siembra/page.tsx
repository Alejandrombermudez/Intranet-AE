import { redirect } from 'next/navigation'

/**
 * El módulo de Siembra se mudó a `/intranet/siembra` (2026-09-20).
 *
 * Vivía aquí abajo de `ras/` aunque no tiene nada que ver con Conservación:
 * lee `siembra.*`, no `ras.*`. Esto queda para que un marcador guardado o un
 * enlace viejo en un correo no muera en un 404.
 *
 * Se puede borrar cuando el rename de `ras` → `conservacion` se haga completo.
 */
export default function SiembraMudada() {
  redirect('/intranet/siembra')
}
