// Lättviktig mock-användarlista, delad mellan Anvandare.tsx (Användarhantering)
// och Handelsesok.tsx ("Spara till användare"-väljaren). Egen fil istället för
// att exportera från Anvandare.tsx, eftersom en komponentfil bara får exportera
// komponenter (react-refresh/only-export-components).
//
// OBS: id/namn/epost måste matcha INITIAL_ANVÄNDARE i Anvandare.tsx — båda är
// mockdata i väntan på riktiga användare (samma begränsning som MOCK_POLISEN_FILTER).

export interface MockAnvändareMini {
  id:    number
  namn:  string
  epost: string
}

export const MOCK_ANVÄNDARE_LISTA: MockAnvändareMini[] = [
  { id: 1,  namn: 'Joakim Rehn',      epost: 'joakim@example.com'     },
  { id: 2,  namn: 'Anna Svensson',    epost: 'anna.svensson@mail.se'  },
  { id: 3,  namn: 'Erik Lindqvist',   epost: 'erik.l@gmail.com'       },
  { id: 4,  namn: 'Maria Johansson',  epost: 'maria.j@outlook.com'    },
  { id: 5,  namn: 'Lars Petersson',   epost: 'lars.p@hotmail.com'     },
  { id: 6,  namn: 'Sofia Nilsson',    epost: 'sofia.n@gmail.com'      },
  { id: 7,  namn: 'Johan Karlsson',   epost: 'johan.k@company.se'     },
  { id: 8,  namn: 'Karin Andersson',  epost: 'karin.a@mail.se'        },
  { id: 9,  namn: 'Magnus Bergström', epost: 'magnus.b@gmail.com'     },
  { id: 10, namn: 'Lena Holm',        epost: 'lena.h@outlook.com'     },
]
