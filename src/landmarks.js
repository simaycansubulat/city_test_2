// Weimar landmarks inside the city kit, with their holographic guides.
//
// Locations: OpenStreetMap (Nominatim), looked up once while building the app and stored here, so the
// app itself fetches nothing. Each one was checked against the kit: every building landmark falls
// inside a building footprint of buildings.geojson; Goetheplatz and the Hauptbahnhof forecourt are open
// squares. The texts are short summaries of well-documented history. The guides are holograms: their
// faces are stylised drawings, not portraits.

export const LANDMARKS = [
  {
    id: 'goethe-house',
    name: "Goethe's House",
    place: 'Frauenplan 1',
    lonlat: [11.32874, 50.97756],
    kind: 'culture',
    guide: { name: 'Johann Wolfgang von Goethe', years: '1749–1832', role: 'poet, scientist, minister', look: 'goethe', voice: 'male' },
    lines: [
      'Welcome to my house on the Frauenplan. I am Johann Wolfgang von Goethe.',
      'I came to Weimar in 1775 at the invitation of the young Duke Carl August, and I stayed for the rest of my life.',
      'I lived here from 1782, first as a tenant. In 1794 the Duke gave me the house, and here I worked on poems, plays, science and my Faust.',
      'I died in this house in March 1832. Since 1886 it has been a museum, part of the Goethe National Museum.',
    ],
  },
  {
    id: 'schiller-house',
    name: "Schiller's House",
    place: 'Schillerstraße 12',
    lonlat: [11.32781, 50.97912],
    kind: 'culture',
    guide: { name: 'Friedrich Schiller', years: '1759–1805', role: 'poet, playwright, historian', look: 'schiller', voice: 'male' },
    lines: [
      'Good evening. I am Friedrich Schiller.',
      'I moved to Weimar in 1799 to be close to the theatre and to my friend Goethe.',
      'In 1802 I bought this house. Up in my study under the roof I wrote William Tell.',
      'I died here in May 1805, at only forty-five. Today the house is a museum.',
    ],
  },
  {
    id: 'national-theatre',
    name: 'German National Theatre',
    place: 'Theaterplatz 2',
    lonlat: [11.32476, 50.97963],
    kind: 'culture',
    guide: { name: 'Friedrich Ebert', years: '1871–1925', role: 'first President of the German Reich', look: 'ebert', voice: 'male' },
    lines: [
      'I am Friedrich Ebert. This theatre carries two stories.',
      'Its court theatre was directed by Goethe for more than twenty-five years. In front of it stands the Goethe and Schiller Monument by Ernst Rietschel, unveiled in 1857.',
      'In 1919 the German National Assembly met in this building. Here it elected me the first President of the Reich, and here it adopted the new constitution.',
      'That is why Germany’s first democracy is called the Weimar Republic.',
    ],
  },
  {
    id: 'bauhaus-museum',
    name: 'Bauhaus-Museum',
    place: 'Stéphane-Hessel-Platz 1',
    lonlat: [11.32438, 50.98477],
    kind: 'culture',
    guide: { name: 'Walter Gropius', years: '1883–1969', role: 'architect, founder of the Bauhaus', look: 'gropius', voice: 'male' },
    lines: [
      'I am Walter Gropius. In 1919 I founded the Bauhaus here in Weimar.',
      'We wanted art, craft and industry to work together, for buildings and everyday things alike.',
      'In 1925 the school had to leave Weimar and moved to Dessau.',
      'This museum opened in 2019, a hundred years after the founding, to show the work of the Weimar Bauhaus.',
    ],
  },
  {
    id: 'bauhaus-university',
    name: 'Van de Velde Building',
    place: 'Geschwister-Scholl-Straße 8',
    lonlat: [11.32916, 50.97458],
    kind: 'education',
    guide: { name: 'Henry van de Velde', years: '1863–1957', role: 'architect and designer', look: 'vandevelde', voice: 'male' },
    lines: [
      'I am Henry van de Velde, an architect from Belgium.',
      'I designed this building for the Grand Ducal art school, built between 1904 and 1911, with its great studio windows.',
      'In 1919 the Bauhaus began in these rooms. Today it is the main building of the Bauhaus-Universität Weimar.',
      'Since 1996 it has been part of the UNESCO World Heritage site of the Bauhaus.',
    ],
  },
  {
    id: 'herderkirche',
    name: 'Herderkirche',
    place: 'Herderplatz',
    lonlat: [11.32925, 50.98122],
    kind: 'culture',
    guide: { name: 'Johann Gottfried Herder', years: '1744–1803', role: 'philosopher, preacher', look: 'herder', voice: 'male' },
    lines: [
      'I am Johann Gottfried Herder. This is the town church of Saint Peter and Paul, which people now call by my name.',
      'In 1776 I came to Weimar as general superintendent and preached from this pulpit for almost thirty years.',
      'Inside stands the great altarpiece begun by Lucas Cranach the Elder and finished by his son in 1555.',
      'I was buried here in 1803.',
    ],
  },
  {
    id: 'anna-amalia-library',
    name: 'Duchess Anna Amalia Library',
    place: 'Platz der Demokratie 1',
    lonlat: [11.33211, 50.97866],
    kind: 'culture',
    guide: { name: 'Duchess Anna Amalia', years: '1739–1807', role: 'regent and patron of the arts', look: 'annaamalia', voice: 'female' },
    lines: [
      'I am Anna Amalia, Duchess of Saxe-Weimar and Eisenach.',
      'In the 1760s I had this palace turned into a library for the ducal books, with its famous Rococo hall.',
      'Later, Goethe himself supervised the library for many years.',
      'In 2004 a fire destroyed tens of thousands of books. The hall was restored and reopened in 2007.',
    ],
  },
  {
    id: 'liszt-house',
    name: 'Liszt House',
    place: 'Marienstraße 17',
    lonlat: [11.32999, 50.97488],
    kind: 'culture',
    guide: { name: 'Franz Liszt', years: '1811–1886', role: 'composer and pianist', look: 'liszt', voice: 'male' },
    lines: [
      'I am Franz Liszt. In 1848 I settled in Weimar as court music director.',
      'Later I returned every year, and from 1869 I lived here, in the former court gardener’s house.',
      'Young pianists came from all over Europe to play for me in this room.',
      'Today the house is a museum, with my piano and my rooms.',
    ],
  },
  {
    id: 'cranach-house',
    name: 'Cranach House',
    place: 'Markt 11',
    lonlat: [11.33034, 50.97938],
    kind: 'culture',
    guide: { name: 'Lucas Cranach the Elder', years: '1472–1553', role: 'painter', look: 'cranach', voice: 'male' },
    lines: [
      'I am Lucas Cranach, painter to the Electors of Saxony.',
      'In 1552 I followed my prince, John Frederick, to Weimar, after his long captivity.',
      'I spent the last year of my life in this Renaissance house on the market square, and died here in 1553.',
      'You can find my altarpiece in the town church nearby.',
    ],
  },
  {
    id: 'city-palace',
    name: 'City Palace',
    place: 'Burgplatz 4',
    lonlat: [11.3328, 50.98066],
    kind: 'culture',
    guide: { name: 'Duke Carl August', years: '1757–1828', role: 'Duke, later Grand Duke', look: 'carlaugust', voice: 'male' },
    lines: [
      'I am Carl August, Duke of Saxe-Weimar and Eisenach, from 1815 Grand Duke.',
      'This palace was our residence. In 1774 it burned down.',
      'Rebuilding took decades, and my friend Goethe sat on the building commission.',
      'It was I who invited Goethe to Weimar, and with him the age we now call Classical Weimar began.',
    ],
  },
  {
    id: 'goetheplatz',
    name: 'Goetheplatz',
    place: 'central bus stop',
    lonlat: [11.32523, 50.98168],
    kind: 'transport',
    guide: { name: 'Weimar Transit Guide', years: '2077', role: 'imagined transit assistant', look: 'ai', voice: 'female' },
    lines: [
      'Welcome to Goetheplatz, the heart of Weimar’s city bus network today.',
      'Most city bus lines meet here, and many run north to the Hauptbahnhof.',
      'In this imagined 2077, maglev lines rise above the real streets from this square.',
      'Please note: the maglev and the flying vehicles are a vision, not a plan.',
    ],
  },
  {
    id: 'hauptbahnhof',
    name: 'Hauptbahnhof',
    place: 'station forecourt',
    lonlat: [11.32789, 50.99103],
    kind: 'transport',
    guide: { name: 'Weimar Transit Guide', years: '2077', role: 'imagined transit assistant', look: 'ai', voice: 'female' },
    lines: [
      'This is the forecourt of Weimar Hauptbahnhof, the main railway station, at the northern edge of the map.',
      'Trains connect Weimar with Erfurt, Jena, Leipzig and beyond. City buses run from here into the old town.',
      'In this imagined 2077, the northern maglev line ends here.',
    ],
  },
]

// Projected positions, the building each landmark stands in (if any), and its height
export function prepareLandmarks(city) {
  const inRing = ([px, py], ring) => {
    let c = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  return LANDMARKS.map((l) => {
    const [x, y] = city.project(l.lonlat)
    const building = city.buildings.findIndex((b) => inRing([x, y], b.rings[0]))
    const h = building >= 0 ? city.buildings[building].height : 0
    return { ...l, x, y, building, h }
  })
}
