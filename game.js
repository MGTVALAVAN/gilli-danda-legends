const canvas = document.getElementById("ground");
const ctx = canvas.getContext("2d");

const overlayEl = document.getElementById("overlayText");
const windEl = document.getElementById("windText");
const fieldingPanelEl = document.getElementById("fieldingPanel");
const joystickBaseEl = document.getElementById("joystickBase");
const joystickKnobEl = document.getElementById("joystickKnob");

const teamATotalEl = document.getElementById("teamATotal");
const teamAInningsEl = document.getElementById("teamAInnings");
const teamBTotalEl = document.getElementById("teamBTotal");
const teamBInningsEl = document.getElementById("teamBInnings");
const inningsTextEl = document.getElementById("inningsText");
const battingTextEl = document.getElementById("battingText");
const wicketsTextEl = document.getElementById("wicketsText");
const targetTextEl = document.getElementById("targetText");
const strikerTextEl = document.getElementById("strikerText");
const attemptTextEl = document.getElementById("attemptText");
const shotTextEl = document.getElementById("shotText");

const teamAcard = document.getElementById("teamAcard");
const teamBcard = document.getElementById("teamBcard");

const modeSelect = document.getElementById("modeSelect");
const variantSelect = document.getElementById("variantSelect");
const difficultySelect = document.getElementById("difficultySelect");
const controlSelect = document.getElementById("controlSelect");
const playersSelect = document.getElementById("playersSelect");

const liftBtn = document.getElementById("liftBtn");
const swingBtn = document.getElementById("swingBtn");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

const GRAVITY = 1260;
const GROUND_Y = 362;
const HOLE_X = 240;
const PX_PER_FOOT = 20;

const VARIANT_RULES = {
  classic: { name: "Classic", flipSkill: 0.79, catchBonus: 0, throwOutBonus: 0, distanceFactor: 1, maxAttempts: 3 },
  danguli: { name: "Danguli", flipSkill: 0.8, catchBonus: -0.05, throwOutBonus: -0.02, distanceFactor: 1.2, maxAttempts: 3 },
  chinni: { name: "Chinni Dandu", flipSkill: 0.74, catchBonus: 0.03, throwOutBonus: 0, distanceFactor: 1, maxAttempts: 3 },
  viti: { name: "Viti Dandu", flipSkill: 0.8, catchBonus: -0.02, throwOutBonus: 0.12, distanceFactor: 1, maxAttempts: 3 },
};

const DIFFICULTY_RULES = {
  easy: { catchBase: 0.12, throwBase: 0.06, timingPenalty: 0.82, aiFieldSpeed: 140 },
  club: { catchBase: 0.2, throwBase: 0.11, timingPenalty: 1, aiFieldSpeed: 168 },
  pro: { catchBase: 0.29, throwBase: 0.18, timingPenalty: 1.16, aiFieldSpeed: 196 },
};

const state = {
  running: false,
  matchOver: false,
  mode: "classic",
  variant: "classic",
  difficulty: "club",
  controlMode: "single",
  playersPerTeam: 5,
  inningsPerTeam: 2,
  halfInningIndex: 0,
  battingTeam: 0,
  strikerIndex: [1, 1],
  wickets: [0, 0],
  inningsRuns: [0, 0],
  totalRuns: [0, 0],
  target: null,
  wind: 0,
  turnActive: false,
  flipAttempts: 0,
  swingWindow: 0,
  awaitingNextTurn: false,
  aiAuto: false,
  aiFlipTimer: 0,
  aiSwingTimer: 0,
  aiSecondSwingTimer: 0,
  keyFieldX: 0,
  keyFieldY: 0,
  manualStick: { active: false, x: 0, y: 0, pointerId: null },
  lastShotLabel: "-",
  gill: {
    x: HOLE_X,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    angle: 0,
    spin: 0,
    inAir: false,
    hitCount: 0,
    firstLandingX: null,
    catchCooldown: 0,
  },
  fielders: [
    { x: 680, y: GROUND_Y - 12, speed: 160 },
    { x: 860, y: GROUND_Y - 10, speed: 182 },
  ],
  trail: [],
};

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function randomWind() {
  const direction = Math.random() < 0.5 ? -1 : 1;
  const strength = 8 + Math.random() * 18;
  return direction * strength;
}

