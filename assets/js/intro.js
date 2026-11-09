(() => {
  'use strict';

  const intro = document.getElementById('intro-screen');
  const site = document.getElementById('site-content');
  if (!intro || !site) return;

  const $ = selector => intro.querySelector(selector);
  const views = [...intro.querySelectorAll('[data-view]')];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'kiuk.restored';
  const timeouts = new Set();
  let active = false;
  let phase = '';
  let returning = false;

  function hasRestored() {
    try { return localStorage.getItem(storageKey) === '1'; } catch { return false; }
  }

  function later(fn, ms) {
    const id = setTimeout(() => {
      timeouts.delete(id);
      if (active) fn();
    }, ms);
    timeouts.add(id);
  }

  function clearTimers() {
    timeouts.forEach(clearTimeout);
    timeouts.clear();
  }

  function showTerminal({ recover = false, save = false } = {}) {
    const fromIntro = active;
    if (save) {
      try { localStorage.setItem(storageKey, '1'); } catch { /* 저장소가 없어도 터미널을 표시합니다. */ }
    }
    active = false;
    clearTimers();
    intro.hidden = true;
    site.hidden = false;
    document.documentElement.classList.remove('intro-active');
    document.body.classList.remove('intro-active');
    delete intro.dataset.phase;
    history.replaceState(history.state, '', location.pathname + location.search + '#introduction');
    document.dispatchEvent(new CustomEvent(recover ? 'kiuk:terminal-recovery' : 'kiuk:introduction', {
      detail: { fromIntro, focus: fromIntro && !document.hidden }
    }));
    if (fromIntro) window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function setPhase(next) {
    phase = next;
    intro.dataset.phase = next;
    views.forEach(view => { view.hidden = view.dataset.view !== next; });
    const labels = { boot: '블로그 불러오는 중', crash: '터미널 복구 대기', reboot: '복구 모드로 다시 시작하는 중' };
    $('[data-phase-status]').textContent = labels[next];
    if (!document.hidden) $(`[data-view="${next}"] [data-phase-focus]`)?.focus({ preventScroll: true });
  }

  function runBoot() {
    let n = 0;
    const tick = () => {
      n = Math.min(97, n + 3 + Math.floor(Math.random() * 7));
      $('[data-boot-bar]').style.width = n + '%';
      $('[data-boot-pct]').textContent = n;
      if (n < 97) later(tick, 55 + Math.random() * 60);
      else later(() => { setPhase('crash'); runCrash(); }, 380);
    };
    later(tick, 300);
  }

  function runCrash() {
    let n = 0;
    const tick = () => {
      n = Math.min(64, n + 2 + Math.floor(Math.random() * 6));
      $('[data-crash-pct]').textContent = n;
      if (n < 64) later(tick, (returning ? 60 : 140) + Math.random() * (returning ? 60 : 180));
      else later(() => { $(returning ? '[data-stall="back"]' : '[data-stall="new"]').hidden = false; }, returning ? 300 : 700);
    };
    later(tick, returning ? 300 : 700);
  }

  function startRecover() {
    if (phase !== 'crash') return;
    setPhase('reboot');
    window.scrollTo({ top: 0, behavior: 'instant' });
    later(() => showTerminal({ recover: true }), 1300);
  }

  function startIntro() {
    if (reduced.matches) { showTerminal(); return; }
    clearTimers();
    returning = hasRestored();
    intro.querySelectorAll('[data-stall]').forEach(box => { box.hidden = true; });
    $('[data-boot-pct]').textContent = '0';
    $('[data-crash-pct]').textContent = '0';
    $('[data-boot-bar]').style.width = '0%';
    $('[data-crash-time]').textContent = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date());
    history.replaceState(history.state, '', location.pathname + location.search);
    active = true;
    site.hidden = true;
    intro.hidden = false;
    document.documentElement.classList.add('intro-active');
    document.body.classList.add('intro-active');
    setPhase('boot');
    window.scrollTo({ top: 0, behavior: 'instant' });
    runBoot();
  }

  intro.addEventListener('click', event => {
    if (!active) return;
    if (event.target.closest('[data-home]')) {
      event.preventDefault();
      showTerminal({ save: true });
      return;
    }
    if (event.target.closest('[data-action="recover"]')) startRecover();
  });
  window.addEventListener('pagehide', () => { active = false; clearTimers(); });
  window.addEventListener('pageshow', event => {
    if (event.persisted && !intro.hidden) showTerminal();
  });
  window.addEventListener('hashchange', () => {
    if (active && location.hash === '#introduction') showTerminal({ save: true });
  });
  reduced.addEventListener('change', event => {
    if (event.matches && active) showTerminal();
  });
  const replay = document.getElementById('replay-intro');
  replay?.addEventListener('click', startIntro);
  if (replay) replay.hidden = false;
  if (hasRestored() || reduced.matches || location.hash === '#introduction') showTerminal();
  else startIntro();
})();
