// File: js/pages.js
import * as nback from "./nback.js";
import * as stroop from "./stroop.js";
import * as switching from "./switching.js";
import { loadResults, exportResults, importResults, clearResults } from "./storage.js";
import { localDateKey, pct, fmtMs } from "./util.js";
import { lineChart } from "./chart.js";

export const GAMES = [
  { id: nback.GAME_ID, name: "デュアルNバック", ability: "ワーキングメモリ", route: "nback" },
  { id: stroop.GAME_ID, name: "ストループ課題", ability: "抑制制御", route: "stroop" },
  { id: switching.GAME_ID, name: "タスクスイッチング", ability: "認知の柔軟性", route: "switching" },
];

function calcStreak(dateKeys) {
  const d = new Date();
  if (!dateKeys.has(localDateKey(d))) {
    d.setDate(d.getDate() - 1);
  }
  let streak = 0;
  while (dateKeys.has(localDateKey(d))) {
    streak += 1;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function metric(label, value) {
  return `<div class="metric"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

export function renderHome(root) {
  const results = loadResults();
  const dateKeys = new Set(results.map((r) => localDateKey(new Date(r.playedAt))));
  const todayKey = localDateKey(new Date());
  const today = results.filter((r) => localDateKey(new Date(r.playedAt)) === todayKey);
  const playedToday = new Set(today.map((r) => r.game));

  const menu = GAMES.map((g) => {
    const done = playedToday.has(g.id);
    return `
      <li>
        <span class="badge ${done ? "done" : ""}">${done ? "済" : "未"}</span>
        <span><a href="#${g.route}">${g.name}</a> <span class="muted">${g.ability}</span></span>
      </li>`;
  }).join("");

  root.innerHTML = `
    <h1>ぶれつよ</h1>
    <p class="muted">研究で使われる認知課題 × 自動難易度調整のトレーニング</p>
    <div class="card">
      <div class="metrics">
        ${metric("連続日数", `${calcStreak(dateKeys)} 日`)}
        ${metric("今日のセット数", today.length)}
        ${metric("累計セット数", results.length)}
      </div>
    </div>
    <div class="card">
      <h2>今日のメニュー(約15分)</h2>
      <ul class="menu-list">${menu}</ul>
    </div>
    <div class="card">
      <details>
        <summary>効果について</summary>
        <p>訓練した課題そのものの成績は、練習によって向上します。ワーキングメモリなど近い能力への転移には一定の研究報告があります。一方で、知能全般や日常生活の能力への広い転移については研究者の間でも結論が出ておらず、否定的なメタ分析も存在します。</p>
        <p>このアプリは、常に少し難しい水準を保つ適応的難易度と、継続しやすい記録機能を重視しています。睡眠、運動、人との交流といった生活習慣と組み合わせることをおすすめします。</p>
      </details>
    </div>`;
}

function gameSection(game, list) {
  if (!list.length) {
    return `<div class="card"><h2>${game.name}</h2><p class="muted">記録なし</p></div>`;
  }
  const last = list[list.length - 1];
  const maxLevel = Math.max(...list.map((r) => r.level));
  let html = `
    <div class="card">
      <h2>${game.name}</h2>
      <div class="metrics">
        ${metric("現在のレベル", last.nextLevel)}
        ${metric("最高レベル", maxLevel)}
        ${metric("直近の正答率", pct(last.accuracy))}
        ${metric("直近の平均反応時間", fmtMs(last.meanRtMs))}
      </div>
      <p class="chart-title">レベルの推移(横軸:セット)</p>
      ${lineChart(list.map((r) => r.level), { integer: true })}`;

  let costKey = null;
  let costTitle = "";
  if (game.id === stroop.GAME_ID) {
    costKey = "interference_ms";
    costTitle = "干渉コストの推移(低いほど良い)";
  } else if (game.id === switching.GAME_ID) {
    costKey = "switch_cost_ms";
    costTitle = "切り替えコストの推移(低いほど良い)";
  }
  if (costKey) {
    const values = list
      .map((r) => (r.extra ? r.extra[costKey] : null))
      .filter((v) => typeof v === "number");
    if (values.length) {
      html += `<p class="chart-title">${costTitle}</p>${lineChart(values, { color: "#fb8c00", unit: " ms" })}`;
    }
  }
  html += "</div>";
  return html;
}

export function renderRecords(root) {
  const results = loadResults();
  const sections = results.length
    ? GAMES.map((g) => gameSection(g, results.filter((r) => r.game === g.id))).join("")
    : '<div class="card"><p>まだ記録がありません。</p></div>';

  root.innerHTML = `
    <h1>記録</h1>
    ${sections}
    <div class="card">
      <h2>データの管理</h2>
      <p class="muted">記録はこのブラウザ内(localStorage)にのみ保存され、外部には送信されません。端末やブラウザを変えるときは、書き出したファイルを移行先で読み込んでください。</p>
      <div class="btn-row">
        <button class="btn" id="rec-export">書き出し</button>
        <label class="btn">
          読み込み
          <input type="file" id="rec-import" accept="application/json,.json" hidden>
        </label>
        <button class="btn btn-danger" id="rec-clear">すべて削除</button>
      </div>
    </div>`;

  root.querySelector("#rec-export").addEventListener("click", () => {
    const blob = new Blob([exportResults()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buretsuyo-${localDateKey(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  root.querySelector("#rec-import").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) {
      return;
    }
    if (!confirm("現在の記録は読み込んだファイルの内容で置き換えられます。続けますか?")) {
      e.target.value = "";
      return;
    }
    try {
      const count = importResults(await file.text());
      alert(`${count} 件の記録を読み込みました。`);
    } catch (err) {
      alert(`読み込みに失敗しました。${err.message}`);
    }
    renderRecords(root);
  });

  root.querySelector("#rec-clear").addEventListener("click", () => {
    if (confirm("すべての記録を削除します。元に戻せません。続けますか?")) {
      clearResults();
      renderRecords(root);
    }
  });
}
