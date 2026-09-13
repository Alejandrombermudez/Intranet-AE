'use client'
import { useState } from 'react'
import { FileText, CheckCircle2, Loader2, AlertCircle, ExternalLink } from 'lucide-react'
import { Cabecera, Contenido, Rotulo, Boton, Firma } from '@/app/components/marca'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
      <AlertCircle size={11} /> {message}
    </p>
  )
}

/** Etiqueta de campo en versalitas, como las fichas del informe de Reporte. */
function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[.14em] text-stone-600">
      {children} <span className="text-red-600">*</span>
    </label>
  )
}

const inputCls    = 'w-full border border-stone-300 bg-white px-3 py-2.5 text-sm transition-colors placeholder:text-stone-400 focus:border-bosque focus:outline-none'
const inputErrCls = 'w-full border border-red-400 bg-white px-3 py-2.5 text-sm transition-colors placeholder:text-stone-400 focus:border-red-600 focus:outline-none'

// ─── Página ───────────────────────────────────────────────────────────────────

export default function ConsentimientoPage() {
  const [form, setForm] = useState({
    nombre: '', apellido: '', cedula: '', celular: '', correo: '',
    acepta_tratamiento: false,
    acepta_politicas: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const set = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.nombre.trim())                       errs.nombre    = 'El nombre es requerido'
    if (!form.apellido.trim())                     errs.apellido  = 'El apellido es requerido'
    if (form.cedula.trim().length < 4)             errs.cedula    = 'Ingresa un número de cédula válido'
    if (form.celular.trim().length < 7)            errs.celular   = 'Ingresa un número de celular válido'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.correo)) errs.correo = 'Ingresa un correo electrónico válido'
    if (!form.acepta_tratamiento) errs.acepta_tratamiento = 'Debes leer y aceptar el documento'
    if (!form.acepta_politicas)   errs.acepta_politicas   = 'Debes leer y aceptar las políticas'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/consentimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const err = await res.json().catch(() => ({}))
        setErrors({ general: err.error ?? 'Error al enviar. Intenta de nuevo.' })
      }
    } catch {
      setErrors({ general: 'Error de conexión. Verifica tu internet.' })
    } finally {
      setSubmitting(false)
    }
  }

  // ── Pantalla de éxito ──
  if (done) {
    return (
      <div className="grid min-h-screen place-items-center bg-papel px-6">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 size={38} strokeWidth={1.5} className="mx-auto mb-5 text-bosque" />
          <Rotulo tono="bosque" className="mb-3">Consentimiento registrado</Rotulo>
          <h1 className="mb-3 font-display text-3xl font-bold text-stone-900">¡Firma registrada!</h1>
          <p className="text-sm font-light leading-relaxed text-stone-600">
            Tu consentimiento de tratamiento de datos ha sido guardado exitosamente.
            Gracias por tu tiempo.
          </p>
          <Firma className="mt-12 justify-center text-stone-500" />
        </div>
      </div>
    )
  }

  // ── Formulario ──
  return (
    <div className="min-h-screen bg-papel">
      <Cabecera
        ancho="estrecho"
        modulo="Protección de datos personales"
        titulo="Consentimiento de datos"
        descripcion="Completa el formulario y acepta los documentos para registrar tu autorización de tratamiento de datos personales."
      />

      <Contenido ancho="estrecho">
        <form onSubmit={handleSubmit} noValidate className="max-w-xl space-y-9">

          {/* Error general */}
          {errors.general && (
            <div className="flex items-center gap-2 border-l-2 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertCircle size={14} /> {errors.general}
            </div>
          )}

          {/* ── Datos personales ── */}
          <div>
            <Rotulo tono="bosque" className="mb-4">Tus datos</Rotulo>
            <div className="space-y-5 border-t border-linea pt-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <Etiqueta>Nombre</Etiqueta>
                  <input
                    value={form.nombre}
                    onChange={(e) => set('nombre', e.target.value)}
                    className={errors.nombre ? inputErrCls : inputCls}
                    placeholder="Tu nombre"
                  />
                  <FieldError message={errors.nombre} />
                </div>
                <div>
                  <Etiqueta>Apellido</Etiqueta>
                  <input
                    value={form.apellido}
                    onChange={(e) => set('apellido', e.target.value)}
                    className={errors.apellido ? inputErrCls : inputCls}
                    placeholder="Tu apellido"
                  />
                  <FieldError message={errors.apellido} />
                </div>
              </div>

              <div>
                <Etiqueta>Cédula</Etiqueta>
                <input
                  value={form.cedula}
                  onChange={(e) => set('cedula', e.target.value.replace(/\D/g, ''))}
                  className={errors.cedula ? inputErrCls : inputCls}
                  placeholder="Número de cédula"
                  inputMode="numeric"
                />
                <FieldError message={errors.cedula} />
              </div>

              <div>
                <Etiqueta>Celular</Etiqueta>
                <input
                  value={form.celular}
                  onChange={(e) => set('celular', e.target.value.replace(/[^\d+\s-]/g, ''))}
                  className={errors.celular ? inputErrCls : inputCls}
                  placeholder="Número de celular"
                  inputMode="tel"
                />
                <FieldError message={errors.celular} />
              </div>

              <div>
                <Etiqueta>Correo electrónico</Etiqueta>
                <input
                  type="email"
                  value={form.correo}
                  onChange={(e) => set('correo', e.target.value)}
                  className={errors.correo ? inputErrCls : inputCls}
                  placeholder="correo@ejemplo.com"
                  inputMode="email"
                />
                <FieldError message={errors.correo} />
              </div>
            </div>
          </div>

          {/* ── Documentos ── */}
          <div>
            <Rotulo tono="bosque" className="mb-4">Documentos</Rotulo>
            <div className="space-y-3 border-t border-linea pt-5">

              {/* Checkbox 1 — Tratamiento de datos */}
              <div className={`border p-4 transition-colors ${errors.acepta_tratamiento ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-white'}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.acepta_tratamiento}
                    onChange={(e) => set('acepta_tratamiento', e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`pointer-events-none mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
                      form.acepta_tratamiento
                        ? 'border-bosque bg-bosque'
                        : errors.acepta_tratamiento ? 'border-red-400 bg-white' : 'border-stone-400 bg-white'
                    }`}>
                    {form.acepta_tratamiento && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm leading-relaxed text-stone-700">
                    He leído y acepto el{' '}
                    <a
                      href="/docs/tratamiento-datos.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-bosque underline decoration-1 underline-offset-2 transition-opacity hover:opacity-75"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Tratamiento de Datos Personales <ExternalLink size={11} />
                    </a>
                  </span>
                </label>
                <FieldError message={errors.acepta_tratamiento} />
              </div>

              {/* Checkbox 2 — Políticas */}
              <div className={`border p-4 transition-colors ${errors.acepta_politicas ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-white'}`}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.acepta_politicas}
                    onChange={(e) => set('acepta_politicas', e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`pointer-events-none mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border transition-colors ${
                      form.acepta_politicas
                        ? 'border-bosque bg-bosque'
                        : errors.acepta_politicas ? 'border-red-400 bg-white' : 'border-stone-400 bg-white'
                    }`}>
                    {form.acepta_politicas && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm leading-relaxed text-stone-700">
                    He leído y acepto las{' '}
                    <a
                      href="/docs/politica-datos.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-bosque underline decoration-1 underline-offset-2 transition-opacity hover:opacity-75"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Políticas de Tratamiento de Datos <ExternalLink size={11} />
                    </a>
                  </span>
                </label>
                <FieldError message={errors.acepta_politicas} />
              </div>
            </div>
          </div>

          {/* ── Envío ── */}
          <div className="space-y-4">
            <Boton
              type="submit"
              disabled={submitting}
              className="w-full py-3.5"
              icono={submitting ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
            >
              {submitting ? 'Enviando…' : 'Registrar mi consentimiento'}
            </Boton>

            <p className="text-[11px] font-light leading-relaxed text-stone-500">
              Al enviar este formulario autorizas a Amazonia Emprende para el tratamiento
              de tus datos personales conforme a la normativa colombiana de protección de datos.
            </p>
          </div>
        </form>

        <footer className="mt-14 flex max-w-xl items-center justify-between gap-4 border-t border-stone-200 pt-6 text-[10px] uppercase tracking-[.2em] text-stone-500">
          <span className="font-display">Inspirar · Nutrir · Actuar</span>
          <span>© {new Date().getFullYear()} Amazonia Emprende</span>
        </footer>
      </Contenido>
    </div>
  )
}
