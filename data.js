// ============================================================
// TRIP CONFIG  — change the dates here and everything updates
// ============================================================
const TRIP = {
  startDate: '2026-07-13',     // Day 1
  endDate:   '2026-07-22',     // Day 10
  days: 10,
  base:     { lat: 35.8993, lng: 14.4944 },   // Airbnb — Quarry St, Msida
  forecast: { lat: 35.8989, lng: 14.5146 },   // Valletta area, used for weather
};

// ============================================================
// ITINERARY DATA
// (the `date` label is overwritten at runtime from TRIP.startDate
//  so weekdays are always correct for the chosen year)
//
// `cost` = rough estimated spend for that stop for the whole party
//  (used by the Smart budget calculator to weight each day's
//   allowance). 0 = free. Edit any of these in the app.
// ============================================================
const DAYS = [
  { n:1, date:"Sun 13 Jul", title:"Arrive · Msida + Sliema", zone:"Arrival", color:"#2176c7",
    stops:[
      {ph:"Afternoon"},
      {t:"a",name:"Arrive Malta Airport",time:"12:00",addr:"Malta International Airport",lat:35.8574,lng:14.4775,note:"Bolt to Msida (~€15, 20 min). Check-in at 16:00.",cost:15},
      {t:"f",name:"Lunch near Msida",time:"13:00–14:00",addr:"Msida waterfront",lat:35.8989,lng:14.4956,note:"Casual cafes along the marina.",cost:30},
      {t:"a",name:"Check in to Airbnb",time:"16:00",addr:"Quarry St, Msida",lat:35.8993,lng:14.4944,note:"Drop bags, freshen up.",cost:0},
      {ph:"Evening"},
      {t:"a",name:"Sliema Promenade walk",time:"18:30–20:00",addr:"Tower Road, Sliema",lat:35.9088,lng:14.5048,note:"2km coastal walk. Valletta skyline at golden hour.",cost:0},
      {t:"f",name:"Dinner — Felice Brasserie",time:"20:00",addr:"Triq Ix-Xatt, Sliema SLM 1171",lat:35.9069,lng:14.4984,note:"Seafront dinner. Scampi risotto. 4.6★. Book ahead.",cost:70},
    ]},
  { n:2, date:"Mon 14 Jul", title:"Valletta — the capital", zone:"Valletta", color:"#0e6b9e",
    stops:[
      {ph:"Morning"},
      {t:"a",name:"Breakfast + head out",time:"08:30–09:00",addr:"Msida → Valletta (bus 13/14/15)",lat:35.8975,lng:14.5124,note:"Early start — cathedral gets crowded fast.",cost:15},
      {t:"a",name:"St. John's Co-Cathedral",time:"09:00–11:00",addr:"Triq San Gwann, Valletta",lat:35.8976,lng:14.5125,note:"Baroque masterpiece. Caravaggio inside. Book ~€15.",cost:30},
      {t:"a",name:"Upper Barrakka Gardens",time:"11:00–12:00",addr:"Triq Sant'Orsla, Valletta",lat:35.8952,lng:14.5119,note:"Free. Best Grand Harbour panorama. Cannon at 12:00.",cost:0},
      {ph:"Afternoon"},
      {t:"f",name:"Lunch — Angela's Valletta",time:"12:30–14:00",addr:"84 Triq San Gwann, Valletta",lat:35.8986,lng:14.5113,note:"Traditional Maltese. Get the rabbit. 4.6★.",cost:45},
      {t:"a",name:"Casa Rocca Piccola",time:"14:30–16:00",addr:"74 Republic St, Valletta",lat:35.8999,lng:14.5153,note:"16th-century noble palace. WWII shelter inside. ~€9.50.",cost:20},
      {t:"a",name:"Valletta Waterfront stroll",time:"16:30–17:30",addr:"Pinto Wharf, Floriana",lat:35.8896,lng:14.5075,note:"Restored Baroque waterfront.",cost:0},
      {ph:"Evening"},
      {t:"f",name:"Dinner — 1522 a food story",time:"19:00",addr:"188a St. Lucia's Street, Valletta",lat:35.8969,lng:14.514,note:"Rated 4.9★. Lasagna or pinza. Book ahead.",cost:70},
    ]},
  { n:3, date:"Tue 15 Jul", title:"Three Cities + Birgu", zone:"Three Cities", color:"#1a6b8a",
    stops:[
      {ph:"Morning"},
      {t:"a",name:"Water taxi to Birgu",time:"09:30",addr:"Barrakka Lift Wharf → Birgu",lat:35.8894,lng:14.5198,note:"€2, 10 min. Views of Fort St Angelo from water.",cost:8},
      {t:"a",name:"Walk the Three Cities",time:"09:45–12:30",addr:"Vittoriosa, Senglea, Cospicua",lat:35.888,lng:14.522,note:"Medieval lanes older than Valletta. Go to Senglea too.",cost:0},
      {ph:"Afternoon"},
      {t:"f",name:"Lunch — Birgu waterfront",time:"12:30–14:00",addr:"Birgu Waterfront",lat:35.8894,lng:14.5198,note:"Casual spots with fort views.",cost:40},
      {t:"a",name:"Sliema waterfront",time:"14:30–17:00",addr:"Sliema Promenade",lat:35.9088,lng:14.5048,note:"Rocky lidos for a swim.",cost:0},
      {ph:"Evening"},
      {t:"f",name:"Dinner — Trattoria del Mare",time:"19:30",addr:"Triq Ix-Xatt, Sliema",lat:35.9085,lng:14.5028,note:"Best seafood pasta in Sliema. 4.6★.",cost:60},
    ]},
  { n:4, date:"Wed 16 Jul", title:"Mdina + Dingli Cliffs", zone:"Central + West", color:"#2d6b4a",
    stops:[
      {ph:"Morning"},
      {t:"a",name:"Mdina — the Silent City",time:"09:30–12:00",addr:"L-Imdina, Malta",lat:35.886,lng:14.4033,note:"Walled medieval capital. Free entry to wander.",cost:0},
      {ph:"Afternoon"},
      {t:"f",name:"Lunch in Rabat",time:"12:00–13:30",addr:"Rabat, outside Mdina gates",lat:35.882,lng:14.398,note:"Try a ftira or pastizzi.",cost:20},
      {t:"a",name:"Dingli Cliffs",time:"14:30–16:30",addr:"Dingli, Malta",lat:35.8521,lng:14.3854,note:"Malta's highest point 253m. Dramatic sea cliffs. Free.",cost:0},
      {ph:"Evening — sunset"},
      {t:"a",name:"Dingli sunset viewpoint",time:"19:30–20:30",addr:"Dingli Cliffs viewpoint",lat:35.8424,lng:14.3988,note:"Best sunset spot on the island. Stay for it.",cost:0},
      {t:"f",name:"Dinner — Bolt back",time:"21:00",addr:"Sliema or Msida",lat:35.9069,lng:14.4984,note:"Casual dinner or takeaway.",cost:45},
    ]},
  { n:5, date:"Thu 17 Jul", title:"South Malta — caves & pool", zone:"South Malta", color:"#6b4a2d",
    stops:[
      {ph:"Morning"},
      {t:"a",name:"Ħaġar Qim Temple",time:"09:00–10:30",addr:"Triq Hagar Qim, Il-Qrendi",lat:35.8277,lng:14.4421,note:"5,500-year-old temple. Opens 09:00, ~€10.",cost:20},
      {t:"m",name:"Blue Grotto boat trip",time:"10:45–11:30",addr:"Blue Grotto Boat Service, Qrendi",lat:35.8198,lng:14.4518,note:"★ 20-min boat through sea caves. €10 cash.",cost:20},
      {t:"m",name:"Għar Ħasan Cave",time:"12:00–13:00",addr:"Birzebbuga, Malta",lat:35.8067,lng:14.518,note:"★ Cave on cliff face with sea windows. Bring a torch.",cost:0},
      {ph:"Afternoon"},
      {t:"f",name:"Lunch — Liska Restaurant",time:"13:30–15:00",addr:"Xatt is-Sajjieda, Marsaxlokk",lat:35.8383,lng:14.5437,note:"Best seafood in Malta 4.8★. Book ahead.",cost:80},
      {t:"a",name:"Marsaxlokk Harbour",time:"15:00–16:00",addr:"Marsaxlokk",lat:35.8413,lng:14.5453,note:"Colourful luzzu boats. Very photogenic.",cost:0},
      {t:"m",name:"St. Peter's Pool",time:"16:00–18:00",addr:"Near Marsaxlokk",lat:35.8331,lng:14.5621,note:"★ Natural rock pool, crystal clear. Free swim + cliff jump.",cost:0},
      {ph:"Evening"},
      {t:"f",name:"Dinner — Roots or Bolt home",time:"19:30",addr:"Marsaxlokk or Msida",lat:35.8404,lng:14.5445,note:"Roots restaurant is excellent for seafood.",cost:55},
    ]},
  { n:6, date:"Fri 18 Jul", title:"North Malta — beaches & caves", zone:"North Malta", color:"#6b2d6b",
    stops:[
      {ph:"Morning"},
      {t:"a",name:"Head north + scooter rental",time:"08:30–09:15",addr:"Mellieħa",lat:35.9569,lng:14.3581,note:"Rent scooters in Mellieħa for the day.",cost:60},
      {t:"m",name:"Ta' Marija Cave (by kayak)",time:"09:30–11:30",addr:"Mġarr coast, Malta",lat:35.9181,lng:14.333,note:"★ Hire kayaks (~€20–25/pp). Best reached by water.",cost:45},
      {t:"m",name:"Għajn Tuffieħa Viewpoint",time:"11:45–12:15",addr:"Mġarr viewpoint",lat:35.9275,lng:14.3422,note:"★ Dramatic clay cliffs above two bays. 4.9★. Easy walk.",cost:0},
      {ph:"Afternoon — three beaches"},
      {t:"m",name:"Għajn Tuffieħa Bay",time:"12:15–13:30",addr:"Għajn Tuffieħa Bay, Malta",lat:35.9265,lng:14.3406,note:"★ Sandy beach below clay cliffs. Less crowded. Steps down.",cost:0},
      {t:"f",name:"Lunch at beach snack bar",time:"13:00–13:45",addr:"Riviera / Għajn Tuffieħa snack bars",lat:35.9297,lng:14.3451,note:"Cold drinks, sandwiches. Eat on the beach.",cost:25},
      {t:"m",name:"Riviera Beach + swings",time:"14:00–15:30",addr:"Riviera Beach, Malta",lat:35.9297,lng:14.3451,note:"★ Famous beach swings. Sandy beach under clay cliffs.",cost:0},
      {t:"a",name:"Golden Bay Beach",time:"15:30–17:30",addr:"Golden Bay, Malta",lat:35.9339,lng:14.3444,note:"Bigger beach, sunbed rental. Good afternoon session.",cost:15},
      {ph:"Evening"},
      {t:"m",name:"Paradise Bay",time:"17:30–19:00",addr:"Triq Il-Latnija, Mellieħa",lat:35.9818,lng:14.3324,note:"★ Small hidden bay. Postcard sunset.",cost:0},
      {t:"f",name:"Dinner — Paradise Bay Lido",time:"19:00–20:30",addr:"Paradise Bay Lido, Mellieħa",lat:35.9818,lng:14.3318,note:"Fresh fish, grilled sea bream. 4.3★.",cost:60},
    ]},
  { n:7, date:"Sat 19 Jul", title:"Comino — Blue Lagoon", zone:"Comino Island", color:"#0e6b6b",
    stops:[
      {ph:"Early morning"},
      {t:"a",name:"Early departure to Cirkewwa",time:"08:00–08:30",addr:"Cirkewwa Ferry Terminal",lat:35.9859,lng:14.3356,note:"MUST leave early. Packed by 11AM in July.",cost:10},
      {t:"a",name:"Boat to Blue Lagoon",time:"09:00–09:30",addr:"Comino Island",lat:36.0136,lng:14.3241,note:"Private boat recommended. Book 1–2 days ahead.",cost:60},
      {t:"a",name:"Blue Lagoon, Comino",time:"09:30–15:00",addr:"Comino Island",lat:36.0136,lng:14.3241,note:"Turquoise water, snorkeling. Walk further for quieter coves.",cost:15},
      {ph:"Afternoon"},
      {t:"f",name:"Lunch on Comino",time:"12:00",addr:"Comino snack bars",lat:36.0136,lng:14.3241,note:"Basic food on-island. Keep it light.",cost:25},
      {t:"a",name:"Return ferry",time:"15:30–16:00",addr:"Cirkewwa → Msida",lat:35.9859,lng:14.3356,note:"Head back before the rush.",cost:0},
      {ph:"Evening"},
      {t:"f",name:"Dinner — Gululu Maltese",time:"19:30",addr:"133 Spinola Bay, St Julian's",lat:35.9198,lng:14.4911,note:"Fenkata tasting menu €36/pp. 4.1★.",cost:72},
    ]},
  { n:8, date:"Sun 20 Jul", title:"Gozo — caves, arch & cliffs", zone:"Gozo Island", color:"#6b4a0e",
    stops:[
      {ph:"Morning — early ferry"},
      {t:"a",name:"Ferry to Gozo",time:"08:00–09:00",addr:"Cirkewwa → Gozo (€4.65 return)",lat:35.9859,lng:14.3356,note:"Ferries every 45 min. Rent scooters on Gozo dockside.",cost:60},
      {t:"m",name:"Tal-Mixta Cave",time:"09:30–11:00",addr:"Nadur, Gozo",lat:36.0633,lng:14.2896,note:"★ Natural cave framing Ramla Bay. Rocky hike, wear shoes.",cost:0},
      {t:"m",name:"Wied il-Mielah window arch",time:"11:30–12:30",addr:"Għarb, Gozo",lat:36.079,lng:14.213,note:"★ Rock arch over the sea. Walk west to mushroom rock.",cost:0},
      {ph:"Afternoon"},
      {t:"f",name:"Lunch in Victoria",time:"13:00–14:30",addr:"Victoria (Rabat), Gozo",lat:36.0439,lng:14.2397,note:"Gozo capital. Eat in the citadel area.",cost:45},
      {t:"a",name:"Wied il-Għasri valley",time:"15:00–16:30",addr:"Żebbuġ, Gozo",lat:36.0787,lng:14.2284,note:"Narrow valley to pebble cove. Great snorkeling.",cost:0},
      {t:"a",name:"Sanap Cliffs walk",time:"17:00–18:30",addr:"Munxar, Gozo",lat:36.0207,lng:14.2219,note:"Cliff walk above Xlendi Bay. 40-min loop. 4.8★.",cost:0},
      {ph:"Evening"},
      {t:"f",name:"Dinner in Xlendi",time:"19:00",addr:"Xlendi, Gozo",lat:36.028,lng:14.2098,note:"Fishing village below the cliffs.",cost:60},
      {t:"a",name:"Return ferry",time:"21:00",addr:"Mġarr, Gozo → Cirkewwa",lat:36.0157,lng:14.2978,note:"Ferries run until late. Bolt home.",cost:0},
    ]},
  { n:9, date:"Mon 21 Jul", title:"Popeye Village + Paceville", zone:"Northwest + Paceville", color:"#6b2d2d",
    stops:[
      {ph:"Morning"},
      {t:"a",name:"Popeye Village",time:"09:30–13:00",addr:"Triq Tal-Prajjet, Mellieħa",lat:35.9609,lng:14.3412,note:"Original 1980 film set. €25/pp. Opens 09:30.",cost:50},
      {ph:"Afternoon"},
      {t:"f",name:"Lunch in Mellieħa",time:"13:30–14:30",addr:"Mellieħa town centre",lat:35.9569,lng:14.3581,note:"Local cafes in the hilltop village.",cost:35},
      {t:"a",name:"Mellieħa Bay beach",time:"15:00–17:30",addr:"Mellieħa Bay",lat:35.9437,lng:14.3592,note:"Malta's longest sandy beach. Shallow, calm.",cost:15},
      {ph:"Evening — last night out"},
      {t:"f",name:"Dinner — CUBA Spinola",time:"19:30–21:30",addr:"Spinola Bay, St Julian's",lat:35.9198,lng:14.4904,note:"Bay view terrace. Happy hour cocktails. 4.2★.",cost:70},
      {t:"n",name:"Paceville nightlife",time:"22:00+",addr:"Paceville, St Julian's",lat:35.9215,lng:14.4933,note:"Malta's nightlife hub. Walk around and pick what looks good.",cost:60},
    ]},
  { n:10, date:"Tue 22 Jul", title:"Checkout + Valletta farewell", zone:"Departure", color:"#4a4a6b",
    stops:[
      {ph:"Morning"},
      {t:"a",name:"Checkout by 10:00",time:"10:00",addr:"Quarry St, Msida",lat:35.8993,lng:14.4944,note:"Pack up night before. Ask host to store bags.",cost:0},
      {ph:"Final Valletta morning"},
      {t:"f",name:"Brunch — TRiBE Valletta",time:"10:30–12:00",addr:"84 South Street, Valletta VLT 1105",lat:35.8966,lng:14.5106,note:"Famous pancakes. Good final meal.",cost:35},
      {t:"a",name:"Republic Street + souvenirs",time:"12:00–13:30",addr:"Republic Street, Valletta",lat:35.8985,lng:14.514,note:"Last walk. Upper Barrakka cannon at 12:00.",cost:40},
      {ph:"Departure"},
      {t:"a",name:"Head to airport",time:"17:30",addr:"Valletta → Malta Airport (~€12 Bolt)",lat:35.8574,lng:14.4775,note:"Flight 20:00. Be at airport by 17:30.",cost:12},
    ]},
];

