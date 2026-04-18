-- demo-seed data; not operational contacts; do not email in production
-- 15 US wildlife rehabbers for Terra Triage MVP demo.
-- Org names are plausible composites; email addresses use the reserved
-- example.org TLD per RFC 2606 so nothing routes to real inboxes.
-- Lat/lng are approximate public city coordinates for each state.

insert into rehabbers (name, org, email, phone, lat, lng, species_scope, radius_km, capacity, active) values
  ('Maria Alvarez',     'Bay Area Wildlife Center',         'intake@bay-area-wildlife.example.org',      '+1-415-555-0101', 37.7749, -122.4194, array['raptor','songbird','mammal_small'],              60, 6, true),
  ('Daniel Whitman',    'Hudson Valley Raptors',            'contact@hudson-valley-raptors.example.org', '+1-845-555-0134', 41.7004, -73.9210,  array['raptor','songbird'],                             75, 4, true),
  ('Priya Ramanathan',  'Lone Star Wildlife Rescue',        'help@lone-star-wildlife.example.org',       '+1-512-555-0172', 30.2672, -97.7431,  array['mammal_small','mammal_medium','reptile','bat'],  65, 7, true),
  ('Janelle Carter',    'Everglades Wildlife Haven',        'intake@everglades-haven.example.org',       '+1-305-555-0118', 25.7617, -80.1918,  array['waterfowl','reptile','songbird'],                50, 5, true),
  ('Kevin Park',        'Puget Sound Songbird Rehab',       'care@puget-songbird.example.org',           '+1-206-555-0156', 47.6062, -122.3321, array['songbird','raptor','waterfowl'],                 55, 4, true),
  ('Sofia Oquendo',     'Front Range Wildlife Aid',         'intake@front-range-wildlife.example.org',   '+1-303-555-0147', 39.7392, -104.9903, array['raptor','mammal_small','mammal_medium'],         70, 5, true),
  ('Marcus Blackwell',  'Prairie State Wildlife Rescue',    'help@prairie-state-wildlife.example.org',   '+1-312-555-0189', 41.8781, -87.6298,  array['songbird','waterfowl','mammal_small'],           50, 6, true),
  ('Emily Donovan',     'Cape Cod Wildlife Rehab',          'intake@cape-cod-rehab.example.org',         '+1-617-555-0162', 42.3601, -71.0589,  array['waterfowl','raptor','songbird'],                 45, 4, true),
  ('Thomas Nakamura',   'Willamette Valley Wildlife',       'care@willamette-wildlife.example.org',      '+1-503-555-0173', 45.5152, -122.6784, array['songbird','raptor','mammal_small','bat'],        60, 5, true),
  ('Rebecca Hastings',  'Sonoran Wildlife Center',          'intake@sonoran-wildlife.example.org',       '+1-602-555-0125', 33.4484, -112.0740, array['reptile','raptor','mammal_small','bat'],         65, 6, true),
  ('Gregory Lindstrom', 'Great Lakes Songbird Sanctuary',   'help@great-lakes-songbird.example.org',     '+1-313-555-0198', 42.3314, -83.0458,  array['songbird','waterfowl','raptor'],                 55, 4, true),
  ('Alicia Freeman',    'Piedmont Wildlife Refuge',         'contact@piedmont-wildlife.example.org',     '+1-919-555-0111', 35.7796, -78.6382,  array['raptor','mammal_small','mammal_medium','reptile'], 60, 5, true),
  ('Jonathan Ellis',    'Southern Appalachian Wildlife',    'intake@sa-wildlife.example.org',            '+1-404-555-0143', 33.7490, -84.3880,  array['mammal_small','mammal_medium','raptor','bat'],   70, 5, true),
  ('Hannah Osterberg',  'North Star Wildlife Aid',          'help@north-star-wildlife.example.org',      '+1-612-555-0187', 44.9778, -93.2650,  array['waterfowl','songbird','raptor','mammal_small'],  50, 6, true),
  ('Christopher Vega',  'Keystone Wildlife Rehab',          'care@keystone-rehab.example.org',           '+1-215-555-0109', 39.9526, -75.1652,  array['raptor','songbird','mammal_small','bat'],        55, 5, true);
