import * as THREE from '../vendor/three.module.js';
const stage=document.querySelector('.stage'),canvas=document.querySelector('canvas');
const names=['青岚抱元','碧流归旋','琥珀凝息'],titles=['青岚成团，抱元守一','碧流回转，百川归元','琥珀凝息，温养成丹'];
const descriptions=['大团青绿色灵雾，深浅分明；缓慢舒卷，轮廓柔而清晰。','三股碧色气流旋入丹田，清楚的旋臂与细密气丝持续运转。','琥珀色气核与厚实气晕，内层凝聚、外层流动，沉稳饱满。'];
let mode=0,paused=false,context=false,time=0,last=performance.now(),pulse=0;
try{
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
const uniforms={t:{value:0},mode:{value:0},energy:{value:1.15},aspect:{value:1},context:{value:0},pulse:{value:0}};
const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
precision highp float;varying vec2 vUv;uniform float t,mode,energy,aspect,context,pulse;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+3.1;a*=.5;}return n;}
void main(){
 vec2 center=mix(vec2(.5,.56),vec2(.52,.36),context);
 vec2 p=(vUv-center)*vec2(aspect,1.);p/=mix(.36,.19,context);
 float breath=1.+.045*sin(t*.85);p/=breath*(1.+pulse*.1);
 float r=length(p),a=atan(p.y,p.x);float n=fbm(p*3.+vec2(t*.13,-t*.1));
 float alpha=0.;vec3 color;
 if(mode<.5){
 float edge=r+(.5-n)*.31;float cloud=fbm(p*4.+vec2(n*1.7,-t*.19));
 float body=exp(-pow(edge*1.38,4.));float folds=pow(.5+.5*sin(a*2.+r*10.-t*.4+n*5.),2.);
 alpha=body*(.28+.54*cloud+.22*folds);color=mix(vec3(.035,.25,.23),vec3(.21,.57,.43),cloud);
 float inner=exp(-r*r*12.)*.32;color=mix(color,vec3(.65,.79,.53),inner);
 }else if(mode<1.5){
 float curl=a*3.+r*13.-t*.9+n*2.;float arms=pow(.5+.5*sin(curl),3.);
 float body=exp(-pow(r*1.27,4.));alpha=body*(.12+.76*arms)+exp(-r*r*32.)*.6;
 color=mix(vec3(.025,.23,.26),vec3(.14,.51,.45),arms);
 color=mix(color,vec3(.68,.79,.45),exp(-r*r*26.)*.8);
 }else{
 float core=1.-smoothstep(.18,.4,r+(n-.5)*.07);
 float shell=exp(-pow((r-.57-(n-.5)*.13)*7.,2.));
 float outer=exp(-pow(r*1.42,4.))*(.2+.25*n);
 alpha=core*.9+shell*.5+outer;
 color=mix(vec3(.43,.23,.045),vec3(.75,.49,.14),n);
 color=mix(color,vec3(.97,.77,.32),core*.87);
 float filament=pow(max(0.,sin(a*4.+r*19.-t*.5+n*3.)),8.);alpha+=filament*outer*.7;
 }
 alpha*=energy*(1.+pulse*.2);alpha*=1.-smoothstep(1.05,1.35,r);
 gl_FragColor=vec4(color,clamp(alpha,0.,.96));}

`});
scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
const resize=()=>{const {width,height}=stage.getBoundingClientRect();renderer.setSize(width,height,false);uniforms.aspect.value=width/height;};new ResizeObserver(resize).observe(stage);resize();
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{mode=Number(button.dataset.mode);uniforms.mode.value=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));document.querySelector('#index').textContent=`0${mode+1} / ${names[mode]}`;document.querySelector('h1').textContent=titles[mode];document.querySelector('#description').textContent=descriptions[mode];stage.dataset.mode=String(mode);}));
document.querySelector('#description').textContent=descriptions[0];document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'继续流动':'暂停观察';};
document.querySelector('#context').onclick=e=>{context=!context;uniforms.context.value=Number(context);stage.classList.toggle('in-context',context);e.target.textContent=context?'查看气团细节':'查看角色叠加';e.target.setAttribute('aria-pressed',String(context));};
document.querySelector('#energy').oninput=e=>uniforms.energy.value=Number(e.target.value);canvas.onclick=()=>pulse=1;
renderer.setAnimationLoop(()=>{const now=performance.now(),dt=Math.min((now-last)/1000,.06);last=now;if(!paused&&!document.hidden)time+=dt;pulse=Math.max(0,pulse-dt*.7);uniforms.t.value=time;uniforms.pulse.value=pulse;if(!document.hidden)renderer.render(scene,camera);});
document.querySelector('#status').textContent='3 版实时效果已就绪 · 本地资源';document.body.dataset.renderer=`Three.js r${THREE.REVISION}`;
window.addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);material.dispose();renderer.dispose();});
}catch(error){document.querySelector('#status').textContent='图形效果未能启动：'+error.message;document.body.dataset.error=error.message;}