// ============================================================
// PACKING DATA
// ============================================================
const PACKING = [
  { section:"📄 Documents", items:["Passport","Flight tickets (printed or app)","Travel insurance","Airbnb confirmation","Driving licence (for scooters)","EHIC / health card","Emergency contacts list","Credit / debit cards"] },
  { section:"👗 Clothing", items:["Lightweight shorts x4","T-shirts x5","Summer dress / evening outfit","Light layer for evenings","Swimsuit x2","Underwear x7","Flip flops","Comfortable walking shoes","Sandals","Cap or sun hat"] },
  { section:"🏖️ Beach & Sun", items:["Sunscreen SPF 50","After-sun lotion","Sunglasses (UV400)","Beach towel x2","Snorkelling mask & fins","Waterproof phone pouch","Reusable water bottle","Dry bag for kayaking"] },
  { section:"💊 Health & Toiletries", items:["Paracetamol / Ibuprofen","Antihistamine","Plasters & blister pads","Insect repellent","Toothbrush & paste","Deodorant","Shampoo & conditioner","Razors","Any prescription meds"] },
  { section:"📱 Tech & Gadgets", items:["Phone charger","Power bank","Universal adapter","Camera + memory card","Earphones","Downloaded offline maps (Google Maps)","Bolt app installed","Ferry ticket app / booking"] },
  { section:"🎒 Day trip essentials", items:["Small daypack","Cash (€) for boats / markets","Reusable bags","Torch (for caves)","Snacks for long days","Sunscreen top-up sachet"] },
];

