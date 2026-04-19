// scripts/generate-rehabber-seed.ts
//
// Deterministic generator for supabase/seed/rehabbers-nationwide.sql.
// Produces 5 fictional rehabbers per US state (250 rows) using:
//   - Real city coordinates (capital + largest-other city, alternated) with
//     small jitter so map markers don't stack.
//   - `.example.org` emails per RFC 2606.
//   - NANPA-reserved 555-0100..555-0199 phones (fictional use block).
//   - Plausible species scopes drawn from the 8 mapSpecies scopes.
//   - `marine` scope only for coastal states.
//
// Usage:
//   pnpm tsx scripts/generate-rehabber-seed.ts > supabase/seed/rehabbers-nationwide.sql
//
// Deterministic: seeded PRNG so every run produces identical SQL. Commit the
// generated SQL to the repo; do not regenerate per build.

type City = { name: string; lat: number; lng: number };
type StateEntry = {
  code: string;
  name: string;
  area: string;
  coastal: boolean;
  cities: [City, City];
};

const STATES: StateEntry[] = [
  { code: "AL", name: "Alabama",        area: "205", coastal: false, cities: [{ name: "Montgomery",  lat: 32.3668, lng: -86.3000 }, { name: "Birmingham",    lat: 33.5186, lng: -86.8104 }] },
  { code: "AK", name: "Alaska",         area: "907", coastal: true,  cities: [{ name: "Juneau",      lat: 58.3019, lng: -134.4197 }, { name: "Anchorage",    lat: 61.2181, lng: -149.9003 }] },
  { code: "AZ", name: "Arizona",        area: "602", coastal: false, cities: [{ name: "Phoenix",     lat: 33.4484, lng: -112.0740 }, { name: "Tucson",       lat: 32.2226, lng: -110.9747 }] },
  { code: "AR", name: "Arkansas",       area: "501", coastal: false, cities: [{ name: "Little Rock", lat: 34.7465, lng: -92.2896 }, { name: "Fayetteville",  lat: 36.0626, lng: -94.1574 }] },
  { code: "CA", name: "California",     area: "916", coastal: true,  cities: [{ name: "Sacramento",  lat: 38.5816, lng: -121.4944 }, { name: "Los Angeles",  lat: 34.0522, lng: -118.2437 }] },
  { code: "CO", name: "Colorado",       area: "303", coastal: false, cities: [{ name: "Denver",      lat: 39.7392, lng: -104.9903 }, { name: "Colorado Springs", lat: 38.8339, lng: -104.8214 }] },
  { code: "CT", name: "Connecticut",    area: "860", coastal: true,  cities: [{ name: "Hartford",    lat: 41.7658, lng: -72.6734 }, { name: "New Haven",     lat: 41.3083, lng: -72.9279 }] },
  { code: "DE", name: "Delaware",       area: "302", coastal: true,  cities: [{ name: "Dover",       lat: 39.1582, lng: -75.5244 }, { name: "Wilmington",    lat: 39.7391, lng: -75.5398 }] },
  { code: "FL", name: "Florida",        area: "850", coastal: true,  cities: [{ name: "Tallahassee", lat: 30.4383, lng: -84.2807 }, { name: "Miami",         lat: 25.7617, lng: -80.1918 }] },
  { code: "GA", name: "Georgia",        area: "404", coastal: true,  cities: [{ name: "Atlanta",     lat: 33.7490, lng: -84.3880 }, { name: "Savannah",      lat: 32.0809, lng: -81.0912 }] },
  { code: "HI", name: "Hawaii",         area: "808", coastal: true,  cities: [{ name: "Honolulu",    lat: 21.3099, lng: -157.8581 }, { name: "Hilo",         lat: 19.7074, lng: -155.0885 }] },
  { code: "ID", name: "Idaho",          area: "208", coastal: false, cities: [{ name: "Boise",       lat: 43.6150, lng: -116.2023 }, { name: "Idaho Falls",  lat: 43.4917, lng: -112.0340 }] },
  { code: "IL", name: "Illinois",       area: "312", coastal: false, cities: [{ name: "Springfield", lat: 39.7817, lng: -89.6501 }, { name: "Chicago",       lat: 41.8781, lng: -87.6298 }] },
  { code: "IN", name: "Indiana",        area: "317", coastal: false, cities: [{ name: "Indianapolis",lat: 39.7684, lng: -86.1581 }, { name: "Fort Wayne",    lat: 41.0793, lng: -85.1394 }] },
  { code: "IA", name: "Iowa",           area: "515", coastal: false, cities: [{ name: "Des Moines",  lat: 41.5868, lng: -93.6250 }, { name: "Cedar Rapids",  lat: 41.9779, lng: -91.6656 }] },
  { code: "KS", name: "Kansas",         area: "785", coastal: false, cities: [{ name: "Topeka",      lat: 39.0473, lng: -95.6752 }, { name: "Wichita",       lat: 37.6872, lng: -97.3301 }] },
  { code: "KY", name: "Kentucky",       area: "502", coastal: false, cities: [{ name: "Frankfort",   lat: 38.2009, lng: -84.8733 }, { name: "Louisville",    lat: 38.2527, lng: -85.7585 }] },
  { code: "LA", name: "Louisiana",      area: "225", coastal: true,  cities: [{ name: "Baton Rouge", lat: 30.4515, lng: -91.1871 }, { name: "New Orleans",   lat: 29.9511, lng: -90.0715 }] },
  { code: "ME", name: "Maine",          area: "207", coastal: true,  cities: [{ name: "Augusta",     lat: 44.3106, lng: -69.7795 }, { name: "Portland",      lat: 43.6591, lng: -70.2568 }] },
  { code: "MD", name: "Maryland",       area: "410", coastal: true,  cities: [{ name: "Annapolis",   lat: 38.9784, lng: -76.4922 }, { name: "Baltimore",     lat: 39.2904, lng: -76.6122 }] },
  { code: "MA", name: "Massachusetts",  area: "617", coastal: true,  cities: [{ name: "Boston",      lat: 42.3601, lng: -71.0589 }, { name: "Worcester",     lat: 42.2626, lng: -71.8023 }] },
  { code: "MI", name: "Michigan",       area: "517", coastal: false, cities: [{ name: "Lansing",     lat: 42.7325, lng: -84.5555 }, { name: "Detroit",       lat: 42.3314, lng: -83.0458 }] },
  { code: "MN", name: "Minnesota",      area: "651", coastal: false, cities: [{ name: "Saint Paul",  lat: 44.9537, lng: -93.0900 }, { name: "Minneapolis",   lat: 44.9778, lng: -93.2650 }] },
  { code: "MS", name: "Mississippi",    area: "601", coastal: true,  cities: [{ name: "Jackson",     lat: 32.2988, lng: -90.1848 }, { name: "Gulfport",      lat: 30.3674, lng: -89.0928 }] },
  { code: "MO", name: "Missouri",       area: "573", coastal: false, cities: [{ name: "Jefferson City", lat: 38.5767, lng: -92.1735 }, { name: "Kansas City",lat: 39.0997, lng: -94.5786 }] },
  { code: "MT", name: "Montana",        area: "406", coastal: false, cities: [{ name: "Helena",      lat: 46.5891, lng: -112.0391 }, { name: "Billings",     lat: 45.7833, lng: -108.5007 }] },
  { code: "NE", name: "Nebraska",       area: "402", coastal: false, cities: [{ name: "Lincoln",     lat: 40.8136, lng: -96.7026 }, { name: "Omaha",         lat: 41.2565, lng: -95.9345 }] },
  { code: "NV", name: "Nevada",         area: "775", coastal: false, cities: [{ name: "Carson City", lat: 39.1638, lng: -119.7674 }, { name: "Las Vegas",    lat: 36.1699, lng: -115.1398 }] },
  { code: "NH", name: "New Hampshire",  area: "603", coastal: true,  cities: [{ name: "Concord",     lat: 43.2081, lng: -71.5376 }, { name: "Manchester",    lat: 42.9956, lng: -71.4548 }] },
  { code: "NJ", name: "New Jersey",     area: "609", coastal: true,  cities: [{ name: "Trenton",     lat: 40.2206, lng: -74.7597 }, { name: "Newark",        lat: 40.7357, lng: -74.1724 }] },
  { code: "NM", name: "New Mexico",     area: "505", coastal: false, cities: [{ name: "Santa Fe",    lat: 35.6870, lng: -105.9378 }, { name: "Albuquerque",  lat: 35.0844, lng: -106.6504 }] },
  { code: "NY", name: "New York",       area: "518", coastal: true,  cities: [{ name: "Albany",      lat: 42.6526, lng: -73.7562 }, { name: "New York",      lat: 40.7128, lng: -74.0060 }] },
  { code: "NC", name: "North Carolina", area: "919", coastal: true,  cities: [{ name: "Raleigh",     lat: 35.7796, lng: -78.6382 }, { name: "Charlotte",     lat: 35.2271, lng: -80.8431 }] },
  { code: "ND", name: "North Dakota",   area: "701", coastal: false, cities: [{ name: "Bismarck",    lat: 46.8083, lng: -100.7837 }, { name: "Fargo",        lat: 46.8772, lng: -96.7898 }] },
  { code: "OH", name: "Ohio",           area: "614", coastal: false, cities: [{ name: "Columbus",    lat: 39.9612, lng: -82.9988 }, { name: "Cleveland",     lat: 41.4993, lng: -81.6944 }] },
  { code: "OK", name: "Oklahoma",       area: "405", coastal: false, cities: [{ name: "Oklahoma City", lat: 35.4676, lng: -97.5164 }, { name: "Tulsa",       lat: 36.1540, lng: -95.9928 }] },
  { code: "OR", name: "Oregon",         area: "503", coastal: true,  cities: [{ name: "Salem",       lat: 44.9429, lng: -123.0351 }, { name: "Portland",     lat: 45.5152, lng: -122.6784 }] },
  { code: "PA", name: "Pennsylvania",   area: "717", coastal: false, cities: [{ name: "Harrisburg",  lat: 40.2732, lng: -76.8867 }, { name: "Philadelphia", lat: 39.9526, lng: -75.1652 }] },
  { code: "RI", name: "Rhode Island",   area: "401", coastal: true,  cities: [{ name: "Providence",  lat: 41.8240, lng: -71.4128 }, { name: "Warwick",       lat: 41.7001, lng: -71.4162 }] },
  { code: "SC", name: "South Carolina", area: "803", coastal: true,  cities: [{ name: "Columbia",    lat: 34.0007, lng: -81.0348 }, { name: "Charleston",    lat: 32.7765, lng: -79.9311 }] },
  { code: "SD", name: "South Dakota",   area: "605", coastal: false, cities: [{ name: "Pierre",      lat: 44.3683, lng: -100.3510 }, { name: "Sioux Falls",  lat: 43.5460, lng: -96.7313 }] },
  { code: "TN", name: "Tennessee",      area: "615", coastal: false, cities: [{ name: "Nashville",   lat: 36.1627, lng: -86.7816 }, { name: "Memphis",       lat: 35.1495, lng: -90.0490 }] },
  { code: "TX", name: "Texas",          area: "512", coastal: true,  cities: [{ name: "Austin",      lat: 30.2672, lng: -97.7431 }, { name: "Houston",       lat: 29.7604, lng: -95.3698 }] },
  { code: "UT", name: "Utah",           area: "801", coastal: false, cities: [{ name: "Salt Lake City", lat: 40.7608, lng: -111.8910 }, { name: "Provo",     lat: 40.2338, lng: -111.6585 }] },
  { code: "VT", name: "Vermont",        area: "802", coastal: false, cities: [{ name: "Montpelier",  lat: 44.2601, lng: -72.5754 }, { name: "Burlington",    lat: 44.4759, lng: -73.2121 }] },
  { code: "VA", name: "Virginia",       area: "804", coastal: true,  cities: [{ name: "Richmond",    lat: 37.5407, lng: -77.4360 }, { name: "Virginia Beach",lat: 36.8529, lng: -75.9780 }] },
  { code: "WA", name: "Washington",     area: "360", coastal: true,  cities: [{ name: "Olympia",     lat: 47.0379, lng: -122.9007 }, { name: "Seattle",      lat: 47.6062, lng: -122.3321 }] },
  { code: "WV", name: "West Virginia",  area: "304", coastal: false, cities: [{ name: "Charleston",  lat: 38.3498, lng: -81.6326 }, { name: "Morgantown",    lat: 39.6295, lng: -79.9559 }] },
  { code: "WI", name: "Wisconsin",      area: "608", coastal: false, cities: [{ name: "Madison",     lat: 43.0731, lng: -89.4012 }, { name: "Milwaukee",     lat: 43.0389, lng: -87.9065 }] },
  { code: "WY", name: "Wyoming",        area: "307", coastal: false, cities: [{ name: "Cheyenne",    lat: 41.1400, lng: -104.8202 }, { name: "Jackson",      lat: 43.4799, lng: -110.7624 }] },
];

