(async () => {
  Core.save('fase', 'missao3.html');
  await Core.loadImages();

  const { ctx, w, h } = Core.setupCanvas();
  const inp = Core.input();
  const dif = Core.get('dif', 'normal');

  const cfg = {
    facil:   { lives: 4, target: 14, itemDelay: 44, speedBonus: 0,   badChance: .28, doubleChance: .12 },
    normal:  { lives: 3, target: 16, itemDelay: 38, speedBonus: .35, badChance: .34, doubleChance: .18 },
    desafio: { lives: 3, target: 22, itemDelay: 30, speedBonus: .85, badChance: .42, doubleChance: .26 }
  }[dif] || { lives: 3, target: 16, itemDelay: 38, speedBonus: .35, badChance: .34, doubleChance: .18 };

  let score = Number(Core.get('score', 0)) || 0;
  let life = cfg.lives;
  let state = 'ready';
  let msg = 'Limpe o rio coletando recicláveis. Desvie dos obstáculos e mantenha o barco estável.';

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

  const goodIcons = ['♻️', '🧴', '🥫', '📄', '🗞️'];
  const badIcons = ['🪨', '⚠️', '🛢️', '🐟'];

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
    floats.push({ text, x, y, life: 52, color });
  }

  function addParticles(x, y, good) {
    const amount = good ? 14 : 20;

    for (let i = 0; i < amount; i++) {
      particles.push({
        x,
        y,
        vx: Core.rnd(-2.6, 2.6),
        vy: Core.rnd(-2.8, 1.3),
        r: Core.rnd(2, good ? 5 : 6),
        life: Core.rnd(24, 44),
        color: good ? '#bef264' : '#fecaca'
      });
    }
  }

  function spawn(forceGood = null) {
    const good = forceGood === null ? Math.random() > cfg.badChance : forceGood;
    const size = good ? Core.rnd(38, 46) : Core.rnd(48, 58);

    items.push({
      x: w() + 90,
      y: Core.rnd(riverTop() + 12, riverBottom() - size - 12),
      w: size,
      h: size,
      s: Core.rnd(3.5, 6.2) + cfg.speedBonus,
      good,
      rot: Core.rnd(-.2, .2),
      spin: good ? Core.rnd(.025, .055) : Core.rnd(.055, .095),
      icon: good ? pick(goodIcons) : pick(badIcons),
      pulse: Math.random() * Math.PI * 2,
      dead: false
    });
  }

  function start() {
    state = 'play';
    msg = 'Use ←/→ e ↑ para controlar. Pegue recicláveis e evite os obstáculos.';
    items = [];
    ripples = [];
    particles = [];
    floats = [];
    timer = 10;
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
    boat.inv = 85;
    boat.stability = Math.max(0, boat.stability - 32);
    shake = 18;
    score = Math.max(0, score - 25);

    msg = 'Cuidado! Obstáculo atingido. O barco ficou instável por alguns segundos.';
    addFloat('-25', boat.x + boat.w / 2, boat.y, '#fecaca');

    if (life <= 0) {
      state = 'gameover';
      items = [];
      combo = 0;
      clean = 0;
      msg = 'O rio poluiu novamente. Pressione E/Enter para tentar de novo.';
    }
  }

  function collectGood(it) {
    clean++;
    combo++;

    const gained = 35 + Math.min(combo * 5, 40);
    score += gained;
    boat.stability = Math.min(100, boat.stability + 4);

    msg = combo >= 3
      ? `Combo x${combo}! Continue limpando o rio.`
      : 'Boa coleta! Continue recolhendo os recicláveis.';

    addFloat(`+${gained}`, it.x + it.w / 2, it.y, '#d9f99d');
  }

  function updateBoat() {
    const accel = 1.15;
    const maxVx = 7.0;

    if (inp.left()) boat.vx -= accel;
    if (inp.right()) boat.vx += accel;
    if (!inp.left() && !inp.right()) boat.vx *= .82;

    boat.vx = Core.clamp(boat.vx, -maxVx, maxVx);

    if (inp.jump()) boat.vy -= .82;
    else boat.vy += .48;

    boat.vy *= .985;
    boat.vy = Core.clamp(boat.vy, -6.4, 5.5);

    boat.x = Core.clamp(boat.x + boat.vx, 24, w() - boat.w - 24);
    boat.y = Core.clamp(boat.y + boat.vy, riverTop(), riverBottom() - boat.h);

    if ((boat.y <= riverTop() && boat.vy < 0) || (boat.y >= riverBottom() - boat.h && boat.vy > 0)) {
      boat.vy *= -.18;
      boat.stability = Math.max(0, boat.stability - .35);
    }

    boat.tilt += ((boat.vx / 18) + (boat.vy / 28) - boat.tilt) * .12;
    boat.stability = Math.min(100, boat.stability + .04);

    if (boat.inv > 0) boat.inv--;
  }

  function updateObjects() {
    timer--;

    if (timer <= 0) {
      timer = cfg.itemDelay;
      spawn();

      if (Math.random() < cfg.doubleChance) spawn();
    }

    items.forEach(it => {
      it.x -= it.s;
      it.rot += it.spin;
      it.pulse += .08;
    });

    const boatHitbox = {
      x: boat.x + 12,
      y: boat.y + 10,
      w: boat.w - 24,
      h: boat.h - 20
    };

    items.forEach(it => {
      if (!it.dead && overlap(boatHitbox, it)) {
        it.dead = true;

        ripples.push({
          x: it.x + it.w / 2,
          y: it.y + it.h / 2,
          r: 5,
          life: 36,
          good: it.good
        });

        addParticles(it.x + it.w / 2, it.y + it.h / 2, it.good);

        if (it.good) collectGood(it);
        else hitBad();
      }
    });

    items = items.filter(it => !it.dead && it.x > -140);

    ripples = ripples.filter(r => {
      r.r += 1.65;
      r.life--;
      return r.life > 0;
    });

    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += .045;
      p.life--;
      return p.life > 0;
    });

    floats = floats.filter(f => {
      f.y -= .58;
      f.life--;
      return f.life > 0;
    });
  }

  function update() {
    frame++;

    if (shake > 0) shake--;

    Core.hud(
      'Missão 3: Rio Limpo',
      `${msg}  •  Progresso: ${clean}/${cfg.target}`,
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
      msg = 'Rio limpo! Pressione E/Enter para ir para a central de reciclagem.';
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

    for (let i = 0; i < 9; i++) {
      const cx = (i * 170 + frame * .22) % (w() + 260) - 130;
      const cy = 30 + (i % 3) * 24;
      Core.rect(ctx, cx, cy, 96, 22, 99, '#ffffff', null);
    }

    ctx.globalAlpha = 1;

    const river = ctx.createLinearGradient(0, riverTop(), 0, riverBottom());
    river.addColorStop(0, '#38bdf8');
    river.addColorStop(.55, '#0891b2');
    river.addColorStop(1, '#075985');

    ctx.fillStyle = river;
    ctx.fillRect(0, riverTop() - 10, w(), riverBottom() - riverTop() + 24);

    ctx.strokeStyle = 'rgba(255,255,255,.24)';
    ctx.lineWidth = 3;

    for (let y = riverTop() + 18; y < riverBottom(); y += 38) {
      ctx.beginPath();

      for (let x = -40; x < w() + 80; x += 24) {
        const wave = Math.sin((x + frame * 2.2) / 62 + y * .03) * 6;

        if (x === -40) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }

      ctx.stroke();
    }

    ctx.fillStyle = '#14532d';
    ctx.fillRect(0, riverBottom(), w(), h() - riverBottom());

    ctx.fillStyle = 'rgba(187,247,208,.42)';

    for (let x = 0; x < w(); x += 105) {
      Core.rect(ctx, x, riverBottom() - 5, 58, 10, 99, 'rgba(187,247,208,.42)', null);
    }
  }

  function drawProgress() {
    const barW = Math.min(500, w() - 48);
    const barX = 24;
    const barY = 88;
    const pct = Core.clamp(clean / cfg.target, 0, 1);

    Core.rect(ctx, barX, barY, barW, 20, 99, 'rgba(255,255,255,.20)', 'rgba(255,255,255,.32)');
    Core.rect(ctx, barX, barY, barW * pct, 20, 99, '#84cc16', null);
    Core.text(ctx, `${clean}/${cfg.target} recicláveis`, barX + barW / 2, barY + 10, 13, '#052e16', 'center', 950);

    const stX = barX;
    const stY = barY + 30;

    Core.rect(ctx, stX, stY, barW, 12, 99, 'rgba(255,255,255,.18)', null);
    Core.rect(ctx, stX, stY, barW * (boat.stability / 100), 12, 99, boat.stability > 40 ? '#22c55e' : '#f97316', null);
    Core.text(ctx, 'estabilidade', stX + 4, stY + 26, 12, '#ecfeff', 'left', 800);
  }

  function drawItems() {
    items.forEach(it => {
      ctx.save();
      ctx.translate(it.x + it.w / 2, it.y + it.h / 2);
      ctx.rotate(it.rot);

      const scale = 1 + Math.sin(it.pulse) * .035;
      ctx.scale(scale, scale);

      ctx.shadowColor = it.good ? 'rgba(132,204,22,.55)' : 'rgba(239,68,68,.55)';
      ctx.shadowBlur = 18;

      Core.rect(
        ctx,
        -it.w / 2,
        -it.h / 2,
        it.w,
        it.h,
        16,
        it.good ? '#84cc16' : '#ef4444',
        'rgba(255,255,255,.58)'
      );

      Core.text(ctx, it.icon, 0, 2, 25, '#fff', 'center', 950);
      ctx.restore();
    });
  }

  function drawBoat() {
    ctx.save();
    ctx.translate(boat.x + boat.w / 2, boat.y + boat.h / 2);
    ctx.rotate(boat.tilt);

    if (boat.inv > 0) {
      ctx.globalAlpha = .58 + .25 * Math.sin(frame * .35);
    }

    ctx.shadowColor = 'rgba(15,23,42,.35)';
    ctx.shadowBlur = 18;

    Core.rect(ctx, -boat.w / 2, -boat.h / 2, boat.w, boat.h, 22, '#f59e0b', '#fff7ed');
    Core.rect(ctx, -boat.w / 2 + 10, -boat.h / 2 + 38, boat.w - 20, 10, 99, '#92400e', null);
    Core.text(ctx, '🚣', 0, -4, 38, '#fff', 'center', 900);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawEffects() {
    ripples.forEach(r => {
      ctx.globalAlpha = r.life / 36;
      ctx.strokeStyle = r.good ? '#d9f99d' : '#fecaca';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.globalAlpha = 1;

    particles.forEach(p => {
      ctx.globalAlpha = Core.clamp(p.life / 44, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.globalAlpha = 1;

    floats.forEach(f => {
      ctx.globalAlpha = Core.clamp(f.life / 52, 0, 1);
      Core.text(ctx, f.text, f.x, f.y, 18, f.color, 'center', 950);
    });

    ctx.globalAlpha = 1;
  }

  function drawMessageBox() {
    const boxW = Math.min(860, w() - 48);

    Core.rect(ctx, 24, h() - 170, boxW, 90, 24, 'rgba(3,8,6,.82)', 'rgba(190,242,100,.38)');
    Core.wrap(ctx, msg, 48, h() - 140, boxW - 48, 26, 20, '#f7fee7');
  }

  function drawOverlay(title, subtitle) {
    ctx.fillStyle = 'rgba(2,6,23,.42)';
    ctx.fillRect(0, 0, w(), h());

    Core.rect(ctx, w() / 2 - 290, h() / 2 - 95, 580, 190, 28, 'rgba(240,253,244,.94)', 'rgba(22,101,52,.55)');
    Core.text(ctx, title, w() / 2, h() / 2 - 36, 34, '#052e16', 'center', 950);
    Core.wrap(ctx, subtitle, w() / 2 - 225, h() / 2 + 4, 450, 24, 18, '#14532d');
    Core.text(ctx, 'Pressione E/Enter', w() / 2, h() / 2 + 68, 22, '#166534', 'center', 950);
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
    drawMessageBox();

    ctx.restore();

    if (state === 'ready') {
      drawOverlay(
        'Rio Limpo',
        'Colete recicláveis, evite os obstáculos vermelhos e complete a limpeza antes que o rio fique poluído.'
      );
    }

    if (state === 'gameover') {
      drawOverlay(
        'Tente novamente',
        'O barco perdeu todas as vidas. Recomece a missão e mantenha a estabilidade.'
      );
    }

    if (state === 'done') {
      drawOverlay(
        'Missão concluída!',
        'O rio ficou limpo e a próxima etapa é levar tudo para a central de reciclagem.'
      );
    }
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  boat.y = h() / 2;
  loop();
})();