// ============================================================
// TIPS DATA
// ============================================================
const TIPS = [
  { icon:"🚕", title:"Bolt over taxis", body:"Bolt is Malta's dominant ride-share app. Always use it over street taxis — cheaper, transparent pricing, no negotiating. Install it before you leave home." },
  { icon:"🚌", title:"Bus system", body:"Malta's public buses are cheap (€1.50/ride, €2 for long routes) but slow and often late. Use them for budget travel. The Malta Public Transport app shows real-time arrivals." },
  { icon:"🛵", title:"Scooter rental", body:"Best way to explore Gozo and north Malta. Rent for €25–35/day. Need a valid driving licence. Helmets are mandatory by law. Roads are narrow — go slow." },
  { icon:"💶", title:"Cash is king in the south", body:"Blue Grotto boats, Marsaxlokk market, and small cafes in villages are cash only. Keep at least €50 cash on you at all times. ATMs are everywhere in Sliema and Valletta." },
  { icon:"🌡️", title:"Heat management", body:"July heat is serious — 33–36°C daily. Do all outdoor sightseeing before 11:00 or after 17:00. Always carry 1L of water minimum. Never hike midday." },
  { icon:"🏖️", title:"Beach timing", body:"Arrive at beaches before 09:30 or after 16:00 in July. Blue Lagoon especially — it becomes a nightmare after 11AM. Early bird gets the clear water." },
  { icon:"📱", title:"Must-have apps", body:"Bolt (taxis), Revolut (payments), Google Maps offline (download Malta + Gozo), Malta Ferry app (Gozo crossings), Translate (useful in rural areas)." },
  { icon:"🍽️", title:"Book restaurants", body:"Angela's, 1522, Liska, and Roots are small and fill up — book ahead, especially for dinner. Most accept online booking or WhatsApp reservation." },
  { icon:"🚢", title:"Gozo & Comino ferries", body:"Gozo ferry from Cirkewwa runs all day, ~€4.65 return, no booking needed. Comino boats need to be pre-booked in July — do it 2–3 days ahead. Private boats are far better than the packed ferries." },
  { icon:"🕌", title:"Dress code at churches", body:"Shoulders and knees must be covered at St. John's Cathedral and Mdina Cathedral. Carry a light scarf. You'll be turned away at the door otherwise." },
  { icon:"🌊", title:"Snorkelling spots", body:"Best snorkelling: Wied il-Għasri (Gozo), St. Peter's Pool, and Comino's quieter coves. Bring your own gear — rental is expensive and limited outside main beaches." },
  { icon:"🏧", title:"Card acceptance", body:"All restaurants in Sliema, Valletta, and St Julian's take cards. Rural areas, markets, and boat trips are cash only. Revolut or Wise saves on foreign transaction fees." },
];

