'use strict';
// A decorative foreground; the CSS underwater layer remains the fallback.
(()=>{
 const scene=document.getElementById('dive');
 const canvas=scene&&scene.querySelector('.water-canvas');
 if(!canvas)return;
 const root=document.documentElement;
 const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
 const clamp=value=>Math.max(0,Math.min(1,value));
 let progress=clamp(parseFloat(getComputedStyle(scene).getPropertyValue('--dive-p'))||0);
 let reduced=preference.matches,visible=false,ready=false,failed=false,frame=0;
 let lastDraw=-Infinity,elapsed=0,lastTick=0,width=1,height=1,dirtySize=true;
 let gl,program,texture,buffer,observer,loadTimer,surfaceRenderer;
 canvas.style.visibility='hidden';
 function stop(){if(frame)cancelAnimationFrame(frame);frame=0;lastTick=0;}
 function fallback(){
  if(failed)return;
  failed=true;ready=false;stop();clearTimeout(loadTimer);
  root.classList.remove('has-water-renderer');canvas.style.visibility='hidden';
  if(surfaceRenderer)surfaceRenderer.dispose();
  if(observer)observer.disconnect();
  if(gl&&!gl.isContextLost()){
   if(texture)gl.deleteTexture(texture);
   if(buffer)gl.deleteBuffer(buffer);
   if(program)gl.deleteProgram(program);
  }
 }
 try{
  gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
  if(!gl){fallback();return;}
  const vertexSource=`
   attribute vec2 aPosition;
   varying vec2 vUV;
   void main(){vUV=aPosition*0.5+0.5;gl_Position=vec4(aPosition,0.0,1.0);}
  `;
  const fragmentSource=`
   precision mediump float;
   varying vec2 vUV;
   uniform sampler2D uImage;
   uniform vec2 uSize;
   uniform float uImageAspect;
   uniform float uProgress;
   uniform float uTime;
   void main(){
    vec2 screen=vec2(vUV.x,1.0-vUV.y);
    float crossing=smoothstep(0.08,0.50,uProgress);
    float line=mix(1.10,-0.10,crossing);
    float wave=0.012*sin(screen.x*11.0+uTime*0.58)
              +0.006*sin(screen.x*25.0-uTime*0.82)
              +0.003*cos(screen.x*43.0+uTime*0.33);
    float distanceToWater=screen.y-(line+wave);
    float pixel=1.25/uSize.y;
    if(distanceToWater < -pixel)discard;
    float alpha=smoothstep(-pixel,pixel,distanceToWater);
    float aspect=uSize.x/uSize.y;
    vec2 cover=vec2(min(1.0,aspect/uImageAspect),min(1.0,uImageAspect/aspect));
    vec2 uv=(screen-0.5)*cover+0.5;
    float edge=exp(-max(distanceToWater,0.0)*55.0);
    float depth=smoothstep(0.0,0.7,max(distanceToWater,0.0));
    uv.x+=edge*0.0035*sin(screen.x*34.0+uTime*0.60);
    uv.y+=edge*0.018*cos(screen.x*21.0-uTime*0.40);
    uv+=vec2(sin(uTime*0.16+screen.y*4.0),cos(uTime*0.12+screen.x*3.0))*0.0012*depth;
    uv=(uv-0.5)/(1.012+0.012*uProgress)+0.5;
    vec3 color=texture2D(uImage,clamp(uv,0.001,0.999)).rgb;
    float rim=exp(-abs(distanceToWater)*uSize.y*0.23);
    color=mix(color,vec3(0.68,0.83,0.80),rim*0.32);
    color*=1.0-edge*0.22;
    gl_FragColor=vec4(color,alpha);
   }
  `;
  function compile(type,source){
   const shader=gl.createShader(type);
   gl.shaderSource(shader,source);gl.compileShader(shader);
   if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){gl.deleteShader(shader);throw new Error('Water shader unavailable');}
   return shader;
  }
  const vertex=compile(gl.VERTEX_SHADER,vertexSource),fragment=compile(gl.FRAGMENT_SHADER,fragmentSource);
  program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);
  gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Water program unavailable');
  gl.useProgram(program);
  buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'aPosition');
  gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const uniforms={};
  for(const name of ['uImage','uSize','uImageAspect','uProgress','uTime'])uniforms[name]=gl.getUniformLocation(program,name);
  gl.uniform1i(uniforms.uImage,0);gl.clearColor(0,0,0,0);
  function createSurfaceRenderer(){
   const surface=scene.querySelector('.surface-canvas');
   if(!surface)return null;
   surface.style.visibility='hidden';
   let context,shaderProgram,surfaceBuffer,surfaceTexture,loaded=false,dead=false;
   const hide=()=>{surface.style.visibility='hidden';};
   function dispose(){
    dead=true;loaded=false;hide();
    if(context&&!context.isContextLost()){
     if(surfaceTexture)context.deleteTexture(surfaceTexture);
     if(surfaceBuffer)context.deleteBuffer(surfaceBuffer);
     if(shaderProgram)context.deleteProgram(shaderProgram);
    }
   }
   try{
    context=surface.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,powerPreference:'low-power'});
    if(!context)return null;
    const source=`
     precision mediump float;
     varying vec2 vUV;
     uniform sampler2D uImage;
     uniform vec2 uSize;
     uniform float uImageAspect;
     uniform float uTime;
     void main(){
      float aspect=uSize.x/uSize.y;
      vec2 cover=vec2(min(1.0,aspect/uImageAspect),min(1.0,uImageAspect/aspect));
      vec2 uv=(vec2(vUV.x,1.0-vUV.y)-0.5)*cover+0.5;
      // Traveling water ripples, anchored at the photographed horizon.
      // This is an artistic approximation over imagery, not a fluid solver.
      float sea=smoothstep(0.625,0.69,uv.y);
      float nearSea=smoothstep(0.64,1.0,uv.y);
      float motion=sea*(0.16+0.84*nearSea);
      float swell=uv.y*45.0+sin(uv.x*9.0)*0.65-uTime*1.70;
      float ripple=uv.y*104.0+uv.x*17.0-uTime*2.85;
      float crossRipple=uv.y*69.0-uv.x*28.0+uTime*1.12;
      vec2 flow=vec2(
       0.0060*sin(uv.y*34.0+uv.x*11.0-uTime*0.96)+0.0030*sin(crossRipple),
       0.0105*sin(swell)+0.0040*sin(ripple)+0.0015*sin(crossRipple)
      );
      // Largest motion is in the foreground; the pale sky never moves.
      vec2 sampleUV=clamp(uv+flow*motion,0.001,0.999);
      vec3 color=texture2D(uImage,sampleUV).rgb;
      float slope=0.64*cos(swell)+0.25*cos(ripple)+0.11*cos(crossRipple);
      float glint=pow(max(0.0,slope),4.0);
      color*=1.0+motion*(0.055*slope-0.025*max(-slope,0.0));
      color+=vec3(1.0,0.86,0.64)*glint*motion*0.045;
      gl_FragColor=vec4(color,1.0);
     }
    `;
    function surfaceShader(type,text){
     const shader=context.createShader(type);context.shaderSource(shader,text);context.compileShader(shader);
     if(!context.getShaderParameter(shader,context.COMPILE_STATUS)){context.deleteShader(shader);throw new Error('Surface shader unavailable');}
     return shader;
    }
    const vs=surfaceShader(context.VERTEX_SHADER,vertexSource),fs=surfaceShader(context.FRAGMENT_SHADER,source);
    shaderProgram=context.createProgram();context.attachShader(shaderProgram,vs);context.attachShader(shaderProgram,fs);context.linkProgram(shaderProgram);
    context.deleteShader(vs);context.deleteShader(fs);
    if(!context.getProgramParameter(shaderProgram,context.LINK_STATUS))throw new Error('Surface program unavailable');
    context.useProgram(shaderProgram);
    surfaceBuffer=context.createBuffer();context.bindBuffer(context.ARRAY_BUFFER,surfaceBuffer);
    context.bufferData(context.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),context.STATIC_DRAW);
    const attribute=context.getAttribLocation(shaderProgram,'aPosition');
    context.enableVertexAttribArray(attribute);context.vertexAttribPointer(attribute,2,context.FLOAT,false,0,0);
    const surfaceSize=context.getUniformLocation(shaderProgram,'uSize');
    const surfaceTime=context.getUniformLocation(shaderProgram,'uTime');
    context.uniform1i(context.getUniformLocation(shaderProgram,'uImage'),0);
    surface.addEventListener('webglcontextlost',event=>{event.preventDefault();dispose();},{once:true});
    const photo=new Image();
    photo.onload=()=>{
     if(dead)return;
     try{
      surfaceTexture=context.createTexture();context.activeTexture(context.TEXTURE0);context.bindTexture(context.TEXTURE_2D,surfaceTexture);
      context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL,false);
      context.texParameteri(context.TEXTURE_2D,context.TEXTURE_WRAP_S,context.CLAMP_TO_EDGE);
      context.texParameteri(context.TEXTURE_2D,context.TEXTURE_WRAP_T,context.CLAMP_TO_EDGE);
      context.texParameteri(context.TEXTURE_2D,context.TEXTURE_MIN_FILTER,context.LINEAR);
      context.texParameteri(context.TEXTURE_2D,context.TEXTURE_MAG_FILTER,context.LINEAR);
      context.texImage2D(context.TEXTURE_2D,0,context.RGBA,context.RGBA,context.UNSIGNED_BYTE,photo);
      if(context.getError()!==context.NO_ERROR)throw new Error('Surface texture unavailable');
      context.uniform1f(context.getUniformLocation(shaderProgram,'uImageAspect'),photo.naturalWidth/photo.naturalHeight);
      loaded=true;
     }catch(_error){dispose();}
    };
    photo.onerror=dispose;photo.src='./assets/surface-v3.png';
    return {hide,dispose,draw(){
     if(!loaded||dead)return;
     try{
      if(surface.width!==width||surface.height!==height){surface.width=width;surface.height=height;context.viewport(0,0,width,height);context.uniform2f(surfaceSize,width,height);}
      context.uniform1f(surfaceTime,elapsed);context.drawArrays(context.TRIANGLES,0,6);
      surface.style.visibility='visible';
     }catch(_error){dispose();}
    }};
   }catch(_error){dispose();return null;}
  }
  surfaceRenderer=createSurfaceRenderer();
  function resize(){
   dirtySize=false;
   const bounds=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,1.5);
   width=Math.max(1,Math.round(bounds.width*ratio));height=Math.max(1,Math.round(bounds.height*ratio));
   if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
   gl.viewport(0,0,width,height);gl.uniform2f(uniforms.uSize,width,height);
  }
  function draw(){
   if(dirtySize)resize();
   gl.uniform1f(uniforms.uProgress,progress);gl.uniform1f(uniforms.uTime,elapsed);
   gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,6);
   if(surfaceRenderer)surfaceRenderer.draw();
  }
  function tick(now){
   frame=0;
   if(!ready||failed||reduced||!visible||document.hidden)return;
   if(lastTick)elapsed+=Math.min((now-lastTick)/1000,0.1);
   lastTick=now;
   if(now-lastDraw>=1000/30){
    try{draw();lastDraw=now;}catch(_error){fallback();return;}
   }
   frame=requestAnimationFrame(tick);
  }
  function sync(){
   if(!ready||failed||reduced){root.classList.remove('has-water-renderer');canvas.style.visibility='hidden';if(surfaceRenderer)surfaceRenderer.hide();stop();return;}
   // Outside the hero there is no need to keep a GPU animation running.
   if(!visible||document.hidden){stop();return;}
   try{draw();}catch(_error){fallback();return;}
   root.classList.add('has-water-renderer');canvas.style.visibility='visible';
   if(!frame)frame=requestAnimationFrame(tick);
  }
  function updateFromStyle(){progress=clamp(parseFloat(getComputedStyle(scene).getPropertyValue('--dive-p'))||0);}
  document.addEventListener('dive:progress',event=>{
   if(event.detail&&Number.isFinite(event.detail.progress))progress=clamp(event.detail.progress);
   if(event.detail&&typeof event.detail.reducedMotion==='boolean')reduced=event.detail.reducedMotion;
   if(!frame)sync();
  });
  // A non-bubbling event dispatched on the hero is supported too.
  scene.addEventListener('dive:progress',event=>{
   if(event.bubbles)return;
   if(event.detail&&Number.isFinite(event.detail.progress))progress=clamp(event.detail.progress);
   if(event.detail&&typeof event.detail.reducedMotion==='boolean')reduced=event.detail.reducedMotion;
   if(!frame)sync();
  });
  // Read after dive.js's scheduled scroll update when no custom event is used.
  window.addEventListener('scroll',()=>{if(visible&&!failed)requestAnimationFrame(updateFromStyle);},{passive:true});
  window.addEventListener('resize',()=>{dirtySize=true;if(!frame)sync();},{passive:true});
  document.addEventListener('visibilitychange',sync);
  preference.addEventListener('change',()=>{reduced=preference.matches;updateFromStyle();sync();});
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fallback();},{once:true});
  if('IntersectionObserver' in window){
   observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();},{threshold:0});
   observer.observe(scene);
  }else{
   const checkVisibility=()=>{const box=scene.getBoundingClientRect();visible=box.bottom>0&&box.top<innerHeight;sync();};
   window.addEventListener('scroll',checkVisibility,{passive:true});checkVisibility();
  }
  const image=new Image();
  image.onload=()=>{
   if(failed)return;
   clearTimeout(loadTimer);
   try{
    texture=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
    if(gl.getError()!==gl.NO_ERROR)throw new Error('Water texture unavailable');
    gl.uniform1f(uniforms.uImageAspect,image.naturalWidth/image.naturalHeight);
    ready=true;updateFromStyle();sync();
   }catch(_error){fallback();}
  };
  image.onerror=fallback;
  loadTimer=setTimeout(fallback,20000);
  image.src='./assets/underwater-v3.png';
 }catch(_error){fallback();}
})();
