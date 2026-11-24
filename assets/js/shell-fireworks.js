(function () {
  'use strict';

  const canvas = document.getElementById('shell-fireworks');
  if (!canvas) return;
  const duration = 3000;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let show = null;
  let timer = 0;

  function stop() {
    clearTimeout(timer);
    timer = 0;
    if (show) {
      show.stop();
      show = null;
      canvas.hidden = true;
      canvas.width = canvas.height = 0;
    }
  }

  function start() {
    stop();
    if (document.hidden) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const deadline = performance.now() + duration;
    canvas.hidden = false;
    show = createShow(ctx, deadline);
    timer = setTimeout(stop, Math.max(0, deadline - performance.now()));
    show.play();
  }

  window.kiukFireworks = { start, stop };
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  motionPreference.addEventListener('change', stop);
  window.addEventListener('resize', () => show?.resize());

  function createShow(ctx, deadline) {
    const MESSAGE = 'WELCOME';   // 글자 폭죽 문구. 한글도 됩니다
    const FADE = 9;              // 꼬리가 사라지는 속도. 작을수록 꼬리가 길어집니다

    const TAU = Math.PI * 2;
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = (list) => list[(Math.random() * list.length) | 0];
    const media = (q) => !!window.matchMedia && window.matchMedia(q).matches;

    const MAX_PARTS = media('(pointer: coarse)') ? 1500 : 3200;
    let W = 0;
    let H = 0;
    let S = 1;          // 화면 크기에 맞춘 크기 배율
    let quality = 1;    // 프레임이 느려지면 자동으로 낮아지는 입자 수 배율
    const N = (n) => Math.max(6, (n * quality) | 0);

    let textCache = {};

    function resize() {
      // 고해상도 화면에서도 캔버스는 1배로 둡니다. 픽셀 수가 4배가 되면 매 프레임 지우고 합성하는 비용도 4배가 됩니다.
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
      S = Math.max(0.55, Math.min(1.4, Math.min(W, H) / 800));
      textCache = {};
    }

    /* ===== 그리기 묶음 =====
       입자를 하나씩 그리면 한 프레임에 stroke 를 수천 번 호출하게 됩니다.
       색상 36단계 × 밝기 4단계 × 투명도 4단계 × 굵기 3단계로 묶어, 묶음마다 한 번만 그립니다. */
    const HUES = 36;
    const LUMS = [60, 72, 84, 96];
    const SIZES = [1.4, 2.1, 2.9];
    const BUCKETS = HUES * 4 * 4 * 3;
    const segs = [];                        // 묶음별 선분 좌표 [x1, y1, x2, y2, ...]
    const segLen = new Int32Array(BUCKETS);
    const active = [];                      // 이번 프레임에 쓰인 묶음 번호
    const strokeColors = [];
    for (let i = 0; i < BUCKETS; i++) segs.push([]);
    for (let h = 0; h < HUES; h++) {
      for (let l = 0; l < 4; l++) strokeColors.push('hsl(' + (h * 10 + 5) + ',100%,' + LUMS[l] + '%)');
    }

    /* ===== 입자 ===== */
    const parts = [];
    const pool = [];
    const flashes = [];

    function emit(x, y, vx, vy, o) {
      if (parts.length >= MAX_PARTS) return null;
      const p = pool.pop() || {};
      p.x = x; p.y = y; p.px = x; p.py = y;
      p.vx = vx; p.vy = vy;
      p.age = 0;
      p.ttl = o.ttl * (0.75 + Math.random() * 0.5);
      p.hue = o.hue;
      p.dh = o.dh || 0;                                      // 초당 색상 변화
      p.lum = o.lum || 60;                                   // 밝기
      p.white = o.white === undefined ? 0.18 : o.white;      // 수명 초반에 흰빛으로 타는 구간
      p.size = o.size || 1.8;
      p.drag = o.drag === undefined ? 1.8 : o.drag;
      p.grav = o.grav === undefined ? 65 : o.grav;
      p.twinkle = o.twinkle || 0;                            // 깜빡일 확률
      p.trail = o.trail || 0;                                // 초당 꼬리 불티 수
      p.trailHue = o.trailHue === undefined ? -1 : o.trailHue;
      p.trailAcc = 0;
      p.split = o.split || 0;                                // 이 나이에 네 갈래로 갈라집니다
      p.crackle = o.crackle || 0;                            // 수명이 끝날 때 튀는 불티 수
      p.rocket = null;
      parts.push(p);
      return p;
    }

    // 꼬리 불티
    function spark(p) {
      if (parts.length > MAX_PARTS * 0.8) return;
      emit(p.x, p.y, p.vx * 0.15 + rand(-18, 18), p.vy * 0.15 + rand(-18, 18), {
        hue: p.trailHue < 0 ? p.hue : p.trailHue, lum: 70, ttl: 0.4, drag: 2.5, grav: 60,
        size: Math.max(1, p.size * 0.55), twinkle: 0.35, white: 0
      });
    }

    function splitCross(p) {
      const base = Math.atan2(p.vy, p.vx) + Math.PI / 4;
      for (let k = 0; k < 4; k++) {
        const a = base + k * Math.PI / 2;
        emit(p.x, p.y, Math.cos(a) * 170 * S, Math.sin(a) * 170 * S, { hue: p.hue + 35, ttl: 0.8, drag: 2, grav: 60, size: 2 });
      }
    }

    function crackleEnd(p) {
      for (let k = 0; k < p.crackle; k++) {
        const a = rand(0, TAU);
        const s = rand(50, 170) * S;
        emit(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, { hue: 46, lum: 86, ttl: 0.32, drag: 3, grav: 40, size: 1.5, twinkle: 0.5, white: 0 });
      }
    }

    /* ===== 터지는 모양 ===== */
    // 공 모양으로 퍼지는 기본 폭발 (구를 평면에 비춘 분포라 가장자리가 촘촘합니다)
    function sphere(x, y, n, speed, o, jitter) {
      for (let i = 0; i < n; i++) {
        const z = Math.random() * 2 - 1;
        const r = Math.sqrt(1 - z * z);
        const a = Math.random() * TAU;
        const s = speed * (1 - (jitter || 0) * Math.random());
        if (!emit(x, y, Math.cos(a) * r * s, Math.sin(a) * r * s, o)) return;
      }
    }

    // 점 목록 모양으로 펼쳐져 멈추는 폭발. 초기 속도 = 목표 거리 × 감속 계수이면 목표 위치에서 멈춥니다.
    function shape(x, y, pts, o) {
      const k = 3.4;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        emit(x, y, pt[0] * k, pt[1] * k, { hue: pt[2], lum: 62, ttl: o.ttl, drag: k, grav: 6, size: o.size, twinkle: o.twinkle, white: 0.1 });
      }
    }

    // 글자를 보이지 않는 캔버스에 그린 뒤 픽셀을 골라 점 목록으로 만듭니다.
    function textPoints(str) {
      if (textCache[str]) return textCache[str];
      const size = Math.max(28, Math.min(W * 0.9 / (str.length * 0.68), H * 0.22, 190));
      const font = '900 ' + size + 'px system-ui, -apple-system, "Segoe UI", "Noto Sans KR", sans-serif';
      const off = document.createElement('canvas');
      const octx = off.getContext('2d');
      octx.font = font;
      off.width = Math.ceil(octx.measureText(str).width) + 8;
      off.height = Math.ceil(size * 1.3);
      octx.font = font;
      octx.textBaseline = 'middle';
      octx.fillStyle = '#fff';
      octx.fillText(str, 4, off.height / 2);
      const data = octx.getImageData(0, 0, off.width, off.height).data;
      const budget = Math.max(220, (520 * quality) | 0);
      let gap = Math.max(3, Math.round(size / 22));
      let pts = [];
      for (;;) {
        pts = [];
        for (let y = 0; y < off.height; y += gap) {
          for (let x = 0; x < off.width; x += gap) {
            if (data[(y * off.width + x) * 4 + 3] > 128) pts.push([x - off.width / 2, y - off.height / 2]);
          }
        }
        if (pts.length <= budget) break;
        gap += 1;
      }
      textCache[str] = { pts: pts, width: off.width };
      return textCache[str];
    }

    const SHELLS = {
      // 둥근 꽃 + 다른 색 속심
      peony(x, y, hue) {
        const inner = hue + pick([0, 40, 160, 200]);
        sphere(x, y, N(100), 330 * S, { hue: hue, ttl: 1.5, drag: 1.9, grav: 65, size: 2 }, 0.12);
        sphere(x, y, N(36), 150 * S, { hue: inner, lum: 70, ttl: 1.2, drag: 1.9, grav: 65, size: 1.8 }, 0.3);
      },
      // 꼬리가 남고 색이 변하는 국화
      chrysanthemum(x, y, hue) {
        sphere(x, y, N(70), 340 * S, { hue: hue, dh: pick([0, 0, 50, -50]), ttl: 1.9, drag: 1.7, grav: 70, size: 2, trail: 12 }, 0.1);
      },
      // 기울어진 이중 고리
      ring(x, y, hue) {
        const tilt = rand(0, TAU);
        const squash = rand(0.35, 1);
        const cos = Math.cos(tilt);
        const sin = Math.sin(tilt);
        [[1, hue], [0.6, hue + 150]].forEach((layer) => {
          const n = N(46 * layer[0] + 12);
          const s = 300 * S * layer[0];
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            const ux = Math.cos(a);
            const uy = Math.sin(a) * squash;
            emit(x, y, (ux * cos - uy * sin) * s, (ux * sin + uy * cos) * s, { hue: layer[1], ttl: 1.5, drag: 1.8, grav: 55, size: 2.2 });
          }
        });
        sphere(x, y, N(18), 90 * S, { hue: 45, lum: 80, ttl: 0.9, drag: 2.2, grav: 60, size: 1.5, twinkle: 0.4 }, 0.5);
      },
      // 금빛 줄기가 길게 늘어지는 버들
      willow(x, y) {
        sphere(x, y, N(56), 300 * S, { hue: 42, lum: 62, white: 0.08, ttl: 3.2, drag: 1.25, grav: 105, size: 1.8, trail: 13, trailHue: 38 }, 0.25);
      },
      // 굵은 금빛 가지가 뻗는 야자수
      palm(x, y, hue) {
        const n = 12;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + rand(-0.15, 0.15);
          const s = rand(300, 380) * S;
          emit(x, y, Math.cos(a) * s, Math.sin(a) * s - 60 * S, { hue: 40, lum: 65, ttl: 2.2, drag: 1.5, grav: 120, size: 3, trail: 32, trailHue: 36 });
        }
        sphere(x, y, N(32), 140 * S, { hue: hue, ttl: 1, drag: 2.2, grav: 50, size: 1.8 }, 0.4);
      },
      // 날아가다 네 갈래로 다시 터지는 십자
      crossette(x, y, hue) {
        const n = N(20);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + rand(-0.1, 0.1);
          const s = rand(260, 320) * S;
          emit(x, y, Math.cos(a) * s, Math.sin(a) * s, { hue: hue, ttl: 1.4, drag: 1.7, grav: 50, size: 2.4, split: rand(0.45, 0.6), trail: 8 });
        }
      },
      // 끝에서 불티가 튀는 폭발
      crackle(x, y, hue) {
        sphere(x, y, N(80), 310 * S, { hue: hue, ttl: 1.3, drag: 1.9, grav: 70, size: 2, crackle: 2 }, 0.15);
      },
      // 공중에 떠서 깜빡이는 별무리
      strobe(x, y, hue) {
        sphere(x, y, N(60), 240 * S, { hue: hue, lum: 88, white: 0, ttl: 2.6, drag: 2.4, grav: 28, size: 2.2, twinkle: 0.55 }, 0.5);
      },
      heart(x, y) {
        const R = 150 * S;
        const n = N(64);
        const pts = [];
        for (let i = 0; i < n; i++) {
          const t = (i / n) * TAU;
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
          pts.push([hx * R / 17, hy * R / 17, 345]);
          if (i % 2 === 0) pts.push([hx * R / 30, hy * R / 30, 20]);
        }
        shape(x, y, pts, { ttl: 2.2, size: 2.6, twinkle: 0.1 });
      },
      star(x, y, hue) {
        const R = 160 * S;
        const rot = rand(-0.3, 0.3) - Math.PI / 2;
        const per = Math.max(4, N(8));
        const pts = [];
        for (let v = 0; v < 10; v++) {
          const a1 = rot + v * Math.PI / 5;
          const a2 = rot + (v + 1) * Math.PI / 5;
          const r1 = v % 2 ? R * 0.42 : R;
          const r2 = v % 2 ? R : R * 0.42;
          for (let k = 0; k < per; k++) {
            const f = k / per;
            pts.push([Math.cos(a1) * r1 * (1 - f) + Math.cos(a2) * r2 * f, Math.sin(a1) * r1 * (1 - f) + Math.sin(a2) * r2 * f, hue]);
          }
        }
        shape(x, y, pts, { ttl: 2.2, size: 2.6, twinkle: 0.1 });
        sphere(x, y, N(22), 120 * S, { hue: 48, lum: 85, white: 0, ttl: 0.9, drag: 2.4, grav: 40, size: 1.5, twinkle: 0.45 }, 0.6);
      },
      // 글자 모양. 가로 방향으로 색이 이어집니다
      text(x, y, hue, str) {
        const t = textPoints(str || MESSAGE);
        const pts = t.pts.map((pt) => [pt[0], pt[1], hue + (pt[0] / t.width + 0.5) * 140]);
        shape(x, y, pts, { ttl: 3, size: 2.4, twinkle: 0.12 });
        sphere(x, y, N(36), 380 * S, { hue: 45, lum: 80, ttl: 1, drag: 2, grav: 60, size: 1.5, twinkle: 0.4 }, 0.4);
      }
    };

    const BAG = ['peony', 'peony', 'peony', 'chrysanthemum', 'chrysanthemum', 'chrysanthemum', 'crackle', 'crackle', 'ring', 'ring',
      'willow', 'willow', 'palm', 'palm', 'crossette', 'crossette', 'strobe', 'heart', 'star'];
    const randomType = () => pick(BAG);
    const randomHue = () => pick([rand(0, 360), rand(0, 360), rand(0, 360), 30, 212]);

    /* ===== 발사 ===== */
    // 화면 아래에서 (tx, ty) 까지 올라가 그 자리에서 터집니다. 도착 순간 속도가 0 이 되도록 감속합니다.
    function launch(tx, ty, type, hue, arg) {
      if (tx === undefined) tx = rand(0.15, 0.85) * W;
      if (ty === undefined) ty = rand(0.15, 0.45) * H;
      if (!SHELLS[type]) type = randomType();
      if (hue === undefined) hue = randomHue();
      const x0 = Math.max(W * 0.04, Math.min(W * 0.96, tx + rand(-70, 70) * S));
      const y0 = H + 8;
      const D = Math.max(40, y0 - ty);
      const T = 0.65 + 0.55 * (D / H);
      const p = emit(x0, y0, (tx - x0) / T, -2 * D / T, {
        hue: 38, lum: 82, white: 0, ttl: T + 1, drag: 0, grav: 2 * D / (T * T), size: 2.6, trail: 40, trailHue: 34
      });
      if (p) {
        p.ttl = T + 1;
        p.rocket = { T: T, type: type, hue: hue, arg: arg };
      }
    }

    function burst(p) {
      const r = p.rocket;
      flashes.push({ x: p.x, y: p.y, r: 190 * S, hue: r.hue, age: 0, ttl: 0.4 });
      SHELLS[r.type](p.x, p.y, r.hue, r.arg);
    }

    function step(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        p.px = p.x;
        p.py = p.y;
        const d = Math.exp(-p.drag * dt);
        p.vx *= d;
        p.vy = p.vy * d + p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.hue += p.dh * dt;

        if (p.trail) {
          p.trailAcc += p.trail * quality * dt;
          while (p.trailAcc >= 1) { p.trailAcc -= 1; spark(p); }
        }

        let dead = p.age >= p.ttl || p.y > H + 60;
        if (p.rocket && p.age >= p.rocket.T) { burst(p); dead = true; }
        else if (p.split && p.age >= p.split) { splitCross(p); dead = true; }
        else if (dead && p.crackle && p.y < H) crackleEnd(p);

        if (dead) {
          const tail = parts.pop();
          if (tail !== p) parts[i] = tail;
          pool.push(p);
        }
      }
    }

    function draw(dt) {
      // 이전 프레임을 조금씩 지워 꼬리를 남깁니다. 배경은 투명하게 유지됩니다.
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1 - Math.exp(-FADE * dt);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);

      // 겹칠수록 밝아지게 그립니다.
      ctx.globalCompositeOperation = 'lighter';

      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        f.age += dt;
        const t = f.age / f.ttl;
        if (t >= 1) { flashes.splice(i, 1); continue; }
        const r = f.r * (0.45 + 0.55 * t);
        const h = ((f.hue % 360) + 360) % 360 | 0;
        const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        g.addColorStop(0, 'hsla(' + h + ',100%,90%,' + (0.3 * (1 - t)).toFixed(3) + ')');
        g.addColorStop(0.35, 'hsla(' + h + ',100%,62%,' + (0.1 * (1 - t)).toFixed(3) + ')');
        g.addColorStop(1, 'hsla(' + h + ',100%,50%,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, TAU);
        ctx.fill();
      }

      // 1) 입자를 묶음에 나눠 담습니다.
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (p.twinkle && Math.random() < p.twinkle) continue;   // 깜빡임: 이번 프레임은 건너뜁니다
        const t = p.age / p.ttl;
        let a = t < 0.65 ? 1 : (1 - t) / 0.35;
        // 거의 멈춘 입자는 같은 자리에 계속 덧그려지므로 밝기를 낮춥니다.
        const still = Math.abs(p.x - p.px) + Math.abs(p.y - p.py) < 0.6;
        if (still) a *= 0.2;
        if (a <= 0.01) continue;
        const l = t < p.white ? 96 - (96 - p.lum) * (t / p.white) : p.lum;
        const hb = (((p.hue % 360) + 360) % 360 / 10) | 0;
        const lb = l < 66 ? 0 : l < 78 ? 1 : l < 90 ? 2 : 3;
        const ab = a >= 1 ? 3 : (a * 4) | 0;
        const sb = p.size < 1.7 ? 0 : p.size < 2.5 ? 1 : 2;
        const key = ((hb * 4 + lb) * 4 + ab) * 3 + sb;
        const list = segs[key];
        let n = segLen[key];
        if (n === 0) active.push(key);
        if (still) {
          // 선 끝을 둥글게 하지 않으므로, 멈춘 입자는 굵기만큼의 짧은 선으로 점을 찍습니다.
          const half = SIZES[sb] / 2;
          list[n++] = p.x - half; list[n++] = p.y; list[n++] = p.x + half; list[n++] = p.y;
        } else {
          list[n++] = p.px; list[n++] = p.py; list[n++] = p.x; list[n++] = p.y;
        }
        segLen[key] = n;
      }

      // 2) 묶음마다 한 번씩만 그립니다.
      for (let k = 0; k < active.length; k++) {
        const key = active[k];
        const list = segs[key];
        const n = segLen[key];
        ctx.globalAlpha = ((((key / 3) | 0) % 4) + 1) / 4;
        ctx.strokeStyle = strokeColors[(key / 12) | 0];
        ctx.lineWidth = SIZES[key % 3];
        ctx.beginPath();
        for (let j = 0; j < n; j += 4) {
          ctx.moveTo(list[j], list[j + 1]);
          ctx.lineTo(list[j + 2], list[j + 3]);
        }
        ctx.stroke();
        segLen[key] = 0;
      }
      active.length = 0;
    }


    let raf = 0;
    let lastFrame = 0;
    let smooth = 0.016;
    let shots = [];

    function play() {
      resize();
      if (motionPreference.matches) {
        SHELLS.text(W * 0.5, H * 0.36, randomHue(), MESSAGE);
        for (let i = 0; i < 35; i++) step(0.025);
        draw(0.016);
        return;
      }
      const started = deadline - duration;
      const count = W < 600 ? 3 : 5;
      const type = pick(['peony', 'chrysanthemum', 'ring', 'crackle', 'crossette']);
      const hue = rand(0, 360);
      const reverse = Math.random() < 0.5;
      launch(W * 0.5, H * 0.36, 'text', randomHue(), MESSAGE);
      for (let i = 0; i < count; i++) {
        const f = ((reverse ? count - 1 - i : i) + 0.5) / count;
        shots.push({ time: started + 120 + i * 130, fire: () =>
          launch(W * (0.1 + 0.8 * f), H * (0.34 - 0.14 * Math.sin(f * Math.PI)), type, hue + f * 300) });
      }
      shots.push({ time: started + 1250, fire: () => launch() });
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function frame(now) {
      if (now >= deadline) { stop(); return; }
      if (now - lastFrame >= 12) {
        const elapsed = (now - lastFrame) / 1000;
        const dt = Math.min(elapsed, 0.05);
        lastFrame = now;
        while (shots.length && shots[0].time <= now) shots.shift().fire();
        step(dt);
        draw(dt);
        smooth += (Math.min(elapsed, 0.1) - smooth) * 0.1;
        if (smooth > 0.021) quality = Math.max(0.3, quality - 0.04);
        else if (smooth < 0.018) quality = Math.min(1, quality + 0.01);
      }
      raf = requestAnimationFrame(frame);
    }

    return { play, resize, stop: () => cancelAnimationFrame(raf) };
  }
})();