// ============================================================
// TYPICAL JULY WEATHER  — fallback when live forecast is
// unavailable (offline, or trip is >16 days away)
// index 0 = Day 1 ... index 9 = Day 10
// ============================================================
const WEATHER_TYPICAL = [
  { icon:"☀️", hi:34, lo:24, desc:"Sunny",         uv:10, wind:10 },
  { icon:"☀️", hi:35, lo:25, desc:"Sunny",         uv:11, wind:8  },
  { icon:"🌤️", hi:33, lo:24, desc:"Mostly sunny",  uv:10, wind:12 },
  { icon:"☀️", hi:36, lo:26, desc:"Sunny, hot",    uv:11, wind:7  },
  { icon:"☀️", hi:35, lo:25, desc:"Sunny",         uv:10, wind:9  },
  { icon:"☀️", hi:34, lo:24, desc:"Sunny",         uv:10, wind:11 },
  { icon:"🌤️", hi:33, lo:24, desc:"Partly cloudy", uv:9,  wind:14 },
  { icon:"☀️", hi:36, lo:26, desc:"Sunny, hot",    uv:11, wind:8  },
  { icon:"☀️", hi:34, lo:25, desc:"Sunny",         uv:10, wind:10 },
  { icon:"⛅", hi:32, lo:23, desc:"Some clouds",   uv:9,  wind:15 },
];