const FIRSTS = [
  "Maria","Daniel","Priya","Janelle","Kevin","Sofia","Marcus","Emily","Thomas","Rebecca",
  "Gregory","Alicia","Jonathan","Hannah","Christopher","Nadia","Omar","Beatrice","Ethan","Samara",
  "Lucas","Imani","Darius","Yolanda","Tomas","Fiona","Raj","Celeste","Quentin","Isla",
  "Mateo","Leila","Cyrus","Whitney","Silas","Noor","Elias","Freya","Soren","Vanessa",
  "Bodhi","Margaux","Kofi","Sienna","Isaiah","Rowan","Tahira","Wyatt","Amara","Dashiell",
];

const LASTS = [
  "Alvarez","Whitman","Ramanathan","Carter","Park","Oquendo","Blackwell","Donovan","Nakamura","Hastings",
  "Lindstrom","Freeman","Ellis","Osterberg","Vega","Harrington","Cho","Ibarra","Mbeki","Cavanaugh",
  "Tanaka","Rahimi","Ouellette","Sinclair","Beltran","Kincaid","Pham","Fenwick","Sorensen","Delacroix",
  "Huang","Marchetti","Kapoor","Novak","Ellison","Ferreira","Coulter","Okafor","Abernathy","Klein",
  "Petrov","Caballero","Langley","Beaumont","Tremblay","Oduya","Rasmussen","McKinley","Halvorsen","Thibodeau",
];