function setOverlay(msg) {
  overlayEl.textContent = msg;
}

function setShotLabel(msg) {
  state.lastShotLabel = msg;
  shotTextEl.textContent = msg;
}

function setupMatchFromUI() {
  state.mode = modeSelect.value;
  state.variant = variantSelect.value;
  state.difficulty = difficultySelect.value;
  state.controlMode = controlSelect.value;
  state.playersPerTeam = clamp(Number(playersSelect.value) || 5, 2, 11);
  state.inningsPerTeam = state.mode === "quick" ? 1 : 2;
}

function activeMaxPlayers() {
  return state.playersPerTeam;
}

function currentRules() {
  return VARIANT_RULES[state.variant];
}

function currentDifficulty() {
  return DIFFICULTY_RULES[state.difficulty];
}

function isCurrentTeamAI() {
  return state.controlMode === "single" && state.battingTeam === 1;
}

function isFieldingTeamAI() {
  if (state.controlMode === "hotseat") return true;
  return !isCurrentTeamAI();
}

function batterTag() {
  return `${state.battingTeam === 0 ? "A" : "B"}${state.strikerIndex[state.battingTeam]}`;
}

function clearAITimers() {
  state.aiAuto = false;
  state.aiFlipTimer = 0;
  state.aiSwingTimer = 0;
  state.aiSecondSwingTimer = 0;
}

function resetFielders() {
  state.fielders[0].x = 680;
  state.fielders[1].x = 860;
}

function setJoystickVector(nx, ny) {
  state.manualStick.x = clamp(nx, -1, 1);
  state.manualStick.y = clamp(ny, -1, 1);
  const px = state.manualStick.x * 22;
  const py = state.manualStick.y * 22;
  joystickKnobEl.style.transform = `translate(${px}px, ${py}px)`;
}

function clearJoystick() {
  state.manualStick.active = false;
  state.manualStick.pointerId = null;
  setJoystickVector(0, 0);
}

function refreshFieldingPanel() {
  const manualFieldingActive = state.running && !state.matchOver && state.turnActive && !isFieldingTeamAI();
  fieldingPanelEl.classList.toggle("active", manualFieldingActive);
}

function resetGill() {
  const g = state.gill;
  g.x = HOLE_X;
  g.y = GROUND_Y;
  g.vx = 0;
  g.vy = 0;
  g.angle = 0;
  g.spin = 0;
  g.inAir = false;
  g.hitCount = 0;
  g.firstLandingX = null;
  g.catchCooldown = 0;
  state.trail = [];
  resetFielders();
}

function armAITurn() {
  clearAITimers();
  if (!isCurrentTeamAI() || !state.turnActive || state.matchOver) return;

  const diff = currentDifficulty();
  state.aiAuto = true;
  state.aiFlipTimer = 0.35 + Math.random() * 0.55;
  state.aiSwingTimer = 0.15 + (diff === DIFFICULTY_RULES.pro ? 0.08 : diff === DIFFICULTY_RULES.easy ? 0.2 : 0.12);
  state.aiSecondSwingTimer = Math.random() < 0.35 ? 0.1 + Math.random() * 0.12 : 0;
}

