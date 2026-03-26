'use client'
import { useState } from 'react'
import { ShieldCheck, FileText, CheckCircle2, Loader2, AlertCircle, ExternalLink } from 'lucide-react'

const PRIMARY = '#0d7377'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
      <AlertCircle size={11} /> {message}
    </p>
  )
}

const inputCls    = 'w-full px-3 py-2.5 text-sm border-2 border-stone-200 rounded-xl focus:outline-none focus:border-primary bg-white transition-colors'
const inputErrCls = 'w-full px-3 py-2.5 text-sm border-2 border-red-300 rounded-xl focus:outline-none focus:border-red-500 bg-white transition-colors'

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
      <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-xl border border-stone-200 p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: '#0d737720' }}>
            <CheckCircle2 size={40} style={{ color: PRIMARY }} />
          </div>
          <h1 className="text-2xl font-black text-stone-900 mb-2">¡Firma registrada!</h1>
          <p className="text-stone-500 text-sm leading-relaxed">
            Tu consentimiento de tratamiento de datos ha sido guardado exitosamente.
            Gracias por tu tiempo.
          </p>
        </div>
      </div>
    )
  }

  // ── Formulario ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 to-stone-100 py-10 px-4">
      <div className="max-w-lg mx-auto">

        {/* Encabezado */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: '#0d737715' }}>
            <ShieldCheck size={32} style={{ color: PRIMARY }} />
          </div>
          <h1 className="text-2xl font-black text-stone-900 mb-1">Consentimiento de Datos</h1>
          <p className="text-sm text-stone-500 max-w-sm mx-auto">
            Completa el formulario y acepta los documentos para registrar tu autorización de tratamiento de datos personales.
          </p>
        </div>

        {/* Tarjeta del formulario */}
        <div className="bg-white rounded-3xl shadow-lg border border-stone-200 p-7">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Error general */}
            {errors.general && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">
                <AlertCircle size={14} /> {errors.general}
              </div>
            )}

            {/* Datos personales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1.5">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.nombre}
                  onChange={(e) => set('nombre', e.target.value)}
                  className={errors.nombre ? inputErrCls : inputCls}
                  placeholder="Tu nombre"
                />
                <FieldError message={errors.nombre} />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1.5">
                  Apellido <span className="text-red-500">*</span>
                </label>
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
              <label className="block text-sm font-bold text-stone-700 mb-1.5">
                Cédula <span className="text-red-500">*</span>
              </label>
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
              <label className="block text-sm font-bold text-stone-700 mb-1.5">
                Celular <span className="text-red-500">*</span>
              </label>
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
              <label className="block text-sm font-bold text-stone-700 mb-1.5">
                Correo electrónico <span className="text-red-500">*</span>
              </label>
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

            {/* Divisor */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-stone-200" />
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-widest whitespace-nowrap">Documentos</span>
              <div className="flex-1 h-px bg-stone-200" />
            </div>

            {/* Checkbox 1 — Tratamiento de datos */}
            <div className={`rounded-xl border-2 p-4 transition-all ${errors.acepta_tratamiento ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-stone-50'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_tratamiento}
                  onChange={(e) => set('acepta_tratamiento', e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all pointer-events-none ${
                    form.acepta_tratamiento
                      ? 'border-primary bg-primary'
                      : errors.acepta_tratamiento ? 'border-red-400 bg-white' : 'border-stone-300 bg-white'
                  }`}>
                  {form.acepta_tratamiento && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-sm text-stone-700 leading-relaxed">
                  He leído y acepto el{' '}
                  <a
                    href="/docs/tratamiento-datos.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline decoration-2 inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                    style={{ color: PRIMARY }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Tratamiento de Datos Personales <ExternalLink size={11} />
                  </a>
                </span>
              </label>
              <FieldError message={errors.acepta_tratamiento} />
            </div>

            {/* Checkbox 2 — Políticas */}
            <div className={`rounded-xl border-2 p-4 transition-all ${errors.acepta_politicas ? 'border-red-300 bg-red-50' : 'border-stone-200 bg-stone-50'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acepta_politicas}
                  onChange={(e) => set('acepta_politicas', e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all pointer-events-none ${
                    form.acepta_politicas
                      ? 'border-primary bg-primary'
                      : errors.acepta_politicas ? 'border-red-400 bg-white' : 'border-stone-300 bg-white'
                  }`}>
                  {form.acepta_politicas && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="text-sm text-stone-700 leading-relaxed">
                  He leído y acepto las{' '}
                  <a
                    href="/docs/politica-datos.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold underline decoration-2 inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
                    style={{ color: PRIMARY }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Políticas de Tratamiento de Datos <ExternalLink size={11} />
                  </a>
                </span>
              </label>
              <FieldError message={errors.acepta_politicas} />
            </div>

            {/* Botón enviar */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-black text-white shadow-sm hover:shadow-md transition-all disabled:opacity-60"
              style={{ backgroundColor: PRIMARY }}
            >
              {submitting
                ? <><Loader2 size={16} className="animate-spin" /> Enviando…</>
                : <><FileText size={16} /> Registrar mi consentimiento</>
              }
            </button>

            <p className="text-center text-[11px] text-stone-400 leading-relaxed">
              Al enviar este formulario autorizas a Amazonia Emprende para el tratamiento
              de tus datos personales conforme a la normativa colombiana de protección de datos.
            </p>

          </form>
        </div>

        <p className="text-center text-xs text-stone-400 mt-6">
          © {new Date().getFullYear()} Amazonia Emprende
        </p>
      </div>
    </div>
  )
}
