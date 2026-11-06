/* Pages : Accueil, Historique, Réglages. */
(function (root) {
  'use strict';
  const BR = root.BR;
  const { D, fmt, esc, $, $$, icon, store, stats, charts, ui } = BR;
  const views = BR.views = BR.views || {};

  function entryRow(e, opts) {
    const o = opts || {};
    return '<li class="entry" data-id="' + esc(e.id) + '">' +
      '<span class="entry-time">' + esc(e.time ? e.time.replace(':', ' h ') : '—') + '</span>' +
      '<span class="entry-count">' + fmt.num(e.count) + '<small>BR</small></span>' +
      '<span class="entry-main">' + (o.showDate ? '<span class="entry-date">' + esc(fmt.day(D.fromKey(e.date))) + '</span>' : '') +
      (e.note ? '<span class="entry-note">' + esc(e.note) + '</span>' : (o.showDate ? '' : '<span class="entry-note muted">Sans note</span>')) + '</span>' +
      '<span class="entry-actions">' +
      '<button class="icon-btn" type="button" data-action="edit" data-id="' + esc(e.id) + '" aria-label="Modifier">' + icon('edit') + '</button>' +
      '<button class="icon-btn" type="button" data-action="delete" data-id="' + esc(e.id) + '" aria-label="Supprimer">' + icon('trash') + '</button>' +
      '</span></li>';
  }
  BR.entryRow = entryRow;

  /* ======================= ACCUEIL ======================= */
  let quickCount = 1;

  views.home = {
    title: 'Accueil',
    render(view) {
      const ix = stats.index(store.all());
      const today = D.today();
      const ws = D.weekStart(today), ms = D.monthStart(today);
      const vToday = stats.dayBR(ix, today);
      const vYest = stats.dayBR(ix, today - 1);
      const vWeek = stats.sumRange(ix, ws, ws + 6);
      const vPrevWeek = stats.sumRange(ix, ws - 7, ws - 1);
      const vMonth = stats.sumRange(ix, ms, D.monthEnd(today));
      const pm = D.addMonths(today, -1);
      const vPrevMonth = stats.sumRange(ix, pm, D.monthEnd(pm));
      const rec = stats.records(ix, today);
      const last = store.all().slice(-5).reverse();
      const dToday = ix.byDay.get(today);

      view.innerHTML =
        '<section class="hero card">' +
          '<div class="hero-left">' +
            '<p class="eyebrow">' + esc(fmt.dayLong(today)) + '</p>' +
            '<div class="hero-value"><span class="big-num" data-count="' + vToday + '">0</span><span class="big-unit">BR aujourd’hui</span></div>' +
            '<p class="hero-sub">' + (dToday ? fmt.plural(dToday.n, 'saisie', 'saisies') + ' aujourd’hui' : 'Aucune saisie pour l’instant aujourd’hui') + '</p>' +
          '</div>' +
          '<div class="quick">' +
            '<div class="stepper" role="group" aria-label="Nombre de BR à enregistrer">' +
              '<button type="button" class="step-btn" data-quick="-1" aria-label="Moins">' + icon('minus') + '</button>' +
              '<output class="step-val" id="quick-val">' + quickCount + '</output>' +
              '<button type="button" class="step-btn" data-quick="1" aria-label="Plus">' + icon('plus') + '</button>' +
            '</div>' +
            '<button type="button" class="btn btn-primary btn-lg" data-action="quick-add">' + icon('plus') + 'Enregistrer maintenant</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" data-action="add">Saisie détaillée (date, heure, note)</button>' +
          '</div>' +
        '</section>' +

        '<section class="kpis">' +
          kpi('Aujourd’hui', vToday, 'Hier : ' + fmt.br(vYest)) +
          kpi('Cette semaine', vWeek, 'Semaine dernière : ' + fmt.br(vPrevWeek)) +
          kpi('Ce mois', vMonth, fmt.monthName(D.ymd(pm).m) + ' : ' + fmt.br(vPrevMonth)) +
          kpi('Total', ix.total, ix.first !== null ? fmt.plural(store.all().length, 'saisie', 'saisies') + ' depuis le ' + fmt.dayMonthYear(ix.first) : 'Aucune saisie') +
        '</section>' +

        '<section class="grid-2">' +
          '<div class="card"><div class="card-head"><h2>14 derniers jours</h2><span class="muted small">' + fmt.br(stats.sumRange(ix, today - 13, today)) + '</span></div><div class="chart" id="home-chart"></div></div>' +
          '<div class="card"><div class="card-head"><h2>Dernières saisies</h2><a class="link" href="#/historique">Tout voir</a></div>' +
            (last.length ? '<ul class="entries">' + last.map((e) => entryRow(e, { showDate: true })).join('') + '</ul>'
              : '<p class="muted">Aucune saisie enregistrée. Utilise le bouton « Enregistrer maintenant » pour commencer.</p>') +
          '</div>' +
        '</section>' +

        '<section class="teasers">' +
          '<a class="card teaser" href="#/stats/activite">' + icon('calendar', 'teaser-ico') + '<div><h3>Activité annuelle</h3><p>' +
            (ix.first !== null ? fmt.plural(stats.yearStats(ix, D.ymd(today).y, today).activeDays, 'jour actif', 'jours actifs') + ' en ' + D.ymd(today).y : 'Ta heatmap se remplira au fil des saisies') + '</p></div>' + icon('chevR', 'teaser-go') + '</a>' +
          '<a class="card teaser" href="#/stats/comparateur">' + icon('swap', 'teaser-ico') + '<div><h3>Comparateur</h3><p>Cette semaine : ' + fmt.br(vWeek) + ' · ' + compareText(vPrevWeek, vWeek) + '</p></div>' + icon('chevR', 'teaser-go') + '</a>' +
          '<a class="card teaser" href="#/stats/records">' + icon('trophy', 'teaser-ico') + '<div><h3>Mes records</h3><p>' +
            (rec.day.current ? 'Meilleure journée : ' + fmt.br(rec.day.current.value) + ' (' + fmt.dayMonthYear(rec.day.current.at) + ')' : 'Aucun record pour l’instant') + '</p></div>' + icon('chevR', 'teaser-go') + '</a>' +
        '</section>';

      const labels = [], values = [];
      for (let i = today - 13; i <= today; i++) { labels.push(fmt.weekdayShort(D.weekday(i)).charAt(0) + ' ' + D.ymd(i).d); values.push(stats.dayBR(ix, i)); }
      charts.bars($('#home-chart', view), {
        labels, series: [{ name: 'BR', cls: 's-1', values }], height: 180, labelEvery: 2, maxBar: 18,
        tooltipTitle: (i) => fmt.dayLong(today - 13 + i), ariaLabel: 'Nombre de BR par jour sur les 14 derniers jours',
      });
    },
    onClick(ev, view) {
      const q = ev.target.closest('[data-quick]');
      if (q) {
        quickCount = Math.max(1, Math.min(store.MAX_COUNT, quickCount + Number(q.dataset.quick)));
        $('#quick-val', view).textContent = quickCount;
        return true;
      }
      if (ev.target.closest('[data-action="quick-add"]')) {
        const e = store.add({ date: D.toKey(D.today()), time: D.nowTime(), count: quickCount, note: '' });
        if (e) {
          ui.toast('Enregistré : <b>' + fmt.br(e.count) + '</b> à ' + esc(e.time.replace(':', ' h ')), {
            icon: 'plus', action: { label: 'Annuler', run: () => store.remove(e.id) },
          });
          quickCount = 1;
        }
        return true;
      }
      return false;
    },
  };

  function kpi(label, value, sub) {
    return '<div class="card kpi"><span class="kpi-label">' + esc(label) + '</span><span class="kpi-value" data-count="' + value + '">0</span><span class="kpi-sub">' + esc(sub) + '</span></div>';
  }
  function compareText(a, b) {
    const d = stats.delta(a, b);
    if (d.diff === 0) return 'identique à la précédente';
    return fmt.signed(d.diff) + ' BR' + (d.pct !== null ? ' (' + fmt.pctSigned(d.pct) + ')' : '') + ' vs précédente';
  }

  /* ======================= HISTORIQUE ======================= */
  const hist = { month: 'all', query: '', limit: 30 };

  views.history = {
    title: 'Historique',
    render(view) {
      const all = store.all();
      if (!all.length) { view.innerHTML = '<h1 class="page-title">Historique</h1>' + ui.emptyState('Aucune saisie', 'Les saisies que tu enregistres apparaîtront ici, regroupées par jour.'); return; }
      const ix = stats.index(all);
      const months = [];
      for (let m = D.monthStart(ix.last); m >= D.monthStart(ix.first); m = D.addMonths(m, -1)) months.push(m);
      if (hist.month !== 'all' && !months.includes(Number(hist.month))) hist.month = 'all';
      const q = hist.query.trim().toLowerCase();
      let days = ix.days.slice().reverse();
      if (hist.month !== 'all') { const ms = Number(hist.month), me = D.monthEnd(ms); days = days.filter((d) => d >= ms && d <= me); }
      const groups = [];
      days.forEach((d) => {
        const entries = ix.byDay.get(d).entries.filter((e) => !q || e.note.toLowerCase().includes(q)).slice().reverse();
        if (entries.length) groups.push({ d, entries, br: entries.reduce((s, e) => s + e.count, 0) });
      });
      const shown = groups.slice(0, hist.limit);
      const totalShown = groups.reduce((s, g) => s + g.br, 0);

      view.innerHTML = '<h1 class="page-title">Historique</h1>' +
        '<div class="toolbar card">' +
          '<label class="field"><span>Mois</span><select id="h-month"><option value="all">Tous les mois</option>' +
            months.map((m) => '<option value="' + m + '"' + (String(m) === String(hist.month) ? ' selected' : '') + '>' + esc(fmt.month(m)) + '</option>').join('') + '</select></label>' +
          '<label class="field grow"><span>Rechercher dans les notes</span><input id="h-query" type="search" value="' + esc(hist.query) + '" placeholder="Mot-clé…"></label>' +
          '<div class="toolbar-sum"><b>' + fmt.br(totalShown) + '</b><span class="muted small">' + fmt.plural(groups.length, 'jour', 'jours') + '</span></div>' +
        '</div>' +
        (shown.length ? shown.map((g) =>
          '<section class="card day-group"><div class="day-head"><h2>' + esc(fmt.dayLong(g.d)) + '</h2><span class="pill">' + fmt.br(g.br) + '</span></div>' +
          '<ul class="entries">' + g.entries.map((e) => entryRow(e)).join('') + '</ul></section>').join('')
          : '<p class="muted center pad">Aucune saisie ne correspond à ces filtres.</p>') +
        (groups.length > shown.length ? '<div class="center"><button class="btn btn-ghost" type="button" data-action="more">Afficher plus</button></div>' : '');

      const mSel = $('#h-month', view), qIn = $('#h-query', view);
      if (mSel) mSel.addEventListener('change', () => { hist.month = mSel.value; hist.limit = 30; BR.app.rerender(); });
      if (qIn) qIn.addEventListener('input', debounce(() => { hist.query = qIn.value; hist.limit = 30; BR.app.rerender(); const n = $('#h-query'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250));
    },
    onClick(ev) {
      if (ev.target.closest('[data-action="more"]')) { hist.limit += 30; BR.app.rerender(); return true; }
      return false;
    },
  };

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* ======================= RÉGLAGES ======================= */
  views.settings = {
    title: 'Réglages',
    render(view) {
      const theme = localStorage.getItem('br.theme') || 'auto';
      const all = store.all();
      const bytes = (localStorage.getItem('br.events.v1') || '').length * 2;
      const swOk = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
      view.innerHTML = '<h1 class="page-title">Réglages</h1>' +
        '<section class="card settings-block"><h2>Apparence</h2>' +
          '<div class="segmented" role="radiogroup" aria-label="Thème">' +
            ['auto', 'light', 'dark'].map((t) => '<button type="button" role="radio" aria-checked="' + (theme === t) + '" data-theme-set="' + t + '">' +
              { auto: 'Automatique', light: 'Clair', dark: 'Sombre' }[t] + '</button>').join('') +
          '</div></section>' +

        '<section class="card settings-block"><h2>Sauvegarde des données</h2>' +
          '<p class="muted">Tes données sont enregistrées uniquement sur cet appareil, dans ce navigateur. Exporte-les régulièrement pour ne rien perdre.</p>' +
          '<div class="btn-row">' +
            '<button class="btn" type="button" data-action="export-json"' + (all.length ? '' : ' disabled') + '>' + icon('download') + 'Exporter (JSON)</button>' +
            '<button class="btn" type="button" data-action="export-csv"' + (all.length ? '' : ' disabled') + '>' + icon('table') + 'Exporter (CSV)</button>' +
            '<button class="btn" type="button" data-action="import">' + icon('upload') + 'Importer une sauvegarde</button>' +
            '<input type="file" id="import-file" accept="application/json,.json" hidden>' +
          '</div></section>' +

        '<section class="card settings-block"><h2>Hors connexion</h2>' +
          '<p>' + (swOk ? '<span class="status-dot ok"></span>L’application fonctionne hors connexion.' :
            location.protocol === 'file:' ? '<span class="status-dot"></span>Ouverte comme fichier local : les données fonctionnent hors connexion. Pour l’installer comme application, sers le dossier via un petit serveur local (voir LISEZMOI.md).' :
            '<span class="status-dot"></span>Mise en cache hors connexion en cours d’activation (recharge la page).') + '</p>' +
          '<p class="muted small">' + fmt.plural(all.length, 'saisie', 'saisies') + ' · ' + fmt.num(Math.round(bytes / 1024)) + ' Ko utilisés</p>' +
          (navigator.storage && navigator.storage.persist ? '<button class="btn btn-ghost btn-sm" type="button" data-action="persist">Protéger le stockage contre l’effacement automatique</button>' : '') +
        '</section>' +

        '<section class="card settings-block danger-zone"><h2>Zone sensible</h2>' +
          '<p class="muted">Supprime définitivement toutes les saisies de cet appareil.</p>' +
          '<button class="btn btn-danger" type="button" data-action="wipe"' + (all.length ? '' : ' disabled') + '>' + icon('trash') + 'Tout supprimer</button>' +
        '</section>';

      const file = $('#import-file', view);
      file.addEventListener('change', async () => {
        const f = file.files[0];
        file.value = '';
        if (!f) return;
        const text = await f.text();
        let mode = 'merge';
        if (store.all().length) {
          const replace = await ui.confirm({
            title: 'Importer « ' + esc(f.name) + ' »',
            text: 'Veux-tu <b>remplacer</b> toutes les données actuelles par celles du fichier ? Sinon, les saisies du fichier seront <b>ajoutées</b> aux tiennes (sans doublon).',
            ok: 'Remplacer', danger: true,
          });
          mode = replace ? 'replace' : 'merge';
        }
        try {
          const r = store.importJSON(text, mode);
          ui.toast('Import terminé : ' + fmt.plural(r.added, 'saisie ajoutée', 'saisies ajoutées') + (r.rejected ? ', ' + fmt.plural(r.rejected, 'ligne ignorée', 'lignes ignorées') : '') + '.', { icon: 'upload' });
        } catch (err) { ui.toast(esc(err.message), { kind: 'error' }); }
      });
    },
    async onClick(ev) {
      const t = ev.target.closest('[data-theme-set]');
      if (t) { BR.app.setTheme(t.dataset.themeSet); BR.app.rerender(); return true; }
      const a = ev.target.closest('[data-action]');
      if (!a) return false;
      const stamp = D.toKey(D.today());
      switch (a.dataset.action) {
        case 'export-json': ui.download('br-sauvegarde-' + stamp + '.json', store.exportJSON(), 'application/json'); return true;
        case 'export-csv': ui.download('br-export-' + stamp + '.csv', store.exportCSV(), 'text/csv;charset=utf-8'); return true;
        case 'import': $('#import-file').click(); return true;
        case 'persist': {
          const ok = await navigator.storage.persist();
          ui.toast(ok ? 'Stockage protégé : le navigateur ne l’effacera pas automatiquement.' : 'Le navigateur a refusé la protection du stockage.', { kind: ok ? 'info' : 'error' });
          return true;
        }
        case 'wipe': {
          const ok = await ui.confirm({ title: 'Tout supprimer ?', text: 'Les ' + fmt.plural(store.all().length, 'saisie', 'saisies') + ' et tous les records associés seront effacés. Pense à exporter une sauvegarde avant.', ok: 'Tout supprimer', danger: true });
          if (ok) { store.clear(); ui.toast('Toutes les données ont été supprimées.', { icon: 'trash' }); }
          return true;
        }
      }
      return false;
    },
  };
})(window);