function updateHud() {
  teamATotalEl.textContent = String(state.totalRuns[0]);
  teamAInningsEl.textContent = String(state.inningsRuns[0]);
  teamBTotalEl.textContent = String(state.totalRuns[1]);
  teamBInningsEl.textContent = String(state.inningsRuns[1]);

  const halfTotal = state.inningsPerTeam * 2;
  inningsTextEl.textContent = `${clamp(state.halfInningIndex + 1, 1, halfTotal)}/${halfTotal}`;

  const baseBatting = state.battingTeam === 0 ? "Team A" : "Team B";
  battingTextEl.textContent = isCurrentTeamAI() ? `${baseBatting} (AI)` : baseBatting;
  wicketsTextEl.textContent = `${state.wickets[state.battingTeam]}/${activeMaxPlayers()}`;
  strikerTextEl.textContent = batterTag();
  attemptTextEl.textContent = `${state.flipAttempts}/${currentRules().maxAttempts}`;

  if (state.target !== null && state.battingTeam === 1) {
    targetTextEl.textContent = `${state.target} (${Math.max(0, state.target - state.totalRuns[1])} needed)`;
  } else {
    targetTextEl.textContent = "-";
  }

  windEl.textContent = `Wind ${state.wind > 0 ? "->" : "<-"} ${Math.abs(state.wind).toFixed(1)} km/h`;

  teamAcard.classList.toggle("active-batting", state.battingTeam === 0);
  teamBcard.classList.toggle("active-batting", state.battingTeam === 1);
  refreshFieldingPanel();
}

function updateButtons() {
  const lockedForAI = isCurrentTeamAI();
  liftBtn.disabled = !state.running || state.matchOver || !state.turnActive || state.awaitingNextTurn || lockedForAI;
  swingBtn.disabled = !state.running || state.matchOver || !state.turnActive || !state.gill.inAir || state.awaitingNextTurn || lockedForAI;
  startBtn.textContent = state.matchOver ? "Start New Match" : state.running ? "Match Running" : "Start Match";
  startBtn.disabled = state.running && !state.matchOver;
  refreshFieldingPanel();
}

function resetSeries() {
  setupMatchFromUI();
  state.running = false;
  state.matchOver = false;
  state.halfInningIndex = 0;
  state.battingTeam = 0;
  state.strikerIndex = [1, 1];
  state.wickets = [0, 0];
  state.inningsRuns = [0, 0];
  state.totalRuns = [0, 0];
  state.target = null;
  state.wind = randomWind();
  state.turnActive = false;
  state.flipAttempts = 0;
  state.swingWindow = 0;
  state.awaitingNextTurn = false;
  clearAITimers();
  clearJoystick();
  setShotLabel("-");
  resetGill();
  setOverlay("Press Start Match. Space=Flip, Enter=Swing. When AI bats, use joystick or arrow keys to field.");
  updateHud();
  updateButtons();
}

function startMatch() {
  if (state.running && !state.matchOver) return;
  if (state.matchOver) resetSeries();
  state.running = true;
  beginTurn();
}

function beginTurn() {
  if (state.matchOver) return;
  state.turnActive = true;
  state.awaitingNextTurn = false;
  state.flipAttempts = 0;
  state.swingWindow = 0;
  state.wind = randomWind();
  clearJoystick();
  resetGill();
  setOverlay(isCurrentTeamAI() ? "AI striker preparing to flip..." : "Tap Flip Gill. You have up to 3 attempts.");
  armAITurn();
  updateHud();
  updateButtons();
}

function flipStartVelocity(isAI) {
  const base = isAI ? 460 : 480;
  const jitter = isAI ? (0.86 + Math.random() * 0.24) : (0.8 + Math.random() * 0.36);
  const vy = -base * jitter;
  const vx = (isAI ? 10 : 14) + (Math.random() - 0.5) * 18;
  const spin = (isAI ? 3.5 : 3.8) + Math.random() * 2.4;
  return { vx, vy, spin };
}

function hitImpulse(quality, hitCount, isAI) {
  const rules = currentRules();
  const basePower = 560 + quality * 740;
  const swingBoost = hitCount > 1 ? 0.72 : 1;
  const forceJitter = isAI ? (0.88 + Math.random() * 0.28) : (0.78 + Math.random() * 0.5);
  const spinJitter = 0.78 + Math.random() * 0.6;

  const vx = (220 + quality * 710) * rules.distanceFactor * swingBoost * forceJitter;
  const vy = -(basePower * swingBoost * rules.distanceFactor * forceJitter);
  const spin = (6 + quality * 18) * spinJitter;
  return { vx, vy, spin };
}

