// File: js/util.js
export function mean(values) {
  if (!values.length) {
    return null;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function choice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

export function shuffle(values) {
  const arr = [...values];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function nextLevelByAccuracy(accuracy, level, minLevel, maxLevel) {
  if (accuracy >= 0.9) {
    return Math.min(level + 1, maxLevel);
  }
  if (accuracy < 0.75) {
    return Math.max(level - 1, minLevel);
  }
  return level;
}

export function fmtMs(value) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }
  return `${Math.round(value)} ms`;
}

export function pct(value) {
  return `${Math.round(value * 100)}%`;
}

export function levelMessage(level, nextLevel, label) {
  if (nextLevel > level) {
    return `レベルアップ。次回は ${label(nextLevel)} です。`;
  }
  if (nextLevel < level) {
    return `次回は ${label(nextLevel)} で調整します。`;
  }
  return `次回も ${label(level)} です。`;
}
