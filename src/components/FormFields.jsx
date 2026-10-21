/** field: {name,label,type: text|number|date|select|textarea, options?, required?, showIf?(values), hint?} */
export function Field({ f, form, options }) {
  const { register, formState: { errors } } = form
  const err = errors[f.name]?.message
  const opts = options ?? f.options ?? []
  return (
    <div className={f.type === 'textarea' ? 'md:col-span-2' : ''}>
      <label className="label">{f.label}{f.required && ' *'}</label>
      {f.type === 'select' ? (
        <select className="input" {...register(f.name)}><option value="">— اختر —</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}</select>
      ) : f.type === 'textarea' ? <textarea rows={2} className="input" {...register(f.name)} />
        : <input className="input" type={f.type || 'text'} step={f.type === 'number' ? 'any' : undefined} {...register(f.name)} />}
      {f.hint && <p className="text-[11px] text-slate-500 mt-1">{f.hint}</p>}
      {err && <p className="text-xs text-red-600 mt-1">{err}</p>}
    </div>
  )
}
