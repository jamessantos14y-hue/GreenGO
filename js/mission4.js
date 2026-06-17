(async () => {
  Core.save('fase', 'missao4.html');
  const I = await Core.loadImages();

  const setup = Core.setupCanvas();
  const { canvas, ctx, w, h } = setup;
  const inp = Core.input();
  const dif = Core.get('dif', 'normal');

  // A missão final tinha muitos efeitos e ficava dependente do FPS.
  // Este redimensionamento reduz o peso do canvas sem mexer nas outras fases.
  const DPR_CAP = innerWidth <= 900 ? 1 : 1.25;
  function resizeFastCanvas() {
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }
  addEventListener('resize', resizeFastCanvas);
  resizeFastCanvas();

  let score = Number(Core.get('score', 0)) || 0;

  const types = [
    ['papel', '#3b82f6', '📄', 'PAPEL'],
    ['plastico', '#ef4444', '🥤', 'PLÁSTICO'],
    ['vidro', '#22c55e', '🍾', 'VIDRO'],
    ['metal', '#f59e0b', '🥫', 'METAL']
  ];

  const cfg = {
    facil: {
      target: 13,
      lives: 4,
      time: 110,
      itemCount: 8,
      hazardCount: 1,
      conveyor: 1.1,
      rushStep: 6,
      lockedTime: 95
    },
    normal: {
      target: 17,
      lives: 3,
      time: 96,
      itemCount: 9,
      hazardCount: 2,
      conveyor: 1.35,
      rushStep: 5,
      lockedTime: 110
    },
    desafio: {
      target: 23,
      lives: 3,
      time: 90,
      itemCount: 10,
      hazardCount: 3,
      conveyor: 1.65,
      rushStep: 4,
      lockedTime: 130
    }
  }[dif] || {
    target: 17,
    lives: 3,
    time: 96,
    itemCount: 9,
    hazardCount: 2,
    conveyor: 1.35,
    rushStep: 5,
    lockedTime: 110
  };

  const player = {
    x: 90,
    y: 0,
    w: 68,
    h: 84,
    vx: 0,
    vy: 0,
    face: 1,
    carry: null,
    inv: 0,
    step: 0
  };

  let state = 'intro';
  let msg = 'Missão final: organize a central antes que o tempo acabe.';
  let feedbackType = 'info';
  let feedbackTimer = 0;

  let items = [];
  let hazards = [];
  let particles = [];
  let floatingTexts = [];
  let sparks = [];

  let delivered = 0;
  let mistakes = 0;
  let streak = 0;
  let timeLeft = cfg.time;
  let frame = 0;
  let shake = 0;
  let rush = 0;
  let lastDelivery = 0;
  let lockedBin = null;
  let lockTimer = 0;
  let lastHud = '';
  let lastTime = performance.now();

  const audio = {
    ctx: null,

    ensure() {
      try {
        if (!this.ctx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) this.ctx = new AudioContextClass();
        }

        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) {}
    },

    beep(type = 'ok') {
      try {
        this.ensure();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type === 'bad' ? 'sawtooth' : type === 'warn' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(type === 'bad' ? 150 : type === 'warn' ? 360 : 660, now);
        osc.frequency.exponentialRampToValueAtTime(type === 'bad' ? 85 : type === 'warn' ? 260 : 930, now + 0.10);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(type === 'bad' ? 0.09 : 0.065, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      } catch (e) {}
    }
  };

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function setMsg(text, type = 'info', timer = 120) {
    msg = text;
    feedbackType = type;
    feedbackTimer = timer;
  }

  function conveyorTop() {
    return 126;
  }

  function conveyorBottom() {
    return Math.max(conveyorTop() + 76, Math.min(250, h() - 292));
  }

  function floorTop() {
    return 100;
  }

  function floorBottom() {
    return h() - 136;
  }

  function livesLeft() {
    return Math.max(0, cfg.lives - mistakes);
  }

  function overlap(a, b) {
    return a.x < b.x + b.w &&
           a.x + a.w > b.x &&
           a.y < b.y + b.h &&
           a.y + a.h > b.y;
  }

  function addFloatingText(text, x, y, color = '#f7fee7') {
    floatingTexts.push({ text, x, y, vy: -0.72, life: 62, color });

    if (floatingTexts.length > 18) {
      floatingTexts.splice(0, floatingTexts.length - 18);
    }
  }

  function addParticles(x, y, color, amount = 10) {
    amount = Math.min(amount, 16);

    for (let i = 0; i < amount; i++) {
      particles.push({
        x,
        y,
        vx: Core.rnd(-22, 22) / 10,
        vy: Core.rnd(-30, 14) / 10,
        r: Core.rnd(2, 5),
        life: Core.rnd(20, 38),
        color
      });
    }

    if (particles.length > 60) {
      particles.splice(0, particles.length - 60);
    }
  }

  function addSparks(x, y, amount = 8) {
    amount = Math.min(amount, 10);

    for (let i = 0; i < amount; i++) {
      sparks.push({
        x,
        y,
        vx: Core.rnd(-18, 18) / 10,
        vy: Core.rnd(-18, 8) / 10,
        life: Core.rnd(12, 24)
      });
    }

    if (sparks.length > 36) {
      sparks.splice(0, sparks.length - 36);
    }
  }

  function randomType() {
    return pick(types);
  }

  function makeItem(id, onConveyor = Math.random() < 0.55) {
    const t = randomType();
    const heavy = Math.random() < (dif === 'desafio' ? 0.28 : 0.18);
    const toxic = Math.random() < (dif === 'desafio' ? 0.13 : 0.08);
    const size = heavy ? 52 : 45;

    return {
      x: Core.rnd(70, Math.max(160, w() - 130)),
      y: onConveyor
        ? Core.rnd(conveyorTop() + 12, conveyorBottom() - 52)
        : Core.rnd(conveyorBottom() + 34, floorBottom() - 78),
      w: size,
      h: size,
      type: t[0],
      color: toxic ? '#a855f7' : t[1],
      realColor: t[1],
      icon: toxic ? '☣️' : t[2],
      name: t[3],
      id,
      heavy,
      toxic,
      onConveyor,
      dir: Math.random() < 0.5 ? -1 : 1,
      bob: Math.random() * 10,
      pulse: Math.random() * 6,
      rot: Core.rnd(-0.10, 0.10)
    };
  }

  function resetItems() {
    items = Array.from({ length: cfg.itemCount }, (_, i) => makeItem(i, i < Math.ceil(cfg.itemCount * 0.56)));
  }

  function makeHazard(i) {
    const yMin = Math.max(conveyorBottom() + 40, 245);
    const yMax = Math.max(yMin + 42, floorBottom() - 98);

    return {
      x: Core.rnd(120, Math.max(200, w() - 170)),
      y: Core.rnd(yMin, yMax),
      w: Core.rnd(58, 82),
      h: Core.rnd(40, 52),
      vx: (Math.random() < 0.5 ? -1 : 1) * Core.rnd(0.95, 1.45),
      pulse: Math.random() * 10,
      hitCooldown: 0,
      id: i
    };
  }

  function resetHazards() {
    hazards = Array.from({ length: cfg.hazardCount }, (_, i) => makeHazard(i));
  }

  function binPos(i) {
    const gap = 10;
    const bw = Math.min(152, (w() - 50) / 4);

    return {
      x: 25 + i * bw,
      y: h() - 120,
      w: bw - gap,
      h: 94,
      type: types[i][0],
      color: types[i][1],
      icon: types[i][2],
      name: types[i][3],
      index: i
    };
  }

  function currentBin() {
    const feetX = player.x + player.w / 2;
    const feetY = player.y + player.h;

    for (let i = 0; i < 4; i++) {
      const b = binPos(i);
      const insideX = feetX > b.x && feetX < b.x + b.w;
      const insideY = feetY > b.y - 18 && feetY < b.y + b.h + 18;

      if (insideX && insideY) return b;
    }

    return null;
  }

  function getTargetBin() {
    if (!player.carry) return null;

    for (let i = 0; i < 4; i++) {
      const b = binPos(i);
      if (b.type === player.carry.type) return b;
    }

    return null;
  }

  function findItem() {
    if (player.carry) return null;

    const pcx = player.x + player.w / 2;
    const pcy = player.y + player.h / 2;
    let best = null;
    let bestDist = Infinity;

    items.forEach((it) => {
      const icx = it.x + it.w / 2;
      const icy = it.y + it.h / 2;
      const dx = icx - pcx;
      const dy = icy - pcy;
      const distSq = dx * dx + dy * dy;

      if (distSq < 76 * 76 && distSq < bestDist) {
        best = it;
        bestDist = distSq;
      }
    });

    return best;
  }

  function dropCarry(reason = 'drop') {
    if (!player.carry) return;

    const item = player.carry;
    player.carry = null;

    item.x = Core.clamp(player.x + Core.rnd(-22, 22), 42, w() - 90);
    item.y = Core.clamp(player.y + player.h + 8, conveyorBottom() + 24, floorBottom() - 76);
    item.onConveyor = false;
    item.dir = Math.random() < 0.5 ? -1 : 1;
    items.push(item);

    if (reason === 'hazard') {
      mistakes++;
      streak = 0;
      score = Math.max(0, score - 25);
      timeLeft = Math.max(0, timeLeft - 4);
      shake = 9;
      player.inv = 60;

      setMsg('Área contaminada! Você derrubou o resíduo. -4s', 'bad', 120);
      addFloatingText('-4s', player.x + player.w / 2, player.y - 22, '#fecaca');
      addParticles(player.x + player.w / 2, player.y + player.h / 2, '#a855f7', 12);
      audio.beep('bad');
    }
  }

  function pickItem(item) {
    if (!item || player.carry) return;

    player.carry = item;
    items = items.filter((i) => i !== item);

    const extra = item.heavy ? ' Item pesado: movimento reduzido.' : '';
    const toxic = item.toxic ? ' Item contaminado: vale mais, mas é perigoso.' : '';

    setMsg(`Leve para: ${item.name}.${extra}${toxic}`, item.toxic ? 'warn' : 'info', 145);
    addFloatingText(`→ ${item.name}`, player.x + player.w / 2, player.y - 25, '#fef9c3');
    addParticles(item.x + item.w / 2, item.y + item.h / 2, item.realColor, 8);
    audio.beep(item.toxic ? 'warn' : 'ok');
  }

  function chooseLockedBin() {
    const targetBin = getTargetBin();
    let options = [0, 1, 2, 3];

    if (targetBin && Math.random() < 0.62) {
      options = options.filter((i) => i !== targetBin.index);
    }

    lockedBin = pick(options);
    lockTimer = cfg.lockedTime;
  }

  function refillItems() {
    while (items.length < cfg.itemCount) {
      items.push(makeItem(Date.now() + items.length, Math.random() < 0.60));
    }
  }

  function lockedDelivery(bin) {
    score = Math.max(0, score - 10);
    timeLeft = Math.max(0, timeLeft - 3);
    shake = 6;

    setMsg('Essa lixeira está processando. Espere liberar. -3s', 'warn', 110);
    addFloatingText('AGUARDE', bin.x + bin.w / 2, bin.y - 12, '#fef9c3');
    player.y = Core.clamp(player.y - 18, floorTop(), h() - player.h - 132);
    audio.beep('warn');
  }

  function wrongDelivery(item, bin) {
    mistakes++;
    streak = 0;
    score = Math.max(0, score - 30);
    timeLeft = Math.max(0, timeLeft - 6);
    shake = 12;

    setMsg(`${item.icon} vai em ${item.name}. Essa era a lixeira ${bin.name}. -6s`, 'bad', 135);
    addParticles(player.x + player.w / 2, player.y + player.h / 2, '#ef4444', 12);
    addFloatingText('ERRADO', player.x + player.w / 2, player.y - 20, '#fecaca');
    audio.beep('bad');
  }

  function deliverToBin(bin) {
    if (!player.carry || !bin || state !== 'play') return;

    const now = performance.now();
    if (now - lastDelivery < 520) return;
    lastDelivery = now;

    const item = player.carry;
    const locked = lockedBin === bin.index && lockTimer > 0;

    if (locked) {
      lockedDelivery(bin);
      return;
    }

    if (item.type === bin.type) {
      delivered++;
      streak++;

      const heavyBonus = item.heavy ? 14 : 0;
      const toxicBonus = item.toxic ? 20 : 0;
      const streakBonus = Math.min(streak * 8, 64);
      const gained = 55 + streakBonus + heavyBonus + toxicBonus;

      score += gained;
      timeLeft = Math.min(cfg.time + 18, timeLeft + (item.toxic ? 5 : 4));
      rush = Math.floor(delivered / cfg.rushStep);

      setMsg(
        streak >= 3
          ? `Sequência x${streak}! +${gained} pontos e +4s.`
          : `Correto! ${delivered}/${cfg.target} reciclados. +4s`,
        'ok',
        115
      );

      addParticles(player.x + player.w / 2, player.y + player.h / 2, item.realColor, 14);
      addSparks(bin.x + bin.w / 2, bin.y + 28, 8);
      addFloatingText(`+${gained}`, player.x + player.w / 2, player.y - 20, '#d9f99d');
      audio.beep('ok');

      player.carry = null;
      refillItems();

      if (delivered > 0 && delivered % cfg.rushStep === 0) {
        setMsg('Ritmo acelerado! A esteira e os riscos ficaram mais rápidos.', 'warn', 130);
        chooseLockedBin();
      }

      if (delivered >= cfg.target) {
        state = 'done';
        score += 300 + livesLeft() * 45 + Math.floor(timeLeft * 4) + Math.min(streak * 12, 120);
        Core.save('score', Math.floor(score));
        Core.save('fase', 'final.html');
        setMsg('Central organizada! Pressione E/Enter para finalizar.', 'ok', 999);
        addParticles(player.x + player.w / 2, player.y + player.h / 2, '#bef264', 20);
      }
    } else {
      wrongDelivery(item, bin);
      player.carry = null;
      refillItems();
    }
  }

  function startGame() {
    state = 'play';
    delivered = 0;
    mistakes = 0;
    streak = 0;
    timeLeft = cfg.time;
    rush = 0;
    lockedBin = null;
    lockTimer = 0;
    lastDelivery = 0;
    lastHud = '';

    player.x = 90;
    player.y = h() / 2;
    player.vx = 0;
    player.vy = 0;
    player.carry = null;
    player.inv = 0;

    resetItems();
    resetHazards();
    particles = [];
    floatingTexts = [];
    sparks = [];

    setMsg('Pegue com E/Enter. Entregue na lixeira correta antes do tempo acabar.', 'info', 150);
  }

  function interact() {
    audio.ensure();

    if (state === 'intro' || state === 'gameover') {
      startGame();
      return;
    }

    if (state === 'done') {
      Core.transition('final.html');
      return;
    }

    if (state !== 'play') return;

    if (!player.carry) {
      const found = findItem();

      if (found) pickItem(found);
      else setMsg('Chegue mais perto de um resíduo e pressione E/Enter para pegar.', 'info', 85);
    } else {
      setMsg(`Você carrega ${player.carry.icon}. Leve para: ${player.carry.name}.`, 'info', 90);
    }
  }

  function updatePlayer(dt) {
    let speed = 8.0;

    if (player.carry) speed -= player.carry.heavy ? 1.10 : 0.35;
    if (player.carry && player.carry.toxic) speed -= 0.12;
    if (rush >= 3) speed += 0.30;

    player.vx = 0;
    player.vy = 0;

    if (inp.left()) {
      player.vx = -speed;
      player.face = -1;
    }

    if (inp.right()) {
      player.vx = speed;
      player.face = 1;
    }

    if (inp.jump()) {
      player.vy = -speed;
    }

    if (inp.keys.ArrowDown || inp.keys.s || inp.keys.S) {
      player.vy = speed;
    }

    // Mantém jogável no celular, que só tem botão de subir, mas sem deixar arrastado.
    if (!inp.jump() && !(inp.keys.ArrowDown || inp.keys.s || inp.keys.S)) {
      player.vy = 0.95;
    }

    player.x = Core.clamp(player.x + player.vx * dt, 18, w() - player.w - 18);
    player.y = Core.clamp(player.y + player.vy * dt, floorTop(), h() - player.h - 132);
    const moving = Math.abs(player.vx) + Math.abs(player.vy) > 0.2;
    player.step += (Math.abs(player.vx) * 0.04 + Math.abs(player.vy) * 0.025) * dt;
    player.walkAnim = moving ? (player.walkAnim || 0) + Math.max(0.12, (Math.abs(player.vx) + Math.abs(player.vy)) * 0.026 * dt) : 0;

    if (player.inv > 0) player.inv -= dt;
  }

  function updateItems(dt) {
    const speed = cfg.conveyor + rush * 0.20;

    items.forEach((it) => {
      it.bob += 0.075 * dt;
      it.pulse += 0.075 * dt;
      it.rot += it.dir * 0.010 * dt;

      if (it.onConveyor) {
        it.x += it.dir * speed * dt;

        if (it.x < -70) {
          it.x = w() + 40;
          it.y = Core.rnd(conveyorTop() + 12, conveyorBottom() - 52);
        }

        if (it.x > w() + 70) {
          it.x = -50;
          it.y = Core.rnd(conveyorTop() + 12, conveyorBottom() - 52);
        }
      }
    });
  }

  function updateHazards(dt) {
    const playerBox = {
      x: player.x + 10,
      y: player.y + 12,
      w: player.w - 20,
      h: player.h - 18
    };

    hazards.forEach((z) => {
      z.x += z.vx * (1 + rush * 0.10) * dt;
      z.pulse += 0.075 * dt;

      if (z.hitCooldown > 0) z.hitCooldown -= dt;

      if (z.x < 28 || z.x + z.w > w() - 28) {
        z.vx *= -1;
        z.x = Core.clamp(z.x, 28, w() - z.w - 28);
      }

      if (player.inv <= 0 && z.hitCooldown <= 0 && overlap(playerBox, z)) {
        z.hitCooldown = 85;

        if (player.carry) {
          dropCarry('hazard');
        } else {
          mistakes++;
          score = Math.max(0, score - 15);
          timeLeft = Math.max(0, timeLeft - 3);
          player.inv = 55;
          shake = 7;

          setMsg('Área contaminada! Você perdeu tempo. -3s', 'bad', 105);
          addFloatingText('-3s', player.x + player.w / 2, player.y - 18, '#fecaca');
          addParticles(player.x + player.w / 2, player.y + player.h / 2, '#a855f7', 10);
          audio.beep('bad');
        }
      }
    });
  }

  function updateTimers(dt) {
    if (state !== 'play') return;

    timeLeft = Math.max(0, timeLeft - dt / 60);
    if (feedbackTimer > 0) feedbackTimer -= dt;

    if (lockTimer > 0) {
      lockTimer -= dt;
      if (lockTimer <= 0) lockedBin = null;
    } else if (delivered >= Math.max(4, cfg.rushStep) && Math.random() < (0.0022 + rush * 0.00055) * dt) {
      chooseLockedBin();
    }

    if (timeLeft <= 0) {
      state = 'gameover';
      player.carry = null;
      setMsg('Tempo esgotado! Pressione E/Enter para tentar de novo.', 'bad', 999);
      audio.beep('bad');
      shake = 16;
    }

    if (livesLeft() <= 0) {
      state = 'gameover';
      player.carry = null;
      setMsg('Muitos erros de reciclagem! Pressione E/Enter para reiniciar.', 'bad', 999);
      audio.beep('bad');
      shake = 16;
    }
  }

  function updateEffects(dt) {
    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.05 * dt;
      p.life -= dt;
    });
    particles = particles.filter((p) => p.life > 0);

    sparks.forEach((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 0.035 * dt;
      s.life -= dt;
    });
    sparks = sparks.filter((s) => s.life > 0);

    floatingTexts.forEach((f) => {
      f.y += f.vy * dt;
      f.life -= dt;
    });
    floatingTexts = floatingTexts.filter((f) => f.life > 0);
  }

  function syncHud() {
    const timeTxt = Math.ceil(timeLeft);
    const hudText = `${msg}  •  Acertos: ${delivered}/${cfg.target}  •  Tempo: ${timeTxt}s`;
    const stamp = `${state}|${hudText}|${livesLeft()}|${Math.floor(score)}`;

    if (stamp !== lastHud) {
      Core.hud('Missão Final: Central de Reciclagem', hudText, livesLeft(), Math.floor(score));
      lastHud = stamp;
    }
  }

  function update(dt) {
    frame += dt;
    if (shake > 0) shake -= dt;

    if (inp.action()) {
      interact();
      inp.clearAction();
    }

    if (state === 'play') {
      updatePlayer(dt);
      updateItems(dt);
      updateHazards(dt);

      if (player.carry) {
        const bin = currentBin();
        if (bin) deliverToBin(bin);
      }

      updateTimers(dt);
    }

    updateEffects(dt);
    syncHud();
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, h());
    g.addColorStop(0, '#dcfce7');
    g.addColorStop(0.42, '#86efac');
    g.addColorStop(0.78, '#22c55e');
    g.addColorStop(1, '#14532d');

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w(), h());

    ctx.fillStyle = 'rgba(6,95,70,.32)';
    for (let x = -80; x < w() + 100; x += 120) {
      const yy = h() - 166 + Math.sin(frame / 48 + x) * 4;
      Core.rect(ctx, x, yy, 50, 58, 12, 'rgba(6,95,70,.32)', null);
    }

    Core.rect(
      ctx,
      18,
      conveyorTop() - 16,
      w() - 36,
      conveyorBottom() - conveyorTop() + 44,
      24,
      'rgba(3,7,18,.14)',
      'rgba(255,255,255,.16)'
    );

    for (let x = -60 + (frame * (cfg.conveyor + rush * 0.13)) % 72; x < w() + 80; x += 72) {
      Core.rect(ctx, x, conveyorTop() - 4, 26, conveyorBottom() - conveyorTop() + 20, 9, 'rgba(15,23,42,.24)', null);
    }

    Core.text(ctx, 'ESTEIRA DE TRIAGEM', 38, conveyorTop() - 26, 14, '#052e16', 'left', 950);
  }

  function drawProgress() {
    const barW = Math.min(480, w() - 48);
    const x = 24;
    const y = 98;
    const progress = Core.clamp(delivered / cfg.target, 0, 1);
    const timePct = Core.clamp(timeLeft / cfg.time, 0, 1);

    Core.rect(ctx, x, y, barW, 18, 99, 'rgba(255,255,255,.24)', null);
    Core.rect(ctx, x, y, barW * progress, 18, 99, '#d9f99d', null);
    Core.text(ctx, `${delivered}/${cfg.target} reciclados`, x + barW / 2, y + 9, 13, '#052e16', 'center', 950);

    Core.rect(ctx, x, y + 28, barW, 13, 99, 'rgba(3,8,6,.24)', null);
    Core.rect(ctx, x, y + 28, barW * timePct, 13, 99, timePct > 0.28 ? '#fef08a' : '#ef4444', null);
    Core.text(ctx, `${Math.ceil(timeLeft)}s`, x + barW + 12, y + 38, 14, '#fef9c3', 'left', 950);
  }

  function drawItems() {
    const near = findItem();

    items.forEach((it) => {
      const y = it.y + Math.sin(it.bob) * 3;
      const pulse = 1 + Math.sin(it.pulse) * 0.030;

      ctx.save();
      ctx.translate(it.x + it.w / 2, y + it.h / 2);
      ctx.rotate(it.rot);
      ctx.scale(pulse, pulse);

      if (it.toxic) {
        ctx.shadowColor = 'rgba(168,85,247,.38)';
        ctx.shadowBlur = 7;
      }

      Core.rect(ctx, -it.w / 2, -it.h / 2, it.w, it.h, 14, it.color, 'rgba(255,255,255,.52)');
      Core.text(ctx, it.icon, 0, 2, it.toxic ? 23 : 24, '#fff', 'center');

      if (it.heavy) {
        Core.text(ctx, 'P', it.w / 2 - 9, -it.h / 2 + 12, 12, '#fef9c3', 'center', 950);
      }

      ctx.restore();

      if (near === it && !player.carry && state === 'play') {
        Core.text(ctx, 'E PARA PEGAR', it.x + it.w / 2, y - 16, 14, '#fef9c3', 'center', 950);
      }
    });
  }

  function drawHazards() {
    hazards.forEach((z) => {
      const pulse = 1 + Math.sin(z.pulse) * 0.025;

      ctx.save();
      ctx.translate(z.x + z.w / 2, z.y + z.h / 2);
      ctx.scale(pulse, pulse);

      Core.rect(ctx, -z.w / 2, -z.h / 2, z.w, z.h, 20, 'rgba(88,28,135,.76)', 'rgba(233,213,255,.54)');
      Core.text(ctx, '☣️', 0, 2, 24, '#fff', 'center', 950);

      ctx.restore();
    });
  }

  function drawBins() {
    const active = currentBin();
    const targetBin = getTargetBin();
    const time = frame / 14;

    for (let i = 0; i < 4; i++) {
      const b = binPos(i);
      const isActive = active && active.type === b.type;
      const isTarget = targetBin && targetBin.type === b.type;
      const isLocked = lockedBin === i && lockTimer > 0;

      if (isTarget && !isLocked) {
        Core.rect(ctx, b.x - 5, b.y - 5, b.w + 10, b.h + 10, 22, 'rgba(254,240,138,.54)', '#fef08a');
      }

      Core.rect(
        ctx,
        b.x,
        b.y,
        b.w,
        b.h,
        18,
        isLocked ? '#334155' : b.color,
        isActive ? '#fef9c3' : isTarget ? '#fef08a' : 'rgba(255,255,255,.45)'
      );

      Core.text(ctx, isLocked ? '🔒' : b.icon, b.x + b.w / 2, b.y + 27, 26, '#fff', 'center');
      Core.text(ctx, isLocked ? 'PROCESSANDO' : b.name, b.x + b.w / 2, b.y + 64, 12, '#fff', 'center', 950);

      if (isTarget && !isLocked) {
        const bounce = Math.sin(time) * 2;
        Core.text(ctx, 'ENTREGUE AQUI', b.x + b.w / 2, b.y - 12 + bounce, 13, '#fef9c3', 'center', 950);
      }

      if (isLocked) {
        Core.text(ctx, `${Math.ceil(lockTimer / 60)}s`, b.x + b.w / 2, b.y - 12, 13, '#e2e8f0', 'center', 950);
      }
    }
  }

  function drawPlayer() {
    ctx.save();

    if (player.inv > 0) {
      ctx.globalAlpha = 0.62 + Math.sin(frame * 0.35) * 0.18;
    }

    const moving = Math.abs(player.vx) + Math.abs(player.vy) > 0.2;
    Core.playerDraw(ctx, player, moving ? [I.walk, I.walk2] : I.idle, I.idle, { bob: 1.6 });

    ctx.restore();
    ctx.globalAlpha = 1;

    if (player.carry) {
      const y = player.y - 50 + Math.sin(frame / 12) * 2;
      Core.rect(ctx, player.x + 9, y, 50, 42, 13, player.carry.color, '#fff');
      Core.text(ctx, player.carry.icon, player.x + 34, y + 22, 23, '#fff', 'center');

      if (player.carry.heavy) {
        Core.text(ctx, 'PESADO', player.x + 34, y - 8, 12, '#fef9c3', 'center', 950);
      }
    }
  }

  function drawEffects() {
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / 38);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    sparks.forEach((s) => {
      ctx.globalAlpha = Math.max(0, s.life / 24);
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 4, s.y - s.vy * 4);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    floatingTexts.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life / 62);
      Core.text(ctx, f.text, f.x, f.y, 19, f.color, 'center', 950);
      ctx.globalAlpha = 1;
    });
  }

  function drawMessageBox() {
    let bg = 'rgba(3,8,6,.72)';
    let border = 'rgba(190,242,100,.32)';

    if (feedbackTimer > 0 && feedbackType === 'ok') {
      bg = 'rgba(20,83,45,.86)';
      border = 'rgba(217,249,157,.74)';
    }

    if (feedbackTimer > 0 && feedbackType === 'bad') {
      bg = 'rgba(127,29,29,.86)';
      border = 'rgba(254,202,202,.74)';
    }

    if (feedbackTimer > 0 && feedbackType === 'warn') {
      bg = 'rgba(113,63,18,.86)';
      border = 'rgba(254,240,138,.78)';
    }

    Core.rect(ctx, 24, 22, Math.min(890, w() - 48), 70, 22, bg, border);
    Core.wrap(ctx, msg, 46, 48, Math.min(835, w() - 92), 24, 18, '#f7fee7');
  }

  function drawCarryInstruction() {
    if (!player.carry || state !== 'play') return;

    const targetBin = getTargetBin();
    const boxW = Math.min(580, w() - 40);
    const boxH = 76;
    const x = w() / 2 - boxW / 2;
    const y = 140;

    Core.rect(ctx, x, y, boxW, boxH, 24, 'rgba(5,46,22,.90)', 'rgba(254,249,195,.72)');
    Core.text(ctx, `LEVE PARA: ${player.carry.name}`, w() / 2, y + 31, 28, '#fef9c3', 'center', 950);

    const detail = player.carry.heavy
      ? 'Item pesado: movimento reduzido. Evite áreas contaminadas.'
      : player.carry.toxic
        ? 'Item contaminado: vale mais pontos, mas qualquer toque derruba.'
        : 'A lixeira correta está destacada. Encoste nela para entregar.';

    Core.text(ctx, detail, w() / 2, y + 56, 15, '#dcfce7', 'center', 800);

    if (targetBin) {
      ctx.fillStyle = targetBin.color;
      ctx.globalAlpha = 0.34;
      ctx.fillRect(x + 12, y + boxH - 8, boxW - 24, 4);
      ctx.globalAlpha = 1;
    }
  }

  function drawOverlay(title, lines, button = 'Pressione E/Enter') {
    ctx.fillStyle = 'rgba(2,6,23,.48)';
    ctx.fillRect(0, 0, w(), h());

    const boxW = Math.min(720, w() - 40);
    const boxH = 250;
    const x = w() / 2 - boxW / 2;
    const y = h() / 2 - boxH / 2;

    Core.rect(ctx, x, y, boxW, boxH, 28, 'rgba(5,46,22,.93)', '#bef264');
    Core.text(ctx, title, w() / 2, y + 48, 34, '#f7fee7', 'center', 950);

    lines.forEach((line, i) => {
      Core.text(ctx, line, w() / 2, y + 92 + i * 29, 18, i === 0 ? '#dcfce7' : '#fef9c3', 'center', 760);
    });

    Core.text(ctx, button, w() / 2, y + boxH - 42, 22, '#fef08a', 'center', 950);
  }

  function draw() {
    ctx.save();

    if (shake > 0) {
      ctx.translate(Core.rnd(-shake / 2, shake / 2), Core.rnd(-shake / 2, shake / 2));
    }

    drawBackground();
    drawProgress();
    drawHazards();
    drawItems();
    drawBins();
    drawPlayer();
    drawEffects();
    drawMessageBox();
    drawCarryInstruction();

    ctx.restore();

    if (state === 'intro') {
      drawOverlay('Missão Final', [
        'Agora a central tem tempo limite, esteira e áreas contaminadas.',
        'Pegue com E/Enter. Leve cada resíduo para a lixeira correta.',
        'Itens pesados deixam você mais lento. Lixeiras podem travar.'
      ]);
    }

    if (state === 'gameover') {
      drawOverlay('Central sobrecarregada', [
        'Você perdeu por tempo ou por erros demais.',
        'Observe o nome do material, evite áreas contaminadas e use os combos.',
        `Meta da fase: ${cfg.target} entregas corretas.`
      ]);
    }

    if (state === 'done') {
      drawOverlay('GreenGo concluído!', [
        'A central foi organizada com sucesso.',
        `Pontuação final: ${Math.floor(score)} pontos.`,
        'Pressione para ver a tela final.'
      ]);
    }
  }

  function loop(now) {
    const rawDt = (now - lastTime) / 16.666;
    const dt = Core.clamp(rawDt || 1, 0.45, 1.45);
    lastTime = now;

    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  resetItems();
  resetHazards();
  player.y = h() / 2;

  requestAnimationFrame((now) => {
    lastTime = now;
    loop(now);
  });
})();