function flipGill() {
  if (!state.running || state.matchOver || !state.turnActive || state.awaitingNextTurn) return;
  if (isCurrentTeamAI() || state.gill.inAir) return;

  state.flipAttempts += 1;
  const rules = currentRules();

  if (Math.random() > rules.flipSkill) {
    if (state.flipAttempts >= rules.maxAttempts) {
      endTurnOut("Three failed flips. OUT.", "Flip Fail");
      return;
    }
    setOverlay(`Flip failed (${state.flipAttempts}/${rules.maxAttempts}). Try again.`);
    updateHud();
    return;
  }

  const g = state.gill;
  const vel = flipStartVelocity(false);
  g.inAir = true;
  g.vx = vel.vx;
  g.vy = vel.vy;
  g.spin = vel.spin;
  g.catchCooldown = 0.2;
  state.swingWindow = 0.75;
  setOverlay("Gill airborne. Swing near waist height for best power.");
  updateHud();
  updateButtons();
}

function swingDanda() {
  if (!state.running || state.matchOver || !state.turnActive || state.awaitingNextTurn) return;
  if (isCurrentTeamAI() || !state.gill.inAir) return;

  const g = state.gill;
  const diff = currentDifficulty();
  const idealY = GROUND_Y - 55;
  const timing = clamp(1 - Math.abs(g.y - idealY) / 140, 0, 1);
  const quality = clamp(timing / diff.timingPenalty, 0, 1);

  if (quality < 0.18) {
    endTurnOut("Mistyimed swing. Easy take, OUT.", "Mistime Catch");
    return;
  }

  g.hitCount += 1;
  const impulse = hitImpulse(quality, g.hitCount, false);
  g.vx = impulse.vx;
  g.vy = impulse.vy;
  g.spin = impulse.spin;
  g.catchCooldown = 0.25;
  state.swingWindow = 0;

  setOverlay(g.hitCount > 1 ? "Second mid-air hit. Double-runs armed." : "Clean strike. Fielders chasing the gilli.");
  updateButtons();
}

function aiTryFlip() {
  if (!state.running || state.matchOver || !state.turnActive || state.awaitingNextTurn) return;
  if (!isCurrentTeamAI() || state.gill.inAir) return;

  state.flipAttempts += 1;
  const rules = currentRules();
  if (Math.random() > rules.flipSkill) {
    if (state.flipAttempts >= rules.maxAttempts) {
      endTurnOut("AI fails 3 flips. OUT.", "Flip Fail");
      return;
    }
    setOverlay(`AI flip failed (${state.flipAttempts}/${rules.maxAttempts}).`);
    state.aiFlipTimer = 0.28 + Math.random() * 0.4;
    updateHud();
    return;
  }

  const g = state.gill;
  const vel = flipStartVelocity(true);
  g.inAir = true;
  g.vx = vel.vx;
  g.vy = vel.vy;
  g.spin = vel.spin;
  g.catchCooldown = 0.2;
  state.swingWindow = 0.78;
  setOverlay("AI flips cleanly and lines up the swing...");
  updateHud();
}

function aiTrySwing() {
  if (!state.running || state.matchOver || !state.turnActive || state.awaitingNextTurn) return;
  if (!isCurrentTeamAI() || !state.gill.inAir) return;

  const g = state.gill;
  const diff = currentDifficulty();
  const idealY = GROUND_Y - 55;
  const offset = diff === DIFFICULTY_RULES.pro ? 8 : diff === DIFFICULTY_RULES.easy ? 26 : 16;
  const nearWindow = Math.abs(g.y - idealY) <= offset;
  const lateWindow = g.vy > 0 && g.y < GROUND_Y - 18;
  if (!nearWindow && !lateWindow) return;

  const timing = clamp(1 - Math.abs(g.y - idealY) / 140, 0, 1);
  const quality = clamp(timing / diff.timingPenalty, 0, 1);
  if (quality < 0.18) {
    endTurnOut("AI mistimes. OUT.", "Mistime Catch");
    return;
  }

  g.hitCount += 1;
  const impulse = hitImpulse(quality, g.hitCount, true);
  g.vx = impulse.vx;
  g.vy = impulse.vy;
  g.spin = impulse.spin;
  g.catchCooldown = 0.24;
  state.swingWindow = 0;

  setOverlay(g.hitCount > 1 ? "AI lands a second hit. Double-runs active." : "AI connects. Fielding team on the move.");
}

