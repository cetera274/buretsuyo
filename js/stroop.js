// File: js/stroop.js
import { getNextLevel, saveResult } from "./storage.js";
import { mean, choice, shuffle, fmtMs, pct, levelMessage, nextLevelByAccuracy } from "./util.js";

export const GAME_ID = "stroop";

const COLORS = [
  { name: "赤", hex: "#e53935" },
  { name: "青", hex: "#1e88e5" },
  { name: "緑", hex: "#43a047" },
  { name: "黄", hex: "#f9a825" },
];
const TRIALS = 24;
const CONGRUENT_COUNT = 8;
const ITI_MS = 500;
const MIN_LEVEL = 1;
const MAX_LEVEL = 14;

let root = null;
let timers = [];
let keyHandler = null;
let lastResult = null;

export function deadlineMs(level) {
  return Math.max(700, 2000 - (level - 1) * 100);
}

function later(fn, ms) {
  const id = setTimeout(fn, ms);
  timers.push(id);
  return id;
}

export function cleanup() {
  timers.forEach(clearTimeout);
  timers = [];
  if (keyHandler) {
    document.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
}

export function render(container) {
  root = container;
  cleanup();
  renderIntro();
}

function makeTrials() {
  const trials = [];
  for (let i = 0; i < TRIALS; i++) {
    if (i < CONGRUENT_COUNT) {
      const c = choice(COLORS);
      trials.push({ word: c.name, ink: c, congruent: true });
    } else {
      const word = choice(COLORS);
      const ink = choice(COLORS.filter((c) => c !== word));
      trials.push({ word: word.name, ink, congruent: false });
    }
  }
  return shuffle(trials);
}

function resultHtml(r) {
  const label = (lv) => `レベル ${lv}(制限 ${deadlineMs(lv)} ms)`;
  return `
    <div class="card">
      <h2>結果:正答率 ${pct(r.accuracy)}</h2>
      <div class="metrics">
        <div class="metric"><div class="label">平均反応時間</div><div class="value">${fmtMs(r.meanRt)}</div></div>
        <div class="metric"><div class="label">干渉コスト</div><div class="value">${fmtMs(r.interference)}</div></div>
        <div class="metric"><div class="label">時間切れ</div><div class="value">${r.timeouts}</div></div>
      </div>
      <p class="muted">干渉コストは「不一致試行と一致試行の反応時間の差」です。小さいほど、邪魔な情報を抑える力が強いことを示します。</p>
      <p class="notice">${levelMessage(r.level, r.nextLevel, label)}</p>
    </div>`;
}

function renderIntro() {
  const level = getNextLevel(GAME_ID, 1);
  root.innerHTML = `
    <h1>ストループ課題</h1>
    ${lastResult ? resultHtml(lastResult) : ""}
    <div class="card">
      <p>色の名前が、別の色で表示されることがあります。文字の意味ではなく、文字の色をできるだけ速く選んでください。</p>
      <p>キーボードでは <kbd>1</kbd>〜<kbd>4</kbd> がボタンの左から順に対応します。</p>
      <p class="muted">現在のレベル: ${level}(制限時間 ${deadlineMs(level)} ms)。正答率90%以上でレベルが上がり、75%未満で下がります。</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="st-start">開始</button>
      </div>
    </div>`;
  root.querySelector("#st-start").addEventListener("click", () => run(level));
}

function run(level) {
  cleanup();
  const deadline = deadlineMs(level);
  const trials = makeTrials();
  const log = [];
  let idx = 0;
  let onset = 0;
  let answered = true;
  let deadlineTimer = null;

  const buttonsHtml = COLORS.map(
    (c, i) => `<button class="btn" data-color="${c.name}">${c.name} <kbd>${i + 1}</kbd></button>`
  ).join("");

  root.innerHTML = `
    <h1>ストループ課題</h1>
    <div class="progress"><div id="st-bar"></div></div>
    <p class="muted" id="st-status">制限 ${deadline} ms。文字の色を選んでください。</p>
    <div class="stimulus" id="st-stim">+</div>
    <div class="feedback" id="st-feedback"></div>
    <div class="btn-row answer-row">${buttonsHtml}</div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="st-abort">中断する</button>
    </div>`;

  const bar = root.querySelector("#st-bar");
  const status = root.querySelector("#st-status");
  const stim = root.querySelector("#st-stim");
  const feedback = root.querySelector("#st-feedback");
  stim.style.color = "#b0bec5";

  function show() {
    if (idx >= TRIALS) {
      finish();
      return;
    }
    const t = trials[idx];
    bar.style.width = `${(idx / TRIALS) * 100}%`;
    status.textContent = `${idx + 1} / ${TRIALS}  (制限 ${deadline} ms)`;
    feedback.textContent = "";
    feedback.className = "feedback";
    stim.textContent = t.word;
    stim.style.color = t.ink.hex;
    onset = performance.now();
    answered = false;
    deadlineTimer = later(() => answer(null), deadline);
  }

  function answer(colorName) {
    if (answered) {
      return;
    }
    answered = true;
    clearTimeout(deadlineTimer);
    const rt = performance.now() - onset;
    const t = trials[idx];
    const timeout = colorName === null || rt > deadline;
    const correct = !timeout && colorName === t.ink.name;
    log.push({ rt, correct, congruent: t.congruent, timeout });

    stim.textContent = "";
    if (timeout) {
      feedback.textContent = "時間切れ";
      feedback.className = "feedback ng";
    } else if (correct) {
      feedback.textContent = "正解";
      feedback.className = "feedback ok";
    } else {
      feedback.textContent = "不正解";
      feedback.className = "feedback ng";
    }
    idx += 1;
    later(show, ITI_MS);
  }

  function finish() {
    cleanup();
    const accuracy = log.filter((r) => r.correct).length / log.length;
    const rtAll = log.filter((r) => r.correct).map((r) => r.rt);
    const rtCon = log.filter((r) => r.correct && r.congruent).map((r) => r.rt);
    const rtInc = log.filter((r) => r.correct && !r.congruent).map((r) => r.rt);
    const meanRt = mean(rtAll);
    const interference = rtCon.length && rtInc.length ? mean(rtInc) - mean(rtCon) : null;
    const nextLevel = nextLevelByAccuracy(accuracy, level, MIN_LEVEL, MAX_LEVEL);
    const timeouts = log.filter((r) => r.timeout).length;

    saveResult(GAME_ID, level, nextLevel, accuracy, meanRt, {
      interference_ms: interference,
      deadline_ms: deadline,
      timeouts,
    });
    lastResult = { level, nextLevel, accuracy, meanRt, interference, timeouts };
    renderIntro();
  }

  root.querySelectorAll("[data-color]").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      answer(btn.dataset.color);
    });
  });

  keyHandler = (e) => {
    if (e.repeat) {
      return;
    }
    const k = Number(e.key);
    if (Number.isInteger(k) && k >= 1 && k <= COLORS.length) {
      answer(COLORS[k - 1].name);
    }
  };
  document.addEventListener("keydown", keyHandler);

  root.querySelector("#st-abort").addEventListener("click", () => {
    cleanup();
    lastResult = null;
    renderIntro();
  });

  later(show, 1000);
}
