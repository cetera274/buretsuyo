// File: js/nback.js
import { getNextLevel, saveResult, getSetting, setSetting } from "./storage.js";
import { mean, choice, fmtMs, pct, levelMessage } from "./util.js";

export const GAME_ID = "dual_nback";

const POSITIONS = [0, 1, 2, 3, 5, 6, 7, 8];
const LETTERS = ["C", "H", "K", "L", "Q", "R", "S", "T"];
const SCORED_TRIALS = 20;
const MATCH_PROB = 0.3;
const TRIAL_MS = 3000;
const STIM_MS = 500;
const MIN_N = 1;
const MAX_N = 9;

let root = null;
let timers = [];
let keyHandler = null;
let lastResult = null;

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
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function render(container) {
  root = container;
  cleanup();
  renderIntro();
}

function makeStream(n, options) {
  const seq = [];
  for (let i = 0; i < n; i++) {
    seq.push(choice(options));
  }
  for (let i = n; i < n + SCORED_TRIALS; i++) {
    const target = seq[i - n];
    if (Math.random() < MATCH_PROB) {
      seq.push(target);
    } else {
      seq.push(choice(options.filter((o) => o !== target)));
    }
  }
  return seq;
}

function speak(letter) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(letter);
  u.lang = "en-US";
  u.rate = 1.1;
  synth.speak(u);
}

function resultHtml(r) {
  const label = (n) => `${n}-バック`;
  return `
    <div class="card">
      <h2>結果:正答率 ${pct(r.accuracy)}</h2>
      <div class="metrics">
        <div class="metric"><div class="label">位置の誤り</div><div class="value">${r.errorsPosition}</div></div>
        <div class="metric"><div class="label">文字の誤り</div><div class="value">${r.errorsLetter}</div></div>
        <div class="metric"><div class="label">平均反応時間</div><div class="value">${fmtMs(r.meanRt)}</div></div>
      </div>
      <p class="notice">${levelMessage(r.n, r.nextN, label)}</p>
    </div>`;
}

function renderIntro() {
  const n = getNextLevel(GAME_ID, 1);
  const speechOk = "speechSynthesis" in window;
  const audio = speechOk && getSetting("nbackAudio", false);

  root.innerHTML = `
    <h1>デュアルNバック</h1>
    ${lastResult ? resultHtml(lastResult) : ""}
    <div class="card">
      <p>3×3のマスに刺激が3秒ごとに1つずつ表示されます。「位置」と「文字」が、それぞれ ${n} 回前と同じなら対応するボタンを押してください。違う場合は何も押しません。</p>
      <p>キーボードでは <kbd>A</kbd> が位置、<kbd>L</kbd> が文字です。</p>
      <p class="muted">各モダリティの誤りが3未満ならNが上がり、どちらかが5を超えるとNが下がります。推奨は1日3〜5セット(1セット約1分)です。</p>
      <label class="check">
        <input type="checkbox" id="nb-audio" ${audio ? "checked" : ""} ${speechOk ? "" : "disabled"}>
        <span>文字を画面に出さず音声で読み上げる(元の研究と同じ形式)</span>
      </label>
      ${speechOk ? "" : '<p class="muted">このブラウザは音声読み上げに対応していません。</p>'}
      <div class="btn-row">
        <button class="btn btn-primary" id="nb-start">${n}-バックを開始</button>
      </div>
    </div>`;

  const audioBox = root.querySelector("#nb-audio");
  audioBox.addEventListener("change", () => setSetting("nbackAudio", audioBox.checked));
  root.querySelector("#nb-start").addEventListener("click", () => {
    const useAudio = audioBox.checked;
    if (useAudio) {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    }
    run(n, useAudio);
  });
}

