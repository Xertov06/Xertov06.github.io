/* Section « Activité annuelle » : calendrier thermique d'une année entière. */
(function (root) {
  'use strict';
  const BR = root.BR;
  const { D, fmt, esc, $, $$, icon, store, stats, charts, ui } = BR;
  const sub = BR.statsViews = BR.statsViews || {};

  const state = { year: null, selected: null };

  function ordinalBest(rank) {
    return rank === 1 ? 'Meilleure journée' : rank + '<sup>e</sup> meilleure journée';
  }

  function cellLabel(idx, v) {
    return (v ? fmt.br(v) : 'Aucun BR') + ' · ' + fmt.dayLong(idx);
  }

  function legendHTML(bounds) {
    const items = [{ lvl: 0, txt: '0' }];
    let prev = 0;
    bounds.forEach((b, k) => { items.push({ lvl: k + 1, txt: b === prev + 1 ? String(b) : (prev + 1) + '–' + b }); prev = b; });
    if (!bounds.length) [1, 2, 3, 4].forEach((l) => items.push({ lvl: l, txt: '' }));
    return '<div class="heat-legend" aria-label="Légende : nombre de BR par jour"><span class="muted small">Moins</span>' +
      items.map((it) => '<span class="hl-item"><i class="hc-sw l' + it.lvl + '"></i><span>' + esc(it.txt) + '</span></span>').join('') +
      '<span class="muted small">Plus</span></div>';
  }

  function gridHTML(ys, today, animate) {
    const start = D.fromYMD(ys.year, 0, 1), end = D.fromYMD(ys.year, 11, 31);
    const w0 = D.weekStart(start);
    const weeks = Math.floor((D.weekStart(end) - w0) / 7) + 1;
    let html = '<div class="heatmap' + (animate ? ' heat-anim' : '') + '" role="grid" aria-label="Calendrier thermique ' + ys.year + '" style="--weeks:' + weeks + '">';
    html += '<span class="hm-corner"></span>';
    for (let m = 0; m < 12; m++) {
      const col = Math.floor((D.fromYMD(ys.year, m, 1) - w0) / 7);
      html += '<span class="hm-month" style="grid-column:' + (col + 2) + ' / span 4">' + esc(fmt.monthShort(D.fromYMD(ys.year, m, 1))) + '</span>';
    }
    for (let r = 0; r < 7; r++) {
      html += '<span class="hm-wd" style="grid-row:' + (r + 2) + '">' + (r % 2 === 0 ? fmt.weekdayShort(r) : '') + '</span>';
    }
    const focusDay = state.selected !== null && state.selected >= start && state.selected <= end ? state.selected
      : (today >= start && today <= end ? today : start);
    for (let i = start; i <= end; i++) {
      const v = ys.daily[i - start];
      const col = Math.floor((i - w0) / 7);
      const lvl = stats.levelOf(v, ys.bounds);
      const cls = 'hc l' + lvl + (i > today ? ' future' : '') + (i === today ? ' today' : '') + (i === state.selected ? ' sel' : '');
      html += '<button type="button" role="gridcell" class="' + cls + '" data-day="' + i + '" tabindex="' + (i === focusDay ? 0 : -1) +
        '" style="grid-column:' + (col + 2) + ';grid-row:' + (D.weekday(i) + 2) + ';--c:' + col + '" aria-label="' + esc(cellLabel(i, v)) + '"' +
        (i === state.selected ? ' aria-selected="true"' : '') + '></button>';
    }
    return html + '</div>';
  }

  function detailHTML(ix, idx, today) {
    if (idx === null) {
      return '<div class="detail-empty">' + icon('calendar') + '<p>Clique sur une case du calendrier pour afficher le détail de la journée.</p></div>';
    }
    const day = ix.byDay.get(idx);
    const rank = stats.dayRankInYear(ix, idx);
    const ys = stats.yearStats(ix, D.ymd(idx).y, today);
    const avgActive = ys.activeDays ? ys.total / ys.activeDays : 0;
    let html = '<div class="detail-head"><div><p class="eyebrow">Détail de la journée</p><h2>' + esc(fmt.dayLong(idx)) + '</h2></div>' +
      '<button class="icon-btn" type="button" data-action="close-detail" aria-label="Fermer le détail">' + icon('close') + '</button></div>';
    if (!day) {
      html += '<p class="muted">' + (idx > today ? 'Cette journée n’est pas encore passée.' : 'Aucun événement enregistré ce jour-là.') + '</p>';
    } else {
      html += '<div class="detail-stats">' +
        '<div><span class="detail-num">' + fmt.num(day.br) + '</span><span class="muted">BR</span></div>' +
        '<div><span class="detail-num sm">' + fmt.num(day.n) + '</span><span class="muted">' + (day.n > 1 ? 'saisies' : 'saisie') + '</span></div>' +
        '<div class="detail-note">' + (rank ? ordinalBest(rank.rank) + ' de ' + ys.year + ' sur ' + fmt.plural(rank.of, 'jour actif', 'jours actifs') : '') +
          '<br><span class="muted small">Moyenne ' + ys.year + ' : ' + fmt.dec(avgActive) + ' BR par jour actif (' + (day.br >= avgActive ? '+' : '') + fmt.num(Math.round((day.br - avgActive) * 100) / 100) + ')</span></div>' +
      '</div>' +
      '<ul class="entries">' + day.entries.slice().reverse().map((e) => BR.entryRow(e)).join('') + '</ul>';
    }
    html += '<div class="btn-row">' +
      (idx <= today ? '<button class="btn btn-sm" type="button" data-action="add-day" data-day="' + idx + '">' + icon('plus') + 'Ajouter une saisie ce jour</button>' : '') +
      '<button class="btn btn-sm btn-ghost" type="button" data-action="compare-day" data-day="' + idx + '">' + icon('swap') + 'Comparer avec la veille</button>' +
      '</div>';
    return html;
  }

  function select(view, idx, focus) {
    state.selected = idx;
    $$('.hc.sel', view).forEach((c) => { c.classList.remove('sel'); c.removeAttribute('aria-selected'); });
    const cell = idx !== null ? $('.hc[data-day="' + idx + '"]', view) : null;
    if (cell) {
      cell.classList.add('sel');
      cell.setAttribute('aria-selected', 'true');
      $$('.hc[tabindex="0"]', view).forEach((c) => (c.tabIndex = -1));
      cell.tabIndex = 0;
      if (focus) cell.focus();
    }
    const panel = $('#day-detail', view);
    panel.innerHTML = detailHTML(stats.index(store.all()), idx, D.today());
    panel.classList.remove('pop'); void panel.offsetWidth; panel.classList.add('pop');
    const q = 'annee=' + state.year + (idx !== null ? '&jour=' + D.toKey(idx) : '');
    history.replaceState(null, '', '#/stats/activite?' + q);
  }

  sub.activite = {
    title: 'Activité annuelle',
    render(view, params, opts) {
      const today = D.today();
      const ix = stats.index(store.all());
      const range = stats.yearsRange(ix, today);
      if (params.jour && D.isValidKey(params.jour)) { state.selected = D.fromKey(params.jour); state.year = D.ymd(state.selected).y; }
      if (params.annee && /^\d{4}$/.test(params.annee)) state.year = Number(params.annee);
      if (state.year === null) state.year = D.ymd(today).y;
      state.year = Math.max(range.first, Math.min(range.last, state.year));
      if (state.selected !== null && D.ymd(state.selected).y !== state.year) state.selected = null;

      const ys = stats.yearStats(ix, state.year, today);
      const years = [];
      for (let y = range.last; y >= range.first; y--) years.push(y);
      const best = ys.best;

      view.innerHTML =
        '<section class="card heat-card">' +
          '<div class="card-head wrap">' +
            '<div><h2>Activité annuelle</h2><p class="muted small">Chaque case est une journée ; plus elle est foncée, plus il y a de BR.</p></div>' +
            '<div class="year-nav">' +
              '<button class="icon-btn" type="button" data-year-step="-1" aria-label="Année précédente"' + (state.year <= range.first ? ' disabled' : '') + '>' + icon('chevL') + '</button>' +
              '<select id="year-select" aria-label="Année">' + years.map((y) => '<option' + (y === state.year ? ' selected' : '') + '>' + y + '</option>').join('') + '</select>' +
              '<button class="icon-btn" type="button" data-year-step="1" aria-label="Année suivante"' + (state.year >= range.last ? ' disabled' : '') + '>' + icon('chevR') + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="year-stats">' +
            chip('Total ' + state.year, fmt.br(ys.total)) +
            chip('Jours avec événement', fmt.num(ys.activeDays) + ' / ' + fmt.num(ys.elapsed)) +
            chip('Moyenne quotidienne', ys.avg !== null ? fmt.dec(ys.avg) + ' BR' : '—') +
            chip('Journée la plus active', best ? fmt.br(best.br) + ' · ' + fmt.dayMonth(best.idx) : '—', best ? best.idx : null) +
            chip('Plus longue série', ys.streak ? fmt.days(ys.streak) + ' d’affilée' : '—') +
          '</div>' +
          '<div class="heat-scroll" id="heat-scroll">' + gridHTML(ys, today, opts.animate) + '</div>' +
          '<div class="heat-foot"><span class="muted small">' + (ys.max ? 'Intensité calculée sur le maximum de l’année : ' + fmt.br(ys.max) + ' en une journée' : 'Aucun événement enregistré cette année') + '</span>' + legendHTML(ys.bounds) + '</div>' +
        '</section>' +
        '<section class="card day-detail" id="day-detail" aria-live="polite">' + detailHTML(ix, state.selected, today) + '</section>' +
        '<section class="card"><div class="card-head"><h2>Mois par mois · ' + state.year + '</h2></div><div class="chart" id="month-chart"></div></section>';

      // Défilement initial : montre la période la plus récente de l'année
      const sc = $('#heat-scroll', view);
      const target = state.selected !== null ? state.selected : (D.ymd(today).y === state.year ? today : null);
      if (target !== null) {
        const cell = $('.hc[data-day="' + target + '"]', view);
        if (cell) requestAnimationFrame(() => { sc.scrollLeft = Math.max(0, cell.offsetLeft - sc.clientWidth * 0.6); });
      }

      charts.bars($('#month-chart', view), {
        labels: ys.monthly.map((_, m) => fmt.monthShort(D.fromYMD(state.year, m, 1))),
        series: [{ name: 'BR', cls: 's-1', values: ys.monthly }], height: 170, maxBar: 26,
        tooltipTitle: (m) => fmt.month(D.fromYMD(state.year, m, 1)), ariaLabel: 'BR par mois en ' + state.year,
      });

      $('#year-select', view).addEventListener('change', (e) => { state.year = Number(e.target.value); state.selected = null; go(); });

      const grid = $('.heatmap', view);
      grid.addEventListener('pointerover', (e) => {
        const c = e.target.closest('.hc');
        if (!c) return;
        const r = c.getBoundingClientRect();
        charts.showTip('<div class="tt-title">' + esc(fmt.dayLong(Number(c.dataset.day))) + '</div><div class="tt-row"><b>' + esc(fmt.br(stats.dayBR(ix, Number(c.dataset.day)))) + '</b></div>', r.left + r.width / 2, r.top);
      });
      grid.addEventListener('pointerleave', charts.hideTip);
      grid.addEventListener('keydown', (e) => {
        const c = e.target.closest('.hc');
        if (!c) return;
        const moves = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7, Home: null, End: null };
        if (!(e.key in moves)) return;
        e.preventDefault();
        const s = D.fromYMD(state.year, 0, 1), en = D.fromYMD(state.year, 11, 31);
        let next = e.key === 'Home' ? s : e.key === 'End' ? en : Number(c.dataset.day) + moves[e.key];
        next = Math.max(s, Math.min(en, next));
        select(view, next, true);
      });
    },
    onClick(ev, view) {
      const c = ev.target.closest('.hc');
      if (c) { charts.hideTip(); select(view, Number(c.dataset.day), false); return true; }
      const ys = ev.target.closest('[data-year-step]');
      if (ys) { state.year += Number(ys.dataset.yearStep); state.selected = null; go(); return true; }
      const jump = ev.target.closest('[data-jump]');
      if (jump) { select(view, Number(jump.dataset.jump), true); return true; }
      const a = ev.target.closest('[data-action]');
      if (!a) return false;
      if (a.dataset.action === 'close-detail') { select(view, null); return true; }
      if (a.dataset.action === 'add-day') {
        const d = Number(a.dataset.day);
        ui.openEntry({ date: D.toKey(d), time: d === D.today() ? D.nowTime() : '12:00' });
        return true;
      }
      if (a.dataset.action === 'compare-day') {
        const d = Number(a.dataset.day);
        BR.compareState.set({ mode: 'jour', a: d - 1, b: d });
        location.hash = '#/stats/comparateur';
        return true;
      }
      return false;
    },
  };

  function go() { location.hash = '#/stats/activite?annee=' + state.year; }

  function chip(label, value, jump) {
    return '<div class="ys-chip' + (jump != null ? ' clickable' : '') + '"' + (jump != null ? ' data-jump="' + jump + '" role="button" tabindex="0"' : '') +
      '><span class="ys-label">' + esc(label) + '</span><span class="ys-value">' + esc(value) + '</span></div>';
  }
})(window);
