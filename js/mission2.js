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
  let state='talk', msg='Fale com a vovó. Ela ficará quase colada em você durante o caminho.';
  let rolls=[],spawn=0,won=false,shake=0;
  function ground(){return h()-112}
  function hit(r,o){return r.x<o.x+o.w*.78&&r.x+r.w>o.x+o.w*.2&&r.y<o.y+o.h&&r.y+r.h>o.y+o.h*.36}
  function jumpBoth(){
    if(p.ground){p.vy=-15.4;p.ground=false}
    if(state==='escort'&&granny.ground){granny.vy=-15.2;granny.ground=false}
  }
  function damage(){
    if(p.inv>0) return;
    p.life--; p.inv=80; shake=18;
    msg='Cuidado! A vovó está junto de você, então pule antes do rolo chegar.';
    if(p.life<=0){
      p.life=dif==='facil'?4:3; p.x=120; p.y=ground()-p.h; granny.x=p.x-58; granny.y=ground()-granny.h;
      state='talk'; rolls=[]; won=false; msg='Tente novamente. Fale com a vovó para reiniciar a escolta.';
    }
  }
  function updateGranny(){
    if(state!=='escort') return;
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
      state='escort'; granny.x=p.x-58; granny.y=ground()-granny.h; msg='Agora vá até a casa. A vovó acompanha de perto; use pulo nos rolos.'; spawn=65;
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
      if(p.x>house.x-135){won=true;state='done';score+=180;msg='Você levou a vovó para casa! Pressione E para continuar.';rolls=[]}
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
    Core.playerDraw(ctx,p,Math.abs(p.vx)>0?I.walk:I.idle,I.idle);
    if(state==='talk'&&Math.abs(p.x-granny.x)<230)Core.text(ctx,'E conversar',granny.x+granny.w/2,granny.y-20,16,'#fef9c3','center',900);
    ctx.restore();
    Core.rect(ctx,24,h()-170,Math.min(810,w()-48),88,22,'rgba(3,8,6,.80)','rgba(190,242,100,.35)');
    Core.wrap(ctx,msg,46,h()-140,Math.min(760,w()-92),26,20,'#f7fee7');
  }
  function loop(){update();draw();requestAnimationFrame(loop)}
  p.y=ground()-p.h;granny.y=ground()-granny.h;loop();
})();
