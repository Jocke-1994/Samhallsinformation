export type AppVersion = '1.0' | '1.1' | '1.2'

const VERSIONS: AppVersion[] = ['1.0', '1.1', '1.2']

export const APP_VERSION = (import.meta.env.VITE_APP_VERSION ?? '1.0') as AppVersion

export function versionAtLeast(min: AppVersion): boolean {
  return VERSIONS.indexOf(APP_VERSION) >= VERSIONS.indexOf(min)
}
