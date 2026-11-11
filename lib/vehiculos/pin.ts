import crypto from 'node:crypto'

// El PIN solo son 4 dígitos: la huella no lo hace seguro por sí sola, lo que protege es el
// bloqueo tras 5 intentos fallidos (ver api/entrar). scrypt evita que la huella sea trivial de leer.

export function esPinValido(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4}$/.test(pin)
}

export function hacerHuella(pin: string): string {
  const sal = crypto.randomBytes(16)
  const hash = crypto.scryptSync(pin, sal, 32)
  return `${sal.toString('hex')}:${hash.toString('hex')}`
}

export function pinCoincide(pin: string, huella: string): boolean {
  const [salHex, hashHex] = huella.split(':')
  if (!salHex || !hashHex) return false
  const esperado = Buffer.from(hashHex, 'hex')
  const calculado = crypto.scryptSync(pin, Buffer.from(salHex, 'hex'), esperado.length)
  return crypto.timingSafeEqual(esperado, calculado)
}
