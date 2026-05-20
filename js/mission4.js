(async () => {
  Core.save("fase", "missao4.html");

  const { ctx, w, h } = Core.setupCanvas();
  const inp = Core.input();
  const dif = Core.get("dif", "normal");

  let score = Core.get("score", 0);
  let state = "intro";

  const types = [
    ["papel", "#3b82f6", "📄", "PAPEL"],
    ["plastico", "#ef4444", "🥤", "PLÁSTICO"],
    ["vidro", "#22c55e", "🍾", "VIDRO"],
    ["metal", "#f59e0b", "🥫", "METAL"],
  ];

  const player = {
    x: 90,
    y: 0,
    w: 66,
    h: 82,
    vx: 0,
    vy: 0,
    carry: null,
    face: 1,
  };

  let items = [];
  let delivered = 0;
  let wrong = 0;
  let streak = 0;
  let particles = [];
  let floatingTexts = [];

  let msg = "Central de reciclagem: pegue um resíduo e leve até a lixeira correta.";
  let feedbackType = "info";
  let feedbackTimer = 0;
  let lastAutoDelivery = 0;
  let finishing = false;

  const target = dif === "desafio" ? 20 : 16;

  const audio = {
    ctx: null,

    ensure() {
      try {
        if (!this.ctx) {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) this.ctx = new AudioContextClass();
        }

        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume();
        }
      } catch (e) {}
    },

    beep(type = "ok") {
      try {
        this.ensure();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type === "bad" ? "sawtooth" : "sine";
        osc.frequency.setValueAtTime(type === "bad" ? 180 : 660, now);
        osc.frequency.exponentialRampToValueAtTime(type === "bad" ? 90 : 980, now + 0.12);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(type === "bad" ? 0.12 : 0.09, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.2);
      } catch (e) {}
    },
  };

  function setMsg(text, type = "info", timer = 120) {
    msg = text;
    feedbackType = type;
    feedbackTimer = timer;
  }

  function addFloatingText(text, x, y, color = "#f7fee7") {
    floatingTexts.push({
      text,
      x,
      y,
      vy: -0.8,
      life: 80,
      color,
    });
  }

  function addParticles(x, y, color, amount = 18) {
    for (let i = 0; i < amount; i++) {
      particles.push({
        x,
        y,
        vx: Core.rnd(-35, 35) / 10,
        vy: Core.rnd(-42, 18) / 10,
        r: Core.rnd(3, 8),
        life: Core.rnd(34, 62),
        color,
      });
    }
  }

  function makeItem(i) {
    const t = types[Math.floor(Math.random() * types.length)];

    return {
      x: Core.rnd(70, w() - 120),
      y: Core.rnd(128, h() - 260),
      w: 46,
      h: 46,
      type: t[0],
      color: t[1],
      icon: t[2],
      name: t[3],
      id: i,
      bob: Math.random() * 10,
      pulse: Math.random() * 6,
    };
  }

  function resetItems() {
    items = Array.from({ length: 12 }, (_, i) => makeItem(i));
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

  function findItem() {
    if (player.carry) return null;

    return items.find((it) => {
      const playerCX = player.x + player.w / 2;
      const playerCY = player.y + player.h / 2;
      const itemCX = it.x + it.w / 2;
      const itemCY = it.y + it.h / 2;

      return Math.abs(itemCX - playerCX) < 62 && Math.abs(itemCY - playerCY) < 70;
    });
  }

  function getTargetBin() {
    if (!player.carry) return null;

    for (let i = 0; i < 4; i++) {
      const b = binPos(i);
      if (b.type === player.carry.type) return b;
    }

    return null;
  }

  function pickItem(item) {
    if (!item) return;
    if (player.carry) return;

    player.carry = item;
    items = items.filter((i) => i !== item);

    setMsg(`Leve para: ${item.name}`, "info", 180);
    addFloatingText(`Leve para: ${item.name}`, player.x + player.w / 2, player.y - 28, "#fef9c3");
    addParticles(item.x + item.w / 2, item.y + item.h / 2, item.color, 10);

    audio.beep("ok");
  }

  function deliverToBin(bin) {
    if (!player.carry || !bin || finishing) return;

    const now = performance.now();

    if (now - lastAutoDelivery < 500) return;
    lastAutoDelivery = now;

    const item = player.carry;

    if (item.type === bin.type) {
      delivered++;
      streak++;

      const bonus = 50 + Math.min(streak * 8, 60);
      score += bonus;

      setMsg(
        streak >= 3
          ? `Perfeito! Sequência x${streak}. ${delivered}/${target}`
          : `Correto! ${delivered}/${target} reciclados.`,
        "ok",
        120
      );

      addParticles(player.x + player.w / 2, player.y + player.h / 2, item.color, 28);
      addFloatingText(`+${bonus}`, player.x + player.w / 2, player.y - 18, "#d9f99d");
      audio.beep("ok");
    } else {
      wrong++;
      streak = 0;
      score = Math.max(0, score - 25);

      setMsg(`${item.icon} vai em ${item.name}. Essa era a lixeira ${bin.name}.`, "bad", 150);

      addParticles(player.x + player.w / 2, player.y + player.h / 2, "#ef4444", 18);
      addFloatingText("LIXEIRA ERRADA", player.x + player.w / 2, player.y - 18, "#fecaca");
      audio.beep("bad");
    }

    player.carry = null;

    while (items.length < 10) {
      items.push(makeItem(Date.now() + items.length));
    }

    if (delivered >= target && !finishing) {
      finishing = true;

      setMsg("Missão concluída! Central de reciclagem organizada.", "ok", 120);
      addParticles(player.x + player.w / 2, player.y + player.h / 2, "#bef264", 45);
      audio.beep("ok");

      setTimeout(() => {
        Core.save("score", Math.floor(score + 260));
        Core.save("fase", "final.html");
        Core.transition("final.html");
      }, 800);
    }
  }

  function interact() {
    audio.ensure();

    if (state === "intro") {
      state = "play";
      setMsg("Pegue um resíduo. Depois encoste na lixeira correta para entregar automaticamente.", "info", 160);
      return;
    }

    if (state !== "play") return;

    if (!player.carry) {
      const found = findItem();

      if (found) {
        pickItem(found);
      } else {
        setMsg("Chegue mais perto de um resíduo para pegar.", "info", 100);
      }
    } else {
      setMsg(`Você já está carregando ${player.carry.icon}. Leve para: ${player.carry.name}`, "info", 120);
    }
  }

  function updatePlayer() {
    player.vx = 0;
    player.vy = 0;

    if (inp.left()) {
      player.vx = -6.2;
      player.face = -1;
    }

    if (inp.right()) {
      player.vx = 6.2;
      player.face = 1;
    }

    if (inp.jump()) {
      player.vy = -6.2;
    }

    if (inp.keys.ArrowDown || inp.keys.s || inp.keys.S) {
      player.vy = 6.2;
    }

    if (!inp.jump() && !(inp.keys.ArrowDown || inp.keys.s || inp.keys.S)) {
      player.vy += 2.1;
    }

    player.x = Core.clamp(player.x + player.vx, 18, w() - player.w - 18);
    player.y = Core.clamp(player.y + player.vy, 92, h() - player.h - 132);
  }

  function updateEffects() {
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.06;
      p.life--;
    });

    particles = particles.filter((p) => p.life > 0);

    floatingTexts.forEach((f) => {
      f.y += f.vy;
      f.life--;
    });

    floatingTexts = floatingTexts.filter((f) => f.life > 0);
  }

  function update() {
    const lives = Math.max(0, 3 - wrong);

    Core.hud(
      "Missão Final: Central de Reciclagem",
      `${msg} Acertos: ${delivered}/${target}`,
      lives,
      Math.floor(score)
    );

    if (inp.action()) {
      interact();
      inp.clearAction();
    }

    if (state !== "play") {
      updateEffects();
      return;
    }

    updatePlayer();

    const found = findItem();

    if (found && !player.carry) {
      pickItem(found);
    }

    if (player.carry) {
      const bin = currentBin();

      if (bin) {
        deliverToBin(bin);
      }
    }

    items.forEach((it) => {
      it.bob += 0.08;
      it.pulse += 0.08;
    });

    if (feedbackTimer > 0) feedbackTimer--;

    updateEffects();

    if (wrong >= 3) {
      wrong = 0;
      delivered = 0;
      streak = 0;
      score = Math.max(0, score - 120);
      player.carry = null;

      resetItems();

      setMsg("A central reiniciou. Observe o nome do material antes de entregar.", "bad", 180);
      addParticles(player.x + player.w / 2, player.y + player.h / 2, "#ef4444", 30);
      audio.beep("bad");
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, h());

    g.addColorStop(0, "#bbf7d0");
    g.addColorStop(0.48, "#22c55e");
    g.addColorStop(1, "#14532d");

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w(), h());

    ctx.fillStyle = "rgba(6,95,70,.45)";

    for (let x = 0; x < w(); x += 76) {
      ctx.fillRect(x + Math.sin(Date.now() / 500 + x) * 8, h() - 158, 42, 52);
    }

    ctx.fillStyle = "rgba(255,255,255,.08)";

    for (let i = 0; i < 20; i++) {
      const x = (i * 143 + Date.now() / 80) % (w() + 80) - 40;
      const y = 130 + ((i * 71) % Math.max(160, h() - 300));

      ctx.beginPath();
      ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawProgress() {
    const progressW = Math.min(460, w() - 48);

    Core.rect(ctx, 24, 100, progressW, 18, 99, "rgba(255,255,255,.22)", null);
    Core.rect(ctx, 24, 100, progressW * (delivered / target), 18, 99, "#d9f99d", null);
    Core.text(ctx, `${delivered}/${target}`, 24 + progressW / 2, 109, 13, "#052e16", "center", 950);
  }

  function drawItems() {
    const near = findItem();

    items.forEach((it) => {
      const y = it.y + Math.sin(it.bob) * 4;
      const pulse = 1 + Math.sin(it.pulse) * 0.04;

      ctx.save();
      ctx.translate(it.x + it.w / 2, y + it.h / 2);
      ctx.scale(pulse, pulse);

      Core.rect(ctx, -it.w / 2, -it.h / 2, it.w, it.h, 13, it.color, "rgba(255,255,255,.55)");
      Core.text(ctx, it.icon, 0, 2, 24, "#fff", "center");

      ctx.restore();

      if (near === it && !player.carry) {
        Core.text(ctx, "PEGANDO...", it.x + it.w / 2, y - 16, 14, "#fef9c3", "center", 900);
      }
    });
  }

  function drawBins() {
    const active = currentBin();
    const targetBin = getTargetBin();
    const time = Date.now() / 180;

    for (let i = 0; i < 4; i++) {
      const b = binPos(i);
      const isActive = active && active.type === b.type;
      const isTarget = targetBin && targetBin.type === b.type;
      const glow = isTarget ? 10 + Math.sin(time) * 5 : 0;

      if (isTarget) {
        ctx.save();
        ctx.shadowColor = "#fef08a";
        ctx.shadowBlur = 32 + glow;

        Core.rect(
          ctx,
          b.x - 4,
          b.y - 4,
          b.w + 8,
          b.h + 8,
          22,
          "rgba(254,240,138,.65)",
          "#fef08a"
        );

        ctx.restore();
      }

      Core.rect(
        ctx,
        b.x,
        b.y,
        b.w,
        b.h,
        18,
        b.color,
        isActive ? "#fef9c3" : isTarget ? "#fef08a" : "rgba(255,255,255,.45)"
      );

      Core.text(ctx, b.icon, b.x + b.w / 2, b.y + 27, 26, "#fff", "center");
      Core.text(ctx, b.name, b.x + b.w / 2, b.y + 64, 13, "#fff", "center", 950);

      if (isTarget) {
        Core.text(ctx, "ENTREGUE AQUI", b.x + b.w / 2, b.y - 12, 13, "#fef9c3", "center", 950);
      }
    }
  }

  function drawPlayer() {
    ctx.save();

    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    ctx.scale(player.face, 1);

    Core.rect(ctx, -player.w / 2, -player.h / 2, player.w, player.h, 18, "#064e3b", "#ecfccb");
    Core.text(ctx, "🧑‍🌾", 0, 0, 39, "#fff", "center");

    ctx.restore();

    if (player.carry) {
      Core.rect(ctx, player.x + 10, player.y - 48, 48, 40, 12, player.carry.color, "#fff");
      Core.text(ctx, player.carry.icon, player.x + 34, player.y - 28, 23, "#fff", "center");
    }
  }

  function drawEffects() {
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / 62);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 1;
    });

    floatingTexts.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life / 80);
      Core.text(ctx, f.text, f.x, f.y, 20, f.color, "center", 950);
      ctx.globalAlpha = 1;
    });
  }

  function drawMessageBox() {
    let bg = "rgba(3,8,6,.70)";
    let border = "rgba(190,242,100,.32)";

    if (feedbackTimer > 0 && feedbackType === "ok") {
      bg = "rgba(20,83,45,.86)";
      border = "rgba(217,249,157,.75)";
    }

    if (feedbackTimer > 0 && feedbackType === "bad") {
      bg = "rgba(127,29,29,.86)";
      border = "rgba(254,202,202,.75)";
    }

    Core.rect(ctx, 24, 24, Math.min(850, w() - 48), 68, 22, bg, border);
    Core.wrap(ctx, msg, 46, 50, Math.min(800, w() - 92), 24, 19, "#f7fee7");
  }

  function drawBigCarryInstruction() {
    if (!player.carry || state !== "play") return;

    const name = player.carry.name;
    const targetBin = getTargetBin();
    const color = targetBin ? targetBin.color : "#166534";

    const boxW = Math.min(560, w() - 40);
    const boxH = 74;
    const x = w() / 2 - boxW / 2;
    const y = 134;

    ctx.save();

    ctx.shadowColor = "#000";
    ctx.shadowBlur = 18;

    Core.rect(ctx, x, y, boxW, boxH, 24, "rgba(5,46,22,.88)", "rgba(254,249,195,.75)");
    Core.text(ctx, `LEVE PARA: ${name}`, w() / 2, y + 31, 30, "#fef9c3", "center", 950);
    Core.text(
      ctx,
      "A lixeira correta está brilhando. Encoste nela para entregar.",
      w() / 2,
      y + 56,
      15,
      "#dcfce7",
      "center",
      800
    );

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x + 10, y + boxH - 8, boxW - 20, 4);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawIntro() {
    if (state !== "intro") return;

    const boxW = Math.min(660, w() - 40);
    const boxH = 190;
    const x = w() / 2 - boxW / 2;
    const y = h() / 2 - boxH / 2;

    Core.rect(ctx, x, y, boxW, boxH, 26, "rgba(5,46,22,.90)", "#bef264");
    Core.text(ctx, "Central de Reciclagem", w() / 2, h() / 2 - 45, 34, "#f7fee7", "center", 950);
    Core.text(ctx, "Pegue os resíduos e leve para a lixeira correta.", w() / 2, h() / 2 - 5, 19, "#dcfce7", "center", 700);
    Core.text(ctx, "A entrega é automática ao encostar na lixeira.", w() / 2, h() / 2 + 25, 17, "#fef9c3", "center", 700);
    Core.text(ctx, "Pressione E/Enter para começar", w() / 2, h() / 2 + 65, 22, "#fef08a", "center", 950);
  }

  function draw() {
    drawBackground();
    drawProgress();
    drawItems();
    drawBins();
    drawPlayer();
    drawEffects();
    drawMessageBox();
    drawBigCarryInstruction();
    drawIntro();
  }

  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  resetItems();
  player.y = h() / 2;

  loop();
})();