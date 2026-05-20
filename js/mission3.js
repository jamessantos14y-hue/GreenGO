(async()=>{
  Core.save('fase','missao3.html');
  await Core.loadImages();
  const {ctx,w,h}=Core.setupCanvas();
  const inp=Core.input();
  const dif=Core.get('dif','normal');
  let score=Core.get('score',0), life=dif==='facil'?4:3;
  let state='ready', msg='Limpe o rio coletando recicláveis. Desvie dos obstáculos e mantenha o barco estável.';
  const boat={x:130,y:0,w:96,h:56,vx:0,vy:0,inv:0};
  let items=[],ripples=[],timer=0,clean=0,combo=0;
  const target=dif==='desafio'?20:16;

  function goodIcon(){return ['♻️','🧴','🥫','📄'][Math.floor(Math.random()*4)]}
  function badIcon(){return ['🪨','🐟','⚠️'][Math.floor(Math.random()*3)]}
  function spawn(){
    const good=Math.random()>.34;
    const size=good?42:52;
    items.push({x:w()+90,y:Core.rnd(118,h()-185),w:size,h:size,s:Core.rnd(3.4,6.0)+(dif==='desafio'?0.8:0),good,rot:0,icon:good?goodIcon():badIcon(),pulse:Math.random()*10});
  }
  function overlap(a,b){return a.x<a.w+b.x && a.x+a.w>b.x && a.y<a.y+b.h && a.y+a.h>b.y}
  function start(){state='play';msg='Use ←/→ e ↑ para controlar. Pegue itens verdes e evite os vermelhos.';items=[];timer=12;combo=0}
  function hitBad(){
    if(boat.inv>0)return;
    life--; combo=0; boat.inv=75;
    msg='Bateu em obstáculo! Você fica invencível por um instante.';
    if(life<=0){life=dif==='facil'?4:3;clean=0;items=[];state='ready';msg='O rio poluiu novamente. Pressione E para tentar de novo.'}
  }
  function update(){
    Core.hud('Missão 3: Rio Limpo',`${msg} Progresso: ${clean}/${target}`,life,Math.floor(score));
    if(inp.action()&&state==='ready'){start();inp.clearAction()}
    if(inp.action()&&state==='done'){Core.save('score',Math.floor(score));Core.save('fase','missao4.html');Core.transition('missao4.html');inp.clearAction()}
    if(state!=='play')return;

    boat.vx=0;
    if(inp.left())boat.vx=-6.4;
    if(inp.right())boat.vx=6.4;
    if(inp.jump())boat.vy-=0.85; else boat.vy+=0.52;
    boat.vy=Core.clamp(boat.vy,-6.2,5.3);
    boat.x=Core.clamp(boat.x+boat.vx,24,w()-boat.w-24);
    boat.y=Core.clamp(boat.y+boat.vy,105,h()-boat.h-126);
    if((boat.y<=105&&boat.vy<0)||(boat.y>=h()-boat.h-126&&boat.vy>0))boat.vy*=.25;

    if(boat.inv>0)boat.inv--;
    timer--;
    if(timer<=0){timer=dif==='desafio'?32:40;spawn(); if(Math.random()<.18)spawn()}
    items.forEach(it=>{it.x-=it.s;it.rot+=it.good?.045:.08;it.pulse+=.08});
    items.forEach(it=>{
      if(overlap({x:boat.x+8,y:boat.y+8,w:boat.w-16,h:boat.h-16},it)){
        it.dead=true;
        ripples.push({x:it.x+it.w/2,y:it.y+it.h/2,r:5,life:35,good:it.good});
        if(it.good){clean++;combo++;score+=35+Math.min(combo*4,32);msg=combo>=3?`Combo x${combo}! Continue limpando.`:'Boa coleta!'}
        else hitBad();
      }
    });
    items=items.filter(i=>!i.dead&&i.x>-120);
    ripples=ripples.filter(r=>(r.r+=1.6,--r.life>0));
    if(clean>=target){state='done';score+=210;items=[];msg='Rio limpo! Pressione E para ir para a central de reciclagem.'}
  }
  function drawBg(){
    const g=ctx.createLinearGradient(0,0,0,h());
    g.addColorStop(0,'#38bdf8');g.addColorStop(.42,'#67e8f9');g.addColorStop(1,'#075985');
    ctx.fillStyle=g;ctx.fillRect(0,0,w(),h());
    ctx.strokeStyle='rgba(255,255,255,.20)';ctx.lineWidth=3;
    for(let y=115;y<h()-98;y+=42){ctx.beginPath();for(let x=-30;x<w()+90;x+=30){ctx.lineTo(x,y+Math.sin((x+Date.now()/22)/72)*7)}ctx.stroke()}
    ctx.fillStyle='rgba(6,78,59,.85)';ctx.fillRect(0,h()-105,w(),105);
    ctx.fillStyle='rgba(187,247,208,.30)';for(let x=0;x<w();x+=120)ctx.fillRect(x,h()-108,65,7);
  }
  function draw(){
    drawBg();
    const barW=Math.min(460,w()-48), barX=24, barY=92;
    Core.rect(ctx,barX,barY,barW,18,99,'rgba(255,255,255,.18)',null);
    Core.rect(ctx,barX,barY,barW*(clean/target),18,99,'#84cc16',null);
    Core.text(ctx,`${clean}/${target}`,barX+barW/2,barY+9,13,'#052e16','center',950);

    ripples.forEach(r=>{ctx.globalAlpha=r.life/35;ctx.strokeStyle=r.good?'#d9f99d':'#fecaca';ctx.lineWidth=3;ctx.beginPath();ctx.arc(r.x,r.y,r.r,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1});
    items.forEach(it=>{ctx.save();ctx.translate(it.x+it.w/2,it.y+it.h/2);ctx.rotate(it.rot);const glow=it.good?'rgba(132,204,22,.35)':'rgba(239,68,68,.30)';ctx.shadowColor=glow;ctx.shadowBlur=14;Core.rect(ctx,-it.w/2,-it.h/2,it.w,it.h,14,it.good?'#84cc16':'#ef4444','rgba(255,255,255,.48)');Core.text(ctx,it.icon,0,1,24,'#fff','center',950);ctx.restore()});
    ctx.save();ctx.translate(boat.x+boat.w/2,boat.y+boat.h/2);if(boat.inv>0)ctx.globalAlpha=.55+.25*Math.sin(Date.now()/55);Core.rect(ctx,-boat.w/2,-boat.h/2,boat.w,boat.h,20,'#f59e0b','#fff7ed');Core.text(ctx,'🚣',0,-2,36,'#fff','center');ctx.restore();ctx.globalAlpha=1;
    Core.rect(ctx,24,h()-170,Math.min(830,w()-48),88,22,'rgba(3,8,6,.80)','rgba(190,242,100,.35)');
    Core.wrap(ctx,msg,46,h()-140,Math.min(780,w()-92),26,20,'#f7fee7');
    if(state==='ready')Core.text(ctx,'Pressione E/Enter para iniciar',w()/2,h()/2,30,'#052e16','center',950);
    if(state==='done')Core.text(ctx,'Pressione E/Enter para continuar',w()/2,h()/2,30,'#052e16','center',950);
  }
  function loop(){update();draw();requestAnimationFrame(loop)}
  boat.y=h()/2;loop();
})();
