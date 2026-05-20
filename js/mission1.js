(async()=>{
  Core.save('fase','jogo.html');
  const I=await Core.loadImages();
  const {ctx,w,h}=Core.setupCanvas();
  const inp=Core.input();
  const worldW=4700, cam={x:0};
  const p=Core.makePlayer(150);
  const dif=Core.get('dif','normal');
  p.life=dif==='facil'?4:3;
  p.speed=dif==='desafio'?5.7:5.35;
  let score=Core.get('score',0);
  let state='intro', msg='Fale com a garotinha para iniciar a busca pelo gato.';
  let flash=0, clue='';
  const girl={x:650,w:95,h:138};
  const bushes=[
    {x:850,w:150,h:88,big:false},{x:1120,w:260,h:126,big:true},{x:1480,w:145,h:88,big:false},
    {x:1810,w:270,h:126,big:true},{x:2230,w:150,h:88,big:false},{x:2570,w:270,h:126,big:true},
    {x:3020,w:150,h:88,big:false},{x:3360,w:280,h:126,big:true},{x:3820,w:150,h:88,big:false}
  ].map((b,i)=>({...b,id:i,searched:false,shake:0}));
  let target=Math.floor(Core.rnd(0,bushes.length));
  let finds=0;
  const needed=dif==='desafio'?5:4;
  let particles=[];

  function ground(){return h()-112}
  function center(o){return o.x+o.w/2}
  function chooseNewTarget(){
    const options=bushes.map((_,i)=>i).filter(i=>i!==target);
    target=options[Math.floor(Math.random()*options.length)]??target;
  }
  function resetRound(text){
    p.x=150; p.y=ground()-p.h; p.life--;
    flash=45; clue='';
    if(p.life<=0){
      p.life=dif==='facil'?4:3; finds=0; bushes.forEach(b=>{b.searched=false;b.shake=0}); chooseNewTarget(); state='intro';
      msg='Você se cansou. Fale com a garotinha para tentar de novo.';
    }else msg=text||'Tente de novo com calma.';
  }
  function nearBush(b){return Math.abs((p.x+p.w/2)-center(b))<120 && Math.abs((p.y+p.h)-ground())<30}
  function interact(){
    if(state==='done'){
      Core.save('score',Math.floor(score)); Core.save('fase','missao2.html'); Core.transition('missao2.html'); return;
    }
    if(state==='intro' && Math.abs(p.x-girl.x)<185){
      state='hunt';
      msg='O gato está escondido. Procure nos arbustos e use o som do miado como pista. Ele não aparece até você encontrar.';
      return;
    }
    if(state!=='hunt') return;
    const b=bushes.find(nearBush);
    if(!b){msg='Chegue encostado em um arbusto e pressione E para procurar.';return;}
    b.shake=22;
    if(b.id===target){
      finds++; score+=35;
      for(let i=0;i<28;i++) particles.push({x:center(b),y:ground()-b.h,xv:Core.rnd(-2.4,2.4),yv:Core.rnd(-7,-1),life:48,icon:i%4===0?'🐾':null});
      if(finds>=needed){
        state='done'; score+=150; clue='';
        msg='Você encontrou o gato pela última vez! Volte para a garotinha e pressione E.';
      }else{
        msg=`Você viu o gato por um instante, mas ele fugiu para outro arbusto. Encontrado ${finds}/${needed}.`;
        chooseNewTarget();
      }
    }else{
      b.searched=true; score=Math.max(0,score-5);
      msg='Nada aqui... continue procurando. Tente ouvir se o miado fica mais forte.';
    }
  }
  function updateClue(){
    if(state!=='hunt'){clue='';return;}
    const d=Math.abs((p.x+p.w/2)-center(bushes[target]));
    if(d<170) clue='🐱 MIAU! O som está muito perto.';
    else if(d<420) clue='Você ouve um miado por perto...';
    else clue='O som do gato está distante.';
  }
  function update(){
    Core.hud('Missão 1: Gato Escondido',`${msg}${clue?` • ${clue}`:''}`,p.life,Math.floor(score));
    p.vx=0;
    if(inp.left()){p.vx=-p.speed;p.face=-1}
    if(inp.right()){p.vx=p.speed;p.face=1}
    if(inp.jump()&&p.ground){p.vy=p.jump;p.ground=false}
    if(inp.action()){interact();inp.clearAction()}
    Core.physics(p,ground(),worldW);
    if(p.y>h()+120) resetRound('Você caiu. Volte à trilha e continue procurando.');
    bushes.forEach(b=>{if(b.shake>0)b.shake--});
    particles=particles.filter(a=>(a.x+=a.xv,a.y+=a.yv,a.yv+=.18,--a.life>0));
    updateClue();
    Core.cameraFollow(cam,p,w(),worldW);
    if(flash>0)flash--;
  }
  function draw(){
    Core.drawWorld(ctx,I.bg,cam.x,w(),h(),worldW);
    ctx.save();ctx.translate(-cam.x,0);
    if(I.girl.complete)ctx.drawImage(I.girl,girl.x,ground()-girl.h,girl.w,girl.h);
    Core.text(ctx,'Garotinha',girl.x+girl.w/2,ground()-girl.h-18,18,'#ecfccb','center');

    bushes.forEach((b)=>{
      const y=ground()-b.h+(b.big?24:0);
      const dx=b.shake?Math.sin(Date.now()/36)*7:0;
      if(b.searched){ctx.globalAlpha=.82}
      if(b.big&&I.bushBig.complete)ctx.drawImage(I.bushBig,b.x+dx,y,b.w,b.h);
      else if(I.bush.complete)ctx.drawImage(I.bush,b.x+dx,y,b.w,b.h);
      else {Core.rect(ctx,b.x+dx,y,b.w,b.h,22,'#166534','#86efac')}
      ctx.globalAlpha=1;
      if(nearBush(b)&&state==='hunt'){
        Core.text(ctx,'E procurar',b.x+b.w/2,y-20,16,'#fef9c3','center',900);
      }
    });

    // O gato fica invisível durante a busca. Só aparece rapidamente nas partículas quando encontrado.
    Core.playerDraw(ctx,p,Math.abs(p.vx)>0?I.walk:I.idle,I.idle);
    particles.forEach(a=>{ctx.globalAlpha=a.life/48;if(a.icon)Core.text(ctx,a.icon,a.x,a.y,22,'#fff','center');else{ctx.fillStyle='#d9f99d';ctx.beginPath();ctx.arc(a.x,a.y,4,0,Math.PI*2);ctx.fill()}ctx.globalAlpha=1});
    ctx.restore();
    drawDialog();
    if(flash){ctx.fillStyle=`rgba(239,68,68,${flash/130})`;ctx.fillRect(0,0,w(),h())}
  }
  function drawDialog(){
    const bx=24,by=h()-196,bw=Math.min(800,w()-48),bh=108;
    Core.rect(ctx,bx,by,bw,bh,22,'rgba(3,8,6,.80)','rgba(190,242,100,.35)');
    Core.wrap(ctx,msg,bx+22,by+28,bw-44,28,21,'#f7fee7');
    Core.text(ctx,state==='done'?'E para próxima missão':'E/Enter para interagir',bx+22,by+86,16,'#bbf7d0');
  }
  function loop(){update();draw();requestAnimationFrame(loop)}
  p.y=ground()-p.h;loop();
})();
