(() => {
  'use strict';

  const terminal = document.querySelector('[data-profile-terminal]');
  if (!terminal) return;
  const controls = terminal.querySelector('[data-terminal-controls]');
  const buttons = [...controls.querySelectorAll('[data-terminal-command]')];
  const panels = [...terminal.querySelectorAll('[data-terminal-panel]')];
  const prompt = terminal.querySelector('[data-terminal-prompt]');
  const status = terminal.querySelector('[data-terminal-status]');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let animation = null;

  controls.addEventListener('click', event => {
    const button = event.target.closest('[data-terminal-command]');
    if (!button || !controls.contains(button)) return;
    const panel = panels.find(item => item.dataset.terminalPanel === button.dataset.terminalCommand);
    if (!panel) return;

    animation?.cancel();
    buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    panels.forEach(item => { item.hidden = item !== panel; });
    prompt.textContent = button.dataset.commandText;
    if (!reduced.matches && typeof panel.animate === 'function') {
      animation = panel.animate([{ opacity: .65, transform: 'translateY(3px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180, easing: 'ease-out' });
    }
    status.textContent = `${button.querySelector('.terminal-command-label').textContent} 표시됨`;
  });
  reduced.addEventListener('change', event => { if (event.matches) animation?.cancel(); });
  controls.hidden = false;
})();