const ORG_TEMPLATES = [
  "{state} Wildlife Rescue",
  "{city} Wildlife Center",
  "{state} Raptor Rehab",
  "{city} Songbird Sanctuary",
  "{state} Wildlife Aid",
  "{city} Wildlife Haven",
  "{state} Rehab Collective",
  "{city} Wild Animal Clinic",
];

const SCOPES_ALL = [
  "raptor","songbird","waterfowl","mammal_small",
  "mammal_medium","reptile","bat","marine",
] as const;

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)] as T;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function scopesFor(r: () => number, state: StateEntry, rehabberIdx: number): string[] {
  const pool = state.coastal
    ? SCOPES_ALL
    : SCOPES_ALL.filter((x) => x !== "marine");
  const n = 2 + Math.floor(r() * 3);
  const out = new Set<string>();
  out.add(rehabberIdx === 0 ? "raptor" : rehabberIdx === 1 ? "songbird" : pick(r, pool));
  while (out.size < n) out.add(pick(r, pool));
  return Array.from(out);
}

function emit(row: {
  name: string;
  org: string;
  email: string;
  phone: string;
  lat: number;
  lng: number;
  scopes: string[];
  radius: number;
  capacity: number;
}): string {
  const scopeSql = `array[${row.scopes.map((s) => `'${s}'`).join(",")}]::text[]`;
  return (
    `  ('${sqlEscape(row.name)}', '${sqlEscape(row.org)}', ` +
    `'${row.email}', '${row.phone}', ${row.lat.toFixed(4)}, ${row.lng.toFixed(4)}, ` +
    `${scopeSql}, ${row.radius}, ${row.capacity}, true)`
  );
}

