// Slår ihop pushar om samma sak (t.ex. samma källa) till EN notis med
// summerat antal. Laddas av sw.js via importScripts och testas i
// src/test/sw-notisgrupp.test.ts.
//
// Varför: när en enhet varit avstängd levererar pushtjänsten alla pushar som
// köats på en gång, en per ingestor-körning (var 5:e minut). Utan det här blev
// varje push en egen notis ("2 nya händelser från Trafikverket", sedan nästa,
// och så vidare).

// Inom det här fönstret uppdateras en befintlig notis tyst i stället för att
// plinga igen, så att en flod av köade pushar bara aviserar en gång.
const TYST_UPPDATERING_MS = 2 * 60 * 1000

// data: pushens payload. befintlig: data-fältet på en redan visad notis med
// samma tag, eller null. nu: tidpunkt i ms.
// Returnerar null om pushen inte ska grupperas (saknar grupp).
function byggGrupperadNotis(data, befintlig, nu) {
  const grupp = data && data.grupp
  if (!grupp || !grupp.tag) return null

  const tidigareAntal = befintlig && befintlig.antal > 0 ? befintlig.antal : 0
  const antal = tidigareAntal + (grupp.antal > 0 ? grupp.antal : 1)
  const sammanslagen = tidigareAntal > 0

  const senast = sammanslagen ? befintlig.senastAviseradAt : undefined
  const tyst = sammanslagen && typeof senast === 'number' && nu - senast < TYST_UPPDATERING_MS

  return {
    tag: grupp.tag,
    body: sammanslagen ? `${antal} nya händelser ${grupp.etikett}` : data.body || '',
    renotify: !tyst,
    data: {
      url: (sammanslagen ? grupp.url : data.url) || '/',
      antal,
      senastAviseradAt: tyst ? senast : nu,
    },
  }
}

self.byggGrupperadNotis = byggGrupperadNotis
