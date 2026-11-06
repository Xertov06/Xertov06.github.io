/* Utilitaires : dates (index de jour sans fuseau), formatage français, DOM. */
(function (root) {
  'use strict';
  const BR = root.BR = root.BR || {};
  const DAY_MS = 86400000;
  const pad = (n) => String(n).padStart(2, '0');

  /* Toutes les dates sont manipulées comme des « index de jour » :
     nombre de jours depuis le 1er janvier 1970 (calcul en UTC, donc
     aucun décalage lié à l'heure d'été). */
  const D = {
    DAY_MS,
    fromYMD(y, m, d) { return Math.round(Date.UTC(y, m, d) / DAY_MS); }, // m : 0-11
    fromKey(key) {
      const [y, m, d] = String(key).split('-').map(Number);
      return D.fromYMD(y, m - 1, d);
    },
    toKey(idx) {
      const t = new Date(idx * DAY_MS);
      return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
    },
    ymd(idx) {
      const t = new Date(idx * DAY_MS);
      return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
    },
    weekday(idx) { return (new Date(idx * DAY_MS).getUTCDay() + 6) % 7; }, // 0 = lundi
    weekStart(idx) { return idx - D.weekday(idx); },
    monthStart(idx) { const p = D.ymd(idx); return D.fromYMD(p.y, p.m, 1); },
    monthEnd(idx) { const p = D.ymd(idx); return D.fromYMD(p.y, p.m + 1, 0); },
    yearStart(idx) { return D.fromYMD(D.ymd(idx).y, 0, 1); },
    yearEnd(idx) { return D.fromYMD(D.ymd(idx).y, 11, 31); },
    addMonths(idx, n) { const p = D.ymd(idx); return D.fromYMD(p.y, p.m + n, 1); },
    today() { const n = new Date(); return D.fromYMD(n.getFullYear(), n.getMonth(), n.getDate()); },
    nowTime() { const n = new Date(); return pad(n.getHours()) + ':' + pad(n.getMinutes()); },
    isValidKey(key) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
      return D.toKey(D.fromKey(key)) === key;
    },
    isValidTime(t) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(t); },
  };

  const LOCALE = 'fr-FR';
  const dtf = (opts) => new Intl.DateTimeFormat(LOCALE, Object.assign({ timeZone: 'UTC' }, opts));
  const F_DAY = dtf({ weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const F_DAY_LONG = dtf({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const F_DM = dtf({ day: 'numeric', month: 'short' });
  const F_DMY = dtf({ day: 'numeric', month: 'short', year: 'numeric' });
  const F_MONTH = dtf({ month: 'long', year: 'numeric' });
  const F_MONTH_SHORT = dtf({ month: 'short' });
  const F_MONTH_NAME = dtf({ month: 'long' });
  const NF = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
  const NF2 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const NF_SIGNED = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const PF_SIGNED = new Intl.NumberFormat(LOCALE, { style: 'percent', minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const PF = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 });
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const d = (idx) => new Date(idx * DAY_MS);

  const WEEKDAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  const fmt = {
    num: (n) => NF.format(n),
    dec: (n) => NF2.format(n),
    signed: (n) => NF_SIGNED.format(n),
    pctSigned: (r) => PF_SIGNED.format(r),
    pct: (r) => PF.format(r),
    br: (n) => NF.format(n) + ' BR',
    day: (idx) => F_DAY.format(d(idx)),
    dayLong: (idx) => cap(F_DAY_LONG.format(d(idx))),
    dayMonth: (idx) => F_DM.format(d(idx)),
    dayMonthYear: (idx) => F_DMY.format(d(idx)),
    month: (idx) => cap(F_MONTH.format(d(idx))),
    monthShort: (idx) => cap(F_MONTH_SHORT.format(d(idx)).replace('.', '')),
    monthName: (m) => cap(F_MONTH_NAME.format(d(D.fromYMD(2001, m, 1)))),
    week(start) {
      const end = start + 6;
      const a = D.ymd(start), b = D.ymd(end);
      if (a.y !== b.y) return 'Semaine du ' + F_DMY.format(d(start)) + ' au ' + F_DMY.format(d(end));
      if (a.m !== b.m) return 'Semaine du ' + F_DM.format(d(start)) + ' au ' + F_DMY.format(d(end));
      return 'Semaine du ' + a.d + ' au ' + F_DMY.format(d(end));
    },
    range(start, end) {
      if (start === end) return F_DMY.format(d(start));
      return 'Du ' + F_DMY.format(d(start)) + ' au ' + F_DMY.format(d(end));
    },
    hour: (h) => h + ' h',
    hourRange: (h) => h + ' h – ' + ((h + 1) % 24) + ' h',
    weekday: (i) => cap(WEEKDAYS[i]),
    weekdayShort: (i) => WEEKDAYS_SHORT[i],
    plural: (n, one, many) => NF.format(n) + ' ' + (Math.abs(n) >= 2 ? many : one),
    days: (n) => fmt.plural(n, 'jour', 'jours'),
  };

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  const reducedMotion = () => root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Animation « compteur » des grands nombres. */
  function countUp(el, to, opts) {
    const o = Object.assign({ duration: 600, format: fmt.num }, opts);
    if (reducedMotion() || !isFinite(to)) { el.textContent = o.format(to); return; }
    const from = Number(el.dataset.value || 0);
    el.dataset.value = to;
    if (from === to || o.duration <= 0) { el.textContent = o.format(to); return; }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / o.duration);
      const e = 1 - Math.pow(1 - k, 3);
      const v = from + (to - from) * e;
      el.textContent = o.format(Number.isInteger(to) ? Math.round(v) : Math.round(v * 100) / 100);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function uid() {
    if (root.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  const icons = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 15v2M11 11v6M15 7v10M19 12v5"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    swap: '<path d="M7 16V4M3 8l4-4 4 4M17 8v12M21 16l-4 4-4-4"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    week: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M7 14h10"/>',
    month: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
    year: '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    stack: '<path d="m12 2 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5M5 3h14"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    arrowDown: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
    equal: '<path d="M5 9h14M5 15h14"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-3-2-6-4-8 0 3-2 4-3 4 0-3-1-6-4-9 0 4-4 7-4 13 0 4 4 7 8 7z"/>',
  };
  const icon = (name, cls) =>
    '<svg class="ico ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (icons[name] || '') + '</svg>';

  BR.D = D;
  BR.fmt = fmt;
  BR.esc = esc;
  BR.$ = $;
  BR.$$ = $$;
  BR.countUp = countUp;
  BR.uid = uid;
  BR.icon = icon;
  BR.reducedMotion = reducedMotion;
})(typeof window !== 'undefined' ? window : globalThis);
