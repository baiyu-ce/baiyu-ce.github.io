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
  header.classList.toggle('scrolled',p>0.38||y>top+range);
  scene.classList.toggle('underwater',p>0.4);
  scene.style.setProperty('--dive-p',p.toFixed(4));
  scene.style.setProperty('--surface-opacity',clamp((0.49-p)/0.13).toFixed(3));
  scene.style.setProperty('--submerged',clamp((p-0.14)/0.34).toFixed(3));
  scene.style.setProperty('--depth-shade',clamp((p-0.44)/0.8).toFixed(3));
  scene.style.setProperty('--evidence-opacity',Math.min(clamp((p-0.48)/0.13),clamp((0.86-p)/0.13)).toFixed(3));
  scene.style.setProperty('--origin-opacity',clamp((p-0.81)/0.15).toFixed(3));
  document.dispatchEvent(new CustomEvent('dive:progress',{detail:{progress:p,reducedMotion:preference.matches}}));
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
