/* Stockage local des saisies (localStorage), sans aucun accès réseau.
   Une saisie = { id, date:'AAAA-MM-JJ', time:'HH:MM', count:entier ≥ 1, note, createdAt, updatedAt } */
(function (root) {
  'use strict';
  const BR = root.BR;
  const { D } = BR;
  const KEY = 'br.events.v1';
  const MAX_COUNT = 9999;

  let events = [];
  let version = 0;
  const listeners = new Set();

  function sanitize(e) {
    if (!e || typeof e !== 'object') return null;
    const date = String(e.date || '');
    if (!D.isValidKey(date)) return null;
    const count = Math.round(Number(e.count));
    if (!Number.isFinite(count) || count < 1 || count > MAX_COUNT) return null;
    const time = D.isValidTime(String(e.time || '')) ? String(e.time) : '';
    const now = Date.now();
    return {
      id: String(e.id || BR.uid()),
      date,
      time,
      count,
      note: String(e.note || '').slice(0, 200),
      createdAt: Number(e.createdAt) || now,
      updatedAt: Number(e.updatedAt) || Number(e.createdAt) || now,
    };
  }

  function sortEvents(list) {
    return list.sort((a, b) =>
      a.date < b.date ? -1 : a.date > b.date ? 1 :
      a.time < b.time ? -1 : a.time > b.time ? 1 :
      a.createdAt - b.createdAt);
  }

  function readStorage() {
    try {
      const raw = root.localStorage.getItem(KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      const list = Array.isArray(data) ? data : (data && data.events) || [];
      return sortEvents(list.map(sanitize).filter(Boolean));
    } catch (err) {
      console.error('Lecture des données impossible', err);
      return [];
    }
  }

  function persist() {
    try {
      root.localStorage.setItem(KEY, JSON.stringify({ v: 1, events }));
      return true;
    } catch (err) {
      console.error(err);
      BR.ui && BR.ui.toast('Enregistrement impossible : stockage local plein ou indisponible.', { kind: 'error' });
      return false;
    }
  }

  function emit(change) {
    version++;
    listeners.forEach((fn) => { try { fn(change); } catch (e) { console.error(e); } });
  }

  function commit(next, change) {
    const prev = events;
    events = sortEvents(next);
    if (!persist()) { events = prev; return false; }
    emit(Object.assign({ prev }, change));
    return true;
  }

  const store = {
    MAX_COUNT,
    load() { events = readStorage(); version++; },
    all() { return events; },
    version() { return version; },
    get(id) { return events.find((e) => e.id === id) || null; },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    add(data) {
      const e = sanitize(Object.assign({}, data, { id: BR.uid(), createdAt: Date.now(), updatedAt: Date.now() }));
      if (!e) return null;
      return commit(events.concat([e]), { type: 'add', event: e }) ? e : null;
    },
    update(id, patch) {
      const old = store.get(id);
      if (!old) return null;
      const e = sanitize(Object.assign({}, old, patch, { id, createdAt: old.createdAt, updatedAt: Date.now() }));
      if (!e) return null;
      return commit(events.map((x) => (x.id === id ? e : x)), { type: 'update', event: e, old }) ? e : null;
    },
    remove(id) {
      const old = store.get(id);
      if (!old) return null;
      return commit(events.filter((x) => x.id !== id), { type: 'remove', old }) ? old : null;
    },
    restore(e) {
      const ok = sanitize(e);
      if (!ok || store.get(ok.id)) return false;
      return commit(events.concat([ok]), { type: 'add', event: ok });
    },
    clear() { return commit([], { type: 'clear' }); },

    exportJSON() {
      return JSON.stringify({ app: 'BR', v: 1, exportedAt: new Date().toISOString(), events }, null, 2);
    },
    exportCSV() {
      const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
      const rows = ['date;heure;nombre_br;note'];
      events.forEach((e) => rows.push([e.date, e.time, e.count, q(e.note)].join(';')));
      return '﻿' + rows.join('\r\n');
    },
    /* Import : « merge » ajoute les saisies absentes (même id ignoré), « replace » remplace tout. */
    importJSON(text, mode) {
      let data;
      try { data = JSON.parse(text); } catch (e) { throw new Error('Fichier illisible : ce n’est pas un JSON valide.'); }
      const list = Array.isArray(data) ? data : data && data.events;
      if (!Array.isArray(list)) throw new Error('Aucune saisie trouvée dans ce fichier.');
      const clean = list.map(sanitize).filter(Boolean);
      const rejected = list.length - clean.length;
      let next;
      if (mode === 'replace') next = clean;
      else {
        const ids = new Set(events.map((e) => e.id));
        next = events.concat(clean.filter((e) => !ids.has(e.id)));
      }
      const added = next.length - (mode === 'replace' ? 0 : events.length);
      commit(next, { type: 'import' });
      return { added, rejected };
    },
  };

  /* Synchronisation si l'application est ouverte dans plusieurs onglets. */
  if (root.addEventListener) {
    root.addEventListener('storage', (ev) => {
      if (ev.key !== KEY) return;
      const prev = events;
      events = readStorage();
      emit({ type: 'sync', prev });
    });
  }

  BR.store = store;
})(typeof window !== 'undefined' ? window : globalThis);
