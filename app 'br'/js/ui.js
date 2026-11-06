/* Composants d'interface partagés : notifications, formulaire de saisie, confirmation. */
(function (root) {
  'use strict';
  const BR = root.BR;
  const { D, fmt, esc, $, icon, store } = BR;

  /* ---------- Notifications ---------- */
  function toast(message, opts) {
    const o = Object.assign({ kind: 'info', duration: 4200 }, opts);
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast toast-' + o.kind;
    t.setAttribute('role', o.kind === 'error' ? 'alert' : 'status');
    t.innerHTML = (o.icon ? icon(o.icon, 'toast-ico') : '') + '<span class="toast-msg">' + message + '</span>' +
      (o.action ? '<button class="toast-btn" type="button">' + esc(o.action.label) + '</button>' : '');
    box.appendChild(t);
    const close = () => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 220);
    };
    if (o.action) $('.toast-btn', t).addEventListener('click', () => { o.action.run(); close(); });
    setTimeout(close, o.duration);
    return close;
  }

  /* ---------- Fenêtre modale générique (<dialog>) ---------- */
  function openDialog(dlg) {
    dlg.classList.remove('closing');
    if (!dlg.open) dlg.showModal();
  }
  function closeDialog(dlg) {
    if (!dlg.open) return;
    if (BR.reducedMotion()) { dlg.close(); return; }
    dlg.classList.add('closing');
    setTimeout(() => { dlg.classList.remove('closing'); dlg.close(); }, 160);
  }
  function wireDialog(dlg) {
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeDialog(dlg); });
    dlg.addEventListener('click', (e) => { if (e.target === dlg) closeDialog(dlg); });
  }

  /* ---------- Confirmation ---------- */
  function confirm(opts) {
    return new Promise((resolve) => {
      const dlg = $('#confirm-dialog');
      $('.dlg-title', dlg).textContent = opts.title;
      $('.dlg-text', dlg).innerHTML = opts.text || '';
      const ok = $('[data-ok]', dlg);
      ok.textContent = opts.ok || 'Confirmer';
      ok.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
      const done = (v) => { cleanup(); closeDialog(dlg); resolve(v); };
      const onOk = () => done(true);
      const onCancel = () => done(false);
      const onClose = () => { cleanup(); resolve(false); };
      const cancelBtn = $('[data-cancel]', dlg);
      function cleanup() {
        ok.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        dlg.removeEventListener('close', onClose);
      }
      ok.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      dlg.addEventListener('close', onClose);
      openDialog(dlg);
      cancelBtn.focus();
    });
  }

  /* ---------- Formulaire de saisie ---------- */
  let editingId = null;

  function openEntry(opts) {
    const o = opts || {};
    const dlg = $('#entry-dialog');
    const form = $('form', dlg);
    const e = o.id ? store.get(o.id) : null;
    editingId = e ? e.id : null;
    $('.dlg-title', dlg).textContent = e ? 'Modifier la saisie' : 'Nouvelle saisie';
    form.count.value = e ? e.count : (o.count || 1);
    form.date.value = e ? e.date : (o.date || D.toKey(D.today()));
    form.date.max = D.toKey(D.today());
    form.time.value = e ? e.time : (o.time || D.nowTime());
    form.note.value = e ? e.note : '';
    $('[data-delete]', dlg).hidden = !e;
    $('.form-error', dlg).textContent = '';
    openDialog(dlg);
    setTimeout(() => form.count.select(), 50);
  }

  function readForm(form) {
    const count = Math.round(Number(form.count.value));
    const date = form.date.value;
    const time = form.time.value;
    if (!Number.isFinite(count) || count < 1) return { error: 'Le nombre de BR doit être au moins 1.' };
    if (count > store.MAX_COUNT) return { error: 'Le nombre de BR ne peut pas dépasser ' + fmt.num(store.MAX_COUNT) + '.' };
    if (!D.isValidKey(date)) return { error: 'Choisis une date valide.' };
    if (D.fromKey(date) > D.today()) return { error: 'La date ne peut pas être dans le futur.' };
    if (!D.isValidTime(time)) return { error: 'Choisis une heure valide.' };
    return { data: { count, date, time, note: form.note.value.trim() } };
  }

  function deleteWithUndo(id) {
    const removed = store.remove(id);
    if (!removed) return;
    toast('Saisie supprimée (' + fmt.br(removed.count) + ', ' + fmt.dayMonthYear(D.fromKey(removed.date)) + ').', {
      icon: 'trash',
      action: { label: 'Annuler', run: () => store.restore(removed) },
      duration: 6000,
    });
  }

  function initEntryDialog() {
    const dlg = $('#entry-dialog');
    const form = $('form', dlg);
    wireDialog(dlg);
    dlg.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-step]');
      if (b) {
        const v = Math.max(1, Math.min(store.MAX_COUNT, (Math.round(Number(form.count.value)) || 0) + Number(b.dataset.step)));
        form.count.value = v;
      }
      if (ev.target.closest('[data-close]')) closeDialog(dlg);
      if (ev.target.closest('[data-now]')) { form.date.value = D.toKey(D.today()); form.time.value = D.nowTime(); }
    });
    $('[data-delete]', dlg).addEventListener('click', () => {
      const id = editingId;
      closeDialog(dlg);
      if (id) deleteWithUndo(id);
    });
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const r = readForm(form);
      if (r.error) { $('.form-error', dlg).textContent = r.error; return; }
      const saved = editingId ? store.update(editingId, r.data) : store.add(r.data);
      if (!saved) return;
      closeDialog(dlg);
      toast((editingId ? 'Saisie modifiée : ' : 'Enregistré : ') + '<b>' + fmt.br(saved.count) + '</b> · ' +
        esc(fmt.dayMonthYear(D.fromKey(saved.date))) + ' à ' + esc(saved.time.replace(':', ' h ')), { icon: 'plus' });
    });
  }

  function initConfirmDialog() { wireDialog($('#confirm-dialog')); }

  function download(name, text, type) {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function emptyState(title, text) {
    return '<div class="empty card">' + icon('chart', 'empty-ico') + '<h3>' + esc(title) + '</h3><p>' + esc(text) +
      '</p><button class="btn btn-primary" type="button" data-action="add">' + icon('plus') + 'Ajouter une saisie</button></div>';
  }

  BR.ui = { toast, openEntry, deleteWithUndo, confirm, initEntryDialog, initConfirmDialog, openDialog, closeDialog, download, emptyState };
})(window);