function updateAITurn(dt) {
  if (!state.aiAuto || !isCurrentTeamAI() || state.matchOver || !state.running || !state.turnActive) return;

  if (!state.gill.inAir) {
    state.aiFlipTimer -= dt;
    if (state.aiFlipTimer <= 0) aiTryFlip();
    return;
  }

  state.aiSwingTimer -= dt;
  if (state.aiSwingTimer <= 0 && state.gill.hitCount === 0) {
    aiTrySwing();
    if (state.turnActive && !state.awaitingNextTurn) {
      state.aiSwingTimer = 0.08 + Math.random() * 0.12;
    }
  }

  if (state.gill.hitCount === 1 && state.aiSecondSwingTimer > 0) {
    state.aiSecondSwingTimer -= dt;
    if (state.aiSecondSwingTimer <= 0) aiTrySwing();
  }
}

function endTurnOut(message, shortLabel) {
  clearAITimers();
  const team = state.battingTeam;
  state.wickets[team] += 1;
  state.strikerIndex[team] = clamp(state.strikerIndex[team] + 1, 1, activeMaxPlayers());
  setShotLabel(`OUT: ${shortLabel}`);
  setOverlay(message);
  state.turnActive = false;
  state.awaitingNextTurn = true;
  updateHud();
  updateButtons();

  setTimeout(() => {
    if (!state.matchOver) afterTurnAdvance();
  }, 900);
}

function endTurnScore(distanceFeet, runs, doubled) {
  clearAITimers();
  const team = state.battingTeam;
  state.inningsRuns[team] += runs;
  state.totalRuns[team] += runs;

  setShotLabel(`${distanceFeet.toFixed(1)} ft = ${runs} runs${doubled ? " (double-hit x2)" : ""}`);
  setOverlay(`Safe shot: ${distanceFeet.toFixed(1)} ft, +${runs} runs.`);

  state.turnActive = false;
  state.awaitingNextTurn = true;
  updateHud();
  updateButtons();

  setTimeout(() => {
    if (!state.matchOver) afterTurnAdvance();
  }, 1100);
}

function applyFielderThrowOutChance() {
  const d = currentDifficulty();
  const r = currentRules();
  const chance = clamp(d.throwBase + r.throwOutBonus + Math.random() * 0.03, 0.02, 0.5);
  return Math.random() < chance;
}

function afterTurnAdvance() {
  if (state.matchOver) return;

  if (state.target !== null && state.battingTeam === 1 && state.totalRuns[1] >= state.target) {
    finishMatch("Team B chased the target and wins!");
    return;
  }

  if (state.wickets[state.battingTeam] >= activeMaxPlayers()) {
    closeHalfInning();
    return;
  }

  beginTurn();
}

function closeHalfInning() {
  const justEndedHalf = state.halfInningIndex;
  const totalHalves = state.inningsPerTeam * 2;
  const teamName = state.battingTeam === 0 ? "Team A" : "Team B";
  setOverlay(`${teamName} innings complete at ${state.inningsRuns[state.battingTeam]} runs.`);

  state.halfInningIndex += 1;
  if (justEndedHalf === totalHalves - 1) {
    resolveFinalWinner();
    return;
  }

  if (state.battingTeam === 1) {
    state.inningsRuns = [0, 0];
    state.wickets = [0, 0];
    state.strikerIndex = [1, 1];
  }

  state.battingTeam = (state.battingTeam + 1) % 2;
  if (state.halfInningIndex === 1 || (state.halfInningIndex === 3 && state.inningsPerTeam === 2)) {
    state.target = state.totalRuns[0] + 1;
  }

  beginTurn();
}

