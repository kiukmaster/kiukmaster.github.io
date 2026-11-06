(() => {
  'use strict';

  const intro = document.getElementById('intro-screen');
  const site = document.getElementById('site-content');
  if (!intro || !site) return;

  const $ = (selector, root = intro) => root.querySelector(selector);
  const $$ = (selector, root = intro) => [...root.querySelectorAll(selector)];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'kiuk.restored';
  const timeouts = new Set();
  const intervals = new Set();
  const views = $$('[data-view]');
  const doneBox = $('[data-done]');
  const doneText = $('[data-done-text]');
  const stayBtn = $('[data-action="stay"]');
  const fixAllBtn = $('[data-action="fix-all"]');
  const fixedCountEl = $('[data-fixed-count]');
  const totalBar = $('[data-total-bar]');
  const phaseStatus = $('[data-phase-status]');
  const order = [];
  let active = false;
  let phase = '';
  let returning = false;
  let completed = false;
  let t0 = 0;
  let countdownTimer = null;
  let count = 0;
  let counting = false;
  let stayed = false;

  const store = {
    get() { try { return localStorage.getItem(storageKey) === '1'; } catch { return false; } },
    set() { try { localStorage.setItem(storageKey, '1'); } catch { /* 저장소가 없어도 소개까지 진행합니다. */ } }
  };

  function later(fn, ms) {
    const id = setTimeout(() => {
      timeouts.delete(id);
      if (active) fn();
    }, ms);
    timeouts.add(id);
    return id;
  }

  function every(fn, ms) {
    const id = setInterval(() => { if (active) fn(); }, ms);
    intervals.add(id);
    return id;
  }

  function stopInterval(id) {
    clearInterval(id);
    intervals.delete(id);
  }

  function clearTimers() {
    timeouts.forEach(clearTimeout);
    intervals.forEach(clearInterval);
    timeouts.clear();
    intervals.clear();
    countdownTimer = null;
    order.forEach(m => { m.iv = null; m.holding = false; });
  }

  function showIntroduction() {
    const fromIntro = active;
    if (active && !completed) store.set();
    active = false;
    clearTimers();
    intro.hidden = true;
    site.hidden = false;
    document.documentElement.classList.remove('intro-active');
    document.body.classList.remove('intro-active');
    delete intro.dataset.phase;
    history.replaceState(history.state, '', location.pathname + location.search + '#introduction');
    document.dispatchEvent(new CustomEvent('kiuk:introduction', { detail: { fromIntro } }));
    document.getElementById('introduction-title')?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function setPhase(next) {
    phase = next;
    intro.dataset.phase = next;
    views.forEach(view => { view.hidden = !(view.dataset.view === next || (view.dataset.view === 'console' && next === 'done')); });
    doneBox.hidden = next !== 'done';
    const labels = { boot: '블로그 불러오는 중', crash: '블로그 복구 대기', reboot: '복구 모드로 다시 시작하는 중', console: '블로그 복구', done: '복구 완료', restart: '소개를 불러오는 중' };
    phaseStatus.textContent = labels[next];
    if (next !== 'done') $(`[data-view="${next}"] [data-phase-focus]`)?.focus({ preventScroll: true });
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
    later(() => {
      t0 = Date.now();
      setPhase('console');
      order.find(m => m.status !== 'fixed')?.btn.focus({ preventScroll: true });
    }, 1300);
  }

  function rnd(seed, i) {
    const x = Math.sin(seed * 78.233 + i * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function corrupt(str, level, seed) {
    if (level <= 0) return str;
    return Array.from(str, (ch, i) => ch === ' ' || rnd(seed, i) >= level ? ch : '▒░▓'.charAt(Math.floor(rnd(seed + 7, i) * 3))).join('');
  }

  $$('[data-module]').forEach((el, mi) => {
    const body = $('[data-body]', el);
    const m = {
      el, body,
      texts: $$('[data-corrupt]', el).map((n, i) => ({ n, src: n.textContent.trim(), seed: 11 + mi * 97 + i * 13 })),
      heading: $('h2', el), btn: $('[data-fix]', el), chip: $('[data-chip]', el),
      bar: $('[data-bar]', el), nudge: $('[data-nudge]', el),
      p: 0, status: 'broken', holding: false, auto: false, nudged: false, iv: null, t: 0, lastEnd: 0
    };
    order.push(m);
    bindHold(m);
  });

  function renderTotals() {
    fixedCountEl.textContent = order.filter(m => m.status === 'fixed').length;
    totalBar.style.width = Math.round(order.reduce((sum, m) => sum + m.p, 0) / order.length) + '%';
    fixAllBtn.hidden = !order.some(m => m.status !== 'fixed' && !m.auto);
  }

  function renderMod(m) {
    const fixed = m.status === 'fixed';
    const p = Math.round(m.p);
    const level = fixed ? 0 : 0.62 * (1 - m.p / 100);
    m.texts.forEach(text => {
      const value = corrupt(text.src, level, text.seed);
      if (text.n.textContent !== value) text.n.textContent = value;
    });
    m.el.classList.toggle('is-live', m.p > 0);
    m.el.classList.toggle('is-fixed', fixed);
    m.bar.style.width = p + '%';
    m.chip.textContent = fixed ? '복구됨' : m.holding || m.auto ? '복구 중 ' + p + '%' : p > 0 ? '멈춤 ' + p + '%' : '손상됨';
    m.btn.textContent = m.holding ? '복구 중…' : p > 0 ? '계속 누르기' : '길게 눌러 복구';
    m.btn.classList.toggle('holding', m.holding);
    m.btn.hidden = fixed || m.auto;
    m.nudge.hidden = !(m.nudged && !fixed);
    m.body.inert = !fixed;
    if (fixed) m.body.removeAttribute('aria-hidden');
    else m.body.setAttribute('aria-hidden', 'true');
    renderTotals();
  }

  const isHoldKey = event => event.key === ' ' || event.key === 'Enter' || event.key === 'Spacebar';
  function bindHold(m) {
    m.btn.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      holdStart(m, event);
    });
    ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture', 'blur'].forEach(type => m.btn.addEventListener(type, () => holdEnd(m)));
    m.btn.addEventListener('keydown', event => {
      if (!isHoldKey(event)) return;
      event.preventDefault();
      if (!event.repeat) holdStart(m);
    });
    m.btn.addEventListener('keyup', event => {
      if (!isHoldKey(event)) return;
      event.preventDefault();
      holdEnd(m);
    });
    m.btn.addEventListener('click', () => {
      if (!m.iv && !m.auto && Date.now() - m.lastEnd > 400) advance(m, 25);
    });
    m.btn.addEventListener('contextmenu', event => event.preventDefault());
  }

  function holdStart(m, event) {
    if (!active || m.status === 'fixed' || m.auto || m.iv) return;
    if (event?.pointerId != null) m.btn.setPointerCapture(event.pointerId);
    m.t = Date.now();
    m.holding = true;
    m.status = 'fixing';
    m.iv = every(() => advance(m, 2.4), 40);
    renderMod(m);
  }

  function holdEnd(m) {
    if (!m.iv || m.auto) return;
    stopInterval(m.iv);
    m.iv = null;
    m.lastEnd = Date.now();
    if (m.status === 'fixed') return;
    m.holding = false;
    m.status = 'broken';
    if (Date.now() - m.t < 220) { m.nudged = true; advance(m, 10); return; }
    renderMod(m);
  }

  function advance(m, amount) {
    if (!active || m.status === 'fixed') return;
    m.p = Math.min(100, m.p + amount);
    if (m.p >= 100) {
      stopInterval(m.iv);
      m.iv = null;
      finishMod(m);
    } else renderMod(m);
  }

  function finishMod(m) {
    const hadFocus = document.activeElement === m.btn;
    m.status = 'fixed';
    m.p = 100;
    m.holding = false;
    m.auto = false;
    m.nudged = false;
    renderMod(m);
    if (hadFocus) (order.find(other => other.status !== 'fixed' && !other.auto)?.btn || m.heading).focus({ preventScroll: true });
    if (!completed && order.every(other => other.status === 'fixed')) {
      completed = true;
      store.set();
      later(complete, 650);
    }
  }

  function fixAll() {
    order.forEach((m, i) => {
      if (m.status === 'fixed' || m.auto) return;
      stopInterval(m.iv);
      m.iv = null;
      m.auto = true;
      m.holding = false;
      m.status = 'fixing';
      renderMod(m);
      later(() => { m.iv = every(() => advance(m, 3.2), 40); }, i * 220);
    });
  }

  function renderDone() {
    doneText.textContent = counting ? count + '초 뒤 소개로 이동합니다.' : stayed ? '천천히 둘러보세요. 준비되면 다시 시작을 누르세요.' : '다시 시작할 준비가 됐습니다.';
    stayBtn.hidden = !counting;
  }

  function complete() {
    const seconds = t0 ? Math.round((Date.now() - t0) / 1000) : 0;
    $('[data-recover-time]').textContent = seconds < 60 ? seconds + '초' : Math.floor(seconds / 60) + '분 ' + seconds % 60 + '초';
    setPhase('done');
    doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (intro.contains(document.activeElement)) $('[data-action="restart"]').focus({ preventScroll: true });
    count = 5;
    counting = true;
    stayed = false;
    renderDone();
    stopInterval(countdownTimer);
    countdownTimer = every(() => {
      count -= 1;
      if (count <= 0) { stopInterval(countdownTimer); counting = false; restart(); }
      else renderDone();
    }, 1000);
  }

  function stay() {
    stopInterval(countdownTimer);
    counting = false;
    stayed = true;
    renderDone();
  }

  function restart() {
    if (phase === 'restart') return;
    stopInterval(countdownTimer);
    counting = false;
    setPhase('restart');
    window.scrollTo({ top: 0, behavior: 'instant' });
    let n = 0;
    const timer = every(() => {
      n = Math.min(100, n + 4 + Math.floor(Math.random() * 6));
      $('[data-restart-bar]').style.width = n + '%';
      $('[data-restart-text]').textContent = '블로그를 다시 시작하는 중 · ' + n + '%';
      if (n === 100) { stopInterval(timer); showIntroduction(); }
    }, 60);
  }

  function startIntro() {
    if (reduced.matches) { showIntroduction(); return; }
    clearTimers();
    returning = store.get();
    completed = false;
    counting = false;
    stayed = false;
    t0 = 0;
    count = 0;
    order.forEach(m => {
      Object.assign(m, { p: 0, status: 'broken', holding: false, auto: false, nudged: false, t: 0, lastEnd: 0 });
      renderMod(m);
    });
    $$('[data-stall]').forEach(box => { box.hidden = true; });
    $('[data-boot-pct]').textContent = '0';
    $('[data-crash-pct]').textContent = '0';
    $('[data-boot-bar]').style.width = '0%';
    $('[data-restart-bar]').style.width = '0%';
    $('[data-restart-text]').textContent = '블로그를 다시 시작하는 중 · 0%';
    $('[data-stop-code]').textContent = returning ? 'VISITOR_IS_BACK' : 'VISITOR_DOES_NOT_KNOW_ME';
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

  intro.addEventListener('click', async event => {
    if (!active) return;
    const link = event.target.closest('[data-home]');
    if (link) { event.preventDefault(); showIntroduction(); return; }
    const email = event.target.closest('[data-copy-email]');
    if (email) {
      try {
        await navigator.clipboard.writeText(email.dataset.copyEmail);
        phaseStatus.textContent = '이메일 주소를 복사했습니다.';
      } catch { phaseStatus.textContent = '이메일 주소를 복사하지 못했습니다. ' + email.dataset.copyEmail; }
      return;
    }
    const action = event.target.closest('[data-action]')?.dataset.action;
    if (action === 'recover') startRecover();
    else if (action === 'fix-all') fixAll();
    else if (action === 'restart') restart();
    else if (action === 'stay') stay();
  });
  const stopHolding = () => order.forEach(holdEnd);
  window.addEventListener('blur', stopHolding);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopHolding(); });
  window.addEventListener('pagehide', () => { active = false; clearTimers(); });
  window.addEventListener('pageshow', event => { if (event.persisted && !intro.hidden) showIntroduction(); });
  window.addEventListener('hashchange', () => { if (active && location.hash === '#introduction') showIntroduction(); });
  reduced.addEventListener('change', event => { if (event.matches && active) showIntroduction(); });
  const replay = document.getElementById('replay-intro');
  replay?.addEventListener('click', startIntro);
  if (replay) replay.hidden = false;
  if (!reduced.matches) {
    if (store.get()) showIntroduction();
    else startIntro();
  }
})();
