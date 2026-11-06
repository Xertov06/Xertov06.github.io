/* Section « Mes records » : records personnels recalculés à chaque modification des données. */
(function (root) {
  'use strict';
  const BR = root.BR;
  const { D, fmt, esc, $$, icon, store, stats } = BR;
  const sub = BR.statsViews = BR.statsViews || {};

  const yearLabel = (it) => 'Année ' + D.ymd(it.at).y;
  const atTime = (it) => (it.time ? ' à ' + it.time.replace(':', ' h ') : '');
  const dayLink = (at) => '#/stats/activite?jour=' + D.toKey(at);

  const DEFS = [
    { key: 'day', title: 'Journée record', ico: 'calendar', value: (it) => fmt.br(it.value), date: (it) => fmt.dayLong(it.at), short: (it) => fmt.dayMonthYear(it.at), unit: 'BR', link: (it) => dayLink(it.at) },
    { key: 'week', title: 'Semaine record', ico: 'week', value: (it) => fmt.br(it.value), date: (it) => fmt.week(it.at), short: (it) => 'Sem. du ' + fmt.dayMonthYear(it.at), unit: 'BR' },
    { key: 'month', title: 'Mois record', ico: 'month', value: (it) => fmt.br(it.value), date: (it) => fmt.month(it.at), short: (it) => fmt.month(it.at), unit: 'BR' },
    { key: 'year', title: 'Année record', ico: 'year', value: (it) => fmt.br(it.value), date: yearLabel, short: yearLabel, unit: 'BR' },
    { key: 'gap', title: 'Plus longue période sans événement', ico: 'pause', value: (it) => fmt.days(it.value),
      date: (it) => fmt.range(it.at, it.end) + (it.ongoing ? ' · en cours' : ''), short: (it) => fmt.dayMonth(it.at) + ' → ' + fmt.dayMonthYear(it.end) + (it.ongoing ? ' (en cours)' : ''), unit: 'jours',
      empty: 'Il faut au moins une journée sans événement après ta première saisie.' },
    { key: 'entry', title: 'Plus grande saisie', ico: 'bolt', value: (it) => fmt.br(it.value), date: (it) => fmt.dayLong(it.at) + atTime(it), short: (it) => fmt.dayMonthYear(it.at) + atTime(it), unit: 'BR', link: (it) => dayLink(it.at) },
    { key: 'entriesDay', title: 'Journée avec le plus d’enregistrements', ico: 'stack', value: (it) => fmt.plural(it.value, 'saisie', 'saisies'), date: (it) => fmt.dayLong(it.at), short: (it) => fmt.dayMonthYear(it.at), unit: 'saisies', link: (it) => dayLink(it.at) },
  ];

  function diffText(cur, prev, unit) {
    const d = stats.delta(prev.value, cur.value);
    return '+' + fmt.num(d.diff) + ' ' + unit + (d.pct !== null ? ' (' + fmt.pctSigned(d.pct) + ')' : '');
  }

  function recordCard(def, rec, today, i) {
    const cur = rec.current, prev = rec.previous;
    let body;
    if (!cur) {
      body = '<p class="rec-value muted">—</p><p class="muted small">' + esc(def.empty || 'Aucune donnée pour l’instant.') + '</p>';
    } else {
      const fresh = !cur.ongoing && today - (cur.end != null ? cur.end : cur.at) <= 6 && def.key !== 'year' && def.key !== 'month';
      body = (fresh ? '<span class="badge-new">Nouveau</span>' : '') +
        '<p class="rec-value">' + esc(def.value(cur)) + '</p>' +
        '<p class="rec-date">' + (def.link ? '<a class="link" href="' + def.link(cur) + '">' + esc(def.date(cur)) + '</a>' : esc(def.date(cur))) + '</p>' +
        '<p class="rec-prev">' + (prev
          ? icon('history', 'mini-ico') + '<span>Record précédent : <b>' + esc(def.value(prev)) + '</b> · ' + esc(def.short(prev)) + '<br><span class="up">Battu de ' + esc(diffText(cur, prev, def.unit)) + '</span></span>'
          : icon('flame', 'mini-ico') + '<span>Premier record établi, aucun record précédent.</span>') + '</p>' +
        (cur.ties ? '<p class="muted small">Égalé ' + fmt.plural(cur.ties, 'fois', 'fois') + ' depuis.</p>' : '') +
        (rec.prog.length > 1 ? '<details class="rec-history"><summary>Historique du record (' + rec.prog.length + ')</summary><ol>' +
          rec.prog.slice().reverse().map((it, k, arr) => {
            const before = arr[k + 1];
            return '<li><span class="rh-val">' + esc(def.value(it)) + '</span><span class="rh-date">' + esc(def.short(it)) + '</span>' +
              (before ? '<span class="rh-diff up">' + esc(diffText(it, before, def.unit)) + '</span>' : '<span class="rh-diff muted">premier</span>') + '</li>';
          }).join('') + '</ol></details>' : '');
    }
    return '<article class="card rec-card" style="--i:' + i + '"><div class="rec-head">' + icon(def.ico, 'rec-ico') + '<h3>' + esc(def.title) + '</h3></div>' + body + '</article>';
  }

  function distCard(title, ico, dist, labels, labelFull, i, emptyText) {
    if (!dist) {
      return '<article class="card rec-card" style="--i:' + i + '"><div class="rec-head">' + icon(ico, 'rec-ico') + '<h3>' + esc(title) + '</h3></div><p class="rec-value muted">—</p><p class="muted small">' + esc(emptyText) + '</p></article>';
    }
    const max = Math.max.apply(null, dist.totals);
    const L = dist.leader, R = dist.runnerUp;
    return '<article class="card rec-card" style="--i:' + i + '"><div class="rec-head">' + icon(ico, 'rec-ico') + '<h3>' + esc(title) + '</h3></div>' +
      '<p class="rec-value">' + esc(labelFull(L.key)) + '</p>' +
      '<p class="rec-date">' + esc(fmt.br(L.value)) + ' · ' + esc(fmt.pct(L.share)) + ' du total · ' + fmt.plural(L.entries, 'saisie', 'saisies') +
        (L.lastSeen !== null ? '<br><span class="muted small">Dernière occurrence : ' + esc(fmt.dayMonthYear(L.lastSeen)) + '</span>' : '') + '</p>' +
      '<div class="mini-dist" style="--n:' + dist.totals.length + '" role="img" aria-label="Répartition : ' + esc(labelFull(L.key)) + ' en tête">' +
        dist.totals.map((v, k) => '<span class="md-bar' + (k === L.key ? ' lead' : '') + '" style="--h:' + (max ? Math.max(v ? 6 : 0, Math.round((v / max) * 100)) : 0) + '%" title="' + esc(labelFull(k) + ' : ' + fmt.br(v)) + '"></span>').join('') +
      '</div><div class="md-axis' + (labels.length === dist.totals.length ? ' full' : '') + '" style="--n:' + labels.length + '">' + labels.map((l) => '<span>' + esc(l) + '</span>').join('') + '</div>' +
      '<p class="rec-prev">' + (R
        ? icon('history', 'mini-ico') + '<span>' + (dist.tie ? 'À égalité avec ' : 'Devant ') + '<b>' + esc(labelFull(R.key)) + '</b> (' + esc(fmt.br(R.value)) + ')' +
          (dist.tie ? '' : '<br><span class="up">Écart : +' + esc(fmt.num(L.value - R.value)) + ' BR</span>') + '</span>'
        : icon('flame', 'mini-ico') + '<span>Seule valeur enregistrée pour l’instant.</span>') + '</p></article>';
  }

  sub.records = {
    title: 'Mes records',
    render(view, params, opts) {
      const all = store.all();
      if (!all.length) {
        view.innerHTML = BR.ui.emptyState('Pas encore de records', 'Tes records personnels seront calculés automatiquement dès ta première saisie.');
        return;
      }
      const today = D.today();
      const ix = stats.index(all);
      const r = stats.records(ix, today);

      // Record le plus récemment établi (hors période sans événement encore en cours)
      let latest = null;
      DEFS.forEach((d) => {
        const c = r[d.key].current;
        if (!c || c.ongoing || r[d.key].prog.length < 2) return;
        const when = c.end != null ? c.end : c.at;
        if (!latest || when > latest.when) latest = { when, def: d, it: c };
      });

      view.innerHTML =
        '<section class="card rec-summary">' + icon('trophy', 'rec-summary-ico') +
          '<div><h2>Mes records</h2><p class="muted small">Recalculés automatiquement à partir de ' + fmt.plural(all.length, 'saisie', 'saisies') +
          ' (' + fmt.br(ix.total) + ' depuis le ' + esc(fmt.dayMonthYear(ix.first)) + '). Ajouter, modifier ou supprimer une saisie met tout à jour.</p>' +
          (latest ? '<p class="small">Dernier record battu : <b>' + esc(latest.def.title) + '</b> — ' + esc(latest.def.value(latest.it)) + ', ' + esc(latest.def.short(latest.it)) + '</p>' : '') +
          '</div></section>' +
        '<section class="rec-grid' + (opts.animate ? ' rec-anim' : '') + '">' +
          DEFS.map((d, i) => recordCard(d, r[d.key], today, i)).join('') +
          distCard('Heure la plus fréquente', 'clock', r.hour, ['0 h', '6 h', '12 h', '18 h', '23 h'], fmt.hourRange, DEFS.length, 'Aucune saisie avec une heure.') +
          distCard('Jour de la semaine le plus fréquent', 'sun', r.weekday, [0, 1, 2, 3, 4, 5, 6].map(fmt.weekdayShort), fmt.weekday, DEFS.length + 1, 'Aucune donnée.') +
        '</section>';
    },
  };
})(window);
