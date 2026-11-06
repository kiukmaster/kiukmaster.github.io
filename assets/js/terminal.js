(() => {
  'use strict';

  const terminal = document.querySelector('[data-profile-terminal]');
  if (!terminal) return;

  const controls = terminal.querySelector('[data-terminal-controls]');
  const prompt = terminal.querySelector('[data-terminal-prompt]');
  const status = terminal.querySelector('[data-terminal-status]');
  const modeButton = terminal.querySelector('[data-terminal-mode]');
  if (!controls || !prompt || !status || !modeButton) return;

  const commands = new Map([
    ['whoami', '소개'], ['posts', '최근 글'],
    ['contests', '대회 기록'], ['contact', '연락처']
  ]);
  const buttons = [...controls.querySelectorAll('[data-terminal-command]')];
  const panels = new Map([...terminal.querySelectorAll('[data-terminal-panel]')]
    .filter(panel => commands.has(panel.dataset.terminalPanel))
    .map(panel => [panel.dataset.terminalPanel, panel]));
  if ([...commands.keys()].some(command => !panels.has(command) || !buttons.some(button => button.dataset.terminalCommand === command))) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const seenKey = 'kiuk.profileSeen';
  function hasSeenProfile() {
    try { return localStorage.getItem(seenKey) === '1'; } catch { return false; }
  }
  let reading = hasSeenProfile();
  let introductionShown = reduced.matches;
  let selected = 'whoami';
  let animation = null;

  function rememberProfile() {
    if (document.hidden) return;
    try { localStorage.setItem(seenKey, '1'); } catch { /* 저장하지 못해도 현재 화면을 유지합니다. */ }
  }

  function renderMode({ animate = false, announce = false } = {}) {
    animation?.cancel();
    animation = null;
    terminal.classList.toggle('is-reading', reading);
    controls.hidden = reading;
    modeButton.dataset.ko = reading ? '터미널 다시 보기' : '모두 펼쳐 보기';
    modeButton.dataset.en = reading ? 'Open terminal' : 'Show all';
    modeButton.textContent = document.documentElement.lang === 'en' ? modeButton.dataset.en : modeButton.dataset.ko;
    if (reading) {
      panels.forEach(panel => { panel.hidden = false; });
      status.textContent = announce ? '소개와 기록을 모두 펼쳤습니다.' : '';
    } else select('whoami', { animate, announce });
  }

  function select(command, { animate = false, announce = false } = {}) {
    const panel = panels.get(command);
    const button = buttons.find(item => item.dataset.terminalCommand === command);
    if (!panel || !button) return;

    animation?.cancel();
    animation = null;
    panels.forEach((item, key) => { item.hidden = key !== command; });
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    prompt.textContent = button.dataset.commandText;
    selected = command;

    if (animate && !reduced.matches && typeof panel.animate === 'function') {
      animation = panel.animate([
        { opacity: .65, transform: 'translateY(3px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ], { duration: 180, easing: 'ease-out' });
    }
    status.textContent = announce ? `${commands.get(command)} 표시됨` : '';
  }

  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-terminal-command]');
    if (!button || !controls.contains(button) || button.dataset.terminalCommand === selected) return;
    select(button.dataset.terminalCommand, { animate: true, announce: true });
  });
  modeButton.addEventListener('click', () => {
    reading = !reading;
    renderMode({ announce: true });
    if (reading) document.getElementById('introduction-title')?.focus();
    else buttons.find(button => button.dataset.terminalCommand === 'whoami')?.focus();
    introductionShown = true;
    rememberProfile();
  });
  document.addEventListener('kiuk:introduction', event => {
    renderMode({ animate: event.detail?.fromIntro === true });
    introductionShown = true;
    rememberProfile();
  });
  document.addEventListener('visibilitychange', () => { if (introductionShown) rememberProfile(); });
  reduced.addEventListener('change', event => { if (event.matches) animation?.cancel(); });
  window.addEventListener('pagehide', () => animation?.cancel());
  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;
    const commandFocused = controls.contains(document.activeElement);
    reading = hasSeenProfile();
    renderMode();
    if (reading && commandFocused) document.getElementById('introduction-title')?.focus({ preventScroll: true });
  });

  renderMode();
  modeButton.hidden = false;
  if (introductionShown) rememberProfile();
})();
