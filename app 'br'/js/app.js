/* Démarrage : navigation, thème, détection des nouveaux records, mode hors connexion. */
(function (root) {
  'use strict';
  const BR = root.BR;
  const { D, fmt, esc, $, $$, icon, store, stats, ui, views } = BR;
  const statsViews = BR.statsViews;

  const SECTIONS = [
    { id: 'activite', label: 'Activité annuelle', ico: 'calendar' },
    { id: 'comparateur', label: 'Comparateur', ico: 'swap' },
    { id: 'records', label: 'Mes records', ico: 'trophy' },
  ];

  /* Page « Statistiques » : regroupe les trois sections sans surcharger la navigation. */
  views.stats = {
    title: 'Statistiques',
    render(view, params, opts) {
      const section = statsViews[params.section] ? params.section : 'activite';
      this.current = section;
      view.innerHTML = '<h1 class="page-title">Statistiques</h1>' +
        '<nav class="sub-nav" aria-label="Sections des statistiques">' +
          SECTIONS.map((s) => '<a href="#/stats/' + s.id + '"' + (s.id === section ? ' aria-current="page"' : '') + '>' + icon(s.ico) + '<span>' + s.label + '</span></a>').join('') +
        '</nav><div class="subview"></div>';
      statsViews[section].render($('.subview', view), params, opts);
    },
    onClick(ev, view) {
      const s = statsViews[this.current];
      return s && s.onClick ? s.onClick(ev, $('.subview', view)) : false;
    },
  };

  const ROUTES = { '': 'home', historique: 'history', stats: 'stats', reglages: 'settings' };
  let current = { name: 'home', params: {} };

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const name = ROUTES[parts[0] || ''] || 'home';
    const params = {};
    new URLSearchParams(qs || '').forEach((v, k) => (params[k] = v));
    if (name === 'stats') params.section = parts[1] || 'activite';
    return { name, params };
  }

  function render(animate) {
    const view = $('#view');
    const v = views[current.name];
    const y = root.scrollY;
    // Sur simple mise à jour des données, les compteurs partent de leur ancienne valeur.
    const old = animate ? [] : $$('[data-count]', view).map((el) => el.dataset.value);
    view.classList.remove('enter');
    v.render(view, current.params, { animate: !!animate });
    if (animate && !BR.reducedMotion()) { void view.offsetWidth; view.classList.add('enter'); }
    $$('[data-count]', view).forEach((el, i) => {
      if (old[i] != null) el.dataset.value = old[i];
      BR.countUp(el, Number(el.dataset.count));
    });
    const sectionTitle = current.name === 'stats' && statsViews[current.params.section] ? statsViews[current.params.section].title : v.title;
    document.title = sectionTitle + ' · BR';
    $$('[data-nav]').forEach((a) => {
      if (a.dataset.nav === current.name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (!animate) root.scrollTo(0, y);
  }

  function navigate() {
    const next = parseHash();
    const changedPage = next.name !== current.name || next.params.section !== current.params.section;
    current = next;
    BR.charts.hideTip();
    render(true);
    if (changedPage) { root.scrollTo(0, 0); $('#view').focus({ preventScroll: true }); }
  }

  /* ---------- Thème ---------- */
  function setTheme(t) {
    localStorage.setItem('br.theme', t);
    applyTheme();
  }
  function applyTheme() {
    const t = localStorage.getItem('br.theme') || 'auto';
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    const dark = t === 'dark' || (t === 'auto' && root.matchMedia('(prefers-color-scheme: dark)').matches);
    const meta = $('meta[name="theme-color"]');
    if (meta) meta.content = dark ? '#121211' : '#f6f6f3';
  }

  /* ---------- Nouveaux records ---------- */
  const RECORD_NAMES = {
    day: ['Journée record', 'BR'], week: ['Semaine record', 'BR'], month: ['Mois record', 'BR'], year: ['Année record', 'BR'],
    entry: ['Plus grande saisie', 'BR'], entriesDay: ['Journée avec le plus d’enregistrements', 'saisies'],
  };
  function detectRecords(change) {
    if (change.type !== 'add' && change.type !== 'update') return;
    if (!change.prev.length) return;
    const today = D.today();
    const before = stats.recordSnapshot(change.prev, today);
    const after = stats.recordSnapshot(store.all(), today);
    const beaten = Object.keys(RECORD_NAMES).filter((k) => before[k] > 0 && after[k] > before[k]);
    if (!beaten.length) return;
    const k = beaten[0];
    const more = beaten.length > 1 ? ' <span class="muted">(+' + (beaten.length - 1) + ' autre' + (beaten.length > 2 ? 's' : '') + ')</span>' : '';
    setTimeout(() => ui.toast('Nouveau record ! <b>' + esc(RECORD_NAMES[k][0]) + '</b> : ' + fmt.num(after[k]) + ' ' + RECORD_NAMES[k][1] +
      ' (avant : ' + fmt.num(before[k]) + ')' + more, {
      kind: 'record', icon: 'trophy', duration: 6500,
      action: { label: 'Voir', run: () => { location.hash = '#/stats/records'; } },
    }), 350);
  }

  function start() {
    applyTheme();
    root.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    store.load();
    ui.initEntryDialog();
    ui.initConfirmDialog();

    store.subscribe((change) => {
      detectRecords(change);
      render(false);
    });

    $('#view').addEventListener('click', async (ev) => {
      const v = views[current.name];
      if (v.onClick && (await v.onClick(ev, $('#view')))) return;
      const a = ev.target.closest('[data-action]');
      if (!a) return;
      if (a.dataset.action === 'add') ui.openEntry();
      else if (a.dataset.action === 'edit') ui.openEntry({ id: a.dataset.id });
      else if (a.dataset.action === 'delete') ui.deleteWithUndo(a.dataset.id);
    });
    $('#view').addEventListener('keydown', (ev) => {
      const t = ev.target;
      if ((ev.key === 'Enter' || ev.key === ' ') && t.getAttribute && t.getAttribute('role') === 'button' && t.tagName !== 'BUTTON') {
        ev.preventDefault();
        t.click();
      }
    });
    $('#fab').addEventListener('click', () => ui.openEntry());

    root.addEventListener('hashchange', navigate);
    navigate();

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker non enregistré', e));
    }
  }

  BR.app = { rerender: (animate) => render(!!animate), setTheme };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})(window);
