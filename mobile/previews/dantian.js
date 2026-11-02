import * as THREE from '../vendor/three.module.js';
const stage=document.querySelector('.stage'),canvas=document.querySelector('canvas');
const names=['柔雾聚气','气旋凝丹','内敛光核'],titles=['一息一聚，气归丹田','气随息转，渐凝成丹','光藏于内，温养不息'];
const descriptions=['青白色的气雾缓缓收拢，边缘轻柔，呼吸时自然舒展。','层层气流沿同一方向旋入，中央逐渐聚亮，突出修炼运转。','暖白色小光核被薄薄灵气包裹，亮度克制，适合长时间挂机。'];
let mode=0,paused=false,context=false,time=0,last=performance.now(),pulse=0;
try{
const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setClearColor(0x000000,0);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,0,2);camera.position.z=1;
const uniforms={t:{value:0},mode:{value:0},energy:{value:.85},aspect:{value:1},context:{value:0},pulse:{value:0}};
const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms,vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
precision highp float;varying vec2 vUv;uniform float t,mode,energy,aspect,context,pulse;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+3.1;a*=.5;}return n;}
void main(){vec2 center=mix(vec2(.5,.54),vec2(.5,.43),context);vec2 p=(vUv-center)*vec2(aspect,1.);p/=mix(.29,.055,context);float breath=1.+.055*sin(t*.95);p/=breath*(1.+pulse*.1);float r=length(p),a=atan(p.y,p.x);float n=fbm(p*3.+vec2(t*.11,-t*.09));float alpha=0.;vec3 color=vec3(.6,.85,.91);
if(mode<.5){float edge=r+(.5-n)*.43;float fog=fbm(p*4.+vec2(n*2.,-t*.16));alpha=exp(-edge*edge*3.2)*(.19+.72*fog);alpha+=exp(-r*r*22.)*.24;float wisps=pow(max(0.,1.-abs(r-(.63+.13*sin(a*3.+n*4.+t*.19)))*9.),3.);alpha+=wisps*.1*(.3+n);color=mix(vec3(.27,.58,.66),vec3(.85,.96,.97),smoothstep(.25,.9,alpha));}
else if(mode<1.5){float swirl=sin(a*3.+r*13.-t*.85+n*3.5);float strands=pow(max(0.,swirl),5.);float envelope=exp(-r*r*2.9)*smoothstep(.08,.28,r);alpha=strands*envelope*.73+exp(-r*r*24.)*.7+exp(-r*r*4.)*.12;color=mix(vec3(.22,.52,.64),vec3(.86,.97,1.),exp(-r*r*9.)+strands*.2);}
else{float core=exp(-r*r*72.);float sheath=exp(-r*r*7.)*(.15+.3*n);float shell=exp(-pow((r-.29-(n-.5)*.07)*20.,2.))*.17;alpha=core*.95+sheath+shell;color=mix(vec3(.41,.65,.67),vec3(1.,.9,.65),exp(-r*r*19.));color=mix(color,vec3(1.,.97,.86),core);}
alpha*=energy*(1.+pulse*.3);alpha*=smoothstep(1.5,.85,r);gl_FragColor=vec4(color,clamp(alpha,0.,.96));}
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