function suddenDeath() {
  const aRuns = Math.floor((2 + Math.random() * 8) / 2.5);
  const bRuns = Math.floor((2 + Math.random() * 8) / 2.5);
  if (aRuns >= bRuns) {
    state.totalRuns[0] += 1;
    finishMatch("Tie-break strike-off: Team A wins.");
  } else {
    state.totalRuns[1] += 1;
    finishMatch("Tie-break strike-off: Team B wins.");
  }
}

function resolveFinalWinner() {
  const a = state.totalRuns[0];
  const b = state.totalRuns[1];
  if (a === b) {
    suddenDeath();
    return;
  }
  finishMatch(a > b ? `Team A wins by ${a - b} runs.` : `Team B wins by ${b - a} runs.`);
}

function finishMatch(message) {
  clearAITimers();
  state.matchOver = true;
  state.running = false;
  state.turnActive = false;
  state.awaitingNextTurn = false;
  setOverlay(`${message} Final: Team A ${state.totalRuns[0]} - Team B ${state.totalRuns[1]}`);
  updateHud();
  updateButtons();
}

function updateFielders(dt) {
  const g = state.gill;
  const diff = currentDifficulty();
  const lead = state.fielders[0];
  const support = state.fielders[1];

  if (isFieldingTeamAI()) {
    const targetX = g.inAir ? g.x + g.vx * 0.18 : HOLE_X + 130;
    const speed = diff.aiFieldSpeed;
    const mv = clamp((targetX - lead.x) * 1.15 * dt, -speed * dt, speed * dt);
    lead.x += mv;
  } else {
    const inputX = clamp(state.manualStick.x + state.keyFieldX, -1, 1);
    const speed = 210;
    lead.x += inputX * speed * dt;
  }

  support.x += clamp((lead.x + 120 - support.x) * 0.75 * dt, -support.speed * dt, support.speed * dt);
  lead.x = clamp(lead.x, HOLE_X + 30, canvas.width - 35);
  support.x = clamp(support.x, HOLE_X + 40, canvas.width - 30);
}

function tryResolveCatch() {
  const g = state.gill;
  if (!g.inAir || g.hitCount <= 0) return false;
  if (g.catchCooldown > 0) return false;
  if (g.vy < 80) return false;
  if (g.y < GROUND_Y - 100 || g.y > GROUND_Y - 14) return false;

  let closest = Infinity;
  for (const f of state.fielders) {
    const d = Math.hypot(g.x - f.x, g.y - (f.y - 20));
    if (d < closest) closest = d;
  }

  const diff = currentDifficulty();
  const rules = currentRules();
  const radius = isFieldingTeamAI() ? 36 : 34;
  if (closest > radius) return false;

  let catchChance;
  if (isFieldingTeamAI()) {
    catchChance = clamp(diff.catchBase + rules.catchBonus + (radius - closest) * 0.012, 0.12, 0.92);
  } else {
    catchChance = clamp(0.5 + (radius - closest) * 0.015, 0.35, 0.95);
  }

  g.catchCooldown = 0.18;
  if (Math.random() < catchChance) {
    endTurnOut(isFieldingTeamAI() ? "AI fielder takes a clean catch. OUT." : "Brilliant joystick catch. OUT.", "Air Catch");
    return true;
  }

  return false;
}

