(() => {
  Core.save('fase', 'missao3.html');

  const { ctx, w, h } = Core.setupCanvas('game', { pixelRatioCap: 1 });
  const inp = Core.input();
  const dif = Core.get('dif', 'normal');

  const cfg = {
    facil:   { lives: 4, target: 12, itemDelay: 50, speedBonus: 0.00, badChance: .22, doubleChance: .05 },
    normal:  { lives: 3, target: 14, itemDelay: 44, speedBonus: 0.25, badChance: .28, doubleChance: .08 },
    desafio: { lives: 3, target: 18, itemDelay: 38, speedBonus: 0.55, badChance: .36, doubleChance: .12 }
  }[dif] || { lives: 3, target: 14, itemDelay: 44, speedBonus: 0.25, badChance: .28, doubleChance: .08 };

  let score = Number(Core.get('score', 0)) || 0;
  let life = cfg.lives;
  let state = 'ready';
  let msg = 'Colete recicláveis e desvie dos obstáculos.';
  let dt = 1;
  let lastTime = performance.now();

  const boat = {
    x: 130,
    y: 0,
    w: 106,
    h: 60,
    vx: 0,
    vy: 0,
    tilt: 0,
    inv: 0,
    stability: 100
  };

  let items = [];
  let ripples = [];
  let particles = [];
  let floats = [];
  let timer = 0;
  let clean = 0;
  let combo = 0;
  let frame = 0;
  let shake = 0;

  const goodIcons = ['♻️', '🧴', '🥫', '📄'];
  const badIcons = ['🪨', '⚠️', '🛢️'];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function riverTop() {
    return 112;
  }

  function riverBottom() {
    return h() - 126;
  }

  function overlap(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  function addFloat(text, x, y, color = '#ecfccb') {
    floats.push({ text, x, y, life: 46, color });

    if (floats.length > 10) {
      floats.splice(0, floats.length - 10);
    }
  }

  function addParticles(x, y, good) {
    const amount = good ? 7 : 10;

    for (let i = 0; i < amount; i++) {
      particles.push({
        x,
        y,
        vx: Core.rnd(-2.2, 2.2),
        vy: Core.rnd(-2.2, 1.2),
        r: Core.rnd(2, good ? 4 : 5),
        life: Core.rnd(20, 34),
        color: good ? '#bef264' : '#fecaca'
      });
    }

    if (particles.length > 45) {
      particles.splice(0, particles.length - 45);
    }
  }

  function spawn(forceGood = null) {
    const good = forceGood === null ? Math.random() > cfg.badChance : forceGood;
    const size = good ? Core.rnd(36, 44) : Core.rnd(46, 54);

    items.push({
      x: w() + 90,
      y: Core.rnd(riverTop() + 12, riverBottom() - size - 12),
      w: size,
      h: size,
      s: Core.rnd(3.6, 5.9) + cfg.speedBonus,
      good,
      rot: Core.rnd(-.18, .18),
      spin: good ? Core.rnd(.02, .045) : Core.rnd(.045, .075),
      icon: good ? pick(goodIcons) : pick(badIcons),
      pulse: Math.random() * Math.PI * 2,
      dead: false
    });
  }

  function start() {
    state = 'play';
    msg = 'Use setas/A-D e ↑/Espaço. Pegue o verde, evite o vermelho.';
    items = [];
    ripples = [];
    particles = [];
    floats = [];
    timer = 8;
    clean = 0;
    combo = 0;
    shake = 0;
    life = cfg.lives;

    boat.x = 130;
    boat.y = h() / 2;
    boat.vx = 0;
    boat.vy = 0;
    boat.inv = 0;
    boat.stability = 100;
  }

  function hitBad() {
    if (boat.inv > 0) return;

    life--;
    combo = 0;
    boat.inv = 70;
    boat.stability = Math.max(0, boat.stability - 28);
    shake = 12;
    score = Math.max(0, score - 20);
    msg = 'Desvie dos obstáculos vermelhos.';
    addFloat('-20', boat.x + boat.w / 2, boat.y, '#fecaca');

    if (life <= 0) {
      state = 'gameover';
      items = [];
      combo = 0;
      clean = 0;
      msg = 'Tente de novo. Pressione E/Enter.';
    }
  }

  function collectGood(it) {
    clean++;
    combo++;

    const gained = 35 + Math.min(combo * 5, 35);
    score += gained;
    boat.stability = Math.min(100, boat.stability + 5);
    msg = combo >= 3 ? `Combo x${combo}!` : 'Boa coleta!';
    addFloat(`+${gained}`, it.x + it.w / 2, it.y, '#d9f99d');
  }

  function updateBoat() {
    const accel = 1.65 * dt;
    const maxVx = 9.2;

    if (inp.left()) boat.vx -= accel;
    if (inp.right()) boat.vx += accel;
    if (!inp.left() && !inp.right()) boat.vx *= Math.pow(.80, dt);

    boat.vx = Core.clamp(boat.vx, -maxVx, maxVx);

    if (inp.jump()) {
      boat.vy -= 1.05 * dt;
    } else {
      boat.vy += .54 * dt;
    }

    boat.vy *= Math.pow(.986, dt);
    boat.vy = Core.clamp(boat.vy, -7.3, 6.4);

    boat.x = Core.clamp(boat.x + boat.vx * dt, 24, w() - boat.w - 24);
    boat.y = Core.clamp(boat.y + boat.vy * dt, riverTop(), riverBottom() - boat.h);

    if ((boat.y <= riverTop() && boat.vy < 0) || (boat.y >= riverBottom() - boat.h && boat.vy > 0)) {
      boat.vy *= -.18;
      boat.stability = Math.max(0, boat.stability - .35 * dt);
    }

    boat.tilt += ((boat.vx / 18) + (boat.vy / 28) - boat.tilt) * .14 * dt;
    boat.stability = Math.min(100, boat.stability + .05 * dt);

    if (boat.inv > 0) {
      boat.inv -= dt;
    }
  }

  function updateObjects() {
    timer -= dt;

    if (timer <= 0) {
      timer = cfg.itemDelay;
      spawn();

      if (Math.random() < cfg.doubleChance) {
        spawn();
      }
    }

    items.forEach((it) => {
      it.x -= it.s * dt;
      it.rot += it.spin * dt;
      it.pulse += .08 * dt;
    });

    const boatHitbox = {
      x: boat.x + 12,
      y: boat.y + 10,
      w: boat.w - 24,
      h: boat.h - 20
    };

    items.forEach((it) => {
      if (!it.dead && overlap(boatHitbox, it)) {
        it.dead = true;

        ripples.push({
          x: it.x + it.w / 2,
          y: it.y + it.h / 2,
          r: 5,
          life: 30,
          good: it.good
        });

        addParticles(it.x + it.w / 2, it.y + it.h / 2, it.good);

        if (it.good) collectGood(it);
        else hitBad();
      }
    });

    items = items.filter((it) => !it.dead && it.x > -140);

    ripples = ripples.filter((r) => {
      r.r += 1.45 * dt;
      r.life -= dt;
      return r.life > 0;
    });

    particles = particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += .045 * dt;
      p.life -= dt;
      return p.life > 0;
    });

    floats = floats.filter((f) => {
      f.y -= .58 * dt;
      f.life -= dt;
      return f.life > 0;
    });
  }

  function update() {
    frame += dt;

    if (shake > 0) {
      shake -= dt;
    }

    Core.hud(
      'Missão 3: Rio Limpo',
      `${msg} • ${clean}/${cfg.target}`,
      life,
      Math.floor(score)
    );

    if (inp.action() && (state === 'ready' || state === 'gameover')) {
      start();
      inp.clearAction();
    }

    if (inp.action() && state === 'done') {
      Core.save('score', Math.floor(score));
      Core.save('fase', 'missao4.html');
      Core.transition('missao4.html');
      inp.clearAction();
    }

    if (state !== 'play') return;

    updateBoat();
    updateObjects();

    if (clean >= cfg.target) {
      state = 'done';
      score += 210 + life * 25 + Math.min(combo * 8, 90);
      items = [];
      msg = 'Rio limpo! Pressione E/Enter.';
    }
  }

  function drawBg() {
    const sky = ctx.createLinearGradient(0, 0, 0, h());
    sky.addColorStop(0, '#0ea5e9');
    sky.addColorStop(.34, '#67e8f9');
    sky.addColorStop(1, '#075985');

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w(), h());

    ctx.globalAlpha = .22;
    ctx.fillStyle = '#ffffff';

    for (let i = 0; i < 5; i++) {
      const cx = (i * 260 + frame * .18) % (w() + 300) - 150;
      const cy = 28 + (i % 2) * 30;
      Core.rect(ctx, cx, cy, 112, 22, 99, '#ffffff', null);
    }

    ctx.globalAlpha = 1;

    const river = ctx.createLinearGradient(0, riverTop(), 0, riverBottom());
    river.addColorStop(0, '#38bdf8');
    river.addColorStop(.58, '#0891b2');
    river.addColorStop(1, '#075985');

    ctx.fillStyle = river;
    ctx.fillRect(0, riverTop() - 10, w(), riverBottom() - riverTop() + 24);

    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 2;

    for (let y = riverTop() + 22; y < riverBottom(); y += 58) {
      ctx.beginPath();

      for (let x = -50; x < w() + 100; x += 40) {
        const wave = Math.sin((x + frame * 2.4) / 62 + y * .03) * 5;

        if (x === -50) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }

      ctx.stroke();
    }

    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, riverBottom(), w(), h() - riverBottom());

    for (let x = 0; x < w(); x += 130) {
      Core.rect(ctx, x, riverBottom() - 5, 60, 10, 99, 'rgba(187,247,208,.42)', null);
    }
  }

  function drawProgress() {
    const barW = Math.min(420, w() - 36);
    const barX = 18;
    const barY = 78;
    const pct = Core.clamp(clean / cfg.target, 0, 1);

    Core.rect(ctx, barX, barY, barW, 18, 99, 'rgba(255,255,255,.20)', 'rgba(255,255,255,.28)');
    Core.rect(ctx, barX, barY, barW * pct, 18, 99, '#84cc16', null);
    Core.text(ctx, `${clean}/${cfg.target}`, barX + barW / 2, barY + 9, 12, '#052e16', 'center', 950);

    const stY = barY + 26;
    Core.rect(ctx, barX, stY, barW, 10, 99, 'rgba(255,255,255,.18)', null);
    Core.rect(ctx, barX, stY, barW * (boat.stability / 100), 10, 99, boat.stability > 40 ? '#22c55e' : '#f97316', null);
  }

  function drawItems() {
    items.forEach((it) => {
      ctx.save();
      ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
      ctx.rotate(it.rot);

      const scale = 1 + Math.sin(it.pulse) * .025;
      ctx.scale(scale, scale);

      Core.rect(
        ctx,
        -it.w / 2,
        -it.h / 2,
        it.w,
        it.h,
        15,
        it.good ? '#84cc16' : '#ef4444',
        'rgba(255,255,255,.48)'
      );

      Core.text(ctx, it.icon, 0, 2, 24, '#fff', 'center', 950);
      ctx.restore();
    });
  }

  function drawBoat() {
    ctx.save();
    ctx.translate(boat.x + boat.w / 2, boat.y + boat.h / 2);
    ctx.rotate(boat.tilt);

    if (boat.inv > 0) {
      ctx.globalAlpha = .62 + .22 * Math.sin(frame * .35);
    }

    Core.rect(ctx, -boat.w / 2, -boat.h / 2, boat.w, boat.h, 22, '#f59e0b', '#fff7ed');
    Core.rect(ctx, -boat.w / 2 + 10, -boat.h / 2 + 38, boat.w - 20, 10, 99, '#92400e', null);
    Core.text(ctx, '🚣', 0, -4, 38, '#fff', 'center', 900);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawEffects() {
    ripples.forEach((r) => {
      ctx.globalAlpha = r.life / 30;
      ctx.strokeStyle = r.good ? '#d9f99d' : '#fecaca';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.globalAlpha = 1;

    particles.forEach((p) => {
      ctx.globalAlpha = Core.clamp(p.life / 34, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;

    floats.forEach((f) => {
      ctx.globalAlpha = Core.clamp(f.life / 46, 0, 1);
      Core.text(ctx, f.text, f.x, f.y, 17, f.color, 'center', 950);
    });

    ctx.globalAlpha = 1;
  }

  function drawMessageBox() {
    const boxW = Math.min(560, w() - 36);
    const boxH = 56;
    const boxX = 18;
    const boxY = h() - 92;

    Core.rect(ctx, boxX, boxY, boxW, boxH, 18, 'rgba(3,8,6,.62)', 'rgba(190,242,100,.25)');
    Core.wrap(ctx, msg, boxX + 16, boxY + 22, boxW - 32, 18, 15, '#f7fee7');
  }

  function drawOverlay(title, subtitle) {
    ctx.fillStyle = 'rgba(2,6,23,.42)';
    ctx.fillRect(0, 0, w(), h());

    const cardW = Math.min(580, w() - 44);
    const cardH = 190;
    const x = w() / 2 - cardW / 2;
    const y = h() / 2 - cardH / 2;

    Core.rect(ctx, x, y, cardW, cardH, 28, 'rgba(240,253,244,.94)', 'rgba(22,101,52,.55)');
    Core.text(ctx, title, w() / 2, y + 58, 34, '#052e16', 'center', 950);
    Core.wrap(ctx, subtitle, x + 42, y + 96, cardW - 84, 24, 18, '#14532d');
    Core.text(ctx, 'Pressione E/Enter', w() / 2, y + 154, 21, '#166534', 'center', 950);
  }

  function draw() {
    ctx.save();

    if (shake > 0) {
      ctx.translate(Core.rnd(-shake / 2, shake / 2), Core.rnd(-shake / 2, shake / 2));
    }

    drawBg();
    drawProgress();
    drawEffects();
    drawItems();
    drawBoat();

    if (state === 'play') {
      drawMessageBox();
    }

    ctx.restore();

    if (state === 'ready') {
      drawOverlay(
        'Rio Limpo',
        'Pegue os recicláveis verdes. Desvie dos obstáculos vermelhos.'
      );
    }

    if (state === 'gameover') {
      drawOverlay(
        'Tente novamente',
        'O barco perdeu as vidas. Recomece e mantenha distância dos obstáculos.'
      );
    }

    if (state === 'done') {
      drawOverlay(
        'Missão concluída!',
        'O rio ficou limpo. Agora siga para a central de reciclagem.'
      );
    }
  }

  function loop() {
    const now = performance.now();
    dt = Core.clamp((now - lastTime) / 16.67, .65, 1.75);
    lastTime = now;

    update();
    draw();

    requestAnimationFrame(loop);
  }

  boat.y = h() / 2;
  loop();
})();
