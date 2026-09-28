// Query-nycklar för användarspecifik data. Användaren (e-post ur access-token,
// null när ingen är inloggad) ligger i nyckeln så att två användare på samma
// enhet aldrig delar cache-post. Prefixet (t.ex. 'user-sources') är oförändrat,
// så invalidateQueries({ queryKey: ['user-sources'] }) träffar fortfarande alla.
export type Anvandare = string | null

export const anvandarKallorNyckel = (a: Anvandare) => ['user-sources', a] as const
export const meNyckel = (a: Anvandare) => ['me', a] as const
export const minaArendenNyckel = (a: Anvandare) => ['my-tickets', a] as const
export const mittArendeNyckel = (a: Anvandare, id: string | number) => ['my-ticket', a, id] as const
export const kontoNotiserNyckel = (a: Anvandare) => ['user-notifications', a] as const
export const supportNotiserNyckel = (a: Anvandare) => ['support-notifications', a] as const
export const pushInstallningarNyckel = (a: Anvandare) => ['push-settings', a] as const

// Serverfiltrerade flöden (V3-11). Egna prefix (INTE 'events', som räknas som
// publikt och behålls vid utloggning): svaren beror på användarens källor,
// bevakningar och sparade händelser och rensas därför vid sessionsslut.
export const mittFlodeNyckel = (a: Anvandare) => ['mitt-flode', a] as const
export const sparatFlodeNyckel = (a: Anvandare) => ['sparat-flode', a] as const
