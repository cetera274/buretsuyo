// File: js/app.js
import * as nback from "./nback.js";
import * as stroop from "./stroop.js";
import * as switching from "./switching.js";
import { renderHome, renderRecords } from "./pages.js";

const ROUTES = {
  home: { title: "ホーム", render: renderHome },
  nback: { title: "デュアルNバック", render: nback.render, cleanup: nback.cleanup },
  stroop: { title: "ストループ課題", render: stroop.render, cleanup: stroop.cleanup },
  switching: { title: "タスクスイッチング", render: switching.render, cleanup: switching.cleanup },
  records: { title: "記録", render: renderRecords },
};

const app = document.getElementById("app");
let current = null;

function route() {
  if (current && current.cleanup) {
    current.cleanup();
  }
  const key = location.hash.slice(1);
  const name = key in ROUTES ? key : "home";
  current = ROUTES[name];

  document.querySelectorAll("#nav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.route === name);
  });
  document.title = name === "home" ? "ぶれつよ" : `${current.title} | ぶれつよ`;

  current.render(app);
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
route();