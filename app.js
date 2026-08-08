(function () {
  const DATASETS = window.DDAY_DATASETS && window.DDAY_DATASETS.length
    ? window.DDAY_DATASETS
    : [window.DDAY_DATA];
  let DATA = DATASETS[0];
  const PHASES = [
    { id: "event", label: "Event", side: null, action: "event" },
    { id: "alliedMove", label: "Allied Move", side: "allied", action: "move" },
    { id: "alliedCombat", label: "Allied Combat", side: "allied", action: "combat" },
    { id: "germanMove", label: "German Move", side: "german", action: "move" },
    { id: "germanCombat", label: "German Combat", side: "german", action: "combat" },
    { id: "logistics", label: "Logistics", side: null, action: "logistics" },
  ];

  const SIDE_LABELS = {
    allied: "Allied",
    german: "German",
    neutral: "Neutral",
  };

  const svg = document.getElementById("boardSvg");
  const datasetTabs = document.getElementById("datasetTabs");
  const scenarioSelect = document.getElementById("scenarioSelect");
  const scenarioCount = document.getElementById("scenarioCount");
  const loadScenarioBtn = document.getElementById("loadScenarioBtn");
  const nextPhaseBtn = document.getElementById("nextPhaseBtn");
  const drawEventBtn = document.getElementById("drawEventBtn");
  const germanAiBtn = document.getElementById("germanAiBtn");
  const resetBtn = document.getElementById("resetBtn");
  const selectedPanel = document.getElementById("selectedPanel");
  const selectedBadge = document.getElementById("selectedBadge");
  const objectivesPanel = document.getElementById("objectivesPanel");
  const eventPanel = document.getElementById("eventPanel");
  const unitsPanel = document.getElementById("unitsPanel");
  const logPanel = document.getElementById("logPanel");
  const scenarioName = document.getElementById("scenarioName");
  const turnLabel = document.getElementById("turnLabel");
  const phaseLabel = document.getElementById("phaseLabel");
  const scoreBadge = document.getElementById("scoreBadge");
  const eventBadge = document.getElementById("eventBadge");
  const unitBadge = document.getElementById("unitBadge");
  const statusBadge = document.getElementById("statusBadge");
  const combatRollOverlay = document.getElementById("combatRollOverlay");
  const combatRollMeta = document.getElementById("combatRollMeta");
  const combatDieFace = document.getElementById("combatDieFace");
  const combatRollValue = document.getElementById("combatRollValue");
  const combatRollMath = document.getElementById("combatRollMath");
  const combatRollOutcome = document.getElementById("combatRollOutcome");

  const HEX_SIZE = 31;
  const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
  const HEX_HEIGHT = HEX_SIZE * 2;
  const H_SPACING = HEX_WIDTH;
  const V_SPACING = HEX_SIZE * 1.5;
  const MAP_MARGIN_X = 54;
  const MAP_MARGIN_Y = 48;

  let state = null;
  let activeDatasetId = DATA.id;
  let combatRollQueue = [];
  let combatRollActive = false;
  let combatRollTimers = [];

  function init() {
    renderDatasetTabs();
    populateScenarioSelect(DATA.id, DATA.scenarios[0].id);

    loadScenarioBtn.addEventListener("click", () => loadScenario(currentScenarioSelection()));
    resetBtn.addEventListener("click", () => loadScenario(state.scenarioKey));
    nextPhaseBtn.addEventListener("click", nextPhase);
    drawEventBtn.addEventListener("click", drawEvent);
    germanAiBtn.addEventListener("click", runGermanAI);
    svg.addEventListener("click", handleBoardClick);
    unitsPanel.addEventListener("click", handleUnitListClick);

    loadScenario(scenarioKey(DATA, DATA.scenarios[0]));
  }

  function currentScenarioSelection() {
    const dataset = getDataset(activeDatasetId);
    return scenarioKey(dataset, { id: scenarioSelect.value });
  }

  function renderDatasetTabs() {
    datasetTabs.replaceChildren();
    for (const dataset of DATASETS) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "campaign-tab";
      button.dataset.dataset = dataset.id;
      button.setAttribute("role", "tab");
      button.textContent = dataset.name;
      button.addEventListener("click", () => populateScenarioSelect(dataset.id));
      datasetTabs.appendChild(button);
    }
    updateDatasetTabs(activeDatasetId);
  }

  function updateDatasetTabs(datasetId) {
    for (const button of Array.from(datasetTabs.children)) {
      const selected = button.dataset.dataset === datasetId;
      button.className = selected ? "campaign-tab is-active" : "campaign-tab";
      button.setAttribute("aria-selected", `${selected}`);
    }
  }

  function populateScenarioSelect(datasetId, selectedScenarioId) {
    const dataset = getDataset(datasetId);
    activeDatasetId = dataset.id;
    updateDatasetTabs(dataset.id);
    scenarioSelect.replaceChildren();
    for (const scenario of dataset.scenarios) {
      const option = document.createElement("option");
      option.value = scenario.id;
      option.textContent = scenario.name;
      scenarioSelect.appendChild(option);
    }
    scenarioSelect.value = selectedScenarioId || dataset.scenarios[0].id;
    scenarioCount.textContent = `${dataset.scenarios.length} ${dataset.scenarios.length === 1 ? "scenario" : "scenarios"}`;
  }

  function getDataset(datasetId) {
    return DATASETS.find((item) => item.id === datasetId) || DATASETS[0];
  }

  function scenarioKey(dataset, scenario) {
    return `${dataset.id}::${scenario.id}`;
  }

  function findScenario(selection) {
    const [datasetId, scenarioId] = String(selection).includes("::")
      ? String(selection).split("::")
      : [DATA.id, selection];
    const dataset = getDataset(datasetId);
    const scenario = dataset.scenarios.find((item) => item.id === scenarioId) || dataset.scenarios[0];
    return { dataset, scenario, key: scenarioKey(dataset, scenario) };
  }

  function loadScenario(selection) {
    clearCombatRollAnimation();
    const found = findScenario(selection);
    DATA = found.dataset;
    const scenario = found.scenario;
    populateScenarioSelect(DATA.id, scenario.id);
    const units = scenario.deployments.map((deployment) => cloneUnit(deployment));
    state = {
      dataset: DATA,
      scenario,
      scenarioKey: found.key,
      turn: 1,
      phaseIndex: 0,
      units,
      control: createInitialControl(scenario),
      selectedUnitId: null,
      activeEvent: null,
      eventDrawn: false,
      eventDeck: shuffle([...DATA.events]),
      eventDiscard: [],
      turnMods: createEmptyTurnMods(),
      log: [],
      finished: false,
    };
    updateControlFromUnits();
    placeDueReinforcements();
    addLog(`${scenario.name} loaded.`);
    render();
  }

  function cloneUnit(deployment) {
    const base = DATA.units[deployment.ref];
    return {
      ...base,
      location: deployment.hex || null,
      entry: deployment.entry || deployment.hex || null,
      reinforceTurn: deployment.reinforceTurn || null,
      currentSteps: base.steps,
      moved: false,
      attacked: false,
      eliminated: false,
    };
  }

  function createInitialControl(scenario) {
    const control = {};
    const datasetControl = DATA.initialControl || {};
    const scenarioControl = scenario.initialControl || {};
    for (const cell of DATA.cells) {
      if (scenarioControl[cell.id]) {
        control[cell.id] = scenarioControl[cell.id];
      } else if (datasetControl[cell.id]) {
        control[cell.id] = datasetControl[cell.id];
      } else if (cell.terrain === "sea") {
        control[cell.id] = "allied";
      } else {
        control[cell.id] = "german";
      }
    }
    return control;
  }

  function createEmptyTurnMods() {
    return {
      allied: { move: 0, attack: 0, defense: 0 },
      german: { move: 0, attack: 0, defense: 0 },
    };
  }

  function addLog(message) {
    state.log.unshift(`T${state.turn} ${currentPhase().label}: ${message}`);
    state.log = state.log.slice(0, 32);
  }

  function currentPhase() {
    return PHASES[state.phaseIndex];
  }

  function nextPhase() {
    if (state.finished) {
      return;
    }

    if (currentPhase().id === "event" && !state.eventDrawn) {
      drawEvent();
    }

    if (currentPhase().id === "logistics") {
      resolveLogistics();
      if (state.finished) {
        render();
        return;
      }
      state.phaseIndex = 0;
      state.turn += 1;
      startTurn();
    } else {
      state.phaseIndex += 1;
    }

    state.selectedUnitId = null;
    render();
  }

  function startTurn() {
    state.turnMods = createEmptyTurnMods();
    state.activeEvent = null;
    state.eventDrawn = false;
    for (const unit of state.units) {
      unit.moved = false;
      unit.attacked = false;
    }
    placeDueReinforcements();
  }

  function resolveLogistics() {
    updateControlFromUnits();
    const result = evaluateVictory();
    if (state.turn >= state.scenario.turns) {
      state.finished = true;
      statusBadge.textContent = result.winner;
      addLog(result.text);
    } else {
      addLog(result.text);
    }
  }

  function drawEvent() {
    if (state.finished || currentPhase().id !== "event" || state.eventDrawn) {
      return;
    }
    if (state.eventDeck.length === 0) {
      state.eventDeck = shuffle(state.eventDiscard);
      state.eventDiscard = [];
    }
    const event = state.eventDeck.pop();
    state.activeEvent = event;
    state.eventDrawn = true;
    state.eventDiscard.push(event);
    applyEvent(event);
    render();
  }

  function applyEvent(event) {
    const effect = event.effect;
    if (!effect) {
      addLog(`${event.title}.`);
      return;
    }

    if (effect.type === "modifier") {
      applyModifier(effect.side, effect.key, effect.value);
      addLog(`${event.title}: ${SIDE_LABELS[effect.side]} ${effect.key} ${signed(effect.value)}.`);
      return;
    }

    if (effect.type === "dualModifier") {
      applyModifier("allied", effect.key, effect.value);
      applyModifier("german", effect.key, effect.value);
      addLog(`${event.title}: both sides ${effect.key} ${signed(effect.value)}.`);
      return;
    }

    if (effect.type === "multiModifier") {
      for (const modifier of effect.modifiers) {
        applyModifier(modifier.side, modifier.key, modifier.value);
      }
      addLog(`${event.title}: multiple modifiers applied.`);
      return;
    }

    if (effect.type === "stepLoss") {
      const candidates = liveUnits(effect.side).filter((unit) => unit.location);
      if (!candidates.length) {
        addLog(`${event.title}: no target.`);
        return;
      }
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      applyStepLoss(target, effect.amount || 1);
      addLog(`${event.title}: ${target.short} loses one step.`);
      return;
    }

    if (effect.type === "reinforce") {
      const candidate = state.units
        .filter(
          (unit) =>
            unit.side === effect.side &&
            !unit.location &&
            !unit.eliminated &&
            unit.reinforceTurn &&
            unit.reinforceTurn > state.turn,
        )
        .sort((a, b) => a.reinforceTurn - b.reinforceTurn)[0];
      if (!candidate) {
        addLog(`${event.title}: no reserve available.`);
        return;
      }
      candidate.reinforceTurn = state.turn;
      placeUnitAtEntry(candidate);
      addLog(`${event.title}: ${candidate.short} enters early.`);
    }
  }

  function applyModifier(side, key, value) {
    state.turnMods[side][key] += value;
  }

  function signed(value) {
    return value >= 0 ? `+${value}` : `${value}`;
  }

  function handleBoardClick(event) {
    const unitNode = event.target.closest("[data-unit]");
    const cellNode = event.target.closest("[data-cell]");
    if (!state || state.finished) {
      return;
    }

    if (unitNode) {
      const clicked = getUnit(unitNode.dataset.unit);
      const selected = getSelectedUnit();
      if (selected && canAttack(selected, clicked)) {
        attackUnit(selected, clicked);
      } else {
        state.selectedUnitId = clicked.id;
        render();
      }
      return;
    }

    if (cellNode) {
      const cellId = cellNode.dataset.cell;
      const selected = getSelectedUnit();
      const occupant = occupantAt(cellId);
      if (occupant) {
        state.selectedUnitId = occupant.id;
        render();
        return;
      }
      if (selected && canMoveTo(selected, cellId)) {
        moveUnit(selected, cellId);
      } else {
        state.selectedUnitId = null;
        render();
      }
    }
  }

  function handleUnitListClick(event) {
    const row = event.target.closest("[data-unit]");
    if (!row) {
      return;
    }
    state.selectedUnitId = row.dataset.unit;
    render();
  }

  function canMoveTo(unit, cellId) {
    const phase = currentPhase();
    if (phase.action !== "move" || phase.side !== unit.side || unit.moved || !unit.location) {
      return false;
    }
    return getReachable(unit).has(cellId);
  }

  function moveUnit(unit, cellId) {
    const from = unit.location;
    unit.location = cellId;
    unit.moved = true;
    state.control[cellId] = unit.side;
    addLog(`${unit.short} moves ${from} to ${cellId}.`);
    render();
  }

  function canAttack(attacker, defender) {
    const phase = currentPhase();
    if (
      !attacker ||
      !defender ||
      attacker.side === defender.side ||
      phase.action !== "combat" ||
      phase.side !== attacker.side ||
      attacker.attacked ||
      !attacker.location ||
      !defender.location
    ) {
      return false;
    }
    return neighbors(attacker.location).includes(defender.location);
  }

  function attackUnit(attacker, defender) {
    const terrain = DATA.TERRAIN[DATA.cellMap[defender.location].terrain];
    const roll = rollDie();
    const support = getSupportBonus(attacker, defender);
    const attack = getAttackValue(attacker) + support;
    const defense = getDefenseValue(defender) + terrain.defense;
    const score = roll + attack - defense;
    let outcome = "no effect";

    if (score >= 7) {
      applyStepLoss(defender, 2);
      outcome = "breakthrough";
    } else if (score >= 4) {
      applyStepLoss(defender, 1);
      outcome = "hit";
    } else if (score <= 0) {
      applyStepLoss(attacker, 1);
      outcome = "attacker loss";
    }

    const combatResult = {
      attacker: attacker.short,
      defender: defender.short,
      attackerSide: attacker.side,
      roll,
      attack,
      defense,
      score,
      outcome,
    };

    attacker.attacked = true;
    addLog(
      `${attacker.short} attacks ${defender.short}: d6=${roll}, A${attack}/D${defense}, ${outcome}.`,
    );
    updateControlFromUnits();
    render();
    queueCombatRoll(combatResult);
  }

  function applyStepLoss(unit, amount) {
    unit.currentSteps -= amount;
    if (unit.currentSteps <= 0) {
      unit.currentSteps = 0;
      unit.eliminated = true;
      unit.location = null;
      state.selectedUnitId = state.selectedUnitId === unit.id ? null : state.selectedUnitId;
    }
  }

  function getAttackValue(unit) {
    const supplyPenalty = isInSupply(unit) ? 0 : -1;
    return Math.max(1, unit.attack + state.turnMods[unit.side].attack + supplyPenalty);
  }

  function getDefenseValue(unit) {
    const supplyPenalty = isInSupply(unit) ? 0 : -1;
    return Math.max(1, unit.defense + state.turnMods[unit.side].defense + supplyPenalty);
  }

  function getEffectiveMove(unit) {
    const supplyPenalty = isInSupply(unit) ? 0 : -1;
    return Math.max(1, unit.move + state.turnMods[unit.side].move + supplyPenalty);
  }

  function getSupportBonus(attacker, defender) {
    const nearby = new Set([...neighbors(attacker.location), ...neighbors(defender.location)]);
    const hasSupport = liveUnits(attacker.side).some(
      (unit) =>
        unit.id !== attacker.id &&
        unit.location &&
        nearby.has(unit.location) &&
        (unit.type === "hq" || unit.type === "engineer"),
    );
    const engineerBonus =
      attacker.traits.includes("engineer") &&
      ["beach", "river", "town"].includes(DATA.cellMap[defender.location].terrain)
        ? 1
        : 0;
    return (hasSupport ? 1 : 0) + engineerBonus;
  }

  function getReachable(unit) {
    const movement = getEffectiveMove(unit);
    const costs = new Map([[unit.location, 0]]);
    const frontier = [{ id: unit.location, cost: 0 }];
    const reachable = new Set();

    while (frontier.length) {
      frontier.sort((a, b) => a.cost - b.cost);
      const current = frontier.shift();
      if (current.cost > movement) {
        continue;
      }
      for (const neighborId of neighbors(current.id)) {
        const cell = DATA.cellMap[neighborId];
        const terrain = DATA.TERRAIN[cell.terrain];
        const occupied = occupantAt(neighborId);
        if (terrain.impassable || occupied) {
          continue;
        }

        let stepCost = terrain.move;
        if (DATA.roadEdges.has(edgeKey(current.id, neighborId))) {
          stepCost = Math.min(stepCost, 1);
        }
        if (unit.traits.includes("engineer") && stepCost > 1) {
          stepCost -= 1;
        }

        const nextCost = current.cost + stepCost;
        if (nextCost > movement) {
          continue;
        }
        const known = costs.get(neighborId);
        if (known === undefined || nextCost < known) {
          costs.set(neighborId, nextCost);
          frontier.push({ id: neighborId, cost: nextCost });
          reachable.add(neighborId);
        }
      }
    }

    return reachable;
  }

  function neighbors(cellId) {
    const cell = DATA.cellMap[cellId];
    if (!cell) {
      return [];
    }
    const rowIndex = cell.row - 1;
    const even = rowIndex % 2 === 0;
    const offsets = even
      ? [
          [1, 0],
          [0, 1],
          [-1, 1],
          [-1, 0],
          [-1, -1],
          [0, -1],
        ]
      : [
          [1, 0],
          [1, 1],
          [0, 1],
          [-1, 0],
          [0, -1],
          [1, -1],
        ];

    return offsets
      .map(([dc, dr]) => {
        const col = cell.col + dc;
        const row = cell.row + dr;
        return `${DATA.columns[col] || ""}${row}`;
      })
      .filter((id) => DATA.cellMap[id]);
  }

  function edgeKey(a, b) {
    return [a, b].sort().join("-");
  }

  function occupantAt(cellId) {
    return state.units.find((unit) => unit.location === cellId && !unit.eliminated) || null;
  }

  function liveUnits(side) {
    return state.units.filter((unit) => !unit.eliminated && (!side || unit.side === side));
  }

  function getUnit(unitId) {
    return state.units.find((unit) => unit.id === unitId) || null;
  }

  function getSelectedUnit() {
    return state.selectedUnitId ? getUnit(state.selectedUnitId) : null;
  }

  function updateControlFromUnits() {
    for (const unit of liveUnits()) {
      if (unit.location) {
        state.control[unit.location] = unit.side;
      }
    }
  }

  function placeDueReinforcements() {
    for (const unit of state.units) {
      if (!unit.location && !unit.eliminated && unit.reinforceTurn && unit.reinforceTurn <= state.turn) {
        placeUnitAtEntry(unit);
        addLog(`${unit.short} enters at ${unit.location}.`);
      }
    }
  }

  function placeUnitAtEntry(unit) {
    const entries = Array.isArray(unit.entry) ? unit.entry : [unit.entry];
    for (const entry of entries) {
      const cell = findOpenCell(entry);
      if (cell) {
        unit.location = cell;
        state.control[cell] = unit.side;
        return true;
      }
    }
    return false;
  }

  function findOpenCell(startId) {
    if (!startId || !DATA.cellMap[startId]) {
      return null;
    }
    const seen = new Set([startId]);
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift();
      const cell = DATA.cellMap[id];
      if (!DATA.TERRAIN[cell.terrain].impassable && !occupantAt(id)) {
        return id;
      }
      for (const next of neighbors(id)) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return null;
  }

  function isInSupply(unit) {
    if (!unit.location || unit.eliminated) {
      return false;
    }
    const sources = getSupplySources(unit.side);
    if (sources.includes(unit.location)) {
      return true;
    }
    const enemySide = unit.side === "allied" ? "german" : "allied";
    const enemyHexes = new Set(liveUnits(enemySide).map((enemy) => enemy.location).filter(Boolean));
    const seen = new Set(sources);
    const queue = sources.map((id) => ({ id, depth: 0 }));
    const maxDepth = unit.side === "allied" ? 6 : 5;

    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= maxDepth) {
        continue;
      }
      for (const next of neighbors(current.id)) {
        if (seen.has(next) || enemyHexes.has(next)) {
          continue;
        }
        const terrain = DATA.TERRAIN[DATA.cellMap[next].terrain];
        if (terrain.impassable) {
          continue;
        }
        if (next === unit.location) {
          return true;
        }
        seen.add(next);
        queue.push({ id: next, depth: current.depth + 1 });
      }
    }
    return false;
  }

  function getSupplySources(side) {
    const configured = [
      ...((DATA.supplySources && DATA.supplySources[side]) || []),
      ...((state.scenario.supplySources && state.scenario.supplySources[side]) || []),
    ].filter((id) => DATA.cellMap[id] && state.control[id] === side);
    const objectiveSources = state.scenario.objectives.filter((id) => {
      const point = DATA.controlPoints[id];
      return point && state.control[id] === side && isSupplyPointFor(point, side);
    });
    const sources = [...new Set([...configured, ...objectiveSources])];

    if (sources.length || side === "allied") {
      return sources;
    }

    return DATA.cells
      .filter(
        (cell) =>
          cell.terrain !== "sea" &&
          (cell.row >= DATA.rows - 1 || cell.col === DATA.columns.length - 1) &&
          state.control[cell.id] === "german",
      )
      .map((cell) => cell.id);
  }

  function isSupplyPointFor(point, side) {
    if (point.supplyFor) {
      return point.supplyFor.includes(side);
    }
    if (point.supply) {
      return true;
    }
    return side === "allied" && ["beach", "port"].includes(point.kind);
  }

  function evaluateVictory() {
    const alliedPoints = getAlliedObjectivePoints();
    const mustMet = state.scenario.alliedWin.must.every((id) => state.control[id] === "allied");
    const needed = state.scenario.alliedWin.points;
    if (alliedPoints >= needed && mustMet) {
      return {
        winner: "Allied",
        text: `Allied victory track: ${alliedPoints}/${needed}, required objectives held.`,
      };
    }
    if (state.turn >= state.scenario.turns) {
      return {
        winner: "German",
        text: `German victory: Allied track ${alliedPoints}/${needed}.`,
      };
    }
    return {
      winner: "Live",
      text: `Objective track: ${alliedPoints}/${needed}.`,
    };
  }

  function getAlliedObjectivePoints() {
    return state.scenario.objectives.reduce((total, id) => {
      const point = DATA.controlPoints[id];
      return total + (state.control[id] === "allied" ? point.value : 0);
    }, 0);
  }

  function runGermanAI() {
    const phase = currentPhase();
    if (state.finished || phase.side !== "german") {
      return;
    }
    if (phase.action === "move") {
      let moves = 0;
      for (const unit of liveUnits("german")) {
        if (!unit.location || unit.moved || adjacentEnemies(unit).length) {
          continue;
        }
        const choices = [...getReachable(unit)];
        const best = choices
          .map((id) => ({ id, score: germanMoveScore(id) }))
          .sort((a, b) => a.score - b.score)[0];
        if (best && best.score < germanMoveScore(unit.location)) {
          unit.location = best.id;
          unit.moved = true;
          state.control[best.id] = "german";
          moves += 1;
        }
      }
      addLog(`German AI moved ${moves} units.`);
    }
    if (phase.action === "combat") {
      let attacks = 0;
      for (const unit of liveUnits("german")) {
        if (!unit.location || unit.attacked) {
          continue;
        }
        const target = adjacentEnemies(unit).sort((a, b) => getDefenseValue(a) - getDefenseValue(b))[0];
        if (target) {
          attackUnit(unit, target);
          attacks += 1;
        }
      }
      if (!attacks) {
        addLog("German AI found no attacks.");
      }
    }
    render();
  }

  function adjacentEnemies(unit) {
    const enemySide = unit.side === "allied" ? "german" : "allied";
    const around = new Set(neighbors(unit.location));
    return liveUnits(enemySide).filter((enemy) => around.has(enemy.location));
  }

  function germanMoveScore(cellId) {
    const alliedTargets = [
      ...liveUnits("allied").map((unit) => unit.location).filter(Boolean),
      ...state.scenario.objectives.filter((id) => state.control[id] === "allied"),
    ];
    if (!alliedTargets.length) {
      return 99;
    }
    return Math.min(...alliedTargets.map((target) => hexDistance(cellId, target)));
  }

  function hexDistance(a, b) {
    const ac = offsetToCube(DATA.cellMap[a]);
    const bc = offsetToCube(DATA.cellMap[b]);
    return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
  }

  function offsetToCube(cell) {
    const row = cell.row - 1;
    const x = cell.col - (row - (row & 1)) / 2;
    const z = row;
    const y = -x - z;
    return { x, y, z };
  }

  function rollDie() {
    return Math.floor(Math.random() * 6) + 1;
  }

  function queueCombatRoll(result) {
    if (!combatRollOverlay) {
      return;
    }
    combatRollQueue.push(result);
    if (!combatRollActive) {
      playNextCombatRoll();
    }
  }

  function playNextCombatRoll() {
    const result = combatRollQueue.shift();
    if (!result) {
      combatRollActive = false;
      return;
    }
    combatRollActive = true;
    showCombatRoll(result, () => {
      combatRollActive = false;
      playNextCombatRoll();
    });
  }

  function showCombatRoll(result, onDone) {
    const reducedMotion = prefersReducedMotion();
    const revealDelay = reducedMotion ? 0 : 620;
    const holdDelay = reducedMotion ? 1100 : 1350;
    let frame = 0;
    let rollInterval = null;

    combatRollOverlay.hidden = false;
    combatRollOverlay.className = `combat-roll is-visible is-rolling ${result.attackerSide}`;
    combatRollOverlay.setAttribute("aria-label", combatRollSummary(result));
    combatRollMeta.textContent = `${result.attacker} attacks ${result.defender}`;
    combatRollValue.textContent = reducedMotion ? `d6 ${result.roll}` : "d6";
    combatRollMath.textContent = `A${result.attack} vs D${result.defense}`;
    combatRollOutcome.textContent = reducedMotion ? outcomeLabel(result.outcome) : "Rolling...";
    combatRollOutcome.className = "combat-roll-outcome";
    setDieFace(reducedMotion ? result.roll : animatedDieValue(frame, result.roll));

    if (!reducedMotion) {
      rollInterval = scheduleCombatInterval(() => {
        frame += 1;
        setDieFace(animatedDieValue(frame, result.roll));
      }, 74);
    }

    scheduleCombatTimeout(() => {
      if (rollInterval !== null) {
        clearCombatTimer("interval", rollInterval);
      }
      setDieFace(result.roll);
      combatRollOverlay.classList.remove("is-rolling");
      combatRollOverlay.classList.add("is-revealed");
      combatRollValue.textContent = `d6 ${result.roll}`;
      combatRollMath.textContent = `${result.roll} + A${result.attack} - D${result.defense} = ${result.score}`;
      combatRollOutcome.textContent = outcomeLabel(result.outcome);
      combatRollOutcome.className = `combat-roll-outcome ${outcomeClass(result.outcome)}`;

      scheduleCombatTimeout(() => {
        hideCombatRoll();
        onDone();
      }, holdDelay);
    }, revealDelay);
  }

  function animatedDieValue(frame, finalRoll) {
    return ((frame + finalRoll + 1) % 6) + 1;
  }

  function setDieFace(value) {
    combatDieFace.dataset.value = `${value}`;
  }

  function outcomeLabel(outcome) {
    if (outcome === "breakthrough") {
      return "Breakthrough";
    }
    if (outcome === "hit") {
      return "Hit";
    }
    if (outcome === "attacker loss") {
      return "Attacker Loss";
    }
    return "No Effect";
  }

  function outcomeClass(outcome) {
    return `outcome-${outcome.replace(/\s+/g, "-")}`;
  }

  function combatRollSummary(result) {
    return `${result.attacker} attacks ${result.defender}. d6 ${result.roll}. Attack ${result.attack}, defense ${result.defense}, score ${result.score}. ${outcomeLabel(result.outcome)}.`;
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function scheduleCombatTimeout(callback, delay) {
    const id = window.setTimeout(() => {
      removeCombatTimer("timeout", id);
      callback();
    }, delay);
    combatRollTimers.push({ kind: "timeout", id });
    return id;
  }

  function scheduleCombatInterval(callback, delay) {
    const id = window.setInterval(callback, delay);
    combatRollTimers.push({ kind: "interval", id });
    return id;
  }

  function clearCombatTimer(kind, id) {
    if (kind === "interval") {
      window.clearInterval(id);
    } else {
      window.clearTimeout(id);
    }
    removeCombatTimer(kind, id);
  }

  function removeCombatTimer(kind, id) {
    combatRollTimers = combatRollTimers.filter((timer) => timer.kind !== kind || timer.id !== id);
  }

  function clearCombatRollAnimation() {
    combatRollQueue = [];
    combatRollActive = false;
    for (const timer of combatRollTimers) {
      if (timer.kind === "interval") {
        window.clearInterval(timer.id);
      } else {
        window.clearTimeout(timer.id);
      }
    }
    combatRollTimers = [];
    hideCombatRoll();
  }

  function hideCombatRoll() {
    if (!combatRollOverlay) {
      return;
    }
    combatRollOverlay.hidden = true;
    combatRollOverlay.className = "combat-roll";
    combatRollOverlay.removeAttribute("aria-label");
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function render() {
    renderStatus();
    renderBoard();
    renderSelected();
    renderObjectives();
    renderEvent();
    renderUnits();
    renderLog();
    renderControls();
  }

  function renderStatus() {
    scenarioName.textContent = state.scenario.name;
    turnLabel.textContent = `Turn ${state.turn} / ${state.scenario.turns}`;
    phaseLabel.textContent = currentPhase().label;
    const alliedPoints = getAlliedObjectivePoints();
    scoreBadge.textContent = `${alliedPoints} / ${state.scenario.alliedWin.points}`;
    unitBadge.textContent = `${liveUnits().length}`;
    statusBadge.textContent = state.finished ? evaluateVictory().winner : "Live";
  }

  function renderControls() {
    drawEventBtn.disabled = state.finished || currentPhase().id !== "event" || state.eventDrawn;
    nextPhaseBtn.disabled = state.finished;
    germanAiBtn.disabled = state.finished || currentPhase().side !== "german";
  }

  function renderBoard() {
    const phase = currentPhase();
    const selected = getSelectedUnit();
    const reachable =
      selected && phase.action === "move" && phase.side === selected.side && !selected.moved
        ? getReachable(selected)
        : new Set();
    const targets = selected
      ? new Set(adjacentEnemies(selected).filter((unit) => canAttack(selected, unit)).map((unit) => unit.location))
      : new Set();

    const width = MAP_MARGIN_X * 2 + H_SPACING * (DATA.columns.length - 1) + HEX_WIDTH + H_SPACING / 2;
    const height = MAP_MARGIN_Y * 2 + V_SPACING * (DATA.rows - 1) + HEX_HEIGHT;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.replaceChildren();

    const background = makeSvg("rect", {
      x: 0,
      y: 0,
      width,
      height,
      fill: "#d6cdb6",
    });
    svg.appendChild(background);

    for (const cell of DATA.cells) {
      const center = cellCenter(cell.id);
      const polygon = makeSvg("polygon", {
        points: hexPoints(center.x, center.y, HEX_SIZE),
        class: [
          "hex",
          cell.terrain,
          reachable.has(cell.id) ? "reachable" : "",
          targets.has(cell.id) ? "attackable" : "",
          selected && selected.location === cell.id ? "selected-cell" : "",
        ]
          .filter(Boolean)
          .join(" "),
        "data-cell": cell.id,
      });
      svg.appendChild(polygon);

      if (cell.objective) {
        svg.appendChild(
          makeSvg("circle", {
            class: "hex-objective",
            cx: center.x,
            cy: center.y,
            r: HEX_SIZE - 6,
          }),
        );
      }
    }

    renderRoads();
    renderCellLabels();
    renderControlDots();
    renderCounters();
  }

  function renderRoads() {
    for (const road of DATA.roads) {
      const points = road
        .map((id) => cellCenter(id))
        .map((point) => `${point.x},${point.y}`)
        .join(" ");
      svg.appendChild(makeSvg("polyline", { class: "road-line", points }));
    }
  }

  function renderCellLabels() {
    for (const cell of DATA.cells) {
      const center = cellCenter(cell.id);
      svg.appendChild(
        makeSvg("text", {
          class: "cell-id",
          x: center.x,
          y: center.y - 16,
        }, cell.id),
      );
      if (cell.label) {
        svg.appendChild(
          makeSvg("text", {
            class: "cell-label",
            x: center.x,
            y: center.y + 19,
          }, cell.label),
        );
      }
    }
  }

  function renderControlDots() {
    for (const id of state.scenario.objectives) {
      const center = cellCenter(id);
      const side = state.control[id] || "neutral";
      svg.appendChild(
        makeSvg("circle", {
          class: `control-dot ${side}`,
          cx: center.x + 18,
          cy: center.y - 18,
          r: 5,
        }),
      );
    }
  }

  function renderCounters() {
    for (const unit of liveUnits()) {
      if (!unit.location) {
        continue;
      }
      const center = cellCenter(unit.location);
      const selected = state.selectedUnitId === unit.id;
      const spent =
        (currentPhase().action === "move" && unit.moved) ||
        (currentPhase().action === "combat" && unit.attacked);
      const group = makeSvg("g", {
        class: ["unit-counter", unit.side, selected ? "is-selected" : "", spent ? "is-spent" : ""]
          .filter(Boolean)
          .join(" "),
        "data-unit": unit.id,
        transform: `translate(${center.x - 18}, ${center.y - 17})`,
      });
      group.appendChild(
        makeSvg("rect", {
          class: "counter-box",
          x: 0,
          y: 0,
          width: 36,
          height: 34,
          rx: 3,
        }),
      );
      group.appendChild(makeSvg("text", { class: "counter-name", x: 18, y: 8 }, unit.short));
      group.appendChild(makeSvg("text", { class: "counter-symbol", x: 18, y: 20 }, unit.symbol));
      group.appendChild(
        makeSvg(
          "text",
          { class: "counter-stats", x: 18, y: 31 },
          `${unit.attack}-${unit.defense}-${unit.move} / ${unit.currentSteps}`,
        ),
      );
      svg.appendChild(group);
    }
  }

  function renderSelected() {
    const unit = getSelectedUnit();
    if (!unit) {
      selectedBadge.textContent = "None";
      selectedPanel.innerHTML = "<div class=\"muted\">No selection.</div>";
      return;
    }
    const terrainName = unit.location ? DATA.TERRAIN[DATA.cellMap[unit.location].terrain].name : "Off map";
    const supply = isInSupply(unit) ? "Supply" : "No supply";
    selectedBadge.textContent = SIDE_LABELS[unit.side];
    selectedPanel.innerHTML = `
      <div class="selected-name">${unit.name}</div>
      <div>${unit.location || "Off map"} / ${terrainName} / ${supply}</div>
      <div class="stat-grid">
        <div class="stat"><span>Attack</span><strong>${getAttackValue(unit)}</strong></div>
        <div class="stat"><span>Defense</span><strong>${getDefenseValue(unit)}</strong></div>
        <div class="stat"><span>Move</span><strong>${getEffectiveMove(unit)}</strong></div>
        <div class="stat"><span>Steps</span><strong>${unit.currentSteps}</strong></div>
      </div>
      <small>${unit.type} / ${unit.traits.join(", ") || "line"}</small>
    `;
  }

  function renderObjectives() {
    objectivesPanel.replaceChildren();
    for (const id of state.scenario.objectives) {
      const point = DATA.controlPoints[id];
      const side = state.control[id] || "neutral";
      const row = document.createElement("div");
      row.className = "objective-row";
      row.innerHTML = `
        <div>
          <b>${point.name}</b>
          <small>${id} / ${point.kind} / ${point.value} VP</small>
        </div>
        <span class="chip ${side}">${SIDE_LABELS[side]}</span>
      `;
      objectivesPanel.appendChild(row);
    }
  }

  function renderEvent() {
    const timeline = currentTimelineEntry();
    const timelineHtml = timeline
      ? `<small>${timeline.date}: ${timeline.title} - ${timeline.note}</small>`
      : "";
    if (!state.activeEvent) {
      eventBadge.textContent = state.eventDrawn ? "Done" : "Ready";
      eventPanel.innerHTML = `
        <div class="event-title">${state.scenario.summary}</div>
        <p class="event-text">Deck ${state.eventDeck.length}, discard ${state.eventDiscard.length}</p>
        ${timelineHtml}
      `;
      return;
    }
    eventBadge.textContent = state.eventDrawn ? "Active" : "Ready";
    eventPanel.innerHTML = `
      <div class="event-title">${state.activeEvent.title}</div>
      <p class="event-text">${state.activeEvent.text}</p>
      <small>Deck ${state.eventDeck.length}, discard ${state.eventDiscard.length}</small>
      ${timelineHtml}
    `;
  }

  function currentTimelineEntry() {
    if (!state.scenario.timeline) {
      return null;
    }
    return state.scenario.timeline.find((item) => item.turn === state.turn) || null;
  }

  function renderUnits() {
    unitsPanel.replaceChildren();
    for (const unit of state.units) {
      const row = document.createElement("div");
      row.className = [
        "unit-row",
        unit.side,
        state.selectedUnitId === unit.id ? "is-selected" : "",
        unit.eliminated ? "is-eliminated" : "",
      ]
        .filter(Boolean)
        .join(" ");
      row.dataset.unit = unit.id;
      const status = unit.eliminated
        ? "Eliminated"
        : unit.location
          ? `${unit.location} / ${isInSupply(unit) ? "Supply" : "No supply"}`
          : `Turn ${unit.reinforceTurn} reserve`;
      row.innerHTML = `
        <div>
          <b>${unit.short} ${unit.name}</b>
          <small>${status}</small>
        </div>
        <span class="chip ${unit.side}">${unit.currentSteps}</span>
      `;
      unitsPanel.appendChild(row);
    }
  }

  function renderLog() {
    logPanel.replaceChildren();
    for (const item of state.log) {
      const li = document.createElement("li");
      li.textContent = item;
      logPanel.appendChild(li);
    }
  }

  function cellCenter(cellId) {
    const cell = DATA.cellMap[cellId];
    const rowIndex = cell.row - 1;
    return {
      x: MAP_MARGIN_X + cell.col * H_SPACING + (rowIndex % 2 ? H_SPACING / 2 : 0) + HEX_SIZE,
      y: MAP_MARGIN_Y + rowIndex * V_SPACING + HEX_HEIGHT / 2,
    };
  }

  function hexPoints(cx, cy, size) {
    const points = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 180) * (30 + 60 * i);
      points.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
    }
    return points.join(" ");
  }

  function makeSvg(name, attrs, text) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs || {})) {
      node.setAttribute(key, value);
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  window.addEventListener("DOMContentLoaded", init);
})();
