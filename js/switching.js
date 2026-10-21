// File: js/switching.js
import { getNextLevel, saveResult } from "./storage.js";
import { mean, choice, fmtMs, pct, levelMessage, nextLevelByAccuracy } from "./util.js";

export const GAME_ID = "task_switching";

const NUMBERS = [1, 2, 3, 4, 6, 7, 8, 9];
const TRIALS = 32;
const SWITCH_PROB = 0.5;
const ITI_MS = 500;
const MIN_LEVEL = 1;
const MAX_LEVEL = 11;

const RULES = {
  parity: { label: "奇数か偶数か", color: "#1e88e5", left: "奇数", right: "偶数" },
  magnitude: { label: "5より小さいか大きいか", color: "#fb8c00", left: "小さい", right: "大きい" },
};

let root = null;
let timers = [];
let keyHandler = null;
let lastResult = null;

export function deadlineMs(level) {
  return Math.max(900, 2500 - (level - 1) * 150);
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

function correctSide(rule, number) {
  if (rule === "parity") {
    return number % 2 === 1 ? "left" : "right";
  }
  return number < 5 ? "left" : "right";
}

function makeTrials() {
  let rule = choice(Object.keys(RULES));
  const trials = [];
  for (let i = 0; i < TRIALS; i++) {
    if (i > 0 && Math.random() < SWITCH_PROB) {
      rule = rule === "parity" ? "magnitude" : "parity";
    }
    trials.push({ rule, number: choice(NUMBERS) });
  }
  return trials;
}

function resultHtml(r) {
  const label = (lv) => `レベル ${lv}(制限 ${deadlineMs(lv)} ms)`;
  return `
    <div class="card">
      <h2>結果:正答率 ${pct(r.accuracy)}</h2>
      <div class="metrics">
        <div class="metric"><div class="label">平均反応時間</div><div class="value">${fmtMs(r.meanRt)}</div></div>
        <div class="metric"><div class="label">切り替えコスト</div><div class="value">${fmtMs(r.switchCost)}</div></div>
        <div class="metric"><div class="label">時間切れ</div><div class="value">${r.timeouts}</div></div>
      </div>
      <p class="muted">切り替えコストは「ルールが切り替わった試行と同じルールが続いた試行の反応時間の差」です。小さいほど、切り替えが素早いことを示します。</p>
      <p class="notice">${levelMessage(r.level, r.nextLevel, label)}</p>
    </div>`;
}

function renderIntro() {
  const level = getNextLevel(GAME_ID, 1);
  root.innerHTML = `
    <h1>タスクスイッチング</h1>
    ${lastResult ? resultHtml(lastResult) : ""}
    <div class="card">
      <p>青い枠では「奇数か偶数か」、オレンジの枠では「5より小さいか大きいか」で答えてください。ルールはランダムに切り替わります。</p>
      <p>キーボードでは <kbd>F</kbd> が左のボタン、<kbd>J</kbd> が右のボタンです。</p>
      <p class="muted">現在のレベル: ${level}(制限時間 ${deadlineMs(level)} ms)。正答率90%以上でレベルが上がり、75%未満で下がります。</p>
      <div class="btn-row">
        <button class="btn btn-primary" id="sw-start">開始</button>
      </div>
    </div>`;
  root.querySelector("#sw-start").addEventListener("click", () => run(level));
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

  root.innerHTML = `
    <h1>タスクスイッチング</h1>
    <div class="progress"><div id="sw-bar"></div></div>
    <p class="muted" id="sw-status">制限 ${deadline} ms。枠の色でルールが変わります。</p>
    <div class="rule-box" id="sw-box">
      <div class="rule-label" id="sw-label"></div>
      <div class="stimulus" id="sw-num">+</div>
    </div>
    <div class="feedback" id="sw-feedback"></div>
    <div class="btn-row answer-row">
      <button class="btn" id="sw-left">- <kbd>F</kbd></button>
      <button class="btn" id="sw-right">- <kbd>J</kbd></button>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="sw-abort">中断する</button>
    </div>`;

  const bar = root.querySelector("#sw-bar");
  const status = root.querySelector("#sw-status");
  const box = root.querySelector("#sw-box");
  const label = root.querySelector("#sw-label");
  const num = root.querySelector("#sw-num");
  const feedback = root.querySelector("#sw-feedback");
  const btnLeft = root.querySelector("#sw-left");
  const btnRight = root.querySelector("#sw-right");
  num.style.color = "#b0bec5";

  function show() {
    if (idx >= TRIALS) {
      finish();
      return;
    }
    const t = trials[idx];
    const info = RULES[t.rule];
    bar.style.width = `${(idx / TRIALS) * 100}%`;
    status.textContent = `${idx + 1} / ${TRIALS}  (制限 ${deadline} ms)`;
    feedback.textContent = "";
    feedback.className = "feedback";
    box.style.borderColor = info.color;
    label.textContent = info.label;
    label.style.color = info.color;
    num.textContent = String(t.number);
    num.style.color = "#263238";
    btnLeft.innerHTML = `${info.left} <kbd>F</kbd>`;
    btnRight.innerHTML = `${info.right} <kbd>J</kbd>`;
    onset = performance.now();
    answered = false;
    deadlineTimer = later(() => answer(null), deadline);
  }

  function answer(side) {
    if (answered) {
      return;
    }
    answered = true;
    clearTimeout(deadlineTimer);
    const rt = performance.now() - onset;
    const t = trials[idx];
    const isSwitch = idx > 0 && trials[idx - 1].rule !== t.rule;
    const timeout = side === null || rt > deadline;
    const correct = !timeout && side === correctSide(t.rule, t.number);
    log.push({ rt, correct, isSwitch, timeout, first: idx === 0 });

    num.textContent = "";
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
    const rtSwitch = log.filter((r) => !r.first && r.correct && r.isSwitch).map((r) => r.rt);
    const rtRepeat = log.filter((r) => !r.first && r.correct && !r.isSwitch).map((r) => r.rt);
    const meanRt = mean(rtAll);
    const switchCost = rtSwitch.length && rtRepeat.length ? mean(rtSwitch) - mean(rtRepeat) : null;
    const nextLevel = nextLevelByAccuracy(accuracy, level, MIN_LEVEL, MAX_LEVEL);
    const timeouts = log.filter((r) => r.timeout).length;

    saveResult(GAME_ID, level, nextLevel, accuracy, meanRt, {
      switch_cost_ms: switchCost,
      deadline_ms: deadline,
      timeouts,
    });
    lastResult = { level, nextLevel, accuracy, meanRt, switchCost, timeouts };
    renderIntro();
  }

  btnLeft.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    answer("left");
  });
  btnRight.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    answer("right");
  });

  keyHandler = (e) => {
    if (e.repeat) {
      return;
    }
    if (e.code === "KeyF") {
      answer("left");
    } else if (e.code === "KeyJ") {
      answer("right");
    }
  };
  document.addEventListener("keydown", keyHandler);

  root.querySelector("#sw-abort").addEventListener("click", () => {
    cleanup();
    lastResult = null;
    renderIntro();
  });

  later(show, 1000);
}