function updatePhysics(dt) {
  if (!state.running || state.matchOver) return;

  const g = state.gill;
  if (g.catchCooldown > 0) g.catchCooldown -= dt;

  updateFielders(dt);
  if (!g.inAir) return;

  if (state.swingWindow > 0) {
    state.swingWindow -= dt;
    if (state.swingWindow <= 0 && g.hitCount === 0) {
      endTurnOut("No strike after flip. Caught low, OUT.", "No Hit");
      return;
    }
  }

  const gust = (Math.random() - 0.5) * 2.2;
  const windAcc = (state.wind + gust) * 0.28;
  const magnus = g.spin * g.vy * 0.0018;

  g.vx += (windAcc + magnus) * dt;
  g.vy += GRAVITY * dt;
  g.x += g.vx * dt;
  g.y += g.vy * dt;
  g.angle += g.spin * dt;
  g.spin *= 0.998;

  state.trail.push({ x: g.x, y: g.y });
  if (state.trail.length > 36) state.trail.shift();

  if (tryResolveCatch()) return;

  if (g.y >= GROUND_Y) {
    g.y = GROUND_Y;
    g.inAir = false;

    if (g.firstLandingX === null) g.firstLandingX = g.x;
    if (g.hitCount === 0) {
      endTurnOut("No legal strike. OUT.", "No Hit");
      return;
    }

    if (applyFielderThrowOutChance()) {
      endTurnOut("Fielder hits grounded danda with gilli. OUT.", "Danda Hit");
      return;
    }

    const distanceFeet = Math.max(0, g.firstLandingX - HOLE_X) / PX_PER_FOOT;
    let runs = Math.max(1, Math.floor(distanceFeet / 2.5));
    const doubled = g.hitCount >= 2;
    if (doubled) runs *= 2;
    endTurnScore(distanceFeet, runs, doubled);
  }
}

function drawField() {
  const horizon = GROUND_Y - 8;
  ctx.fillStyle = "#a7d3ef";
  ctx.fillRect(0, 0, canvas.width, horizon);

  ctx.fillStyle = "#b58f51";
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

  ctx.fillStyle = "#8f6137";
  ctx.fillRect(HOLE_X - 140, GROUND_Y - 10, 280, 18);

  ctx.strokeStyle = "#f6e8cb";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(HOLE_X - 110, GROUND_Y + 6);
  ctx.lineTo(HOLE_X + 110, GROUND_Y + 6);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1.5;
  for (let i = 1; i <= 8; i += 1) {
    const x = HOLE_X + i * 95;
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x + i * 8, GROUND_Y - 80 - i * 20);
    ctx.stroke();

    ctx.fillStyle = "rgba(35, 23, 12, 0.74)";
    ctx.font = "13px Trebuchet MS";
    ctx.fillText(`${(x - HOLE_X) / PX_PER_FOOT} ft`, x - 18, GROUND_Y + 28);
  }
}

