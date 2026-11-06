/* Calculs statistiques : fonctions pures, recalculées à partir des saisies réellement enregistrées. */
(function (root) {
  'use strict';
  const BR = root.BR;
  const { D } = BR;

  /* ---------- Index ---------- */
  function buildIndex(events) {
    const byDay = new Map();
    let total = 0;
    for (const e of events) {
      const idx = D.fromKey(e.date);
      let day = byDay.get(idx);
      if (!day) { day = { idx, br: 0, n: 0, entries: [] }; byDay.set(idx, day); }
      day.br += e.count;
      day.n += 1;
      day.entries.push(e);
      total += e.count;
    }
    const days = Array.from(byDay.keys()).sort((a, b) => a - b);
    return {
      events, byDay, days, total,
      first: days.length ? days[0] : null,
      last: days.length ? days[days.length - 1] : null,
    };
  }

  let cache = { events: null, ix: null };
  function index(events) {
    if (cache.events !== events) cache = { events, ix: buildIndex(events) };
    return cache.ix;
  }

  const dayBR = (ix, idx) => { const d = ix.byDay.get(idx); return d ? d.br : 0; };
  const hourOf = (e) => (e.time ? Number(e.time.slice(0, 2)) : -1);

  function sumRange(ix, start, end) {
    let s = 0;
    for (let i = start; i <= end; i++) s += dayBR(ix, i);
    return s;
  }

  /* ---------- Résumé d'une période ---------- */
  /* Seuls les jours déjà écoulés comptent pour la moyenne : une période en cours
     n'est pas pénalisée par ses jours futurs (sauf si des saisies y figurent). */
  function periodSummary(ix, start, end, today) {
    if (start > end) { const t = start; start = end; end = t; }
    let effEnd = end;
    if (end > today) {
      effEnd = Math.max(today, start - 1);
      for (let i = end; i > today; i--) if (ix.byDay.has(i)) { effEnd = i; break; }
    }
    const length = end - start + 1;
    const elapsed = Math.max(0, effEnd - start + 1);
    const daily = new Array(length).fill(0);
    const hours = new Array(24).fill(0);
    const weekdays = new Array(7).fill(0);
    let total = 0, entries = 0, activeDays = 0, untimed = 0;
    let best = null;
    for (let i = start; i <= end; i++) {
      const d = ix.byDay.get(i);
      if (!d) continue;
      daily[i - start] = d.br;
      total += d.br;
      entries += d.n;
      activeDays++;
      weekdays[D.weekday(i)] += d.br;
      if (!best || d.br > best.br) best = { idx: i, br: d.br };
      for (const e of d.entries) {
        const h = hourOf(e);
        if (h >= 0) hours[h] += e.count; else untimed += e.count;
      }
    }
    let peakHour = null;
    hours.forEach((v, h) => { if (v > 0 && (peakHour === null || v > hours[peakHour])) peakHour = h; });
    return {
      start, end, effEnd, length, elapsed, total, entries, activeDays, untimed,
      avg: elapsed > 0 ? total / elapsed : null,
      best, daily, hours, weekdays, peakHour,
    };
  }

  /* Écart B − A et évolution relative à A (non calculable si A = 0). */
  function delta(a, b) {
    if (a == null || b == null) return { diff: null, pct: null };
    return { diff: b - a, pct: a !== 0 ? (b - a) / a : null };
  }

  /* ---------- Heatmap annuelle ---------- */
  function levelBounds(max) {
    if (max <= 0) return [];
    if (max <= 4) return Array.from({ length: max }, (_, i) => i + 1);
    return [1, 2, 3, 4].map((k) => Math.round((k * max) / 4));
  }
  function levelOf(v, bounds) {
    if (!v) return 0;
    for (let k = 0; k < bounds.length; k++) if (v <= bounds[k]) return k + 1;
    return bounds.length;
  }

  function yearStats(ix, year, today) {
    const start = D.fromYMD(year, 0, 1), end = D.fromYMD(year, 11, 31);
    const s = periodSummary(ix, start, end, today);
    let max = 0;
    s.daily.forEach((v) => { if (v > max) max = v; });
    // Plus longue série de jours consécutifs avec au moins un événement
    let streak = 0, run = 0, streakEnd = null;
    for (let i = start; i <= end; i++) {
      if (ix.byDay.has(i)) { run++; if (run > streak) { streak = run; streakEnd = i; } } else run = 0;
    }
    const monthly = new Array(12).fill(0);
    s.daily.forEach((v, k) => { monthly[D.ymd(start + k).m] += v; });
    const bounds = levelBounds(max);
    return Object.assign(s, {
      year, max, bounds, monthly,
      streak, streakStart: streakEnd !== null ? streakEnd - streak + 1 : null, streakEnd,
    });
  }

  function dayRankInYear(ix, idx) {
    const y = D.ymd(idx).y;
    const v = dayBR(ix, idx);
    if (!v) return null;
    let better = 0, active = 0;
    ix.days.forEach((d) => {
      if (D.ymd(d).y !== y) return;
      active++;
      if (dayBR(ix, d) > v) better++;
    });
    return { rank: better + 1, of: active };
  }

  function yearsRange(ix, today) {
    const ty = D.ymd(today).y;
    const fy = ix.first !== null ? Math.min(D.ymd(ix.first).y, ty) : ty;
    const ly = ix.last !== null ? Math.max(D.ymd(ix.last).y, ty) : ty;
    return { first: fy, last: ly };
  }

  /* ---------- Records personnels ---------- */
  /* Parcours chronologique : chaque fois qu'une valeur dépasse strictement le
     meilleur score connu, un nouveau record est établi. Le record actuel est le
     dernier de la progression, le record précédent l'avant-dernier. L'historique
     est donc entièrement dérivé des données présentes et ne se perd jamais. */
  function progression(items) {
    const prog = [];
    let best = -Infinity;
    for (const it of items) {
      if (it.value > best) { best = it.value; prog.push(Object.assign({ ties: 0 }, it)); }
      else if (it.value === best && prog.length) prog[prog.length - 1].ties++;
    }
    return prog;
  }

  function groupBy(ix, keyFn) {
    const m = new Map();
    ix.days.forEach((d) => {
      const k = keyFn(d);
      m.set(k, (m.get(k) || 0) + dayBR(ix, d));
    });
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0]).map(([at, value]) => ({ at, value }));
  }

  function wrap(prog) {
    return {
      prog,
      current: prog.length ? prog[prog.length - 1] : null,
      previous: prog.length > 1 ? prog[prog.length - 2] : null,
    };
  }

  function distribution(totals, counts, lastSeen) {
    const order = totals.map((v, i) => i).filter((i) => totals[i] > 0).sort((a, b) => totals[b] - totals[a] || a - b);
    const sum = totals.reduce((a, b) => a + b, 0);
    if (!order.length) return null;
    const lead = order[0], second = order.length > 1 ? order[1] : null;
    return {
      totals, counts, sum,
      leader: { key: lead, value: totals[lead], entries: counts[lead], share: totals[lead] / sum, lastSeen: lastSeen[lead] },
      runnerUp: second === null ? null : { key: second, value: totals[second], entries: counts[second], share: totals[second] / sum },
      tie: second !== null && totals[second] === totals[lead],
    };
  }

  function records(ix, today) {
    const dayItems = ix.days.map((d) => ({ at: d, value: ix.byDay.get(d).br }));
    const entriesDayItems = ix.days.map((d) => ({ at: d, value: ix.byDay.get(d).n }));
    const entryItems = ix.events.map((e) => ({ at: D.fromKey(e.date), time: e.time, value: e.count, id: e.id }));

    const gaps = [];
    for (let i = 0; i + 1 < ix.days.length; i++) {
      const g = ix.days[i + 1] - ix.days[i] - 1;
      if (g > 0) gaps.push({ at: ix.days[i] + 1, end: ix.days[i + 1] - 1, value: g, ongoing: false });
    }
    if (ix.last !== null && today > ix.last) {
      gaps.push({ at: ix.last + 1, end: today, value: today - ix.last, ongoing: true });
    }

    const hourTotals = new Array(24).fill(0), hourCounts = new Array(24).fill(0), hourLast = new Array(24).fill(null);
    const wdTotals = new Array(7).fill(0), wdCounts = new Array(7).fill(0), wdLast = new Array(7).fill(null);
    ix.events.forEach((e) => {
      const idx = D.fromKey(e.date);
      const h = hourOf(e);
      if (h >= 0) {
        hourTotals[h] += e.count; hourCounts[h]++;
        if (hourLast[h] === null || idx >= hourLast[h]) hourLast[h] = idx;
      }
      const w = D.weekday(idx);
      wdTotals[w] += e.count; wdCounts[w]++;
      if (wdLast[w] === null || idx >= wdLast[w]) wdLast[w] = idx;
    });

    return {
      day: wrap(progression(dayItems)),
      week: wrap(progression(groupBy(ix, D.weekStart))),
      month: wrap(progression(groupBy(ix, D.monthStart))),
      year: wrap(progression(groupBy(ix, D.yearStart))),
      gap: wrap(progression(gaps)),
      entry: wrap(progression(entryItems)),
      entriesDay: wrap(progression(entriesDayItems)),
      hour: distribution(hourTotals, hourCounts, hourLast),
      weekday: distribution(wdTotals, wdCounts, wdLast),
    };
  }

  /* Valeurs actuelles des records « à battre », pour détecter un nouveau record. */
  function recordSnapshot(events, today) {
    const r = records(index(events), today);
    const v = (x) => (x.current ? x.current.value : 0);
    return { day: v(r.day), week: v(r.week), month: v(r.month), year: v(r.year), entry: v(r.entry), entriesDay: v(r.entriesDay) };
  }

  BR.stats = {
    index, buildIndex, dayBR, sumRange, periodSummary, delta,
    levelBounds, levelOf, yearStats, dayRankInYear, yearsRange,
    progression, records, recordSnapshot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
