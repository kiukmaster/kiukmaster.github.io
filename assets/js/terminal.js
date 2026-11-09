(() => {
  'use strict';

  const terminal = document.querySelector('[data-profile-terminal]');
  if (!terminal) return;
  const $ = selector => terminal.querySelector(selector);
  const controls = $('[data-terminal-controls]');
  const buttons = [...controls.querySelectorAll('[data-terminal-command]')];
  const panels = [...terminal.querySelectorAll('[data-terminal-panel]')];
  const status = $('[data-terminal-status]');
  const footerStatus = $('#footer-status');
  const recoveryView = $('#recovery-view');
  const readyView = $('#ready-view');
  const repairAll = $('#repair-all');
  const replay = $('#replay-repair');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rows = [...terminal.querySelectorAll('[data-repair-item]')];
  const completed = new Set();
  const pending = new Set();
  const timers = new Map();
  const log = [];
  let generation = 0;
  let bulkRepair = false;
  let finishing = false;
  let animation = null;

  function remember(value) {
    try {
      if (value) localStorage.setItem('kiuk.restored', '1');
      else localStorage.removeItem('kiuk.restored');
    } catch { /* 저장소가 차단돼도 현재 터미널은 사용할 수 있습니다. */ }
  }

  function wait(duration) {
    if (reduced.matches) return Promise.resolve(true);
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        resolve(true);
      }, duration);
      timers.set(timer, resolve);
    });
  }

  function cancelWork() {
    generation += 1;
    timers.forEach((resolve, timer) => {
      clearTimeout(timer);
      resolve(false);
    });
    timers.clear();
    pending.clear();
    bulkRepair = false;
    finishing = false;
    animation?.cancel();
    animation = null;
  }

  function renderRepair() {
    rows.forEach(row => {
      const step = row.dataset.repairItem;
      const fixed = completed.has(step);
      const busy = pending.has(step);
      const button = row.querySelector('[data-repair]');
      row.classList.toggle('is-fixed', fixed);
      row.classList.toggle('is-repairing', busy);
      terminal.classList.toggle(`${step}-fixed`, fixed);
      button.disabled = fixed || busy || bulkRepair || finishing;
      button.querySelector('.task-state').textContent = fixed ? '완료' : busy ? '복구 중' : '복구';
      button.setAttribute('aria-label', `${row.dataset.repairLabel} ${fixed ? '복구 완료' : busy ? '복구 중' : '복구'}`);
    });
    repairAll.disabled = pending.size > 0 || bulkRepair || finishing;
    repairAll.textContent = bulkRepair ? '복구 중' : '모두 복구';
    $('#step-counter').textContent = `${completed.size} / ${rows.length}`;
    footerStatus.textContent = finishing ? '복구 완료' : pending.size || bulkRepair ? '복구 진행 중' : '복구 대기';
    $('#preview-prompt').textContent = completed.has('commands') ? '$ whoami' : '$ _';
    $('#preview-name').textContent = completed.has('content') ? $('#preview-name').dataset.restoredText : completed.has('display') ? 'KIUK' : '#_?__';
    $('#preview-description').textContent = completed.has('content') ? $('#preview-description').dataset.restoredText : completed.has('display') ? '화면 출력 복구' : '출력 대기';
    $('#repair-log').textContent = log.length ? log.slice(-3).join('\n') : '[대기] 복구 항목을 선택하세요.';
  }

  function select(command, announce = false) {
    if (terminal.dataset.phase !== 'ready') return;
    const button = buttons.find(item => item.dataset.terminalCommand === command);
    const panel = panels.find(item => item.dataset.terminalPanel === command);
    if (!button || !panel) return;
    animation?.cancel();
    animation = null;
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    panels.forEach(item => { item.hidden = item !== panel; });
    $('[data-terminal-prompt]').textContent = button.dataset.commandText;
    if (announce && !reduced.matches && typeof panel.animate === 'function') {
      animation = panel.animate([{ opacity: .65, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
    }
    status.textContent = announce ? `${button.querySelector('.terminal-command-label').textContent} 표시됨` : '';
    footerStatus.textContent = '시스템 정상';
  }

  function showReady({ save = false, focus = false } = {}) {
    cancelWork();
    rows.forEach(row => completed.add(row.dataset.repairItem));
    terminal.dataset.phase = 'ready';
    renderRepair();
    recoveryView.hidden = true;
    readyView.hidden = false;
    replay.hidden = false;
    buttons.forEach(button => { button.disabled = false; });
    $('#state-label').textContent = 'READY';
    select('whoami');
    if (save) remember(true);
    if (focus) {
      $('#introduction-title').focus({ preventScroll: true });
      status.textContent = '소개를 표시했습니다.';
    }
  }

  function showRecovery(focus = false) {
    cancelWork();
    completed.clear();
    log.length = 0;
    terminal.dataset.phase = 'repair';
    recoveryView.hidden = false;
    readyView.hidden = true;
    replay.hidden = true;
    buttons.forEach(button => {
      button.disabled = true;
      button.setAttribute('aria-pressed', 'false');
    });
    $('#state-label').textContent = 'RESTORE';
    status.textContent = '';
    renderRepair();
    if (focus) $('#terminal-recovery-title').focus({ preventScroll: true });
  }

  async function repair(row, fromBulk = false) {
    const step = row.dataset.repairItem;
    if (terminal.dataset.phase !== 'repair' || completed.has(step) || pending.has(step) || finishing) return;
    const ticket = generation;
    const button = row.querySelector('[data-repair]');
    const hadFocus = document.activeElement === button;
    pending.add(step);
    renderRepair();
    status.textContent = `${row.dataset.repairLabel} 복구 중`;
    if (!await wait(550) || ticket !== generation) return;
    pending.delete(step);
    completed.add(step);
    log.push(`[완료] ${row.dataset.repairLabel}`);
    status.textContent = `${row.dataset.repairLabel} 복구 완료. ${completed.size}개 완료`;
    finishing = completed.size === rows.length;
    renderRepair();
    if (finishing) {
      remember(true);
      if (await wait(180) && ticket === generation) {
        showReady({ focus: !document.hidden && (terminal.contains(document.activeElement) || document.activeElement === document.body) });
      }
    } else if (hadFocus && !fromBulk && (document.activeElement === button || document.activeElement === document.body)) {
      rows.find(item => !completed.has(item.dataset.repairItem) && !pending.has(item.dataset.repairItem))?.querySelector('[data-repair]').focus({ preventScroll: true });
    }
  }

  rows.forEach(row => row.querySelector('[data-repair]').addEventListener('click', () => repair(row)));
  repairAll.addEventListener('click', async () => {
    if (bulkRepair || pending.size || finishing) return;
    const ticket = generation;
    bulkRepair = true;
    renderRepair();
    for (const row of rows) {
      if (ticket !== generation) return;
      await repair(row, true);
    }
    if (ticket === generation) {
      bulkRepair = false;
      renderRepair();
    }
  });
  $('#skip-repair').addEventListener('click', () => showReady({ save: true, focus: true }));
  replay.addEventListener('click', () => {
    remember(false);
    showRecovery(true);
  });
  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-terminal-command]');
    if (button && controls.contains(button)) select(button.dataset.terminalCommand, true);
  });
  document.addEventListener('kiuk:introduction', event => showReady({ focus: event.detail?.focus === true }));
  document.addEventListener('kiuk:terminal-recovery', event => showRecovery(event.detail?.focus === true));
  document.getElementById('replay-intro')?.addEventListener('click', cancelWork);
  reduced.addEventListener('change', event => { if (event.matches) animation?.cancel(); });
  window.addEventListener('pagehide', cancelWork);
  window.addEventListener('pageshow', event => {
    if (!event.persisted || terminal.dataset.phase !== 'repair') return;
    if (completed.size === rows.length) showReady();
    else renderRepair();
  });

  controls.hidden = false;
  showReady();
})();
