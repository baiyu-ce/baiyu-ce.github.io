'use strict';
// Native scroll only. The scene is decorative; content and anchors work without JS.
(()=>{
 const scene=document.getElementById('dive'),header=document.querySelector('.header'),counter=document.getElementById('depth-progress');
 if(!scene||!header)return;
 const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
 let top=0,range=1,frame=0,previousCount=-1;
 const clamp=x=>Math.max(0,Math.min(1,x));
 function render(){
  frame=0;if(document.hidden)return;
  const y=window.scrollY,p=preference.matches?0:clamp((y-top)/range);
  header.classList.toggle('scrolled',y>45);
  scene.style.setProperty('--dive-p',p.toFixed(4));
  scene.style.setProperty('--surface-opacity',clamp(1-p/0.28).toFixed(3));
  scene.style.setProperty('--evidence-opacity',Math.min(clamp((p-0.2)/0.17),clamp((0.78-p)/0.18)).toFixed(3));
  scene.style.setProperty('--origin-opacity',clamp((p-0.7)/0.24).toFixed(3));
  const count=Math.round(p*100);if(counter&&count!==previousCount){counter.textContent=String(count).padStart(2,'0');previousCount=count;}
 }
 function schedule(){if(!frame&&!document.hidden)frame=window.requestAnimationFrame(render);}
 function measure(){top=scene.getBoundingClientRect().top+window.scrollY;range=Math.max(1,scene.offsetHeight-scene.querySelector('.dive-stage').offsetHeight);schedule();}
 function configure(){document.documentElement.classList.toggle('has-dive-motion',!preference.matches);measure();}
 window.addEventListener('scroll',schedule,{passive:true});
 window.addEventListener('resize',measure,{passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&frame){window.cancelAnimationFrame(frame);frame=0;}else schedule();});
 preference.addEventListener('change',configure);
 configure();
})();