// WMO weather-code → [emoji, description] (Open-Meteo codes)
const WMO = {
  0:["☀️","Clear sky"], 1:["🌤️","Mainly clear"], 2:["⛅","Partly cloudy"], 3:["☁️","Overcast"],
  45:["🌫️","Fog"], 48:["🌫️","Rime fog"],
  51:["🌦️","Light drizzle"], 53:["🌦️","Drizzle"], 55:["🌦️","Dense drizzle"],
  56:["🌧️","Freezing drizzle"], 57:["🌧️","Freezing drizzle"],
  61:["🌧️","Light rain"], 63:["🌧️","Rain"], 65:["🌧️","Heavy rain"],
  66:["🌧️","Freezing rain"], 67:["🌧️","Freezing rain"],
  71:["🌨️","Light snow"], 73:["🌨️","Snow"], 75:["🌨️","Heavy snow"], 77:["🌨️","Snow grains"],
  80:["🌦️","Light showers"], 81:["🌧️","Showers"], 82:["⛈️","Violent showers"],
  85:["🌨️","Snow showers"], 86:["🌨️","Snow showers"],
  95:["⛈️","Thunderstorm"], 96:["⛈️","Storm + hail"], 99:["⛈️","Severe storm"],
};
function wmo(code) { return WMO[code] || ["🌡️","—"]; }
