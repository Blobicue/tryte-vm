'use strict';
/* ---------------------------------------------------------------------------
 * visualizer.js — Physical Anyon Spacetime Braid Renderer
 *
 * Renders 2D+1 spacetime worldlines of 3-strand (or 4-strand) anyon braids
 * in both ASCII art and scalable vector graphics (SVG).
 * ------------------------------------------------------------------------- */

/**
 * Render a braid word as an ASCII spacetime diagram.
 * Strands run vertically downwards.
 * @param {Array<number>} word - Braid word array, e.g. [1, -2, 1, 1, 2]
 * @returns {string} ASCII diagram
 */
function renderASCII(word) {
  const lines = [];
  lines.push('  τ₁    τ₂    τ₃   (Anyon Strands)');
  lines.push('  │     │     │');

  for (let step = 0; step < word.length; step++) {
    const gen = word[step];
    if (gen === 1) {
      // σ₁: Strand 1 crosses OVER Strand 2
      lines.push('  ╲    ╱      │');
      lines.push('   ╲  ╱       │   [σ₁ : 1 over 2]');
      lines.push('    ╲╱        │');
      lines.push('    ╱╲        │');
      lines.push('   ╱  ╲       │');
      lines.push('  ╱    ╲      │');
    } else if (gen === -1) {
      // σ₁⁻¹: Strand 1 crosses UNDER Strand 2
      lines.push('  ╲    ╱      │');
      lines.push('   ╲  ╱       │   [σ₁⁻¹: 1 under 2]');
      lines.push('    ╵ ╵       │');
      lines.push('   ╱ ╲ ╲      │');
      lines.push('  ╱   ╲ ╲     │');
      lines.push(' ╱     ╲ ╲    │');
    } else if (gen === 2) {
      // σ₂: Strand 2 crosses OVER Strand 3
      lines.push('  │     ╲    ╱');
      lines.push('  │      ╲  ╱     [σ₂ : 2 over 3]');
      lines.push('  │       ╲╱  ');
      lines.push('  │       ╱╲  ');
      lines.push('  │      ╱  ╲ ');
      lines.push('  │     ╱    ╲');
    } else if (gen === -2) {
      // σ₂⁻¹: Strand 2 crosses UNDER Strand 3
      lines.push('  │     ╲    ╱');
      lines.push('  │      ╲  ╱     [σ₂⁻¹: 2 under 3]');
      lines.push('  │       ╵ ╵ ');
      lines.push('  │      ╱ ╲ ╲');
      lines.push('  │     ╱   ╲ ╲');
      lines.push('  │    ╱     ╲ ╲');
    } else if (gen === 3 || gen === -3) {
      lines.push('  │     │     │   ╲   ╱  [σ₃ : 3 & 4]');
      lines.push('  │     │     │    ╲ ╱ ');
      lines.push('  │     │     │     ╳  ');
      lines.push('  │     │     │    ╱ ╲ ');
    }
    lines.push('  │     │     │');
  }

  lines.push('  ▼     ▼     ▼   (Fusion Channel Output)');
  return lines.join('\n');
}

/**
 * Render a braid word as an SVG diagram with smooth Bezier curves
 * and visual over/under crossings.
 * @param {Array<number>} word - Braid word
 * @param {object} opts - Styling options
 * @returns {string} SVG xml
 */
