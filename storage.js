// File: js/storage.js
const RESULTS_KEY = "buretsuyo.results.v1";
const SETTINGS_KEY = "buretsuyo.settings.v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function loadResults(game = null) {
  const list = readJson(RESULTS_KEY, []);
  return game ? list.filter((r) => r.game === game) : list;
}

export function saveResult(game, level, nextLevel, accuracy, meanRtMs = null, extra = {}) {
  const list = loadResults();
  const id = list.length ? list[list.length - 1].id + 1 : 1;
  list.push({
    id,
    game,
    playedAt: new Date().toISOString(),
    level,
    nextLevel,
    accuracy,
    meanRtMs,
    extra,
  });
  localStorage.setItem(RESULTS_KEY, JSON.stringify(list));
}

export function getNextLevel(game, defaultLevel = 1) {
  const list = loadResults(game);
  return list.length ? list[list.length - 1].nextLevel : defaultLevel;
}

export function exportResults() {
  return JSON.stringify(loadResults(), null, 2);
}

function isValidRecord(r) {
  return (
    r !== null &&
    typeof r === "object" &&
    typeof r.game === "string" &&
    typeof r.playedAt === "string" &&
    !Number.isNaN(Date.parse(r.playedAt)) &&
    Number.isInteger(r.level) &&
    Number.isInteger(r.nextLevel) &&
    typeof r.accuracy === "number"
  );
}

export function importResults(text) {
  const data = JSON.parse(text);
  if (!Array.isArray(data) || !data.every(isValidRecord)) {
    throw new Error("ファイルの形式が正しくありません。");
  }
  const normalized = data
    .map((r) => ({
      game: r.game,
      playedAt: r.playedAt,
      level: r.level,
      nextLevel: r.nextLevel,
      accuracy: r.accuracy,
      meanRtMs: typeof r.meanRtMs === "number" ? r.meanRtMs : null,
      extra: r.extra && typeof r.extra === "object" ? r.extra : {},
    }))
    .sort((a, b) => Date.parse(a.playedAt) - Date.parse(b.playedAt))
    .map((r, i) => ({ id: i + 1, ...r }));
  localStorage.setItem(RESULTS_KEY, JSON.stringify(normalized));
  return normalized.length;
}

export function clearResults() {
  localStorage.removeItem(RESULTS_KEY);
}

export function getSetting(name, defaultValue) {
  const settings = readJson(SETTINGS_KEY, {});
  return name in settings ? settings[name] : defaultValue;
}

export function setSetting(name, value) {
  const settings = readJson(SETTINGS_KEY, {});
  settings[name] = value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}