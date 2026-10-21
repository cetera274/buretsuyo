// File: js/chart.js
export function lineChart(values, { color = "#3949ab", integer = false, unit = "" } = {}) {
  if (!values.length) {
    return "";
  }
  const width = 640;
  const height = 220;
  const pad = { l: 64, r: 16, t: 14, b: 28 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) {
    min -= 1;
    max += 1;
  }

  const x = (i) => pad.l + (values.length === 1 ? w / 2 : (i * w) / (values.length - 1));
  const y = (v) => pad.t + h - ((v - min) / (max - min)) * h;
  const fmt = (v) => `${Math.round(v)}${unit}`;

  let ticks;
  if (integer && max - min <= 6) {
    ticks = [];
    for (let v = Math.ceil(min); v <= Math.floor(max); v++) {
      ticks.push(v);
    }
  } else {
    ticks = [min, (min + max) / 2, max];
  }

  const grid = ticks
    .map(
      (v) =>
        `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#e0e0e0"/>` +
        `<text x="${pad.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end" font-size="12" fill="#607d8b">${fmt(v)}</text>`
    )
    .join("");

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dots = values
    .map((v, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.5" fill="${color}"/>`)
    .join("");

  let xLabels = `<text x="${x(0).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="12" fill="#607d8b">1</text>`;
  if (values.length > 1) {
    xLabels += `<text x="${x(values.length - 1).toFixed(1)}" y="${height - 8}" text-anchor="middle" font-size="12" fill="#607d8b">${values.length}</text>`;
  }

  return (
    `<svg class="chart" viewBox="0 0 ${width} ${height}" role="img">` +
    grid +
    `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>` +
    dots +
    xLabels +
    `</svg>`
  );
}
