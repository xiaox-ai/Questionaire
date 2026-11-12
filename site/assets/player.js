'use strict';
window.mountPlayer=function(config){
 const video=document.querySelector('#video'),host=document.querySelector('#panorama'),button=document.querySelector('#viewMode'),message=document.querySelector('#playerMessage');
 let renderer,geometry,material,texture,frame,observer,uploadCanvas,uploadContext,active=false,yaw=0,pitch=0,last,dirty=true,previousTime=-1,previousDraw=0;
 let compatible=/Harmony|HUAWEI|HuaweiBrowser/i.test(navigator.userAgent)||(/Android/i.test(navigator.userAgent)&&!/Mobile/i.test(navigator.userAgent));
 const compatibility=document.createElement('button');compatibility.type='button';compatibility.id='compatibility';compatibility.textContent=compatible?'标准模式':'兼容模式';document.querySelector('.player-tools').append(compatibility);
 let autoRotate=true,resumeAt=0,lastTick=0;
 const rotation=document.createElement('button');rotation.type='button';rotation.id='autoRotate';rotation.textContent='环视开';rotation.setAttribute('aria-pressed','true');rotation.hidden=true;
 document.querySelector('.player-tools').append(rotation);
 rotation.onclick=()=>{autoRotate=!autoRotate;resumeAt=0;rotation.textContent=autoRotate?'环视开':'环视关';rotation.setAttribute('aria-pressed',String(autoRotate))};
 const controls=document.createElement('div');controls.className='video-controls';
 controls.innerHTML='<input class="seek" type="range" min="0" max="100" value="0" step="0.1" aria-label="播放进度" disabled><button type="button" class="play">播放</button><output aria-label="播放时间">00:00 / 00:00</output><button type="button" class="mute">开启声音</button><input class="volume" type="range" min="0" max="1" step="0.05" value="1" aria-label="音量">';
 video.parentElement.append(controls);video.controls=false;
 const seek=controls.querySelector('.seek'),play=controls.querySelector('.play'),mute=controls.querySelector('.mute'),volume=controls.querySelector('.volume'),time=controls.querySelector('output');
 const clock=t=>{t=Number.isFinite(t)?Math.floor(t):0;return String(Math.floor(t/60)).padStart(2,'0')+':'+String(t%60).padStart(2,'0')};
 const sync=()=>{play.textContent=video.paused?'播放':'暂停';mute.textContent=video.muted||video.volume===0?'开启声音':'静音';volume.value=video.muted?0:video.volume;const ready=Number.isFinite(video.duration)&&video.duration>0;seek.disabled=!ready;if(ready)seek.value=video.currentTime/video.duration*100;time.textContent=clock(video.currentTime)+' / '+clock(video.duration)};
 for(const event of ['play','pause','ended','timeupdate','durationchange','loadedmetadata','volumechange'])video.addEventListener(event,sync);
 play.onclick=()=>{if(video.paused)video.play().catch(()=>report('播放失败，请检查视频链接'));else video.pause()};
 mute.onclick=()=>{if(video.muted||video.volume===0){video.muted=false;if(video.volume===0)video.volume=1}else video.muted=true;sync()};
 volume.oninput=()=>{video.volume=Number(volume.value);video.muted=video.volume===0;sync()};
 seek.oninput=()=>{if(Number.isFinite(video.duration)){video.currentTime=Number(seek.value)*video.duration/100;dirty=true;sync()}};
 for(const event of ['seeked','loadeddata'])video.addEventListener(event,()=>{dirty=true});
 sync();
 const report=text=>message.textContent=text;
 const stop=()=>{active=false;last=null;rotation.hidden=true;cancelAnimationFrame(frame);observer?.disconnect();renderer?.dispose();geometry?.dispose();material?.dispose();texture?.dispose();host.replaceChildren();video.hidden=false;video.classList.remove('panorama-source');host.hidden=true;uploadCanvas=null;uploadContext=null;button.textContent='全景观看';};
 window.destroyPlayer=()=>{stop();video.pause();video.removeAttribute('src');video.load();controls.remove();window.destroyPlayer=null};
 video.onerror=()=>report('视频加载失败：请检查链接是否过期，以及视频服务器是否允许跨域访问。');
 video.loop=true;video.defaultMuted=false;video.muted=false;video.volume=1;sync();
 let audioBlocked=false;
 const clearAudioRetry=()=>{document.removeEventListener('pointerdown',retryAudio);document.removeEventListener('keydown',retryAudio);document.removeEventListener('WeixinJSBridgeReady',retryAudio)};
 const retryAudio=()=>{if(!audioBlocked)return;video.play().then(()=>{audioBlocked=false;clearAudioRetry()}).catch(()=>{})};
 video.play().catch(error=>{if(error.name==='NotAllowedError'){audioBlocked=true;document.addEventListener('pointerdown',retryAudio);document.addEventListener('keydown',retryAudio);document.addEventListener('WeixinJSBridgeReady',retryAudio)}});
 const disposePlayer=window.destroyPlayer;window.destroyPlayer=()=>{audioBlocked=false;clearAudioRetry();disposePlayer()};
 host.hidden=true;
 button.onclick=()=>{
 if(active){stop();report('');return}
 try{
 const T=window.THREE,canvas=document.createElement('canvas');
 const options={alpha:false,antialias:false,powerPreference:'default'};
 // WebGL1 avoids some Android tablet WebGL2/video texture driver failures.
 let context;
 if(compatible){context=canvas.getContext('webgl',options)||canvas.getContext('experimental-webgl',options);if(!context)throw Error('WebGL1 unavailable')}
 renderer=new T.WebGLRenderer({canvas,...options,...(context?{context}:{})});renderer.setPixelRatio(1);host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(75,1,.1,100);geometry=new T.SphereGeometry(10,32,20);geometry.scale(-1,1,1);if(compatible){uploadCanvas=document.createElement('canvas');uploadCanvas.width=1024;uploadCanvas.height=512;uploadContext=uploadCanvas.getContext('2d',{alpha:false});if(!uploadContext)throw Error('Canvas unavailable');texture=new T.CanvasTexture(uploadCanvas)}else texture=new T.VideoTexture(video);texture.generateMipmaps=false;texture.minFilter=T.LinearFilter;texture.magFilter=T.LinearFilter;texture.colorSpace=T.SRGBColorSpace;material=new T.MeshBasicMaterial({map:texture});scene.add(new T.Mesh(geometry,material));
 video.hidden=false;video.classList.add('panorama-source');host.hidden=false;active=true;rotation.hidden=false;lastTick=0;dirty=true;previousTime=-1;previousDraw=0;button.textContent='普通观看';
 observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true});observer.observe(host);
 host.onpointerdown=e=>{resumeAt=Infinity;last=[e.clientX,e.clientY];host.setPointerCapture(e.pointerId)};
 host.onpointermove=e=>{if(!last)return;yaw-=(e.clientX-last[0])*.004;pitch=Math.max(-1.4,Math.min(1.4,pitch+(e.clientY-last[1])*.004));last=[e.clientX,e.clientY];dirty=true};host.onpointerup=host.onpointercancel=host.onlostpointercapture=()=>{if(!last)return;last=null;resumeAt=performance.now()+3000};
 const draw=now=>{if(!active)return;const delta=lastTick?Math.min((now-lastTick)/1000,.1):0;lastTick=now;if(autoRotate&&!last&&!video.paused&&!video.ended&&video.readyState>=2&&!document.hidden&&now>=resumeAt){yaw=(yaw+delta*Math.PI/90)%(Math.PI*2);dirty=true}try{if(!document.hidden&&(dirty||(!video.paused&&video.currentTime!==previousTime))&&now-previousDraw>=1000/30){camera.lookAt(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));if(video.readyState<2){frame=requestAnimationFrame(draw);return}if(uploadCanvas){uploadContext.drawImage(video,0,0,uploadCanvas.width,uploadCanvas.height);texture.needsUpdate=true}else if(video.videoWidth>renderer.capabilities.maxTextureSize||video.videoHeight>renderer.capabilities.maxTextureSize){compatible=true;stop();button.click();return}renderer.render(scene,camera);previousTime=video.currentTime;previousDraw=now;dirty=false}frame=requestAnimationFrame(draw)}catch{stop();report('全景渲染失败，可切换兼容模式或普通观看；也请检查视频跨域设置。')}};frame=requestAnimationFrame(draw);report('');
 }catch{stop();report('全景模式不可用，请使用普通视频观看。')}
 };
 compatibility.onclick=()=>{compatible=!compatible;compatibility.textContent=compatible?'标准模式':'兼容模式';if(active)stop();button.click()};
 if(config.mode==='360')button.click();
};
