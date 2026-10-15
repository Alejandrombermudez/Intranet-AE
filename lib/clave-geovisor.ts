/**
 * Contraseñas de las cuentas del geovisor (people.usuarios_geovisor). SOLO servidor.
 *
 * La intranet crea las cuentas y guarda la huella; el geovisor la verifica al
 * iniciar sesión (GeoAE/lib/sesion.ts → verificarClave). El formato es un
 * contrato entre los dos repos:
 *
 *     scrypt$N$r$p$<sal en base64>$<huella en base64>
 *
 * Los parámetros viajan dentro de la huella, así que se pueden endurecer aquí
 * sin invalidar las cuentas que ya existen.
 */
import { randomBytes, scrypt } from 'node:crypto'

const N = 16384
const R = 8
const P = 1
const LARGO = 64

export const CLAVE_MINIMA = 10

export function huellaDeClave(clave: string): Promise<string> {
  const sal = randomBytes(16)
  return new Promise((resolver, rechazar) => {
    scrypt(clave, sal, LARGO, { N, r: R, p: P }, (error, derivada) => {
      if (error) rechazar(error)
      else resolver(`scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${derivada.toString('base64')}`)
    })
  })
}

/** Por qué una contraseña no sirve, o null si sirve. */
export function problemaDeClave(clave: unknown): string | null {
  if (typeof clave !== 'string' || clave.length < CLAVE_MINIMA) return `La contraseña debe tener al menos ${CLAVE_MINIMA} caracteres.`
  if (clave.length > 200) return 'La contraseña es demasiado larga.'
  if (clave !== clave.trim()) return 'La contraseña no puede empezar ni terminar con espacios.'
  return null
}

/** El usuario se guarda en minúsculas y sin espacios; puede ser un correo o un nombre corto. */
export function normalizarUsuario(crudo: unknown): { usuario: string } | { error: string } {
  const usuario = typeof crudo === 'string' ? crudo.trim().toLowerCase() : ''
  if (usuario.length < 3) return { error: 'El usuario debe tener al menos 3 caracteres.' }
  if (usuario.length > 120) return { error: 'El usuario es demasiado largo.' }
  if (!/^[a-z0-9._@+-]+$/.test(usuario)) return { error: 'El usuario solo puede llevar letras sin tilde, números y . _ - @ +' }
  return { usuario }
}
