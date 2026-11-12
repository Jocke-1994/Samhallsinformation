import { useEffect } from 'react'

interface PwaIdentitet {
  manifestHref: string
  faviconHref: string
  themeColor: string
  appleTouchIconHref: string
  appleTitle: string
  title: string
}

const HUVUDAPP_IDENTITET: PwaIdentitet = {
  manifestHref: '/manifest.json',
  faviconHref: '/favicon.svg',
  themeColor: '#7c3aed',
  appleTouchIconHref: '/icons/apple-touch-icon.png',
  appleTitle: 'Samhällsinfo',
  title: 'Samhällsinformation — nyheter från svenska myndigheter',
}

export const ADMIN_PWA_IDENTITET: PwaIdentitet = {
  manifestHref: '/admin-manifest.json',
  faviconHref: '/admin-favicon.svg',
  themeColor: '#7c3aed',
  appleTouchIconHref: '/icons/admin-apple-touch-icon.png',
  appleTitle: 'SI Admin',
  title: 'Samhällsinfo Admin',
}

function sättIdentitet(identitet: PwaIdentitet) {
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', identitet.manifestHref)
  document.querySelector('link[rel="icon"]')?.setAttribute('href', identitet.faviconHref)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', identitet.themeColor)
  document
    .querySelector('link[rel="apple-touch-icon"]')
    ?.setAttribute('href', identitet.appleTouchIconHref)
  document
    .querySelector('meta[name="apple-mobile-web-app-title"]')
    ?.setAttribute('content', identitet.appleTitle)
  document.title = identitet.title
}

// Byter vilket manifest/ikon/namn browsern läser vid "Installera app" medan
// komponenten som anropar hooken är monterad. Används av AdminPage så att
// adminsidan går att installera som en egen app, skild från huvudappen.
// Återställer huvudappens identitet vid unmount.
export function usePwaIdentity(identitet: PwaIdentitet) {
  useEffect(() => {
    sättIdentitet(identitet)
    return () => sättIdentitet(HUVUDAPP_IDENTITET)
  }, [identitet])
}