function run(n, audio) {
  cleanup();
  const total = n + SCORED_TRIALS;
  const pos = makeStream(n, POSITIONS);
  const lets = makeStream(n, LETTERS);
  const resp = Array.from({ length: total }, () => ({ pos: null, let: null }));
  let idx = -1;
  let onset = 0;
  let start = 0;

  const cellsHtml = Array.from({ length: 9 }, (_, i) =>
    i === 4 ? '<div class="cell center">+</div>' : '<div class="cell"></div>'
  ).join("");

  root.innerHTML = `
    <h1>デュアルNバック(N = ${n})</h1>
    <div class="progress"><div id="nb-bar"></div></div>
    <p class="muted" id="nb-status">まもなく始まります</p>
    <div class="grid">${cellsHtml}</div>
    <div class="btn-row answer-row">
      <button class="btn" id="nb-pos" disabled>位置が同じ <kbd>A</kbd></button>
      <button class="btn" id="nb-let" disabled>文字が同じ <kbd>L</kbd></button>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="nb-abort">中断する</button>
    </div>`;

  const cells = [...root.querySelectorAll(".cell")];
  const bar = root.querySelector("#nb-bar");
  const status = root.querySelector("#nb-status");
  const btns = { pos: root.querySelector("#nb-pos"), let: root.querySelector("#nb-let") };

  function respond(mod) {
    if (idx < n || idx >= total) {
      return;
    }
    if (resp[idx][mod] !== null) {
      return;
    }
    resp[idx][mod] = performance.now() - onset;
    btns[mod].classList.add("pressed");
  }

  function hide() {
    cells.forEach((c, i) => {
      if (i !== 4) {
        c.classList.remove("active");
        c.textContent = "";
      }
    });
  }

  function step() {
    idx += 1;
    if (idx >= total) {
      finish();
      return;
    }
    for (const b of Object.values(btns)) {
      b.classList.remove("pressed");
      b.disabled = idx < n;
    }
    bar.style.width = `${(idx / total) * 100}%`;
    status.textContent =
      idx < n ? `${idx + 1} / ${total}  最初の${n}回は覚えるだけです` : `${idx + 1} / ${total}`;

    const cell = cells[pos[idx]];
    cell.classList.add("active");
    if (audio) {
      speak(lets[idx]);
    } else {
      cell.textContent = lets[idx];
    }
    onset = performance.now();
    later(hide, STIM_MS);
    const nextAt = start + (idx + 1) * TRIAL_MS;
    later(step, Math.max(0, nextAt - performance.now()));
  }

  function finish() {
    cleanup();
    const errors = { pos: 0, let: 0 };
    const rts = [];
    for (let i = n; i < total; i++) {
      for (const [mod, seq] of [["pos", pos], ["let", lets]]) {
        const isTarget = seq[i] === seq[i - n];
        const pressed = resp[i][mod] !== null;
        if (pressed !== isTarget) {
          errors[mod] += 1;
        }
        if (pressed && isTarget) {
          rts.push(resp[i][mod]);
        }
      }
    }

    const accuracy = 1 - (errors.pos + errors.let) / (2 * SCORED_TRIALS);
    const worst = Math.max(errors.pos, errors.let);
    let nextN = n;
    if (worst < 3) {
      nextN = Math.min(n + 1, MAX_N);
    } else if (worst > 5) {
      nextN = Math.max(n - 1, MIN_N);
    }

    const meanRt = mean(rts);
    const extra = {
      errors_position: errors.pos,
      errors_letter: errors.let,
      audio,
    };
    saveResult(GAME_ID, n, nextN, accuracy, meanRt, extra);
    lastResult = {
      n,
      nextN,
      accuracy,
      meanRt,
      errorsPosition: errors.pos,
      errorsLetter: errors.let,
    };
    renderIntro();
  }

  btns.pos.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    respond("pos");
  });
  btns.let.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    respond("let");
  });

  keyHandler = (e) => {
    if (e.repeat) {
      return;
    }
    if (e.code === "KeyA") {
      respond("pos");
    } else if (e.code === "KeyL") {
      respond("let");
    }
  };
  document.addEventListener("keydown", keyHandler);

  root.querySelector("#nb-abort").addEventListener("click", () => {
    cleanup();
    lastResult = null;
    renderIntro();
  });

  later(() => {
    start = performance.now();
    step();
  }, 1000);
}
