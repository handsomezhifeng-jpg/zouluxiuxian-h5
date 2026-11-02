import * as THREE from '../vendor/three.module.js';
const stage=document.querySelector('.stage'),canvas=document.querySelector('canvas');
const names=['澄蓝凝息','琉璃流转','沧澜抱丹'],titles=['澄蓝如水，一息一旋','琉璃流转，气息相生','沧澜抱丹，静中有流'];
const descriptions=['柔蓝气核，薄雾缓旋；呼吸舒展，中心通透。','层叠薄蓝气膜围绕内核，错层旋转，轻盈如琉璃。','深蓝气流包裹柔亮丹核，浓淡交错，聚散有度。'];
let mode=0,paused=false,context=false,time=0,last=performance.now(),pulse=0;
try{
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
const uniforms={t:{value:0},mode:{value:0},energy:{value:.9},aspect:{value:1},context:{value:0},pulse:{value:0}};
const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
precision highp float;varying vec2 vUv;uniform float t,mode,energy,aspect,context,pulse;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+3.1;a*=.5;}return n;}
void main(){
 vec2 center=mix(vec2(.5,.56),vec2(.52,.36),context);
 vec2 p=(vUv-center)*vec2(aspect,1.);p/=mix(.36,.19,context);
 float phase=t*.85;float breath=.5+.5*sin(phase);
 p/=(.95+.10*breath)*(1.+pulse*.06);
 float rot=t*.16; p=mat2(cos(rot),-sin(rot),sin(rot),cos(rot))*p;
 float r=length(p),a=atan(p.y,p.x);
 float n=fbm(p*3.3+vec2(t*.065,-t*.05));
 float warp=(n-.5)*.12;float rr=r+warp;
 float alpha=0.;vec3 color;
 float core=exp(-pow(r*3.6,4.));
 if(mode<.5){
 float ring=exp(-pow((rr-.58)*8.,2.));
 float flow=.5+.5*sin(a*3.+r*9.+n*3.-t*.18);
 float fog=exp(-pow(r*1.35,4.))*(.06+.13*n);
 alpha=ring*(.16+.24*flow)+core*.23+fog;
 color=mix(vec3(.11,.36,.61),vec3(.37,.65,.83),n);
 color=mix(color,vec3(.59,.80,.90),core*.75);
 }else if(mode<1.5){
 float membrane=exp(-pow((rr-.54-.05*sin(a*2.+t*.2))*13.,2.));
 float inner=exp(-pow((r+warp*.5-.37)*18.,2.));
 float outer=exp(-pow((r-warp-.77)*16.,2.));
 float sweep=.5+.5*sin(a*2.-r*8.+t*.13);
 alpha=membrane*(.16+.25*sweep)+inner*.16+outer*.1+core*.18+exp(-r*r*4.)*.06;
 color=mix(vec3(.14,.41,.66),vec3(.49,.74,.88),sweep*.6+n*.3);
 color=mix(color,vec3(.67,.86,.94),core*.7);
 }else{
 float curl=pow(.5+.5*sin(a*3.+r*10.+n*3.-t*.12),3.);
 float envelope=exp(-pow(r*1.32,4.));
 float ring=exp(-pow((rr-.62)*8.,2.));
 alpha=envelope*(.07+.29*curl)+ring*.15+core*.23;
 color=mix(vec3(.07,.28,.52),vec3(.3,.6,.79),n*.7+curl*.3);
 color=mix(color,vec3(.57,.79,.9),core*.85);
 }
 alpha*=energy*(.91+.13*breath)*(1.+pulse*.15);
 alpha*=1.-smoothstep(1.,1.3,r);
 gl_FragColor=vec4(color,clamp(alpha,0.,.66));}

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
