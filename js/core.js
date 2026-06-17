const Core = (() => {
  const AS = {
    bg: "fundo-game.png",
    idle: "personagem-parado.png",
    walk: "personagem-andando.png",
    walk2: "personagem-andando-2.png",
    girl: "assets/sprites/garotinha.png",
    cat: "assets/sprites/gato.png",
    bush: "assets/sprites/arbusto-pequeno.png",
    bushBig: "assets/sprites/arbustos.png",
    vovo: "assets/sprites/vovo.png",
    kite: "assets/Kitesurf.png",
    church: "assets/igreja.png"
  };

  function $(s) {
    return document.querySelector(s);
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function rnd(a, b) {
    return a + Math.random() * (b - a);
  }

  function dist(a, b) {
    return Math.abs(a - b);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[ch]));
  }

  function loadImages(map = AS) {
    const out = {};
    const entries = Object.entries(map);

    return Promise.all(entries.map(([k, src]) => new Promise((res) => {
      const img = new Image();
      img.onload = () => res();
      img.onerror = () => res();
      img.src = src;
      out[k] = img;
    }))).then(() => out);
  }

  function setupCanvas(id = 'game', opts = {}) {
    const canvas = document.getElementById(id);
    const ctx = canvas.getContext('2d', { alpha: false });

    function resize() {
      const lightMode =
        document.body.classList.contains('mission-rio') ||
        document.body.classList.contains('mission-final') ||
        innerWidth <= 900;

      const defaultCap = lightMode ? 1 : 1.35;
      const cap = opts.pixelRatioCap ?? defaultCap;
      const dpr = Math.min(cap, window.devicePixelRatio || 1);

      canvas.width = Math.floor(innerWidth * dpr);
      canvas.height = Math.floor(innerHeight * dpr);
      canvas.style.width = innerWidth + 'px';
      canvas.style.height = innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
    }

    addEventListener('resize', resize);
    resize();

    return { canvas, ctx, w: () => innerWidth, h: () => innerHeight };
  }

  function round(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function rect(ctx, x, y, w, h, r, fill, stroke) {
    round(ctx, x, y, w, h, r);

    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }

    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function text(ctx, txt, x, y, size = 24, color = '#fff', align = 'left', weight = 800) {
    ctx.save();
    ctx.font = `${weight} ${size}px Inter, Arial`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, x, y);
    ctx.restore();
  }

  function wrap(ctx, str, x, y, maxWidth, lineH, size = 22, color = '#fff') {
    ctx.save();
    ctx.font = `800 ${size}px Inter, Arial`;
    ctx.fillStyle = color;

    let line = '';
    let cy = y;

    for (const word of String(str).split(' ')) {
      const test = line + word + ' ';

      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, cy);
        line = word + ' ';
        cy += lineH;
      } else {
        line = test;
      }
    }

    ctx.fillText(line, x, cy);
    ctx.restore();

    return cy + lineH;
  }

  function drawButton(ctx, b, label, enabled = true) {
    rect(
      ctx,
      b.x,
      b.y,
      b.w,
      b.h,
      18,
      enabled ? '#84cc16' : 'rgba(255,255,255,.2)',
      'rgba(255,255,255,.35)'
    );

    text(ctx, label, b.x + b.w / 2, b.y + b.h / 2, 18, enabled ? '#052e16' : '#ddd', 'center', 950);
  }

  function drawDialog(ctx, message, canvasW, canvasH, opts = {}) {
    const maxW = Math.min(opts.maxWidth ?? 620, canvasW - 32);
    const x = opts.x ?? 16;
    const y = opts.y ?? 82;
    const h = opts.height ?? 64;
    const prompt = opts.prompt || '';

    ctx.save();
    rect(ctx, x, y, maxW, h, 18, 'rgba(3,8,6,.68)', 'rgba(190,242,100,.30)');
    wrap(ctx, message, x + 16, y + 24, maxW - 32, 20, opts.size ?? 16, '#f7fee7');

    if (prompt) {
      text(ctx, prompt, x + 16, y + h - 14, 13, '#bbf7d0', 'left', 900);
    }

    ctx.restore();
  }

  function input() {
    const keys = {};
    const touch = { left: false, right: false, jump: false, action: false };

    addEventListener('keydown', (e) => {
      keys[e.key] = true;

      if (['ArrowUp', ' ', 'w', 'W'].includes(e.key)) {
        e.preventDefault();
      }
    });

    addEventListener('keyup', (e) => {
      keys[e.key] = false;
    });

    document.querySelectorAll('[data-hold]').forEach((btn) => {
      const k = btn.dataset.hold;

      const on = (e) => {
        e.preventDefault();
        touch[k] = true;
      };

      const off = (e) => {
        e.preventDefault();
        touch[k] = false;
      };

      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('pointerleave', off);
    });

    document.querySelectorAll('[data-tap]').forEach((btn) => {
      const k = btn.dataset.tap;

      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        touch[k] = true;
        setTimeout(() => {
          touch[k] = false;
        }, 120);
      });
    });

    return {
      keys,
      touch,
      left() {
        return keys.ArrowLeft || keys.a || keys.A || touch.left;
      },
      right() {
        return keys.ArrowRight || keys.d || keys.D || touch.right;
      },
      jump() {
        return keys.ArrowUp || keys.w || keys.W || keys[' '] || touch.jump;
      },
      action() {
        return keys.e || keys.E || keys.Enter || touch.action;
      },
      clearAction() {
        keys.e = false;
        keys.E = false;
        keys.Enter = false;
        touch.action = false;
      }
    };
  }

  function save(k, v) {
    localStorage.setItem('greengo_' + k, JSON.stringify(v));
  }

  function get(k, d = null) {
    try {
      const value = JSON.parse(localStorage.getItem('greengo_' + k));
      return value ?? d;
    } catch {
      return d;
    }
  }

  function transition(url) {
    const f = document.querySelector('.fade');

    if (f) {
      f.classList.add('active');
    }

    setTimeout(() => {
      location.href = url;
    }, 330);
  }

  function drawWorld(ctx, img, camera, w, h, worldW) {
    ctx.save();

    ctx.fillStyle = '#072217';
    ctx.fillRect(0, 0, w, h);

    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#7dd3fc');
    g.addColorStop(.44, '#bef264');
    g.addColorStop(.46, '#67e8f9');
    g.addColorStop(1, '#14532d');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (img && img.complete && img.naturalWidth > 0) {
      const scale = Math.max(h / img.height, w / img.width);
      const iw = img.width * scale;
      const ih = img.height * scale;

      for (let x = -camera % iw - iw; x < w + iw; x += iw) {
        ctx.drawImage(img, x, 0, iw, ih);
      }
    }

    ctx.fillStyle = 'rgba(5,46,22,.72)';
    ctx.fillRect(0, h - 105, w, 105);

    ctx.fillStyle = 'rgba(236,252,203,.35)';
    for (let x = -camera % 160; x < w; x += 160) {
      ctx.fillRect(x, h - 104, 90, 6);
    }

    ctx.restore();
  }

  function playerDraw(ctx, p, img, idle, opts = {}) {
    ctx.save();

    const drawX = Number.isFinite(p.screenX) ? p.screenX : p.x;
    const moving = Math.abs(p.vx || 0) + Math.abs(p.vy || 0) > 0.18;
    const canBob = moving && p.ground !== false;
    const bob = canBob ? Math.sin((p.walkAnim || 0) * Math.PI) * (opts.bob ?? 2.5) : 0;
    const squash = canBob ? 1 + Math.sin((p.walkAnim || 0) * Math.PI * 2) * 0.012 : 1;

    ctx.translate(drawX + p.w / 2, p.y + p.h / 2 + bob);
    ctx.scale(p.face, squash);

    let im = null;
    if (Array.isArray(img)) {
      const frames = img.filter((frame) => frame && frame.complete && frame.naturalWidth > 0);
      if (frames.length) {
        im = frames[Math.floor((p.walkAnim || 0)) % frames.length];
      }
    } else {
      im = img && img.complete && img.naturalWidth > 0 ? img : null;
    }

    if (!im && idle && idle.complete && idle.naturalWidth > 0) {
      im = idle;
    }

    if (opts.shadow !== false) {
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#052e16';
      ctx.beginPath();
      ctx.ellipse(0, p.h / 2 - 6 - bob, p.w * 0.28, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (im) {
      ctx.drawImage(im, -p.w / 2, -p.h / 2, p.w, p.h);
    } else {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    }

    ctx.restore();
  }

  function makePlayer(x = 150) {
    return {
      x,
      y: 0,
      w: 118,
      h: 132,
      vx: 0,
      vy: 0,
      face: 1,
      speed: 5.2,
      jump: -15,
      ground: false,
      life: 3,
      score: 0,
      inv: 0
    };
  }

  function physics(p, ground, worldW) {
    p.vy += .72;

    if (p.vy > 18) {
      p.vy = 18;
    }

    const walking = Math.abs(p.vx) > 0.15;
    if (walking) {
      p.walkAnim = (p.walkAnim || 0) + Math.max(0.12, Math.abs(p.vx) * 0.035);
    } else {
      p.walkAnim = 0;
    }

    p.x += p.vx;
    p.y += p.vy;
    p.x = clamp(p.x, 0, worldW - p.w);

    if (p.y + p.h >= ground) {
      p.y = ground - p.h;
      p.vy = 0;
      p.ground = true;
    } else {
      p.ground = false;
    }

    if (p.inv > 0) {
      p.inv--;
    }
  }

  function cameraFollow(cam, target, w, worldW) {
    const desired = clamp(target.x - w * .42, 0, Math.max(0, worldW - w));
    cam.x = lerp(cam.x, desired, .08);
  }

  function hud(title, subtitle, life = 3, score = 0) {
    const ui = document.querySelector('#hudText');
    const hs = document.querySelector('#hudStats');

    if (ui) {
      ui.innerHTML = `<div class="hud-title">${escapeHTML(title)}</div><div class="hud-small">${escapeHTML(subtitle)}</div>`;
    }

    if (hs) {
      hs.innerHTML = `<div class="hearts">${'💚'.repeat(Math.max(0, life))}${'🖤'.repeat(Math.max(0, 3 - life))}</div><div class="hud-small">Eco pontos: ${Math.floor(score)}</div>`;
    }
  }

  return {
    AS,
    $,
    clamp,
    lerp,
    rnd,
    dist,
    loadImages,
    setupCanvas,
    rect,
    text,
    wrap,
    drawButton,
    drawDialog,
    input,
    save,
    get,
    transition,
    drawWorld,
    playerDraw,
    makePlayer,
    physics,
    cameraFollow,
    hud
  };
})();
