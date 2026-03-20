export interface FormField {
  value: string
  saved: boolean
  error: string
}

export function makeField(initial: string): FormField {
  return { value: initial, saved: false, error: '' }
}

export const inputClass = `
  w-full bg-slate-50 text-slate-900 text-sm px-4 py-3 rounded-xl
  border border-slate-200 focus:outline-none focus:border-violet-400 focus:bg-white
  placeholder-slate-400 transition-colors
`
