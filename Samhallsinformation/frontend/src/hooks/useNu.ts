import { useEffect, useState } from 'react'

// Nuvarande tid (ms) som state istället för Date.now() direkt i render — render
// ska vara ren (react-hooks/purity), och värdet tickar ändå fram så tidsstyrda
// villkor (t.ex. en banderolls start/slut) slår om utan att sidan laddas om.
export function useNu(intervallMs = 60_000) {
  const [nu, setNu] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNu(Date.now()), intervallMs)
    return () => clearInterval(t)
  }, [intervallMs])

  return nu
}
