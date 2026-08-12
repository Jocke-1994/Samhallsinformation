// Client-id är publikt (inte hemligt) — men saknas den lokalt/i preview ska
// Google-inloggning bara döljas istället för att krascha, se main.tsx.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
