(function () {
  const columns = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const rows = 18;

  const TERRAIN = {
    sea: { name: "Sea", move: 99, defense: 0, impassable: true },
    beach: { name: "Beachhead", move: 1, defense: 0 },
    open: { name: "Open", move: 1, defense: 0 },
    bocage: { name: "Close country", move: 2, defense: 1 },
    town: { name: "Urban", move: 1, defense: 2 },
    port: { name: "Port", move: 1, defense: 2 },
    highland: { name: "Rough upland", move: 2, defense: 1 },
    marsh: { name: "Polder / marsh", move: 2, defense: 1 },
    river: { name: "Major river line", move: 2, defense: 1 },
  };

  const terrainOverrides = {};
  const labels = {};

  function setTerrain(ids, terrain) {
    for (const id of ids) {
      terrainOverrides[id] = terrain;
    }
  }

  function setLabel(id, label) {
    labels[id] = label;
  }

  for (let row = 1; row <= 4; row += 1) {
    for (let col = 0; col <= 13; col += 1) {
      terrainOverrides[`${columns[col]}${row}`] = "sea";
    }
  }
  for (let row = 5; row <= 7; row += 1) {
    for (let col = 0; col <= 2; col += 1) {
      terrainOverrides[`${columns[col]}${row}`] = "sea";
    }
  }
  for (let row = 17; row <= 18; row += 1) {
    for (let col = 11; col <= 15; col += 1) {
      terrainOverrides[`${columns[col]}${row}`] = "sea";
    }
  }

  setTerrain(["B2", "C2", "E3"], "port");
  setTerrain(["E5", "C8", "N6", "P5", "M17", "N18"], "port");
  setTerrain(["F5", "G5", "H5", "L17"], "beach");
  setTerrain(["E7", "F7", "G7", "G8", "H8"], "bocage");
  setTerrain(["O5", "P4", "P5", "Q4", "Q5", "R4"], "marsh");
  setTerrain(["P9", "Q9", "Q10", "R9", "R10", "Q12", "R13"], "highland");
  setTerrain(["J8", "K8", "L8", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13"], "river");
  setTerrain(["G6", "F7", "K9", "P6", "Q5", "R4", "R7", "S7", "T7", "P11", "R13", "O16", "L14", "Y8"], "town");
  setTerrain(["P5"], "port");

  for (const [id, label] of Object.entries({
    B2: "Portsmouth",
    C2: "London",
    E3: "Dover",
    E5: "Cherbourg",
    F5: "Normandy",
    G6: "Caen",
    F7: "St-Lo",
    H8: "Falaise",
    C8: "Brest",
    N6: "Le Havre",
    K9: "Paris",
    P5: "Antwerp",
    Q4: "Scheldt",
    P6: "Brussels",
    Q5: "Nijmegen",
    R4: "Arnhem",
    P9: "Ardennes",
    R7: "Aachen",
    S7: "Cologne",
    T7: "Ruhr",
    S10: "Remagen",
    P11: "Metz",
    Q12: "Saar",
    R13: "Strasbourg",
    M17: "Toulon",
    N18: "Marseille",
    O16: "Lyon",
    L14: "Dijon",
    Y8: "Elbe",
  })) {
    setLabel(id, label);
  }

  const controlPoints = {
    B2: { name: "Portsmouth Staging", kind: "port", value: 0, supply: true, supplyFor: ["allied"] },
    C2: { name: "London Staging", kind: "port", value: 0, supply: true, supplyFor: ["allied"] },
    E3: { name: "Dover Staging", kind: "port", value: 0, supply: true, supplyFor: ["allied"] },
    E5: { name: "Cherbourg", kind: "port", value: 2, supply: true, supplyFor: ["allied"] },
    F5: { name: "Normandy Beachhead", kind: "beach", value: 2, supply: true, supplyFor: ["allied"] },
    G6: { name: "Caen", kind: "town", value: 2 },
    F7: { name: "St-Lo", kind: "town", value: 1 },
    H8: { name: "Falaise Gap", kind: "town", value: 2 },
    C8: { name: "Brest", kind: "port", value: 1, supply: true, supplyFor: ["allied"] },
    N6: { name: "Le Havre", kind: "port", value: 1, supply: true, supplyFor: ["allied"] },
    K9: { name: "Paris", kind: "town", value: 3 },
    P5: { name: "Antwerp", kind: "port", value: 4, supply: true, supplyFor: ["allied"] },
    Q4: { name: "Scheldt Estuary", kind: "depot", value: 2 },
    P6: { name: "Brussels", kind: "town", value: 2 },
    Q5: { name: "Nijmegen", kind: "bridge", value: 1 },
    R4: { name: "Arnhem", kind: "bridge", value: 2 },
    P9: { name: "Ardennes", kind: "pass", value: 2 },
    R7: { name: "Aachen / Westwall", kind: "town", value: 2 },
    S7: { name: "Cologne Rhine Line", kind: "bridge", value: 3 },
    T7: { name: "Ruhr", kind: "industrial", value: 4 },
    S10: { name: "Remagen", kind: "bridge", value: 3 },
    P11: { name: "Metz", kind: "fortress", value: 2 },
    Q12: { name: "Saar", kind: "industrial", value: 2 },
    R13: { name: "Strasbourg", kind: "town", value: 2 },
    M17: { name: "Toulon", kind: "port", value: 2, supply: true, supplyFor: ["allied"] },
    N18: { name: "Marseille", kind: "port", value: 3, supply: true, supplyFor: ["allied"] },
    O16: { name: "Rhone Depot", kind: "depot", value: 1, supply: true, supplyFor: ["allied"] },
    L14: { name: "Dijon Link-Up", kind: "rail", value: 2 },
    Y8: { name: "Elbe Line", kind: "exit", value: 4 },
  };

  const cells = [];
  const cellMap = {};
  for (let row = 1; row <= rows; row += 1) {
    for (let col = 0; col < columns.length; col += 1) {
      const id = `${columns[col]}${row}`;
      const terrain = terrainOverrides[id] || "open";
      const cell = {
        id,
        col,
        row,
        terrain,
        label: labels[id] || "",
        objective: controlPoints[id] || null,
      };
      cells.push(cell);
      cellMap[id] = cell;
    }
  }

  const roads = [
    ["B2", "E3", "F5", "G6", "F7", "H8", "K9", "M8", "N7", "P6", "R7", "S7", "T7", "U8", "Y8"],
    ["C8", "E7", "F7", "H8", "K9", "L10", "P11", "Q12", "R13"],
    ["F5", "G6", "H8", "I9", "K9"],
    ["P5", "Q4", "Q5", "R4"],
    ["M17", "N18", "O16", "L14", "K12", "K9"],
    ["N18", "O16", "P14", "R13", "S10", "S7"],
    ["P6", "P9", "P11", "Q12", "R13"],
  ];

  const roadEdges = new Set();
  for (const road of roads) {
    for (let i = 0; i < road.length - 1; i += 1) {
      roadEdges.add([road[i], road[i + 1]].sort().join("-"));
    }
  }

  const units = {
    us_v_corps: { id: "us_v_corps", side: "allied", name: "US V Corps", short: "V US", type: "infantry", symbol: "XXX", attack: 6, defense: 5, move: 3, steps: 3, traits: ["corps", "assault", "amphibious"] },
    us_vii_corps: { id: "us_vii_corps", side: "allied", name: "US VII Corps", short: "VII", type: "infantry", symbol: "XXX", attack: 6, defense: 5, move: 3, steps: 3, traits: ["corps", "amphibious"] },
    us_xix_corps: { id: "us_xix_corps", side: "allied", name: "US XIX Corps", short: "XIX", type: "infantry", symbol: "XXX", attack: 5, defense: 5, move: 3, steps: 3, traits: ["corps"] },
    us_viii_corps: { id: "us_viii_corps", side: "allied", name: "US VIII Corps", short: "VIII", type: "infantry", symbol: "XXX", attack: 5, defense: 4, move: 3, steps: 3, traits: ["corps", "brittany"] },
    us_xii_corps: { id: "us_xii_corps", side: "allied", name: "US XII Corps", short: "XII", type: "armor", symbol: "XXX", attack: 7, defense: 5, move: 5, steps: 3, traits: ["corps", "armored"] },
    us_xv_corps: { id: "us_xv_corps", side: "allied", name: "US XV Corps", short: "XV", type: "armor", symbol: "XXX", attack: 7, defense: 5, move: 5, steps: 3, traits: ["corps", "pursuit"] },
    us_xx_corps: { id: "us_xx_corps", side: "allied", name: "US XX Corps", short: "XX", type: "armor", symbol: "XXX", attack: 7, defense: 5, move: 5, steps: 3, traits: ["corps", "pursuit"] },
    us_vi_corps: { id: "us_vi_corps", side: "allied", name: "US VI Corps", short: "VI", type: "infantry", symbol: "XXX", attack: 6, defense: 5, move: 4, steps: 3, traits: ["corps", "amphibious", "dragoon"] },
    us_ninth_corps: { id: "us_ninth_corps", side: "allied", name: "US Ninth Army Corps Group", short: "9A", type: "infantry", symbol: "HQ", attack: 5, defense: 5, move: 3, steps: 3, traits: ["army", "rhine"] },
    br_i_corps: { id: "br_i_corps", side: "allied", name: "British I Corps", short: "I BR", type: "infantry", symbol: "XXX", attack: 5, defense: 5, move: 3, steps: 3, traits: ["corps", "amphibious"] },
    br_viii_corps: { id: "br_viii_corps", side: "allied", name: "British VIII Corps", short: "VIII", type: "armor", symbol: "XXX", attack: 6, defense: 5, move: 4, steps: 3, traits: ["corps", "armored"] },
    br_xxx_corps: { id: "br_xxx_corps", side: "allied", name: "British XXX Corps", short: "XXX", type: "armor", symbol: "XXX", attack: 7, defense: 5, move: 4, steps: 3, traits: ["corps", "guards"] },
    ca_ii_corps: { id: "ca_ii_corps", side: "allied", name: "II Canadian Corps", short: "II CA", type: "infantry", symbol: "XXX", attack: 6, defense: 5, move: 3, steps: 3, traits: ["corps", "canadian"] },
    ca_i_corps: { id: "ca_i_corps", side: "allied", name: "I Canadian Corps", short: "I CA", type: "infantry", symbol: "XXX", attack: 5, defense: 5, move: 3, steps: 3, traits: ["corps", "canadian"] },
    fr_i_corps: { id: "fr_i_corps", side: "allied", name: "French I Corps", short: "I FR", type: "infantry", symbol: "XXX", attack: 6, defense: 5, move: 4, steps: 3, traits: ["corps", "dragoon"] },
    fr_ii_corps: { id: "fr_ii_corps", side: "allied", name: "French II Corps", short: "II FR", type: "armor", symbol: "XXX", attack: 7, defense: 5, move: 5, steps: 3, traits: ["corps", "armored", "dragoon"] },
    allied_airborne: { id: "allied_airborne", side: "allied", name: "First Allied Airborne Army", short: "ABN", type: "airborne", symbol: "AB", attack: 4, defense: 4, move: 4, steps: 2, traits: ["airborne", "reserve"] },
    allied_logistics: { id: "allied_logistics", side: "allied", name: "Allied Communications Zone", short: "COMZ", type: "hq", symbol: "HQ", attack: 1, defense: 3, move: 2, steps: 2, traits: ["support", "depot"] },

    g_7army: { id: "g_7army", side: "german", name: "German Seventh Army", short: "7A", type: "infantry", symbol: "HQ", attack: 5, defense: 6, move: 3, steps: 3, traits: ["army", "normandy"] },
    g_lxxxiv: { id: "g_lxxxiv", side: "german", name: "LXXXIV Corps Coastal Defense", short: "84", type: "garrison", symbol: "XXX", attack: 3, defense: 5, move: 2, steps: 2, traits: ["static", "coastal"] },
    g_i_ss_pz: { id: "g_i_ss_pz", side: "german", name: "I SS Panzer Corps", short: "I SS", type: "armor", symbol: "PZ", attack: 8, defense: 6, move: 5, steps: 3, traits: ["panzer", "reserve"] },
    g_15army: { id: "g_15army", side: "german", name: "German Fifteenth Army", short: "15A", type: "infantry", symbol: "HQ", attack: 4, defense: 6, move: 3, steps: 3, traits: ["army", "channel"] },
    g_5pz: { id: "g_5pz", side: "german", name: "Fifth Panzer Army", short: "5PZ", type: "armor", symbol: "PZ", attack: 8, defense: 6, move: 5, steps: 3, traits: ["panzer", "ardennes"] },
    g_1army: { id: "g_1army", side: "german", name: "German First Army", short: "1A", type: "infantry", symbol: "HQ", attack: 5, defense: 6, move: 3, steps: 3, traits: ["army", "lorraine"] },
    g_19army: { id: "g_19army", side: "german", name: "German Nineteenth Army", short: "19A", type: "infantry", symbol: "HQ", attack: 4, defense: 5, move: 3, steps: 3, traits: ["army", "southern"] },
    g_brittany: { id: "g_brittany", side: "german", name: "Brittany Fortress Commands", short: "BRT", type: "garrison", symbol: "GAR", attack: 2, defense: 6, move: 1, steps: 2, traits: ["fortress", "port"] },
    g_scheldt: { id: "g_scheldt", side: "german", name: "Scheldt Coastal Defense", short: "SCH", type: "garrison", symbol: "GAR", attack: 3, defense: 6, move: 2, steps: 2, traits: ["fortress", "polder"] },
    g_1para: { id: "g_1para", side: "german", name: "First Parachute Army", short: "1FJ", type: "infantry", symbol: "XXX", attack: 5, defense: 6, move: 3, steps: 3, traits: ["army", "netherlands"] },
    g_westwall_aachen: { id: "g_westwall_aachen", side: "german", name: "Aachen Westwall Sector", short: "AACH", type: "garrison", symbol: "GAR", attack: 3, defense: 7, move: 1, steps: 2, traits: ["fortress", "westwall"] },
    g_westwall_saar: { id: "g_westwall_saar", side: "german", name: "Saar Westwall Sector", short: "SAAR", type: "garrison", symbol: "GAR", attack: 3, defense: 7, move: 1, steps: 2, traits: ["fortress", "westwall"] },
    g_rhine: { id: "g_rhine", side: "german", name: "Rhine Defense Command", short: "RHN", type: "garrison", symbol: "GAR", attack: 4, defense: 7, move: 2, steps: 3, traits: ["river", "fortress"] },
    g_ruhr: { id: "g_ruhr", side: "german", name: "Ruhr Defense Group", short: "RUHR", type: "garrison", symbol: "GAR", attack: 4, defense: 7, move: 2, steps: 3, traits: ["industrial", "fortress"] },
    g_6pz: { id: "g_6pz", side: "german", name: "Sixth Panzer Army", short: "6PZ", type: "armor", symbol: "PZ", attack: 9, defense: 6, move: 5, steps: 3, traits: ["panzer", "ardennes", "reserve"] },
  };

  const campaignEvents = [
    { id: "air-superiority", title: "Tactical Air Superiority", text: "Allied attacks gain +1 this turn.", effect: { type: "modifier", side: "allied", key: "attack", value: 1 } },
    { id: "logistics-strain", title: "Long Haul Logistics", text: "Allied movement is -1 this turn.", effect: { type: "modifier", side: "allied", key: "move", value: -1 } },
    { id: "clear-breakout-weather", title: "Clear Breakout Weather", text: "Allied movement and attack gain +1 this turn.", effect: { type: "multiModifier", modifiers: [{ side: "allied", key: "move", value: 1 }, { side: "allied", key: "attack", value: 1 }] } },
    { id: "panzer-counterstroke", title: "Panzer Counterstroke", text: "German attacks gain +1 this turn.", effect: { type: "modifier", side: "german", key: "attack", value: 1 } },
    { id: "fuel-shortage-west", title: "Fuel Shortage", text: "German movement is -1 this turn.", effect: { type: "modifier", side: "german", key: "move", value: -1 } },
    { id: "mud-and-fog", title: "Mud and Fog", text: "Both sides attack at -1 this turn.", effect: { type: "dualModifier", key: "attack", value: -1 } },
    { id: "combat-engineers", title: "Combat Engineers Forward", text: "Allied movement is +1 this turn.", effect: { type: "modifier", side: "allied", key: "move", value: 1 } },
    { id: "defensive-depth", title: "Defensive Depth", text: "German defense gains +1 this turn.", effect: { type: "modifier", side: "german", key: "defense", value: 1 } },
  ];

  const timeline = [
    { turn: 1, date: "1944-06-06", title: "Overlord begins", note: "Normandy lodgement, airborne drops, and beach supply are the opening focus." },
    { turn: 3, date: "1944-06-20", title: "Cherbourg drive", note: "US VIII Corps becomes available for the Cotentin and Brittany axis." },
    { turn: 8, date: "1944-07-25", title: "Cobra breakout", note: "US armored exploitation begins after the Normandy attrition phase." },
    { turn: 10, date: "1944-08-08", title: "Falaise pressure", note: "Canadian, British, and US forces converge toward the Falaise pocket." },
    { turn: 11, date: "1944-08-15", title: "Dragoon landing", note: "Southern France / Rhone corridor opens as a second Allied supply axis." },
    { turn: 13, date: "1944-08-29", title: "Paris and Seine pursuit", note: "Allied columns race east; German forces trade space for time." },
    { turn: 15, date: "1944-09-12", title: "Antwerp and Market Garden window", note: "Antwerp is a major prize, but Scheldt access must be cleared before it functions as a supply source." },
    { turn: 18, date: "1944-10-03", title: "Scheldt battle", note: "Clearing the estuary is a logistics priority for the broad front." },
    { turn: 21, date: "1944-10-24", title: "Autumn supply crisis", note: "Long supply lines and weather slow the Allied advance toward the Westwall." },
    { turn: 28, date: "1944-12-12", title: "Ardennes warning", note: "German panzer reserves gather for the winter counteroffensive." },
    { turn: 29, date: "1944-12-19", title: "Ardennes counteroffensive", note: "German armor attempts to break the Allied center and reach the Meuse/Antwerp axis." },
    { turn: 34, date: "1945-01-23", title: "Bulge reduced", note: "The western front resets for the Rhineland battles." },
    { turn: 36, date: "1945-02-06", title: "Rhineland operations", note: "Veritable, Grenade, and Saar operations pressure the west bank of the Rhine." },
    { turn: 40, date: "1945-03-06", title: "Remagen opportunity", note: "A Rhine bridgehead can accelerate the final campaign." },
    { turn: 42, date: "1945-03-20", title: "Rhine crossings", note: "Northern and central crossings open the Ruhr and central Germany." },
    { turn: 44, date: "1945-04-03", title: "Ruhr encirclement", note: "The industrial heartland becomes the decisive objective." },
    { turn: 48, date: "1945-05-01", title: "Elbe line", note: "Allied forces drive to the Elbe and final surrender conditions." },
  ];

  const initialControl = {};
  for (const cell of cells) {
    if (cell.terrain === "sea") {
      initialControl[cell.id] = "allied";
    }
  }
  for (const id of ["B2", "C2", "E3"]) {
    initialControl[id] = "allied";
  }

  const scenarios = [
    {
      id: "western-campaign-1944",
      name: "Full Western Campaign",
      turns: 49,
      startDate: "1944-06-06",
      turnScale: "1 week",
      summary: "Corps-scale western campaign from Normandy and Southern France to the Rhine, Ruhr, and Elbe.",
      designNotes: [
        "Original regional hex layout inspired by geography and public histories, not by any published game map.",
        "Corps counters abstract attached divisions and army-level assets.",
        "Stacking, ZOC, retreats, detailed port throughput, and scheduled event effects are reserved for later engine phases.",
      ],
      objectives: [
        "E5", "F5", "G6", "F7", "H8", "C8", "N6", "K9", "P5", "Q4", "P6", "Q5", "R4", "P9", "R7", "S7", "T7", "S10", "P11", "Q12", "R13", "M17", "N18", "O16", "L14", "Y8",
      ],
      alliedWin: { points: 34, must: ["P5", "S10", "T7", "Y8"] },
      supplySources: {
        allied: ["B2", "C2", "E3", "F5", "E5", "N6", "P5", "M17", "N18", "O16"],
        german: ["Z8", "Z11", "Z14", "Y8", "Y12", "Y15"],
      },
      timeline,
      deployments: [
        { ref: "us_v_corps", hex: "F5" },
        { ref: "us_vii_corps", hex: "E5" },
        { ref: "us_xix_corps", hex: "G5" },
        { ref: "br_i_corps", hex: "H5" },
        { ref: "br_xxx_corps", hex: "H6" },
        { ref: "ca_ii_corps", hex: "I5" },
        { ref: "allied_airborne", hex: "I6" },
        { ref: "allied_logistics", hex: "B2" },
        { ref: "us_viii_corps", entry: "F5", reinforceTurn: 3 },
        { ref: "us_xii_corps", entry: "F5", reinforceTurn: 8 },
        { ref: "us_xv_corps", entry: "K9", reinforceTurn: 10 },
        { ref: "us_xx_corps", entry: "K9", reinforceTurn: 12 },
        { ref: "us_vi_corps", entry: "L17", reinforceTurn: 11 },
        { ref: "fr_i_corps", entry: "N18", reinforceTurn: 12 },
        { ref: "fr_ii_corps", entry: "N18", reinforceTurn: 13 },
        { ref: "us_ninth_corps", entry: "P6", reinforceTurn: 15 },
        { ref: "br_viii_corps", entry: "N6", reinforceTurn: 16 },
        { ref: "ca_i_corps", entry: "R13", reinforceTurn: 36 },

        { ref: "g_lxxxiv", hex: "F6" },
        { ref: "g_7army", hex: "G7" },
        { ref: "g_i_ss_pz", hex: "H7" },
        { ref: "g_brittany", hex: "C8" },
        { ref: "g_15army", hex: "N5" },
        { ref: "g_scheldt", hex: "Q4" },
        { ref: "g_1para", hex: "R4" },
        { ref: "g_5pz", hex: "P9" },
        { ref: "g_1army", hex: "P11" },
        { ref: "g_19army", hex: "O16" },
        { ref: "g_westwall_aachen", hex: "R7" },
        { ref: "g_westwall_saar", hex: "Q12" },
        { ref: "g_rhine", hex: "S10" },
        { ref: "g_ruhr", hex: "T7" },
        { ref: "g_6pz", entry: "P9", reinforceTurn: 28 },
      ],
    },
  ];

  const westfrontData = {
    id: "westfront-campaign",
    name: "Western Front Campaign",
    description: "Original corps-scale 1944-45 campaign dataset for Northwest Europe plus Southern France / Rhone corridor.",
    sourceBasis: [
      "U.S. Army CMH campaign date summaries for Normandy, Northern France, Southern France, Rhineland, Ardennes-Alsace, and Central Europe.",
      "U.S. Army CMH ETO campaign volumes and public order-of-battle references for broad formation names.",
      "Government of Canada Normandy and 3rd Canadian Division public histories for Canadian campaign roles.",
    ],
    columns,
    rows,
    TERRAIN,
    cells,
    cellMap,
    roads,
    roadEdges,
    controlPoints,
    units,
    scenarios,
    events: campaignEvents,
    initialControl,
    supplySources: {
      allied: ["B2", "C2", "E3", "F5", "E5", "N6", "P5", "M17", "N18", "O16"],
      german: ["Z8", "Z11", "Z14", "Y8", "Y12", "Y15"],
    },
  };

  window.DDAY_DATASETS = window.DDAY_DATASETS || [];
  window.DDAY_DATASETS.push(westfrontData);
})();
