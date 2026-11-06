/* Section « Comparateur » : compare deux périodes (A = référence, B = période comparée). */
(function (root) {
  'use strict';
  const BR = root.BR;
  const { D, fmt, esc, $, $$, icon, store, stats, charts } = BR;
  const sub = BR.statsViews = BR.statsViews || {};
  const KEY = 'br.compare.v1';

  const MODES = [
    { id: 'jour', label: 'Jours' },
    { id: 'semaine', label: 'Semaines' },
    { id: 'mois', label: 'Mois' },
    { id: 'annee', label: 'Années' },
    { id: 'perso', label: 'Personnalisé' },
  ];

  /* ---------- Définition des périodes ---------- */
  function shift(mode, anchor, n) {
    switch (mode) {
      case 'jour': return anchor + n;
      case 'semaine': return anchor + 7 * n;
      case 'mois': return D.addMonths(anchor, n);
      case 'annee': return D.fromYMD(D.ymd(anchor).y + n, 0, 1);
      default: return anchor + n;
    }
  }

  function period(mode, a, aEnd) {
    switch (mode) {
      case 'jour': return { start: a, end: a, label: fmt.dayLong(a), short: fmt.dayMonthYear(a) };
      case 'semaine': { const s = D.weekStart(a); return { start: s, end: s + 6, label: fmt.week(s), short: 'Sem. du ' + fmt.dayMonthYear(s) }; }
      case 'mois': return { start: D.monthStart(a), end: D.monthEnd(a), label: fmt.month(a), short: fmt.month(a) };
      case 'annee': return { start: D.yearStart(a), end: D.yearEnd(a), label: 'Année ' + D.ymd(a).y, short: String(D.ymd(a).y) };
      default: {
        const s = Math.min(a, aEnd), e = Math.max(a, aEnd);
        return { start: s, end: e, label: fmt.range(s, e), short: fmt.dayMonth(s) + ' → ' + fmt.dayMonthYear(e) };
      }
    }
  }

  function defaults(mode) {
    const t = D.today();
    if (mode === 'perso') return { mode, b: t - 29, bEnd: t, a: t - 59, aEnd: t - 30 };
    return { mode, b: t, a: shift(mode, t, -1), aEnd: null, bEnd: null };
  }

  let st = null;
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (s && MODES.some((m) => m.id === s.mode) && Number.isFinite(s.a) && Number.isFinite(s.b)) return s;
    } catch (e) { /* ignore */ }
    return defaults('semaine');
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* ignore */ } }

  BR.compareState = {
    get() { if (!st) st = load(); return st; },
    set(patch) {
      st = Object.assign(defaults(patch.mode || BR.compareState.get().mode), patch);
      if (st.mode === 'perso') { if (st.aEnd == null) st.aEnd = st.a; if (st.bEnd == null) st.bEnd = st.b; }
      save();
    },
  };

  /* ---------- Contrôles de saisie de période ---------- */
  function yearOptions(sel, range) {
    let h = '';
    for (let y = range.last; y >= range.first - 1; y--) h += '<option value="' + y + '"' + (y === sel ? ' selected' : '') + '>' + y + '</option>';
    return h;
  }

  function periodInputs(which, mode, p, s, range) {
    const id = 'p' + which;
    const anchor = s[which];
    const max = D.toKey(D.today());
    let inputs;
    switch (mode) {
      case 'jour':
      case 'semaine':
        inputs = '<input type="date" class="cmp-in" data-which="' + which + '" data-field="day" value="' + D.toKey(mode === 'semaine' ? p.start : anchor) + '" max="' + max + '" aria-label="' + (mode === 'semaine' ? 'Un jour de la semaine ' : 'Jour ') + which.toUpperCase() + '">';
        break;
      case 'mois': {
        const ym = D.ymd(p.start);
        inputs = '<select class="cmp-in" data-which="' + which + '" data-field="month" aria-label="Mois ' + which.toUpperCase() + '">' +
          Array.from({ length: 12 }, (_, m) => '<option value="' + m + '"' + (m === ym.m ? ' selected' : '') + '>' + fmt.monthName(m) + '</option>').join('') + '</select>' +
          '<select class="cmp-in" data-which="' + which + '" data-field="year" aria-label="Année ' + which.toUpperCase() + '">' + yearOptions(ym.y, range) + '</select>';
        break;
      }
      case 'annee':
        inputs = '<select class="cmp-in" data-which="' + which + '" data-field="year" aria-label="Année ' + which.toUpperCase() + '">' + yearOptions(D.ymd(p.start).y, range) + '</select>';
        break;
      default:
        inputs = '<label class="mini-field"><span>Du</span><input type="date" class="cmp-in" data-which="' + which + '" data-field="start" value="' + D.toKey(p.start) + '"></label>' +
          '<label class="mini-field"><span>au</span><input type="date" class="cmp-in" data-which="' + which + '" data-field="end" value="' + D.toKey(p.end) + '"></label>';
    }
    return '<div class="period-box p-' + which + '" id="' + id + '">' +
      '<div class="period-top"><span class="tag tag-' + which + '">' + which.toUpperCase() + '</span><span class="period-label">' + esc(p.label) + '</span></div>' +
      '<div class="period-inputs">' +
        '<button class="icon-btn" type="button" data-pstep="-1" data-which="' + which + '" aria-label="Période ' + which.toUpperCase() + ' précédente">' + icon('chevL') + '</button>' +
        '<div class="period-fields">' + inputs + '</div>' +
        '<button class="icon-btn" type="button" data-pstep="1" data-which="' + which + '" aria-label="Période ' + which.toUpperCase() + ' suivante">' + icon('chevR') + '</button>' +
      '</div></div>';
  }

  /* ---------- Rendu des valeurs ---------- */
  function deltaCells(a, b, isDec) {
    if (a == null || b == null) return '<td class="num" data-label="Écart">—</td><td class="num" data-label="Évolution">—</td>';
    const d = stats.delta(a, b);
    const diff = isDec ? Math.round(d.diff * 100) / 100 : d.diff;
    const cls = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    const arrow = diff > 0 ? icon('arrowUp', 'delta-ico') : diff < 0 ? icon('arrowDown', 'delta-ico') : icon('equal', 'delta-ico');
    const pct = d.pct === null
      ? (a === 0 && b === 0 ? '0,00 %' : '<span class="nc" title="Évolution non calculable : la valeur de A est 0">n.c.</span>')
      : esc(fmt.pctSigned(d.pct));
    return '<td class="num delta ' + cls + '" data-label="Écart">' + arrow + esc(fmt.signed(diff)) + '</td><td class="num delta ' + cls + '" data-label="Évolution">' + pct + '</td>';
  }

  function metricRow(label, va, vb, show, opts) {
    const o = opts || {};
    const cell = (v, sub, lbl) => '<td class="num" data-label="' + lbl + '">' + (v == null ? '—' : esc(show(v))) + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</td>';
    return '<tr><th scope="row">' + esc(label) + (o.hint ? '<small>' + esc(o.hint) + '</small>' : '') + '</th>' +
      cell(va, o.subA, 'A') + cell(vb, o.subB, 'B') +
      (o.noDelta ? '<td class="num" data-label="Écart">—</td><td class="num" data-label="Évolution">—</td>' : deltaCells(va, vb, o.dec)) + '</tr>';
  }

  function heroDelta(sa, sb) {
    if (!sa.elapsed && !sa.total) return '<p class="muted">La période A n’a pas encore commencé.</p>';
    if (!sb.elapsed && !sb.total) return '<p class="muted">La période B n’a pas encore commencé.</p>';
    const d = stats.delta(sa.total, sb.total);
    const cls = d.diff > 0 ? 'up' : d.diff < 0 ? 'down' : 'same';
    return '<div class="hero-delta ' + cls + '">' +
      icon(d.diff > 0 ? 'arrowUp' : d.diff < 0 ? 'arrowDown' : 'equal', 'hero-delta-ico') +
      '<span class="hd-diff">' + esc(fmt.signed(d.diff)) + ' BR</span>' +
      '<span class="hd-pct">' + (d.pct !== null ? esc(fmt.pctSigned(d.pct)) : (sa.total === 0 && sb.total === 0 ? '0,00 %' : 'Évolution non calculable (A = 0)')) + '</span>' +
      '<span class="muted small">de B par rapport à A</span></div>';
  }

  function evolutionSeries(mode, pa, pb, sa, sb) {
    const vals = (s) => s.daily.map((v, k) => (s.start + k <= s.effEnd ? v : null));
    if (mode === 'jour') return null;
    if (mode === 'annee') {
      const monthly = (s) => {
        const out = new Array(12).fill(null);
        s.daily.forEach((v, k) => { const i = s.start + k; if (i > s.effEnd) return; const m = D.ymd(i).m; out[m] = (out[m] || 0) + v; });
        return out;
      };
      return { labels: Array.from({ length: 12 }, (_, m) => fmt.monthShort(D.fromYMD(2001, m, 1))), a: monthly(sa), b: monthly(sb), unit: 'mois', title: (i) => fmt.monthName(i) };
    }
    let a = vals(sa), b = vals(sb);
    let n = Math.max(a.length, b.length);
    if (mode === 'perso' && n > 92) {
      const block = (arr) => {
        const out = [];
        for (let i = 0; i < arr.length; i += 7) {
          const part = arr.slice(i, i + 7).filter((v) => v != null);
          out.push(part.length ? part.reduce((x, y) => x + y, 0) : null);
        }
        return out;
      };
      a = block(a); b = block(b); n = Math.max(a.length, b.length);
      const pad = (arr) => arr.concat(new Array(n - arr.length).fill(null));
      return { labels: Array.from({ length: n }, (_, i) => 'S' + (i + 1)), a: pad(a), b: pad(b), unit: 'bloc de 7 jours', title: (i) => '7 jours n°' + (i + 1) };
    }
    const pad = (arr) => arr.concat(new Array(n - arr.length).fill(null));
    let labels, title;
    if (mode === 'semaine') { labels = [0, 1, 2, 3, 4, 5, 6].map(fmt.weekdayShort); title = (i) => fmt.weekday(i); }
    else if (mode === 'mois') { labels = Array.from({ length: n }, (_, i) => String(i + 1)); title = (i) => 'Jour ' + (i + 1) + ' du mois'; }
    else { labels = Array.from({ length: n }, (_, i) => 'J' + (i + 1)); title = (i) => 'Jour ' + (i + 1) + ' de la période'; }
    return {
      labels, a: pad(a), b: pad(b), unit: 'jour',
      title: (i) => title(i) + ' · A : ' + (pa.start + i <= pa.end ? fmt.dayMonth(pa.start + i) : '—') + ' · B : ' + (pb.start + i <= pb.end ? fmt.dayMonth(pb.start + i) : '—'),
    };
  }

  sub.comparateur = {
    title: 'Comparateur',
    render(view) {
      const s = BR.compareState.get();
      const today = D.today();
      const ix = stats.index(store.all());
      const range = stats.yearsRange(ix, today);
      const pa = period(s.mode, s.a, s.aEnd), pb = period(s.mode, s.b, s.bEnd);
      const sa = stats.periodSummary(ix, pa.start, pa.end, today);
      const sb = stats.periodSummary(ix, pb.start, pb.end, today);
      const same = pa.start === pb.start && pa.end === pb.end;
      const both = !!(sa.elapsed || sa.total) && !!(sb.elapsed || sb.total);

      const lenHint = (p, x) => (x.elapsed < x.length ? fmt.days(x.elapsed) + ' écoulé' + (x.elapsed > 1 ? 's' : '') + ' sur ' + fmt.num(x.length) : fmt.days(x.length));

      view.innerHTML =
        '<section class="card cmp-controls">' +
          '<div class="card-head wrap"><div><h2>Comparateur de périodes</h2><p class="muted small">A sert de référence ; l’écart et l’évolution sont calculés de B par rapport à A.</p></div></div>' +
          '<div class="segmented" role="radiogroup" aria-label="Type de période">' +
            MODES.map((m) => '<button type="button" role="radio" aria-checked="' + (m.id === s.mode) + '" data-mode="' + m.id + '">' + m.label + '</button>').join('') +
          '</div>' +
          '<div class="cmp-periods">' + periodInputs('a', s.mode, pa, s, range) +
            '<button class="icon-btn swap-btn" type="button" data-action="swap" aria-label="Inverser A et B" title="Inverser A et B">' + icon('swap') + '</button>' +
            periodInputs('b', s.mode, pb, s, range) +
          '</div>' +
          (same ? '<p class="notice">Les deux périodes sont identiques : choisis une autre période pour A ou B.</p>' : '') +
        '</section>' +

        '<section class="cmp-hero">' +
          heroCard('a', pa, sa) + '<div class="card hero-mid">' + heroDelta(sa, sb) + '</div>' + heroCard('b', pb, sb) +
        '</section>' +

        '<section class="card"><div class="card-head"><h2>Indicateurs</h2></div>' +
          '<div class="table-wrap"><table class="cmp-table"><thead><tr><th scope="col">Indicateur</th>' +
            '<th scope="col" class="num"><span class="tag tag-a">A</span></th><th scope="col" class="num"><span class="tag tag-b">B</span></th>' +
            '<th scope="col" class="num">Écart (B − A)</th><th scope="col" class="num">Évolution</th></tr></thead><tbody>' +
            metricRow('Nombre total de BR', both ? sa.total : null, both ? sb.total : null, fmt.num) +
            metricRow('Moyenne quotidienne', sa.avg, sb.avg, (v) => fmt.dec(v) + ' BR', { dec: true, subA: lenHint(pa, sa), subB: lenHint(pb, sb), hint: 'BR par jour écoulé' }) +
            metricRow('Jours avec au moins un événement', sa.elapsed ? sa.activeDays : null, sb.elapsed ? sb.activeDays : null, fmt.num,
              { subA: sa.elapsed ? 'sur ' + fmt.days(sa.elapsed) : '', subB: sb.elapsed ? 'sur ' + fmt.days(sb.elapsed) : '' }) +
            metricRow('Journée la plus active', sa.best ? sa.best.br : (sa.elapsed ? 0 : null), sb.best ? sb.best.br : (sb.elapsed ? 0 : null), (v) => fmt.br(v),
              { subA: sa.best ? fmt.day(sa.best.idx) : '', subB: sb.best ? fmt.day(sb.best.idx) : '' }) +
            metricRow('Nombre de saisies', sa.elapsed ? sa.entries : null, sb.elapsed ? sb.entries : null, fmt.num) +
            metricRow('Heure la plus active', sa.peakHour, sb.peakHour, fmt.hourRange, { noDelta: true }) +
          '</tbody></table></div></section>' +

        '<section class="card"><div class="card-head wrap"><h2>Répartition horaire</h2>' + legendAB(pa, pb) + '</div>' +
          '<div class="chart" id="cmp-hours"></div>' +
          ((sa.untimed || sb.untimed) ? '<p class="muted small">Saisies sans heure non représentées : A ' + fmt.br(sa.untimed) + ', B ' + fmt.br(sb.untimed) + '.</p>' : '') +
          '<details class="table-toggle"><summary>' + icon('table') + 'Voir en tableau</summary><div id="cmp-hours-table"></div></details>' +
        '</section>' +

        '<section class="card" id="evo-card"><div class="card-head wrap"><h2>Évolution au fil de la période</h2>' + legendAB(pa, pb) + '</div>' +
          '<div class="chart" id="cmp-evo"></div>' +
          '<details class="table-toggle"><summary>' + icon('table') + 'Voir en tableau</summary><div id="cmp-evo-table"></div></details>' +
        '</section>';

      // Graphiques
      const hourLabels = Array.from({ length: 24 }, (_, h) => h + ' h');
      const hs = [{ name: 'A', cls: 's-a', values: sa.hours }, { name: 'B', cls: 's-b', values: sb.hours }];
      charts.bars($('#cmp-hours', view), {
        labels: hourLabels, series: hs, height: 210, labelEvery: 3, maxBar: 10,
        tooltipTitle: (h) => fmt.hourRange(h), ariaLabel: 'Répartition horaire des BR des périodes A et B',
      });
      $('#cmp-hours-table', view).innerHTML = charts.table({ head: 'Heure', labels: hourLabels, rowLabel: (h) => fmt.hourRange(h), series: hs });

      const evo = evolutionSeries(s.mode, pa, pb, sa, sb);
      if (!evo) { $('#evo-card', view).remove(); }
      else {
        const es = [{ name: 'A', cls: 's-a', values: evo.a }, { name: 'B', cls: 's-b', values: evo.b }];
        const cfg = { labels: evo.labels, series: es, height: 210, tooltipTitle: evo.title, ariaLabel: 'Évolution des BR par ' + evo.unit + ' pour A et B', maxBar: 16 };
        if (evo.labels.length <= 14) charts.bars($('#cmp-evo', view), cfg);
        else charts.lines($('#cmp-evo', view), cfg);
        $('#cmp-evo-table', view).innerHTML = charts.table({ head: evo.unit.charAt(0).toUpperCase() + evo.unit.slice(1), labels: evo.labels, rowLabel: (i) => evo.title(i).split(' · ')[0], series: es });
      }

      $$('.cmp-in', view).forEach((inp) => inp.addEventListener('change', () => onInput(inp)));
    },
    onClick(ev) {
      const s = BR.compareState.get();
      const m = ev.target.closest('[data-mode]');
      if (m) { if (m.dataset.mode !== s.mode) { BR.compareState.set({ mode: m.dataset.mode }); BR.app.rerender(true); } return true; }
      const step = ev.target.closest('[data-pstep]');
      if (step) {
        const w = step.dataset.which, n = Number(step.dataset.pstep);
        const patch = Object.assign({}, s);
        if (s.mode === 'perso') {
          const p = period('perso', s[w], s[w + 'End']);
          const len = p.end - p.start + 1;
          patch[w] = p.start + n * len; patch[w + 'End'] = p.end + n * len;
        } else patch[w] = shift(s.mode, s[w], n);
        BR.compareState.set(patch); BR.app.rerender(); return true;
      }
      if (ev.target.closest('[data-action="swap"]')) {
        BR.compareState.set(Object.assign({}, s, { a: s.b, b: s.a, aEnd: s.bEnd, bEnd: s.aEnd }));
        BR.app.rerender(); return true;
      }
      return false;
    },
  };

  function onInput(inp) {
    const s = BR.compareState.get();
    const w = inp.dataset.which, f = inp.dataset.field;
    const patch = Object.assign({}, s);
    const box = inp.closest('.period-box');
    if (f === 'day' || f === 'start' || f === 'end') {
      if (!D.isValidKey(inp.value)) return;
      const v = D.fromKey(inp.value);
      if (f === 'day' || f === 'start') patch[w] = v; else patch[w + 'End'] = v;
    } else if (f === 'month' || f === 'year') {
      const mSel = box.querySelector('[data-field="month"]');
      const ySel = box.querySelector('[data-field="year"]');
      patch[w] = D.fromYMD(Number(ySel.value), mSel ? Number(mSel.value) : 0, 1);
    }
    BR.compareState.set(patch);
    BR.app.rerender();
  }

  function heroCard(which, p, x) {
    const empty = !x.elapsed && !x.total;
    return '<div class="card hero-period hp-' + which + '"><div class="period-top"><span class="tag tag-' + which + '">' + which.toUpperCase() + '</span><span class="period-label">' + esc(p.label) + '</span></div>' +
      '<div class="hp-value"><span class="big-num"' + (empty ? '>—' : ' data-count="' + x.total + '">0') + '</span><span class="big-unit">BR</span></div>' +
      '<p class="muted small">' + (empty ? 'Période à venir' : fmt.plural(x.activeDays, 'jour actif', 'jours actifs') + ' · ' + fmt.plural(x.entries, 'saisie', 'saisies')) + '</p></div>';
  }

  function legendAB(pa, pb) {
    return '<div class="legend"><span class="legend-item"><i class="sw s-a"></i>A · ' + esc(pa.short) + '</span><span class="legend-item"><i class="sw s-b"></i>B · ' + esc(pb.short) + '</span></div>';
  }

  BR.compare = { period, shift, defaults };
})(window);
