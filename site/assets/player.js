'use strict';
window.mountPlayer=function(config){
 const video=document.querySelector('#video'),host=document.querySelector('#panorama'),button=document.querySelector('#viewMode'),message=document.querySelector('#playerMessage');
 let renderer,geometry,material,texture,frame,observer,active=false,yaw=0,pitch=0,last;
 const report=text=>message.textContent=text;
 const stop=()=>{active=false;cancelAnimationFrame(frame);observer?.disconnect();renderer?.dispose();geometry?.dispose();material?.dispose();texture?.dispose();host.replaceChildren();video.hidden=false;host.hidden=true;button.textContent='全景观看';};
 window.destroyPlayer=()=>{stop();video.pause();video.removeAttribute('src');video.load()};
 video.onerror=()=>report('视频加载失败：请检查链接是否过期，以及视频服务器是否允许跨域访问。');
 video.play().catch(()=>report('点击播放按钮开始观看。'));
 host.hidden=true;
 button.onclick=()=>{
 if(active){stop();report('已切换普通视频');return}
 try{
 const T=window.THREE;renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(75,1,.1,100);geometry=new T.SphereGeometry(10,64,40);geometry.scale(-1,1,1);texture=new T.VideoTexture(video);texture.colorSpace=T.SRGBColorSpace;material=new T.MeshBasicMaterial({map:texture});scene.add(new T.Mesh(geometry,material));
 video.hidden=true;host.hidden=false;active=true;button.textContent='普通观看';
 observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()});observer.observe(host);
 host.onpointerdown=e=>{last=[e.clientX,e.clientY];host.setPointerCapture(e.pointerId)};
 host.onpointermove=e=>{if(!last)return;yaw-=(e.clientX-last[0])*.004;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-last[1])*.004));last=[e.clientX,e.clientY]};host.onpointerup=host.onpointercancel=()=>last=null;
 const draw=()=>{if(!active)return;try{camera.lookAt(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));renderer.render(scene,camera);frame=requestAnimationFrame(draw)}catch{stop();report('全景渲染失败，请检查视频跨域设置。')}};draw();report('拖动调整视角；仅适用于360°等距柱状全景素材。');
 }catch{stop();report('全景模式不可用，请使用普通视频观看。')}
 };
 document.querySelector('#fullVideo').onclick=()=>{const el=active?host:video;if(el.requestFullscreen)el.requestFullscreen().catch(()=>report('当前设备不支持全屏'))};
 if(config.mode==='360')button.click();
};