function main() {
  const header = [
    "-- Auto-generated by scripts/generate-rehabber-seed.ts. Do not edit by hand.",
    "-- 250 fictional US wildlife rehabbers (5 per state) for Terra Triage demo.",
    "--",
    "-- All emails are .example.org per RFC 2606. All phones are NANPA-reserved",
    "-- 555-0100..555-0199 fictional numbers. Coordinates are real city centers",
    "-- with jitter. No real person or organization is represented here.",
    "",
    "delete from rehabbers where email like '%.example.org';",
    "",
    "insert into rehabbers (name, org, email, phone, lat, lng, species_scope, radius_km, capacity, active) values",
  ];
  const lines: string[] = [];

  for (const state of STATES) {
    const seed =
      state.code.charCodeAt(0) * 31 + state.code.charCodeAt(1) * 17 + 7;
    const r = rng(seed);
    for (let i = 0; i < 5; i++) {
      const city = state.cities[i % 2]!;
      const firstName = pick(r, FIRSTS);
      const lastName = pick(r, LASTS);
      const name = `${firstName} ${lastName}`;
      const orgTmpl = pick(r, ORG_TEMPLATES);
      const org = orgTmpl.replace("{state}", state.name).replace("{city}", city.name);
      const orgSlug = slug(org);
      const email = `intake+${state.code.toLowerCase()}${i + 1}@${orgSlug}.example.org`;
      const phoneSeed = 100 + i * 13 + Math.floor(r() * 7);
      const phone = `+1-${state.area}-555-0${String(phoneSeed % 200).padStart(3, "0")}`;
      const jitterLat = city.lat + (r() - 0.5) * 0.4;
      const jitterLng = city.lng + (r() - 0.5) * 0.4;
      const scopes = scopesFor(r, state, i);
      const radius = 45 + Math.floor(r() * 40);
      const capacity = 3 + Math.floor(r() * 6);
      lines.push(
        emit({
          name,
          org,
          email,
          phone,
          lat: jitterLat,
          lng: jitterLng,
          scopes,
          radius,
          capacity,
        }),
      );
    }
  }

  const sql = [
    ...header,
    lines.join(",\n") + ";",
    "",
  ].join("\n");

  process.stdout.write(sql);
}

main();
