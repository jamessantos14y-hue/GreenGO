(async()=>{
  Core.save('fase','missao2.html');
  const I=await Core.loadImages();
  const {ctx,w,h}=Core.setupCanvas();
  const inp=Core.input();
  const worldW=5400,cam={x:0};
  const p=Core.makePlayer(120);
  const dif=Core.get('dif','normal');
  p.life=dif==='facil'?4:3; p.speed=dif==='desafio'?5.65:5.35;
  let score=Core.get('score',0);
  const granny={x:250,y:0,w:86,h:130,vx:0,vy:0,ground:false,face:1,inv:0};
  const house={x:4850,w:360,h:230};
  let state='talk', msg='Fale com a vovó e leve-a até a casa.';
  let rolls=[],spawn=0,won=false,shake=0;
  function ground(){return h()-112}
  function hit(r,o){return r.x<o.x+o.w*.78&&r.x+r.w>o.x+o.w*.2&&r.y<o.y+o.h&&r.y+r.h>o.y+o.h*.36}
  function drawShoppingBag(x,y,size=1,angle=0){
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.scale(size,size);
    ctx.lineWidth=3;
    ctx.strokeStyle='#78350f';
    ctx.beginPath();
    ctx.moveTo(-11,-9);
    ctx.quadraticCurveTo(0,-24,11,-9);
    ctx.stroke();
    Core.rect(ctx,-17,-9,34,36,7,'#d97706','#fef3c7');
    ctx.fillStyle='rgba(255,255,255,.18)';
    ctx.fillRect(-10,-2,8,23);
    ctx.fillStyle='#84cc16';
    ctx.beginPath();
    ctx.ellipse(7,-13,7,3.7,-.45,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle='#ef4444';
    ctx.beginPath();
    ctx.arc(-7,-12,4,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
  }
  function drawGrannyBag(){
    if(state!=='talk') return;
    const x=granny.face>=0?granny.x+granny.w*.73:granny.x+granny.w*.27;
    const y=granny.y+granny.h*.64+Math.sin(Date.now()/240)*1.5;
    drawShoppingBag(x,y,.76,granny.face>=0?.05:-.05);
  }
  function drawPlayerBag(){
    if(state==='talk') return;
    const swing=Math.sin((p.walkAnim||0)*Math.PI)*3;
    const x=p.face>=0?p.x+p.w*.73:p.x+p.w*.27;
    const y=p.y+p.h*.59+swing;
    drawShoppingBag(x,y,.85,p.face>=0?.08:-.08);
  }
  function jumpBoth(){
    if(p.ground){p.vy=-15.4;p.ground=false}
    if((state==='escort'||state==='done')&&granny.ground){granny.vy=-15.2;granny.ground=false}
  }
  function damage(){
    if(p.inv>0) return;
    p.life--; p.inv=80; shake=18;
    msg='Pule antes do rolo chegar.';
    if(p.life<=0){
      p.life=dif==='facil'?4:3; p.x=120; p.y=ground()-p.h; granny.x=p.x-58; granny.y=ground()-granny.h;
      state='talk'; rolls=[]; won=false; msg='Tente de novo: fale com a vovó.';
    }
  }
  function updateGranny(){
    if(state!=='escort'&&state!=='done') return;
    const desired=p.face>=0?p.x-62:p.x+p.w-20;
    const gap=Math.abs(granny.x-desired);
    if(gap>270){granny.x=desired; granny.y=Math.min(granny.y,ground()-granny.h)}
    granny.vx=Core.clamp((desired-granny.x)*.18,-6.2,6.2);
    granny.face=p.face;
    granny.x+=granny.vx;
    granny.vy+=.68; if(granny.vy>16)granny.vy=16;
    granny.y+=granny.vy;
    if(granny.y+granny.h>=ground()){granny.y=ground()-granny.h;granny.vy=0;granny.ground=true}else granny.ground=false;
    if(p.vy<-1 && granny.ground){granny.vy=p.vy;granny.ground=false}
    if(granny.inv>0) granny.inv--;
  }
  function interact(){
    if(won){Core.save('score',Math.floor(score));Core.save('fase','missao3.html');Core.transition('missao3.html');return}
    if(state==='talk'&&Math.abs(p.x-granny.x)<210){
      state='escort'; granny.x=p.x-58; granny.y=ground()-granny.h; msg='Leve a sacola e acompanhe a vovó até a casa.'; spawn=65;
    }
  }
  function update(){
    Core.hud('Missão 2: Escolta da Vovó',msg,p.life,Math.floor(score));
    p.vx=0;
    if(inp.left()){p.vx=-p.speed;p.face=-1}
    if(inp.right()){p.vx=p.speed;p.face=1}
    if(inp.jump()) jumpBoth();
    if(inp.action()){interact();inp.clearAction()}
    Core.physics(p,ground(),worldW);
    if(state==='talk') granny.face=(p.x+p.w/2>=granny.x+granny.w/2)?1:-1;
    updateGranny();
    if(state==='escort'&&!won){
      spawn--;
      if(spawn<=0&&p.x<house.x-650){
        spawn=dif==='desafio'?112:142;
        const qtd=dif==='desafio'?2:1;
        for(let i=0;i<qtd;i++) rolls.push({x:p.x+w()+240+i*210,y:ground()-66,w:80,h:58,rot:0,s:Core.rnd(4.8,6.25)});
      }
      rolls.forEach(r=>{r.x-=r.s;r.rot-=.15});
      rolls=rolls.filter(r=>r.x>cam.x-260);
      rolls.forEach(r=>{if(hit(r,p)) damage()});
      score+=.04;
      if(p.x>house.x-135){won=true;state='done';score+=180;msg='Vovó em casa! Pressione E para continuar.';rolls=[]}
    }
    Core.cameraFollow(cam,p,w(),worldW);
    if(shake>0)shake--;
  }
  function draw(){
    const sx=shake?Math.sin(Date.now()/28)*5:0;
    Core.drawWorld(ctx,I.bg,cam.x-sx,w(),h(),worldW);
    ctx.save();ctx.translate(-cam.x+sx,0);
    Core.rect(ctx,620,ground()-190,330,190,16,'rgba(217,119,6,.55)','rgba(255,255,255,.2)');
    Core.text(ctx,'Mercado',785,ground()-214,20,'#fff7ed','center');
    Core.rect(ctx,house.x,ground()-house.h,house.w,house.h,18,'rgba(34,197,94,.58)','rgba(255,255,255,.24)');
    Core.text(ctx,'Casa da vovó',house.x+house.w/2,ground()-house.h-18,20,'#ecfccb','center');
    rolls.forEach(r=>{ctx.save();ctx.translate(r.x+r.w/2,r.y+r.h/2);ctx.rotate(r.rot);Core.rect(ctx,-r.w/2,-r.h/2,r.w,r.h,22,'#92400e','#fde68a');ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(-r.w/2+13,-r.h/2+10,9,r.h-20);ctx.restore()});
    if(I.vovo.complete){ctx.save();ctx.translate(granny.x+granny.w/2,granny.y+granny.h/2);ctx.scale(granny.face,1);ctx.drawImage(I.vovo,-granny.w/2,-granny.h/2,granny.w,granny.h);ctx.restore()}else Core.rect(ctx,granny.x,granny.y,granny.w,granny.h,18,'#a78bfa','#fff');
    drawGrannyBag();
    Core.playerDraw(ctx,p,Math.abs(p.vx)>0?[I.walk,I.walk2]:I.idle,I.idle);
    drawPlayerBag();
    if(state==='talk'&&Math.abs(p.x-granny.x)<230)Core.text(ctx,'E conversar',granny.x+granny.w/2,granny.y-20,16,'#fef9c3','center',900);
    ctx.restore();
    Core.drawDialog(ctx,msg,w(),h(),{
      x:18,
      y:88,
      maxWidth:Math.min(560,w()-36),
      height:64,
      size:16,
      prompt:won?'E para próxima missão':'E/Enter para interagir'
    });
  }
  function loop(){update();draw();requestAnimationFrame(loop)}
  p.y=ground()-p.h;granny.y=ground()-granny.h;loop();
})();
