/* Graphiques SVG légers : barres (groupées) et courbes, avec infobulle au survol. */
(function (root) {
  'use strict';
  const BR = root.BR;
  const { esc } = BR;
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- Infobulle partagée ---------- */
  let tipEl = null;
  function tip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tooltip';
      tipEl.setAttribute('role', 'status');
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function showTip(html, x, y) {
    const t = tip();
    t.innerHTML = html;
    t.classList.add('show');
    const r = t.getBoundingClientRect();
    let left = x + 14, top = y - r.height - 12;
    if (left + r.width > innerWidth - 8) left = x - r.width - 14;
    if (left < 8) left = 8;
    if (top < 8) top = y + 18;
    t.style.transform = 'translate(' + Math.round(left) + 'px,' + Math.round(top) + 'px)';
  }
  function hideTip() { if (tipEl) tipEl.classList.remove('show'); }
  root.addEventListener('scroll', hideTip, { passive: true });

  function tipRows(title, rows) {
    return '<div class="tt-title">' + esc(title) + '</div>' + rows.map((r) =>
      '<div class="tt-row">' + (r.cls ? '<i class="sw ' + r.cls + '"></i>' : '') +
      '<span class="tt-name">' + esc(r.name) + '</span><b>' + esc(r.value) + '</b></div>').join('');
  }

  /* ---------- Échelle ---------- */
  function niceScale(max, ticks) {
    if (max <= 0) return { max: 4, step: 1 };
    const raw = max / (ticks || 4);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    if (step < 1) step = 1;
    step = Math.ceil(step);
    return { max: Math.ceil(max / step) * step, step };
  }

  function el(name, attrs) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function topRoundedBar(x, y, w, h, r) {
    r = Math.min(r, w / 2, h);
    const y0 = y + h;
    return 'M' + x + ',' + y0 + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + y0 + 'Z';
  }

  /* Montage commun : SVG responsive, re-rendu au redimensionnement. */
  function mount(container, draw) {
    let first = true, lastW = 0;
    const render = () => {
      const w = Math.max(240, Math.floor(container.clientWidth));
      if (w === lastW) return;
      lastW = w;
      container.innerHTML = '';
      container.appendChild(draw(w, first && !BR.reducedMotion()));
      first = false;
    };
    render();
    if (root.ResizeObserver) {
      if (container._ro) container._ro.disconnect();
      let raf = 0;
      container._ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); });
      container._ro.observe(container);
    }
  }

  function frame(w, h, m, scale, fmtTick, label) {
    const svg = el('svg', { viewBox: '0 0 ' + w + ' ' + h, width: w, height: h, role: 'img', 'aria-label': label || '' , class: 'chart-svg' });
    const plotH = h - m.top - m.bottom;
    const y = (v) => m.top + plotH - (v / scale.max) * plotH;
    for (let v = 0; v <= scale.max + 1e-9; v += scale.step) {
      const yy = Math.round(y(v)) + 0.5;
      svg.appendChild(el('line', { x1: m.left, x2: w - m.right, y1: yy, y2: yy, class: v === 0 ? 'axis' : 'grid' }));
      const t = el('text', { x: m.left - 6, y: yy + 3.5, class: 'tick', 'text-anchor': 'end' });
      t.textContent = fmtTick(v);
      svg.appendChild(t);
    }
    return { svg, y, plotH };
  }

  /* ---------- Barres (une ou plusieurs séries côte à côte) ---------- */
  function bars(container, cfg) {
    const n = cfg.labels.length;
    const k = cfg.series.length;
    const h = cfg.height || 200;
    const fmtV = cfg.format || BR.fmt.num;
    let max = 0;
    cfg.series.forEach((s) => s.values.forEach((v) => { if (v > max) max = v; }));
    const scale = niceScale(max, 4);

    mount(container, (w, animate) => {
      const m = { top: 10, right: 6, bottom: 22, left: 34 };
      const { svg, y } = frame(w, h, m, scale, BR.fmt.num, cfg.ariaLabel);
      const plotW = w - m.left - m.right;
      const gw = plotW / n;
      const gap = 2;
      const bw = Math.max(2, Math.min(cfg.maxBar || 22, (gw * 0.72 - gap * (k - 1)) / k));
      const groupW = bw * k + gap * (k - 1);
      const every = cfg.labelEvery || Math.max(1, Math.ceil(n / Math.floor(plotW / 34)));
      const groups = [];

      for (let i = 0; i < n; i++) {
        const gx = m.left + gw * i + (gw - groupW) / 2;
        const g = el('g', { class: 'bar-group' });
        cfg.series.forEach((s, si) => {
          const v = s.values[i];
          if (!v) return;
          const yy = y(v);
          const p = el('path', { d: topRoundedBar(gx + si * (bw + gap), yy, bw, m.top + (h - m.top - m.bottom) - yy, 4), class: 'bar ' + s.cls + (animate ? ' grow' : '') });
          if (animate) p.style.animationDelay = Math.min(i * 12, 400) + 'ms';
          g.appendChild(p);
        });
        svg.appendChild(g);
        groups.push(g);
        if (i % every === 0) {
          const t = el('text', { x: m.left + gw * i + gw / 2, y: h - 6, class: 'tick', 'text-anchor': 'middle' });
          t.textContent = cfg.labels[i];
          svg.appendChild(t);
        }
      }

      // Zones de survol plus larges que les barres
      const hit = el('rect', { x: m.left, y: m.top, width: plotW, height: h - m.top - m.bottom, class: 'hit' });
      svg.appendChild(hit);
      const move = (ev) => {
        const r = svg.getBoundingClientRect();
        const i = Math.max(0, Math.min(n - 1, Math.floor(((ev.clientX - r.left) * (w / r.width) - m.left) / gw)));
        groups.forEach((g, gi) => g.classList.toggle('dim', gi !== i));
        const title = cfg.tooltipTitle ? cfg.tooltipTitle(i) : cfg.labels[i];
        showTip(tipRows(title, cfg.series.map((s) => ({ cls: s.cls, name: s.name, value: fmtV(s.values[i] || 0) }))), ev.clientX, ev.clientY);
      };
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', () => { groups.forEach((g) => g.classList.remove('dim')); hideTip(); });
      return svg;
    });
  }

  /* ---------- Courbes avec réticule ---------- */
  function lines(container, cfg) {
    const n = cfg.labels.length;
    const h = cfg.height || 200;
    const fmtV = cfg.format || BR.fmt.num;
    let max = 0;
    cfg.series.forEach((s) => s.values.forEach((v) => { if (v != null && v > max) max = v; }));
    const scale = niceScale(max, 4);

    mount(container, (w, animate) => {
      const m = { top: 10, right: 10, bottom: 22, left: 34 };
      const { svg, y } = frame(w, h, m, scale, BR.fmt.num, cfg.ariaLabel);
      const plotW = w - m.left - m.right;
      const x = (i) => m.left + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
      const every = cfg.labelEvery || Math.max(1, Math.ceil(n / Math.floor(plotW / 40)));
      for (let i = 0; i < n; i += every) {
        const t = el('text', { x: x(i), y: h - 6, class: 'tick', 'text-anchor': i === 0 ? 'start' : 'middle' });
        t.textContent = cfg.labels[i];
        svg.appendChild(t);
      }
      cfg.series.forEach((s) => {
        let d = '', pen = false;
        s.values.forEach((v, i) => {
          if (v == null) { pen = false; return; }
          d += (pen ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1);
          pen = true;
        });
        const p = el('path', { d, class: 'line ' + s.cls + (animate ? ' draw' : '') , pathLength: 1 });
        svg.appendChild(p);
      });
      const cross = el('line', { x1: 0, x2: 0, y1: m.top, y2: h - m.bottom, class: 'crosshair' });
      svg.appendChild(cross);
      const dots = cfg.series.map((s) => { const c = el('circle', { r: 4.5, class: 'dot ' + s.cls }); svg.appendChild(c); return c; });
      const hit = el('rect', { x: m.left - 6, y: m.top, width: plotW + 12, height: h - m.top - m.bottom, class: 'hit' });
      svg.appendChild(hit);
      const move = (ev) => {
        const r = svg.getBoundingClientRect();
        const px = (ev.clientX - r.left) * (w / r.width);
        const i = Math.max(0, Math.min(n - 1, Math.round(n === 1 ? 0 : ((px - m.left) / plotW) * (n - 1))));
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
        svg.classList.add('hovering');
        cfg.series.forEach((s, si) => {
          const v = s.values[i];
          dots[si].style.display = v == null ? 'none' : '';
          if (v != null) { dots[si].setAttribute('cx', x(i)); dots[si].setAttribute('cy', y(v)); }
        });
        const title = cfg.tooltipTitle ? cfg.tooltipTitle(i) : cfg.labels[i];
        showTip(tipRows(title, cfg.series.map((s) => ({ cls: s.cls, name: s.name, value: s.values[i] == null ? '—' : fmtV(s.values[i]) }))), ev.clientX, ev.clientY);
      };
      hit.addEventListener('pointermove', move);
      hit.addEventListener('pointerdown', move);
      hit.addEventListener('pointerleave', () => { svg.classList.remove('hovering'); hideTip(); });
      return svg;
    });
  }

  /* ---------- Vue tableau (accessibilité) ---------- */
  function table(cfg) {
    const fmtV = cfg.format || BR.fmt.num;
    return '<div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">' + esc(cfg.head || '') + '</th>' +
      cfg.series.map((s) => '<th scope="col"><i class="sw ' + s.cls + '"></i>' + esc(s.name) + '</th>').join('') +
      '</tr></thead><tbody>' + cfg.labels.map((l, i) =>
        '<tr><th scope="row">' + esc(cfg.rowLabel ? cfg.rowLabel(i) : l) + '</th>' +
        cfg.series.map((s) => '<td>' + (s.values[i] == null ? '—' : esc(fmtV(s.values[i]))) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  function legend(series) {
    return '<div class="legend">' + series.map((s) => '<span class="legend-item"><i class="sw ' + s.cls + '"></i>' + esc(s.name) + '</span>').join('') + '</div>';
  }

  BR.charts = { bars, lines, table, legend, showTip, hideTip, tipRows };
})(window);
