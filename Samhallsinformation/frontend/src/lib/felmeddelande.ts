// Gör ett fångat fel till en text som är säker att visa för en medborgare.
//
// API-lagret (src/api/) kastar Error med serverns egna svenska klartext när
// backend skickar { error } — den texten är avsedd för användaren. I övrigt är
// meddelandet tekniskt: "saveUserSources: 500" när servern svarar utan text,
// och TypeError ("Failed to fetch" / "Load failed") när nätverket faller. Sådant
// ska aldrig visas rått, då får användaren i stället `reserv` (en svensk text
// som skrivits för just den handlingen).
const TEKNISKT_STATUSFEL = /^\w+: \d{3}$/

// Anrop som inte svarat inom tidsgränsen (api/hamta.ts, eller webbläsarens egen
// AbortSignal.timeout vars text är engelsk) visas alltid med den här texten.
export const TIDSGRANS_TEXT = 'Servern svarade inte i tid. Försök igen.'

export function visaFel(fel: unknown, reserv: string): string {
  if (fel instanceof Error && fel.name === 'TimeoutError') return TIDSGRANS_TEXT
  if (!(fel instanceof Error) || fel instanceof TypeError) return reserv
  const text = fel.message.trim()
  if (text === '' || TEKNISKT_STATUSFEL.test(text)) return reserv
  return text
}