function drawFielder() {
  for (let i = 0; i < state.fielders.length; i += 1) {
    const f = state.fielders[i];
    ctx.fillStyle = i === 0 ? "#1f5f2f" : "#2f7040";
    ctx.beginPath();
    ctx.arc(f.x, f.y - 20, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = i === 0 ? "#264c95" : "#5d4aa3";
    ctx.fillRect(f.x - 8, f.y - 12, 16, 24);
  }
}

function drawDanda() {
  const ready = state.gill.inAir;
  const angle = ready ? -0.44 : -0.76;
  ctx.save();
  ctx.translate(HOLE_X - 50, GROUND_Y - 14);
  ctx.rotate(angle);
  ctx.fillStyle = "#5f3a1f";
  ctx.fillRect(-8, -4, 145, 8);
  ctx.restore();
}

function drawGill() {
  for (let i = 0; i < state.trail.length; i += 1) {
    const p = state.trail[i];
    const alpha = (i + 1) / state.trail.length;
    ctx.fillStyle = `rgba(244, 217, 158, ${alpha * 0.2})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const g = state.gill;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.angle);
  ctx.fillStyle = "#f3d9a9";
  ctx.beginPath();
  ctx.moveTo(-13, 0);
  ctx.lineTo(-7, -5);
  ctx.lineTo(7, -5);
  ctx.lineTo(13, 0);
  ctx.lineTo(7, 5);
  ctx.lineTo(-7, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTelemetry() {
  const g = state.gill;
  const manualFielding = !isFieldingTeamAI() && state.running && state.turnActive;
  ctx.fillStyle = "rgba(22, 15, 9, 0.76)";
  ctx.font = "15px Trebuchet MS";
  ctx.fillText(`Variant: ${currentRules().name}`, 18, 28);
  ctx.fillText(`Gill Hits: ${g.hitCount}`, 18, 50);
  ctx.fillText(`Speed: ${Math.hypot(g.vx, g.vy).toFixed(0)} px/s`, 18, 72);
  if (manualFielding) {
    ctx.fillText("Manual fielding active: joystick or arrow keys", 18, 94);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawField();
  drawFielder();
  drawDanda();
  drawGill();
  drawTelemetry();
}

function handleJoystickPointer(event) {
  const rect = joystickBaseEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const r = rect.width / 2;
  const mag = Math.hypot(dx, dy);
  const nx = mag > 0 ? dx / Math.max(r, mag) : 0;
  const ny = mag > 0 ? dy / Math.max(r, mag) : 0;
  setJoystickVector(nx, ny);
}

joystickBaseEl.addEventListener("pointerdown", (event) => {
  state.manualStick.active = true;
  state.manualStick.pointerId = event.pointerId;
  joystickBaseEl.setPointerCapture(event.pointerId);
  handleJoystickPointer(event);
});

joystickBaseEl.addEventListener("pointermove", (event) => {
  if (!state.manualStick.active || state.manualStick.pointerId !== event.pointerId) return;
  handleJoystickPointer(event);
});

function releaseJoystick(event) {
  if (state.manualStick.pointerId !== event.pointerId) return;
  clearJoystick();
}

joystickBaseEl.addEventListener("pointerup", releaseJoystick);
joystickBaseEl.addEventListener("pointercancel", releaseJoystick);

liftBtn.addEventListener("click", flipGill);
swingBtn.addEventListener("click", swingDanda);
startBtn.addEventListener("click", startMatch);
restartBtn.addEventListener("click", resetSeries);

modeSelect.addEventListener("change", resetSeries);
variantSelect.addEventListener("change", resetSeries);
difficultySelect.addEventListener("change", resetSeries);
controlSelect.addEventListener("change", resetSeries);
playersSelect.addEventListener("change", resetSeries);

function handleKeyDown(event) {
  const isSpace = event.code === "Space" || event.key === " ";
  const isEnter = event.code === "Enter" || event.key === "Enter";
  const isRestart = event.code === "KeyR" || event.key === "r" || event.key === "R";

  if (isSpace) {
    event.preventDefault();
    if (!state.running || state.matchOver) startMatch();
    flipGill();
  }

  if (isEnter) {
    event.preventDefault();
    if (!state.running || state.matchOver) startMatch();
    swingDanda();
  }

  if (isRestart) {
    event.preventDefault();
    if (!state.running || state.matchOver) startMatch();
  }

  if (event.code === "ArrowLeft" || event.code === "KeyA") state.keyFieldX = -1;
  if (event.code === "ArrowRight" || event.code === "KeyD") state.keyFieldX = 1;
  if (event.code === "ArrowUp" || event.code === "KeyW") state.keyFieldY = -1;
  if (event.code === "ArrowDown" || event.code === "KeyS") state.keyFieldY = 1;
}

function handleKeyUp(event) {
  if ((event.code === "ArrowLeft" || event.code === "KeyA") && state.keyFieldX < 0) state.keyFieldX = 0;
  if ((event.code === "ArrowRight" || event.code === "KeyD") && state.keyFieldX > 0) state.keyFieldX = 0;
  if ((event.code === "ArrowUp" || event.code === "KeyW") && state.keyFieldY < 0) state.keyFieldY = 0;
  if ((event.code === "ArrowDown" || event.code === "KeyS") && state.keyFieldY > 0) state.keyFieldY = 0;
}

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  updateAITurn(dt);
  updatePhysics(dt);
  render();
  requestAnimationFrame(loop);
}

resetSeries();
requestAnimationFrame(loop);