function renderSVG(word, opts = {}) {
  const width = opts.width || 360;
  const stepHeight = opts.stepHeight || 60;
  const height = (word.length + 2) * stepHeight;
  const strandColors = opts.strandColors || ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
  const strokeWidth = 5;

  const strandX = [60, 160, 260];
  let currentPositions = [0, 1, 2]; // tracking which physical strand is at which position

  let svgPaths = '';
  let y = stepHeight;

  // Initial straight leads
  for (let i = 0; i < 3; i++) {
    svgPaths += `  <path d="M ${strandX[i]} 20 L ${strandX[i]} ${y}" stroke="${strandColors[currentPositions[i]]}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
  }

  for (let s = 0; s < word.length; s++) {
    const gen = word[s];
    const yStart = y;
    const yEnd = y + stepHeight;
    const yMid = (yStart + yEnd) / 2;

    if (Math.abs(gen) === 1) {
      const idxA = 0, idxB = 1;
      const xA = strandX[idxA], xB = strandX[idxB];
      const colorA = strandColors[currentPositions[idxA]];
      const colorB = strandColors[currentPositions[idxB]];

      // Unchanged strand 2
      svgPaths += `  <path d="M ${strandX[2]} ${yStart} L ${strandX[2]} ${yEnd}" stroke="${strandColors[currentPositions[2]]}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;

      if (gen === 1) {
        // Strand A crosses OVER Strand B (Draw B first, then mask and draw A)
        svgPaths += `  <path d="M ${xB} ${yStart} C ${xB} ${yMid}, ${xA} ${yMid}, ${xA} ${yEnd}" stroke="${colorB}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
        // Gap for under-strand
        svgPaths += `  <path d="M ${xA} ${yStart} C ${xA} ${yMid}, ${xB} ${yMid}, ${xB} ${yEnd}" stroke="#1e293b" stroke-width="${strokeWidth + 6}" stroke-linecap="round" fill="none"/>\n`;
        svgPaths += `  <path d="M ${xA} ${yStart} C ${xA} ${yMid}, ${xB} ${yMid}, ${xB} ${yEnd}" stroke="${colorA}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
      } else {
        // Strand A crosses UNDER Strand B
        svgPaths += `  <path d="M ${xA} ${yStart} C ${xA} ${yMid}, ${xB} ${yMid}, ${xB} ${yEnd}" stroke="${colorA}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
        // Gap for under-strand
        svgPaths += `  <path d="M ${xB} ${yStart} C ${xB} ${yMid}, ${xA} ${yMid}, ${xA} ${yEnd}" stroke="#1e293b" stroke-width="${strokeWidth + 6}" stroke-linecap="round" fill="none"/>\n`;
        svgPaths += `  <path d="M ${xB} ${yStart} C ${xB} ${yMid}, ${xA} ${yMid}, ${xA} ${yEnd}" stroke="${colorB}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
      }

      // Swap positions
      const tmp = currentPositions[idxA];
      currentPositions[idxA] = currentPositions[idxB];
      currentPositions[idxB] = tmp;

    } else if (Math.abs(gen) === 2) {
      const idxA = 1, idxB = 2;
      const xA = strandX[idxA], xB = strandX[idxB];
      const colorA = strandColors[currentPositions[idxA]];
      const colorB = strandColors[currentPositions[idxB]];

      // Unchanged strand 0
      svgPaths += `  <path d="M ${strandX[0]} ${yStart} L ${strandX[0]} ${yEnd}" stroke="${strandColors[currentPositions[0]]}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;

      if (gen === 2) {
        // Strand A crosses OVER Strand B
        svgPaths += `  <path d="M ${xB} ${yStart} C ${xB} ${yMid}, ${xA} ${yMid}, ${xA} ${yEnd}" stroke="${colorB}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
        svgPaths += `  <path d="M ${xA} ${yStart} C ${xA} ${yMid}, ${xB} ${yMid}, ${xB} ${yEnd}" stroke="#1e293b" stroke-width="${strokeWidth + 6}" stroke-linecap="round" fill="none"/>\n`;
        svgPaths += `  <path d="M ${xA} ${yStart} C ${xA} ${yMid}, ${xB} ${yMid}, ${xB} ${yEnd}" stroke="${colorA}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
      } else {
        // Strand A crosses UNDER Strand B
        svgPaths += `  <path d="M ${xA} ${yStart} C ${xA} ${yMid}, ${xB} ${yMid}, ${xB} ${yEnd}" stroke="${colorA}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
        svgPaths += `  <path d="M ${xB} ${yStart} C ${xB} ${yMid}, ${xA} ${yMid}, ${xA} ${yEnd}" stroke="#1e293b" stroke-width="${strokeWidth + 6}" stroke-linecap="round" fill="none"/>\n`;
        svgPaths += `  <path d="M ${xB} ${yStart} C ${xB} ${yMid}, ${xA} ${yMid}, ${xA} ${yEnd}" stroke="${colorB}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
      }

      // Swap positions
      const tmp = currentPositions[idxA];
      currentPositions[idxA] = currentPositions[idxB];
      currentPositions[idxB] = tmp;
    }

    y = yEnd;
  }

  // Terminal leads
  for (let i = 0; i < 3; i++) {
    svgPaths += `  <path d="M ${strandX[i]} ${y} L ${strandX[i]} ${y + 30}" stroke="${strandColors[currentPositions[i]]}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none"/>\n`;
    svgPaths += `  <circle cx="${strandX[i]}" cy="${y + 35}" r="5" fill="${strandColors[currentPositions[i]]}"/>\n`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="100%" height="100%" fill="#0f172a" rx="8"/>
  <text x="60" y="16" fill="#94a3b8" font-family="monospace" font-size="12" text-anchor="middle">τ₁</text>
  <text x="160" y="16" fill="#94a3b8" font-family="monospace" font-size="12" text-anchor="middle">τ₂</text>
  <text x="260" y="16" fill="#94a3b8" font-family="monospace" font-size="12" text-anchor="middle">τ₃</text>
${svgPaths}
</svg>`;
}

module.exports = {
  renderASCII,
  renderSVG,
};
