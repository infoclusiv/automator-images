const p={QUEUE_NEXT:"queue:next",PROCESSING_COMPLETE:"processing:complete",PROCESSING_STOP:"processing:stop",PROCESSING_TERMINATE:"processing:terminate",TASK_START:"task:start",TASK_COMPLETED:"task:completed",TASK_ERROR:"task:error",TASK_SKIPPED:"task:skipped",DAILY_LIMIT_FALLBACK:"task:daily_limit_fallback",OVERLAY_SHOW:"overlay:show",OVERLAY_HIDE:"overlay:hide",OVERLAY_MESSAGE:"overlay:message",OVERLAY_PAUSING:"overlay:pausing",OVERLAY_ERROR_BANNER:"overlay:error_banner",OVERLAY_ERROR_BANNER_CLEAR:"overlay:error_banner_clear",COUNTDOWN_START:"countdown:start",PROGRESS_UPDATE:"progress:update"},W=new Map;function vt(e,t){return W.has(e)||W.set(e,new Set),W.get(e).add(t),()=>lt(e,t)}function pn(e,t){const n=o=>{lt(e,n),t(o)};vt(e,n)}function lt(e,t){const n=W.get(e);n&&(n.delete(t),n.size===0&&W.delete(e))}function mn(e,t){const n=W.get(e);if(!(!n||n.size===0))for(const o of n)try{o(t)}catch(r){console.error(`❌ EventBus: handler error for event "${e}":`,r)}}function gn(e){W.delete(e)}function fn(){W.clear()}function bn(){const e={};for(const[t,n]of W.entries())e[t]=n.size;return e}console.log("✅ EventBus module loaded");const _e=Object.freeze(Object.defineProperty({__proto__:null,EVENTS:p,clear:gn,clearAll:fn,debugListeners:bn,emit:mn,off:lt,on:vt,once:pn},Symbol.toStringTag,{value:"Module"}));function h(e){return new Promise(t=>setTimeout(t,e))}function $(e,t=document){try{return document.evaluate(e,t,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null).singleNodeValue}catch(n){return console.error("❌ XPath evaluation error:",n,`
XPath:`,e),null}}async function kt(e,t=5e3){const n=Date.now();for(;Date.now()-n<t;){const o=document.querySelector(e);if(o)return o;await h(100)}return null}function re(){document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",keyCode:27,bubbles:!0,cancelable:!0,composed:!0}))}function Tt(e){const t=e.getBoundingClientRect();return{x:t.left+t.width/2,y:t.top+t.height/2}}console.log("✅ DomUtils module loaded");let k=null,tt=null;function It(e,t=null){k=e,tt=t,console.log("✅ StateManager EventBus wired")}let Oe=!1,De=null,ct=null,H=!1,ae=!1,q=0,V=[],T={autoDownload:!0,delayBetweenPrompts:8e3,delayMin:15,delayMax:30,flowVideoCount:"1",flowModel:"default",flowAspectRatio:"landscape",imageDownloadQuality:"1K",videoDownloadQuality:"720p"},dt=!1,ve=null,ke=null,ut=null,S=[],J=0,Pt=null,Ct=5e3,At=null,Mt=null,ge=null,Lt=3,Rt=0,_t=new Set;const Pe="flowAutomationState",Ot={PROMPT_POLICY_ERROR_POPUP_XPATH:"//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and not(.//*[contains(., '5')])]",QUEUE_FULL_POPUP_XPATH:"//li[@data-sonner-toast and .//i[normalize-space(text())='error'] and .//*[contains(., '5')]]"};function ue(){return{isUserLoggedIn:Oe,subscriptionStatus:De,userId:ct,isProcessing:H,isPausing:ae,currentPromptIndex:q,prompts:V,settings:T,isCurrentPromptProcessed:dt,lastAppliedSettings:ve,lastAppliedMode:ke,fallbackModel:ut,taskList:S,currentTaskIndex:J,tileScanInterval:Pt,scanIntervalMs:Ct,currentProcessingPrompt:At,currentTaskStartTime:Mt,countdownInterval:ge,maxRetries:Lt,currentRetries:Rt,preSubmitTileIds:_t}}function ee(e){if(e.isUserLoggedIn!==void 0&&(Oe=e.isUserLoggedIn),e.subscriptionStatus!==void 0&&(De=e.subscriptionStatus),e.userId!==void 0&&(ct=e.userId),e.isProcessing!==void 0){const t=H;H=e.isProcessing,t!==H&&chrome.runtime.sendMessage({action:"automationStateChanged",isRunning:H}).catch(()=>{})}e.isPausing!==void 0&&(ae=e.isPausing),e.currentPromptIndex!==void 0&&(q=e.currentPromptIndex),e.prompts!==void 0&&(V=e.prompts),e.settings!==void 0&&(T=e.settings),e.isCurrentPromptProcessed!==void 0&&(dt=e.isCurrentPromptProcessed),e.lastAppliedSettings!==void 0&&(ve=e.lastAppliedSettings),e.lastAppliedMode!==void 0&&(ke=e.lastAppliedMode),e.fallbackModel!==void 0&&(ut=e.fallbackModel),e.taskList!==void 0&&(S=e.taskList),e.currentTaskIndex!==void 0&&(J=e.currentTaskIndex),e.tileScanInterval!==void 0&&(Pt=e.tileScanInterval),e.scanIntervalMs!==void 0&&(Ct=e.scanIntervalMs),e.currentProcessingPrompt!==void 0&&(At=e.currentProcessingPrompt),e.currentTaskStartTime!==void 0&&(Mt=e.currentTaskStartTime),e.countdownInterval!==void 0&&(ge=e.countdownInterval),e.maxRetries!==void 0&&(Lt=e.maxRetries),e.currentRetries!==void 0&&(Rt=e.currentRetries),e.preSubmitTileIds!==void 0&&(_t=e.preSubmitTileIds)}function hn(){return T}function yn(e){T={...T,...e}}function wn(){return S}function xn(e,t){S[e]&&(S[e]={...S[e],...t})}function En(){return S[q]||null}function Sn(e){return S.find(t=>t.index===e)||null}function vn(){return S.find(e=>e.status==="current")||null}async function Ee(){const e={status:H?"running":"paused",isProcessing:H,prompts:V.map(t=>t),currentIndex:q,totalPrompts:V.length,processedCount:q,currentPrompt:V[q]||"",settings:T,startTime:Date.now(),lastUpdate:Date.now(),taskList:S,currentTaskIndex:J};return new Promise(t=>{chrome.storage.local.set({[Pe]:e},()=>{t(e)})})}async function Te(){return new Promise(e=>{chrome.storage.local.get(Pe,t=>{const n=t[Pe];e(n||null)})})}async function Dt(){return new Promise(e=>{chrome.storage.local.remove(Pe,()=>{e()})})}(async function(){const t=await Te();t&&t.status==="paused"&&(V=t.prompts||[],q=t.currentIndex||0,T=t.settings||T,S=t.taskList||[],J=t.currentTaskIndex||0,H=!1,console.log(`📋 Restored ${S.length} tasks from storage`),chrome.runtime.sendMessage({action:"stateRestored",state:t}).catch(()=>{}),S.length>0&&S.forEach(n=>Ke(n)))})();function qe(e,t,n){return e&&e.settings&&e.settings[t]!==void 0?e.settings[t]:n[t]}function kn(e,t){let n=qe(e,"delayMin",t),o=qe(e,"delayMax",t);if(n===void 0||o===void 0){const a=qe(e,"delayBetweenPrompts",t)||8;n=a/1e3,o=a/1e3}n>o&&([n,o]=[o,n]);const r=n+Math.random()*(o-n);return Math.round(r*1e3)}function Ge(){ge&&(clearInterval(ge),ge=null)}function Tn(e){const t=Math.floor(e/1e3),n=Math.floor(t/60),o=t%60;return n>0?`${n}m ${o}s`:`${o}s`}function In(e,t){Ge();let n=e;const o=Date.now(),r=(e/1e3).toFixed(1);k&&k.emit(p.OVERLAY_MESSAGE,`⏱️ Waiting ${r}s before ${t}...`),ge=setInterval(()=>{const i=Date.now()-o;if(n=e-i,n<=0){Ge(),k&&k.emit(p.OVERLAY_MESSAGE,`▶️ Starting ${t}...`);return}const a=(n/1e3).toFixed(1);k&&k.emit(p.OVERLAY_MESSAGE,`⏱️ Waiting ${a}s before ${t}...`)},100)}function Ze(){return new Promise(e=>{let t=0;const n=3,o=1e3;function r(){chrome.runtime.sendMessage({action:"getAuthState"},i=>{if(chrome.runtime.lastError){if(t<n){t++,setTimeout(r,o);return}e({isLoggedIn:!1,subscriptionStatus:null,error:"Could not verify authentication state"});return}i?(Oe=i.isLoggedIn,De=i.subscriptionStatus,e(i)):t<n?(t++,setTimeout(r,o)):e({isLoggedIn:!1,subscriptionStatus:null,error:"No response from background script"})})}r()})}chrome.runtime.sendMessage({action:"getAuthState"},e=>{e&&(Oe=e.isLoggedIn,De=e.subscriptionStatus)});chrome.runtime.onMessage.addListener(function(e,t,n){const o={received:!0};if(e.action==="startProcessing")return Ze().then(r=>{if(!r.isLoggedIn){const i=r.error||"Authentication required. Please sign in first.";chrome.runtime.sendMessage({action:"error",error:i}),n({...o,error:i});return}if(H)n({...o,error:"Already processing"});else{if(T={...T,...e.settings,flowVideoCount:e.settings.flowVideoCount||T.flowVideoCount,flowModel:e.settings.flowModel||T.flowModel,flowAspectRatio:e.settings.flowAspectRatio||T.flowAspectRatio},ee({isProcessing:!0}),q=0,ve=null,ke=null,e.useUnifiedQueue&&e.queueTasks)console.log("🎯 Using UNIFIED QUEUE system"),S=e.queueTasks.map(i=>{var a;return{queueTaskId:i.id,index:i.index,prompt:i.prompt,type:i.type,status:"pending",expectedVideos:parseInt((a=i.settings)==null?void 0:a.count,10)||1,foundVideos:0,videoUrls:[],settings:i.settings,referenceImages:i.referenceImages||null}}),V=S.map(i=>i.prompt),console.log(`✅ Created ${S.length} tasks from unified queue (${S.filter(i=>i.type==="createvideo").length} video, ${S.filter(i=>i.type==="createimage").length} image)`);else{console.log("⚠️ Using LEGACY task system"),V=e.prompts;const i=e.taskSettings||[],a=e.processingMode||"createvideo",l=e.imagePairs||[];a==="image"&&l.length>0?(S=l.map((d,u)=>{var c;return{index:u+1,prompt:d.prompt,image:d.image,type:"image-to-video",status:"pending",expectedVideos:parseInt((c=d.settings)==null?void 0:c.count,10)||1,foundVideos:0,videoUrls:[],settings:d.settings}}),console.log(`✅ Created ${S.length} image-to-video tasks (legacy)`)):(S=V.map((d,u)=>{const c=i[u]||{videoCount:T.flowVideoCount,model:T.flowModel,aspectRatio:T.flowAspectRatio};return{index:u+1,prompt:d,type:"createvideo",status:"pending",expectedVideos:parseInt(c.count,10)||1,foundVideos:0,videoUrls:[],settings:c}}),console.log(`✅ Created ${S.length} createvideo tasks (legacy)`))}J=0,Ee(),k&&k.emit(p.QUEUE_NEXT),n({...o,started:!0})}}).catch(r=>{chrome.runtime.sendMessage({action:"error",error:"Authentication verification failed. Please try again."}),n({...o,error:"Authentication verification failed"})}),!0;if(e.action==="resumeProcessing")return Te().then(r=>{r&&r.status==="paused"?(V=r.prompts||[],q=r.currentIndex||0,T=r.settings||T,S=r.taskList||[],J=r.currentTaskIndex||0,ee({isProcessing:!0}),ae=!1,chrome.runtime.sendMessage({action:"setPageZoom",zoomFactor:.75}).catch(()=>{}),console.log(`▶️ Resuming Flow from prompt ${q+1}/${V.length}`),console.log(`📋 Restored ${S.length} tasks`),Ee(),S.forEach(i=>Ke(i)),k&&k.emit(p.QUEUE_NEXT),n({...o,resumed:!0})):n({...o,error:"No paused state to resume"})}),!0;if(e.action==="resumeAfterCacheClean")return Te().then(r=>{var i;r&&(r.status==="running"||r.status==="paused")&&((i=r.prompts)==null?void 0:i.length)>0?(V=r.prompts||[],q=r.currentIndex||0,T=r.settings||T,S=r.taskList||[],J=r.currentTaskIndex||0,H=!0,ae=!1,ve=null,ke=null,chrome.runtime.sendMessage({action:"setPageZoom",zoomFactor:.75}).catch(()=>{}),Ee(),S.forEach(a=>Ke(a)),console.log(`🔄 resumeAfterCacheClean: restored ${S.length} tasks, resuming from index ${q}`),k&&k.emit(p.QUEUE_NEXT),n({...o,resumed:!0})):(console.warn("⚠️ resumeAfterCacheClean: no valid saved state found — cannot auto-resume"),n({...o,error:"No valid saved state"}))}),!0;if(e.action==="stopProcessing")k&&k.emit(p.PROCESSING_STOP),Ge(),ee({isProcessing:!1}),ae=!0,chrome.runtime.sendMessage({action:"resetPageZoom"}).catch(()=>{}),Ee(),dt?(ae=!1,k&&k.emit(p.OVERLAY_HIDE),chrome.runtime.sendMessage({action:"updateStatus",status:"Processing paused. Click Resume to continue."})):(k&&k.emit(p.OVERLAY_PAUSING),chrome.runtime.sendMessage({action:"updateStatus",status:"Flow will pause after current prompt completes..."})),n(o);else if(e.action==="terminateProcessing")chrome.runtime.sendMessage({action:"resetPageZoom"}).catch(()=>{}),ee({isProcessing:!1}),ae=!1,V=[],q=0,S=[],J=0,ve=null,ke=null,ut=null,Dt(),k&&(k.emit(p.PROCESSING_TERMINATE),k.emit(p.OVERLAY_HIDE)),n({...o,terminated:!0});else{if(e.action==="getStoredState")return Te().then(r=>{n({...o,state:r})}),!0;if(e.action==="authStateChanged")Oe=e.isLoggedIn,De=e.subscriptionStatus,ct=e.userId,n({success:!0});else if(e.action==="activateContentDownloader")tt?(tt.toggle(),n({received:!0,toggled:!0})):(console.warn("⚠️ activateContentDownloader: ContentDownloadManager not wired"),n({received:!0,toggled:!1,error:"ContentDownloadManager not available"}));else if(e.action==="clickNewProjectButton"){try{const r=$("//button[.//i[normalize-space()='add_2']]");r?(console.log("✅ New project button found. Clicking..."),r.click(),n({success:!0})):(console.warn("⚠️ New project button not found"),n({success:!1,error:"Button not found"}))}catch(r){console.error("❌ Error clicking new project button:",r),n({success:!1,error:r.message})}return!0}else n(o)}});document.addEventListener("visibilitychange",()=>{document.hidden||setTimeout(()=>{Ze().then(e=>{chrome.runtime.sendMessage({action:"authStateRefreshed",authState:e}).catch(()=>{})})},500)});window.addEventListener("focus",()=>{setTimeout(()=>{Ze().then(e=>{chrome.runtime.sendMessage({action:"authStateRefreshed",authState:e}).catch(()=>{})})},500)});function Ke(e){e.queueTaskId&&chrome.runtime.sendMessage({action:"queueTaskUpdate",taskId:e.queueTaskId,updates:{status:e.status}}).catch(()=>{})}console.log("✅ State Manager module loaded");const Je=Object.freeze(Object.defineProperty({__proto__:null,SELECTORS:Ot,STORAGE_KEY:Pe,clearCountdownTimer:Ge,clearStateFromStorage:Dt,formatTime:Tn,getCurrentTask:En,getCurrentTaskByStatus:vn,getEffectiveSetting:qe,getRandomDelay:kn,getSettings:hn,getState:ue,getTaskByIndex:Sn,getTaskList:wn,init:It,loadStateFromStorage:Te,saveStateToStorage:Ee,sendTaskUpdate:Ke,setState:ee,startCountdown:In,updateSettings:yn,updateTask:xn,verifyAuthenticationState:Ze},Symbol.toStringTag,{value:"Module"}));let Ce=null;function Pn(e){Ce=e,console.log("✅ TextInjector initialized")}function we(e,t=[]){return new Promise(n=>{chrome.runtime.sendMessage({action:"executeInMainWorld",funcBody:e,args:t},o=>{chrome.runtime.lastError?n({success:!1,error:chrome.runtime.lastError.message}):n(o||{success:!1,error:"No response"})})})}const Cn=120;async function An(e){var t;try{const n=document.querySelector('[data-slate-editor="true"]');return n?((t=(Ce?Ce():{}).settings)==null?void 0:t.stealthMode)||!1?e.length>Cn?(console.log(`🥷 Stealth Mode: Long prompt (${e.length} chars) — using human-like paste simulation...`),await Mn(n,e)?(console.log("✅ Text pasted with human-like behavior (Slate.js)"),!0):(console.log("⏸️ Paste was interrupted or failed"),!1)):(console.log(`🥷 Stealth Mode: Short prompt (${e.length} chars) — using human-like typing...`),await _n(n,e)?(console.log("✅ Text typed with human-like behavior (Slate.js)"),!0):(console.log("⏸️ Typing was interrupted"),!1)):await Ut(n,e):(console.error('🔴 Flow Slate editor [data-slate-editor="true"] not found'),!1)}catch(n){return console.error("❌ Error injecting text into Slate.js editor:",n),!1}}async function Ut(e,t){e.focus(),e.click(),await h(200);const n=window.getSelection(),o=document.createRange();o.selectNodeContents(e),n.removeAllRanges(),n.addRange(o),await h(100),e.dispatchEvent(new InputEvent("beforeinput",{bubbles:!0,cancelable:!0,inputType:"insertText",data:t})),await h(400);const r=e.textContent.trim();return r===t||r.includes(t.substring(0,20))?(console.log("✅ Text injected successfully into Slate.js Flow editor"),!0):(console.warn("⚠️ Text injection may have failed. Got:",JSON.stringify(r.substring(0,50))),!0)}async function Mn(e,t){const n=300+Math.random()*600;console.log(`🥷 Paste simulation: thinking pause ${Math.round(n)}ms...`),await h(n),e.focus(),e.click(),await h(150+Math.random()*100);const o=window.getSelection(),r=document.createRange();r.selectNodeContents(e),o.removeAllRanges(),o.addRange(r),await h(80+Math.random()*80);const i=new DataTransfer;i.setData("text/plain",t),i.setData("text/html",`<span>${t.replace(/\n/g,"<br>")}</span>`);const a=new ClipboardEvent("paste",{bubbles:!0,cancelable:!0,clipboardData:i});e.dispatchEvent(a),await h(300+Math.random()*200);const l=e.textContent.trim(),d=t.trim();return l===d||l.includes(d.substring(0,30))?(console.log("✅ Paste simulation: SUCCESS"),!0):(console.warn("⚠️ Paste simulation: Slate ignored paste event — falling back to fast inject"),await Ut(e,t))}const Ln={a:["q","w","s","z"],b:["v","g","h","n"],c:["x","d","f","v"],d:["s","e","r","f","c"],e:["w","r","d"],f:["d","r","t","g","v"],g:["f","t","y","h","b"],h:["g","y","u","j","n"],i:["u","o","k"],j:["h","u","i","k","n"],k:["j","i","o","l"],l:["k","o","p"],m:["n","j","k"],n:["b","h","j","m"],o:["i","p","l","k"],p:["o","l"],q:["w","a"],r:["e","t","f"],s:["a","w","e","d","z"],t:["r","y","g"],u:["y","i","h","j"],v:["c","f","g","b"],w:["q","e","s"],x:["z","s","d","c"],y:["t","u","g","h"],z:["a","s"]},Rn=new Set(["th","he","in","er","an","re","on","en","at","es","ti","or"]);async function _n(e,t){var i,a;const n=await we(`
    const el = document.querySelector('[data-slate-editor="true"]');
    if (!el) return 'error:Editor not found';

    const fiberKey = Object.keys(el).find(k =>
      k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
    );
    if (!fiberKey) return 'error:React fiber not found on editor element';

    let node = el[fiberKey];
    let editor = null;
    for (let i = 0; i < 100; i++) {
      if (!node) break;
      const p = node.memoizedProps;
      if (p && p.editor && typeof p.editor.apply === 'function' && p.editor.children) {
        editor = p.editor;
        break;
      }
      node = node.return;
    }
    if (!editor) return 'error:Slate editor not found in fiber tree';

    // Store on window for subsequent per-character calls
    window.__flowSlateEditor = editor;

    // Clear any existing text
    const existing = editor.children[0]?.children[0]?.text || '';
    if (existing.length > 0) {
      editor.apply({ type: 'remove_text', path: [0, 0], offset: 0, text: existing });
    }
    return 'ok';
  `);if(!n.success||(i=n.result)!=null&&i.startsWith("error:")){const l=n.error||((a=n.result)==null?void 0:a.replace("error:",""))||"Unknown error";return console.error("❌ Stealth Typing init failed:",l),!1}console.log("✅ Stealth Typing: Slate editor initialized via MAIN world fiber"),await h(200);let o="";console.log(`🥷 Stealth Typing: "${t.substring(0,40)}${t.length>40?"...":""}"`);for(let l=0;l<t.length;l++){const d=Ce?Ce():{};if(!d.isProcessing&&!d.isPausing)return console.log("⏸️ Stealth Typing: interrupted — processing stopped"),!1;const u=t[l],c=u.toLowerCase();if(/[a-z]/.test(c)&&Math.random()<.03){const E=Ln[c]||[c],I=E[Math.floor(Math.random()*E.length)];await we(`
        const editor = window.__flowSlateEditor;
        if (editor) {
          const offset = editor.children[0]?.children[0]?.text?.length || 0;
          editor.apply({ type: 'insert_text', path: [0, 0], offset, text: args[0] });
        }
      `,[I]),await h(80+Math.random()*60),await h(150+Math.random()*250),await we(`
        const editor = window.__flowSlateEditor;
        if (editor) {
          const t = editor.children[0]?.children[0]?.text || '';
          if (t.length > 0) {
            editor.apply({ type: 'remove_text', path: [0, 0], offset: t.length - 1, text: t[t.length - 1] });
          }
        }
      `),await h(60+Math.random()*50)}await we(`
      const editor = window.__flowSlateEditor;
      if (editor) {
        const offset = editor.children[0]?.children[0]?.text?.length || 0;
        editor.apply({ type: 'insert_text', path: [0, 0], offset, text: args[0] });
      }
    `,[u]);const s=o+c;let m;Rn.has(s)?m=50+Math.random()*40:u===" "?m=120+Math.random()*150:u===","||u==="."?m=150+Math.random()*200:m=80+Math.random()*120;const w=l-t.lastIndexOf(" ",l);w>5&&(m+=w*2),Math.random()<.03&&(m+=400+Math.random()*800),o=c,await h(m)}await h(400);const r=await we(`
    const editor = window.__flowSlateEditor;
    return editor ? (editor.children[0]?.children[0]?.text || '') : '';
  `);if(r.success){const l=r.result||"";l===t?console.log("✅ Stealth Typing: SUCCESS — text matches exactly"):(console.warn("⚠️ Stealth Typing: mismatch. Got:     ",JSON.stringify(l.substring(0,60))),console.warn("⚠️ Stealth Typing: Expected:",JSON.stringify(t.substring(0,60))))}return!0}console.log("✅ TextInjector module loaded");let nt=null;function On(e){nt=e,console.log("✅ SubmitHandler initialized")}function Dn(e,t=[]){return new Promise(n=>{chrome.runtime.sendMessage({action:"executeInMainWorld",funcBody:e,args:t},o=>{chrome.runtime.lastError?n({success:!1,error:chrome.runtime.lastError.message}):n(o||{success:!1,error:"No response"})})})}async function Un(){var e;try{return((e=(nt?nt():{}).settings)==null?void 0:e.stealthMode)||!1?await $n():$t()}catch(t){return console.error("❌ Error in clickSubmit:",t),!1}}async function $n(){var t,n;console.log("🥷 Stealth Mode: Triggering submit via React fiber onClick (MAIN world)...");const e=await Dn(`
    // Find submit button: arrow_forward icon + span with text
    const buttons = Array.from(document.querySelectorAll('button'));
    const submitBtn = buttons.find(btn => {
      const hasArrowForward = btn.querySelector('i')?.textContent.trim() === 'arrow_forward';
      const hasSpanText     = btn.querySelector('span')?.textContent.trim().length > 0;
      return hasArrowForward && hasSpanText;
    });
    if (!submitBtn) return 'error:Submit button not found';

    // Walk fiber tree to find onClick prop
    const fiberKey = Object.keys(submitBtn).find(k =>
      k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
    );
    if (!fiberKey) return 'error:React fiber not found on submit button';

    let node = submitBtn[fiberKey];
    let onClick = null;
    for (let i = 0; i < 50; i++) {
      if (!node) break;
      const p = node.memoizedProps;
      if (p && typeof p.onClick === 'function') {
        onClick = p.onClick;
        break;
      }
      node = node.return;
    }
    if (!onClick) return 'error:onClick prop not found in fiber tree';

    // Call React handler directly — zero DOM events fired
    onClick({ type: 'click', preventDefault: () => {}, stopPropagation: () => {} });
    return 'ok';
  `);if(!e.success||(t=e.result)!=null&&t.startsWith("error:")){const o=e.error||((n=e.result)==null?void 0:n.replace("error:",""))||"Unknown error";return console.error("❌ Stealth submit failed:",o),console.warn("⚠️ Falling back to DOM click for submit..."),$t()}return console.log("✅ Stealth submit triggered via React onClick prop (zero DOM events)"),!0}function $t(){const t=Array.from(document.querySelectorAll("button")).find(n=>{var i,a;const o=((i=n.querySelector("i"))==null?void 0:i.textContent.trim())==="arrow_forward",r=((a=n.querySelector("span"))==null?void 0:a.textContent.trim().length)>0;return o&&r});return t?(t.click(),console.log("✅ Submit button clicked (DOM)"),!0):(console.warn("⚠️ Submit button not found"),!1)}console.log("✅ SubmitHandler module loaded");function ht(e){const{x:t,y:n}=Tt(e),o={bubbles:!0,cancelable:!0,pointerId:1,pointerType:"mouse",isPrimary:!0,clientX:t,clientY:n};e.dispatchEvent(new PointerEvent("pointerdown",o)),e.dispatchEvent(new PointerEvent("pointerup",o))}function Vn(e){const{x:t,y:n}=Tt(e),o={bubbles:!0,cancelable:!0,clientX:t,clientY:n,button:0};e.dispatchEvent(new MouseEvent("mousedown",o)),e.dispatchEvent(new MouseEvent("mouseup",o)),e.dispatchEvent(new MouseEvent("click",o))}function Ue(e){return e.getAttribute("data-state")==="active"?!1:(Vn(e),!0)}function qn(e){const t=e.getBoundingClientRect(),n=(Math.random()-.5)*t.width*.6,o=(Math.random()-.5)*t.height*.6,r=t.left+t.width/2+n,i=t.top+t.height/2+o;console.log(`🎯 Stealth click at (${Math.round(r)}, ${Math.round(i)}) — offset (${Math.round(n)}px, ${Math.round(o)}px)`);const a={bubbles:!0,cancelable:!0,view:window,clientX:r,clientY:i,screenX:window.screenX+r,screenY:window.screenY+i,button:0};e.dispatchEvent(new PointerEvent("pointerdown",{...a,isPrimary:!0,buttons:1})),e.dispatchEvent(new MouseEvent("mousedown",{...a,buttons:1})),e.dispatchEvent(new PointerEvent("pointerup",{...a,isPrimary:!0,buttons:0})),e.dispatchEvent(new MouseEvent("mouseup",{...a,buttons:0})),e.dispatchEvent(new PointerEvent("click",{...a,isPrimary:!0})),e.dispatchEvent(new MouseEvent("click",a))}console.log("✅ ClickHelper module loaded");let Ae=null,ot=null;function zn(e,t){Ae=e,ot=t,console.log("✅ SettingsApplicator initialized")}const Fn={default:"Veo 3.1 - Fast",veo3_fast:"Veo 3.1 - Fast",veo3_quality:"Veo 3.1 - Quality",veo2_fast:"Veo 2 - Fast",veo2_quality:"Veo 2 - Quality",veo3_fast_low:"Veo 3.1 - Fast",nano_banana_pro:"Nano Banana Pro",nano_banana2:"Nano Banana 2",nano_banana:"Nano Banana 2",imagen4:"Imagen 4"};function Yn(e,t){return!e||!t?!1:e.count===t.count&&e.model===t.model&&e.aspectRatio===t.aspectRatio&&e.taskType===t.taskType&&e.videoSubMode===t.videoSubMode}async function Nn(e="createvideo",t={}){try{const n=Ae?Ae():{};if(!n.isProcessing&&!n.isPausing)return console.log("⏸️ Settings application cancelled — processing stopped"),!1;const o=(t==null?void 0:t.count)||"1",r=(t==null?void 0:t.model)||"default",i=(t==null?void 0:t.aspectRatio)||"landscape",a=(t==null?void 0:t.videoSubMode)||"frames",l=e==="createimage",d=l?"image":"videocam",u=l?"Image":"Video",c={count:o,model:r,aspectRatio:i,taskType:e,videoSubMode:a};if(n.lastAppliedSettings&&Yn(c,n.lastAppliedSettings))return console.log("⏩ Settings unchanged from previous task — SKIPPING (~5s saved)"),!0;console.log(`⚙️ Applying settings: type=${e}, count=${o}, model=${r}, ratio=${i}, subMode=${l?"n/a":a}`);const s=$("//button[@aria-haspopup='menu' and .//div[@data-type='button-overlay'] and text()[normalize-space() != '']]");if(!s)return console.warn("⚠️ Main settings trigger button not found"),!1;if(ht(s),console.log("✅ Step 1: Opened main control panel"),await h(600),!document.querySelector('[role="menu"][data-state="open"]'))return console.warn("⚠️ Control panel menu did not open"),!1;const w=$(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${d}']]`);if(w?Ue(w)?(console.log(`✅ Step 2: Selected output type: ${u}`),await h(400)):console.log(`⏩ Step 2: Output type already: ${u}`):console.warn(`⚠️ Output type tab "${u}" not found`),$e())return re(),!1;if(l)console.log("⏩ Step 3: Skipped (image task — no sub-mode)");else{const L=a==="ingredients"?"chrome_extension":"crop_free",B=a==="ingredients"?"Ingredients":"Frames",U=$(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${L}']]`);U?Ue(U)?(console.log(`✅ Step 3: Selected video sub-mode: ${B}`),await h(300)):console.log(`⏩ Step 3: Sub-mode already: ${B}`):console.warn(`⚠️ Sub-mode tab "${B}" not found`)}if($e())return re(),!1;const E=i==="portrait"?"crop_9_16":"crop_16_9",I=i==="portrait"?"Portrait":"Landscape",Q=$(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and .//i[normalize-space(text())='${E}']]`);if(Q?Ue(Q)?(console.log(`✅ Step 4: Selected aspect ratio: ${I}`),await h(300)):console.log(`⏩ Step 4: Aspect ratio already: ${I}`):console.warn(`⚠️ Aspect ratio tab "${I}" not found`),$e())return re(),!1;const Y=`x${o}`,G=$(`//button[@role='tab' and contains(@class,'flow_tab_slider_trigger') and normalize-space(text())='${Y}']`);if(G?Ue(G)?(console.log(`✅ Step 5: Selected count: ${Y}`),await h(300)):console.log(`⏩ Step 5: Count already: ${Y}`):console.warn(`⚠️ Count tab "${Y}" not found`),$e())return re(),!1;const K=Fn[r]||(l?"Nano Banana Pro":"Veo 3.1 - Fast"),O=$("//div[@role='menu' and @data-state='open']//button[@aria-haspopup='menu' and .//div[@data-type='button-overlay']]");if(!O)console.warn("⚠️ Model dropdown trigger not found inside control panel");else{ht(O),console.log("✅ Step 6a: Opened model dropdown"),await h(500);const L=$(`//div[@role='menuitem']//button[.//span[contains(normalize-space(text()),'${K}')]]`);L?(L.click(),console.log(`✅ Step 6b: Selected model: ${K}`),await h(400)):(console.warn(`⚠️ Model option "${K}" not found`),re(),await h(300))}return re(),await h(600),console.log("✅ Step 7: Control panel closed"),ot&&(ot({lastAppliedSettings:c,lastAppliedMode:e}),console.log("💾 Settings cached for next task comparison")),!0}catch(n){return console.error("❌ Error applying unified Flow settings:",n),re(),!1}}function $e(){const e=Ae?Ae():{};return!e.isProcessing&&!e.isPausing}console.log("✅ SettingsApplicator module loaded");let Me=null;const jn=500,yt=3e3,Vt=8e3,Gn=15e3,Kn=8e3,Bn=300,Hn=5e3;function Qn(e){Me=e,console.log("✅ ImageUploader initialized")}function et(){var t;return((t=(Me?Me():{}).settings)==null?void 0:t.stealthMode)===!0}function Xn(e){return Math.round(e*(.7+Math.random()*.6))}async function X(e){const t=et()?Xn(e):e;return h(t)}function Be(e){et()?qn(e):e.click()}async function qt(e,t){const n=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,"value").set;if(et()){const o=100+Math.random()*300;console.log(`🥷 Stealth: Input think pause ${Math.round(o)}ms before setting "${t}"...`),await h(o)}e.focus(),n.call(e,t),e.dispatchEvent(new Event("input",{bubbles:!0}))}async function Wn(){const e=document.querySelectorAll("button");let t=null;for(const n of e){const o=n.querySelector("i.google-symbols");if(o&&o.textContent.trim()==="close"&&n.querySelector("span")){t=n;break}}return t?(Be(t),console.log("🧹 ImageUploader Pre-flight: Clicked clear-references button — all attached references cleared"),await X(300),!0):(console.log("✅ ImageUploader Pre-flight: No attached references found — input area is clean"),!1)}async function Zn(e){if(!e||e.length===0)return console.warn("⚠️ ImageUploader.uploadAllImages: No images provided"),!1;console.log(`📤 ImageUploader Phase 1: Batch-checking ${e.length} file(s) in library (single picker session)...`);const t=e.map((a,l)=>a.name||`reference_${l+1}.jpg`),n=await to(t),o=e.length-n.size;let r=!1,i=0;for(let a=0;a<e.length;a++){if(Ft())return console.log("⏸️ ImageUploader: Processing stopped during file injection"),!1;const l=e[a],d=t[a],u=l.mimeType||"image/jpeg";if(n.has(d)){console.log(`⏩ ImageUploader Phase 1 [${a+1}/${e.length}]: "${d}" already in library — skipping upload`);continue}console.log(`📤 ImageUploader Phase 1 [${a+1}/${e.length}]: "${d}" not in library — uploading...`);const c=document.querySelector('input[type="file"][accept*="image"]');if(!c)return console.warn(`⚠️ ImageUploader Phase 1: File input not found for "${d}"`),!1;const s=ro(l.data,d,u);if(!s)return console.warn(`⚠️ ImageUploader Phase 1: Failed to convert "${d}" to File object`),!1;const m=new DataTransfer;m.items.add(s),c.files=m.files,c.dispatchEvent(new Event("change",{bubbles:!0})),console.log(`✅ ImageUploader Phase 1 [${a+1}/${e.length}]: "${d}" injected (${(s.size/1024).toFixed(1)} KB)`),r=!0,i++,i<o&&await X(jn)}return r?(console.log(`⏳ ImageUploader Phase 1 complete — waiting ${yt/1e3}s for uploads to settle...`),await h(yt)):console.log("⏩ ImageUploader Phase 1 complete — all images already in library, no settle wait needed"),!0}async function Jn(e,t="ingredients"){if(!e||e.length===0)return console.warn("⚠️ ImageUploader.attachAllImages: No images provided"),!1;console.log(`🔗 ImageUploader Phase 2: Attaching ${e.length} image(s) as references [${t}]...`);for(let n=0;n<e.length;n++){if(Ft())return console.log("⏸️ ImageUploader: Processing stopped during reference attachment"),!1;const r=e[n].name||`reference_${n+1}.jpg`,i=n;if(console.log(`🔗 ImageUploader Phase 2 [${n+1}/${e.length}]: Attaching "${r}" [${t}${t==="frames"?`/${i===0?"Start":"End"}`:""}]...`),!await eo(r,t,i))return console.error(`❌ ImageUploader Phase 2: Failed to attach "${r}"`),!1;console.log(`✅ ImageUploader Phase 2 [${n+1}/${e.length}]: "${r}" attached successfully`)}return console.log(`✅ ImageUploader Phase 2 complete — all ${e.length} image(s) attached`),!0}async function eo(e,t,n){const o=et(),r=no(t,n);if(!r)return console.warn(`⚠️ ImageUploader: ${t==="frames"?`Frames ${n===0?"Start":"End"} frame div`:"add_2 button"} trigger not found`),!1;Be(r),console.log(`✅ ImageUploader: Clicked trigger (${t}${t==="frames"?`/${n===0?"Start":"End"}`:""})`);const i=await kt('[role="dialog"][data-state="open"]',Vt);if(!i)return console.warn("⚠️ ImageUploader: Asset picker popover did not open"),!1;console.log("✅ ImageUploader: Asset picker popover opened"),await X(400);const a=i.querySelector('input[type="text"]');if(!a)return console.warn("⚠️ ImageUploader: Search input not found in popover"),me(),!1;await qt(a,e),console.log(`🔍 ImageUploader: Searching for "${e}"${o?" (stealth paste)":""}...`);const l=await zt(e,Gn);if(!l)return console.warn(`⚠️ ImageUploader: Search result for "${e}" not found (upload may not have completed yet)`),me(),!1;console.log(`✅ ImageUploader: Found search result for "${e}"`);const d=l.parentElement;return d?(o&&await h(150+Math.random()*200),Be(d),console.log(`✅ ImageUploader: Clicked result row for "${e}"`),await oo(Kn)?console.log("✅ ImageUploader: Popover closed — image attached as reference"):(console.warn("⚠️ ImageUploader: Popover did not close after clicking result — forcing close"),me(),await X(300)),await X(500),!0):(console.warn("⚠️ ImageUploader: Result row parent not found"),me(),!1)}async function to(e){const t=new Set;if(!e||e.length===0)return t;const n=$("//button[.//i[normalize-space(text())='add_2']]");if(!n)return console.warn("⚠️ ImageUploader library check: add_2 trigger not found — assuming all images need upload"),t;Be(n);const o=await kt('[role="dialog"][data-state="open"]',Vt);if(!o)return console.warn("⚠️ ImageUploader library check: Popover did not open — assuming all images need upload"),t;await X(300);const r=o.querySelector('input[type="text"]');if(!r)return console.warn("⚠️ ImageUploader library check: Search input not found — closing picker"),me(),t;for(let i=0;i<e.length;i++){const a=e[i];await qt(r,a),console.log(`🔍 ImageUploader library check [${i+1}/${e.length}]: Searching for "${a}"...`),await X(300),await zt(a,Hn)?(console.log(`✅ ImageUploader library check [${i+1}/${e.length}]: "${a}" found in library`),t.add(a)):console.log(`📭 ImageUploader library check [${i+1}/${e.length}]: "${a}" not in library — will upload`),i<e.length-1&&await X(200)}return me(),await X(400),console.log(`📊 ImageUploader library check complete: ${t.size}/${e.length} already in library`),t}function no(e,t){return $(e==="frames"?`//div[@aria-haspopup='dialog' and normalize-space(text())='${t===0?"Start":"End"}']`:"//button[.//i[normalize-space(text())='add_2']]")}async function zt(e,t){const n=Date.now();for(;Date.now()-n<t;){const o=document.querySelector(`[data-testid="virtuoso-item-list"] img[alt="${e}"]`);if(o)return o;await h(Bn)}return null}async function oo(e){const t=Date.now();for(;Date.now()-t<e;){if(!document.querySelector('[role="dialog"][data-state="open"]'))return!0;await h(200)}return!1}function me(){document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",keyCode:27,bubbles:!0,cancelable:!0,composed:!0}))}function ro(e,t,n){try{let o=e,r=n;if(e.startsWith("data:")){const[l,d]=e.split(",");o=d;const u=l.match(/:(.*?);/);u&&(r=u[1])}const i=atob(o),a=new Uint8Array(i.length);for(let l=0;l<i.length;l++)a[l]=i.charCodeAt(l);return new File([a],t,{type:r})}catch(o){return console.error("❌ ImageUploader: base64ToFile conversion failed:",o),null}}function Ft(){const e=Me?Me():{};return!e.isProcessing&&!e.isPausing}console.log("✅ ImageUploader module loaded");function xe(e,t){return[...e.querySelectorAll("i")].some(n=>n.textContent.trim()===t)}const Yt=[{type:"POLICY_VIOLATION",label:"Prompt flagged by content policy",detect:e=>xe(e,"warning")?[...e.querySelectorAll("a[href]")].some(n=>{const o=n.getAttribute("href")||"";return o.includes("/faq")||o.includes("/policies")||o.includes("policy")}):!1},{type:"DAILY_LIMIT_MODEL_FALLBACK",label:"Daily generation limit reached — switching to Imagen 4",detect:e=>!xe(e,"warning")||!xe(e,"refresh")?!1:e.textContent.includes("Nano Banana")},{type:"GENERATION_FAILED",label:"Generation failed — Flow encountered an error",detect:e=>xe(e,"warning")?xe(e,"refresh"):!1}],Nt=[];function io(e,t){const n=[];return document.querySelectorAll("[data-tile-id]").forEach(o=>{const r=o.getAttribute("data-tile-id");if(!(!r||e!=null&&e.has(r)||t!=null&&t.has(r)||o.querySelector('video[src*="media.getMediaUrlRedirect"]')||o.querySelector('img[src*="media.getMediaUrlRedirect"]'))){for(const a of Yt)if(a.detect(o)){t==null||t.add(r),n.push({tileId:r,type:a.type,label:a.label}),console.warn(`⚠️ ErrorScanner: tile ${r} — ${a.label}`);break}}}),{errorCount:n.length,errors:n}}function ao(){for(const e of Nt)if(e.detect())return console.error(`❌ ErrorScanner: global error — ${e.label} (severity: ${e.severity})`),{found:!0,type:e.type,label:e.label,severity:e.severity};return{found:!1,type:null,label:null,severity:null}}console.log(`✅ ErrorScanner module loaded — ${Yt.length} tile pattern(s), ${Nt.length} global pattern(s)`);let z=null,ze=null,Le=null,b=null,y=null,Fe=null,Ye=null,He=[],rt=!1;function jt({getState:e,setState:t,getSelectors:n,eventBus:o,stateManager:r}){z=e,ze=t,Le=n,b=o,y=r,o.on(p.PROCESSING_TERMINATE,()=>{ye(),le(),pt()}),console.log("✅ MonitoringExport initialized")}function so(){const e=new Set;return document.querySelectorAll("[data-tile-id]").forEach(t=>{const n=t.getAttribute("data-tile-id");n&&e.add(n)}),console.log(`📸 Tile snapshot: ${e.size} existing tile(s)`),e}function Gt(e){const t=!!e.querySelector('video[src*="media.getMediaUrlRedirect"]'),n=!!e.querySelector('img[src*="media.getMediaUrlRedirect"]');return t||n}function Kt(e){return!!e.querySelector("video")}function Bt(e){const t=[],n=new Set;return document.querySelectorAll("[data-tile-id]").forEach(o=>{const r=o.getAttribute("data-tile-id");!r||n.has(r)||(n.add(r),!(e&&e.has(r))&&Gt(o)&&t.push({tileId:r,tileEl:o,isVideo:Kt(o)}))}),t}function lo(e,t){const n=[...e.querySelectorAll('button[role="menuitem"], button')];if(n.length===0)return null;const o=n.map(i=>{var u;const l=((u=i.querySelectorAll("span")[0])==null?void 0:u.textContent.trim())||i.textContent.trim(),d=i.getAttribute("aria-disabled")!=="true";return{btn:i,label:l,enabled:d}}),r=o.filter(i=>i.enabled);if(t){const i=o.find(a=>a.label===t);if(i){if(i.enabled)return console.log(`⬇️ Download quality: "${i.label}" (selected)`),i.btn;console.warn(`⚠️ "${t}" is locked (aria-disabled). Falling back to best available.`)}else console.warn(`⚠️ Quality "${t}" not found in sub-menu. Falling back.`)}if(r.length>0){const i=r[r.length-1];return console.log(`⬇️ Download quality fallback: "${i.label}" (best available)`),i.btn}return console.warn("⚠️ All quality options disabled — clicking first button as last resort"),n[0]}async function Ht(e,t=null){try{const n=e.querySelector('video[src*="media.getMediaUrlRedirect"]')||e.querySelector('img[src*="media.getMediaUrlRedirect"]');if(!n)return console.warn("⚠️ No media element found in tile for download"),!1;const o=n.getBoundingClientRect(),r=o.left+o.width/2,i=o.top+o.height/2;n.dispatchEvent(new MouseEvent("mouseenter",{bubbles:!0,clientX:r,clientY:i})),n.dispatchEvent(new MouseEvent("mousemove",{bubbles:!0,clientX:r,clientY:i})),await h(400),n.dispatchEvent(new MouseEvent("contextmenu",{bubbles:!0,cancelable:!0,clientX:r,clientY:i,button:2})),await h(600);const a=document.querySelector('[data-radix-menu-content][data-state="open"]');if(!a)return console.warn("⚠️ Context menu did not open for tile download"),!1;const l=[...a.querySelectorAll('[role="menuitem"]')].find(s=>{var m;return((m=s.querySelector("i"))==null?void 0:m.textContent.trim())==="download"});if(!l)return console.warn("⚠️ Download menuitem not found in context menu"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;l.click(),await h(600);const d=[...document.querySelectorAll('[data-radix-menu-content][data-state="open"]')],u=d.find(s=>s!==a)||d[d.length-1];if((!u||u===a)&&!([...document.querySelectorAll("[data-radix-popper-content-wrapper]")].flatMap(m=>[...m.querySelectorAll('[role="menuitem"]')]).length>0?document.querySelector("[data-radix-popper-content-wrapper]:last-of-type"):null))return console.warn("⚠️ Quality sub-menu did not open"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;const c=lo(u,t);return c?(c.click(),await h(300),console.log("✅ Download triggered via UI"),!0):(console.warn("⚠️ No quality button found in sub-menu"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1)}catch(n){return console.error("❌ Error in downloadTileViaUI:",n),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1}}async function co(){if(!rt){for(rt=!0;He.length>0;){const{tileEl:e,targetQuality:t,label:n}=He.shift();console.log(`⬇️ Download runner: processing "${n}" (quality: ${t??"default"})`),await Ht(e,t),await h(500)}pt(),console.log("✅ Download runner: queue empty, state reset")}}const wt={image:{stall:3e4,zeroTiles:6e4},video:{stall:9e4,zeroTiles:18e4}};async function Qt(){var t,n,o,r,i,a,l,d,u,c;const e=z?z():{};if(!(!e.isProcessing&&!e.isPausing))try{const s=(t=e.taskList)==null?void 0:t.find(x=>x.status==="current");if(!s)return;s.foundVideos||(s.foundVideos=0),s.processedTileIds||(s.processedTileIds=new Set),s._scanStartedAt||(s._scanStartedAt=Date.now(),b==null||b.emit(p.OVERLAY_ERROR_BANNER_CLEAR));const m=s.type==="createimage",{stall:w,zeroTiles:E}=m?wt.image:wt.video,I=e.preSubmitTileIds||new Set,Q=Bt(I);let Y=!1;for(const{tileId:x,tileEl:R,isVideo:oe}of Q){if(s.processedTileIds.has(x))continue;s.processedTileIds.add(x),s.foundVideos+=1,s._lastFoundAt=Date.now(),Y=!0;const Z=oe?"Video":"Image";if(console.log(`✅ New ${Z} detected: tile ${x} (${s.foundVideos}/${s.expectedVideos})`),b==null||b.emit(p.OVERLAY_MESSAGE,`✅ ${Z} ${s.foundVideos}/${s.expectedVideos} for Task ${s.index}`),chrome.runtime.sendMessage({action:"updateStatus",status:`${Z} ${s.foundVideos}/${s.expectedVideos} captured for Task ${s.index}`}),((n=e.settings)==null?void 0:n.autoDownload)!==!1){const D=oe?"videoDownloadQuality":"imageDownloadQuality",pe=((o=s.settings)==null?void 0:o[D])||((r=e.settings)==null?void 0:r[D])||(oe?"720p":"1K");He.push({tileEl:R,targetQuality:pe,label:`${Z} ${x}`}),co()}(i=y==null?void 0:y.sendTaskUpdate)==null||i.call(y,s)}const{errorCount:G,errors:K}=io(I,s.processedTileIds);if(G>0){if(K.every(D=>D.type==="DAILY_LIMIT_MODEL_FALLBACK")){console.warn(`🍌 Task ${s.index}: ALL tile errors are DAILY_LIMIT_MODEL_FALLBACK — triggering Imagen 4 fallback`),ye(),le(),b==null||b.emit(p.OVERLAY_MESSAGE,`⚠️ Nano Banana Pro daily limit reached — switching to Imagen 4 and retrying Task ${s.index}...`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${s.index}: Nano Banana Pro limit hit — switching to Imagen 4`}),b==null||b.emit(p.DAILY_LIMIT_FALLBACK,{task:s,taskIndex:e.currentPromptIndex,fallbackModel:"imagen4"});return}s.foundVideos+=G,s._lastFoundAt=Date.now(),Y=!0;for(const D of K)console.warn(`⚠️ Tile error counted for task ${s.index}: [${D.type}] ${D.label} (tile ${D.tileId})`);const R=s.foundVideos,oe=s.expectedVideos,Z=K.reduce((D,pe)=>(D[pe.label]=(D[pe.label]||0)+1,D),{}),M=Object.entries(Z).map(([D,pe])=>`• ${pe}× ${D}`);b==null||b.emit(p.OVERLAY_ERROR_BANNER,{lines:M,taskIndex:s.index}),b==null||b.emit(p.OVERLAY_MESSAGE,`⚠️ ${G} tile error(s) — ${R}/${oe} resolved`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${s.index}: ${G} error tile(s) — ${JSON.stringify(Z)} — ${R}/${oe} resolved`}),(a=y==null?void 0:y.sendTaskUpdate)==null||a.call(y,s)}const O=ao();if(O.found){if(console.error(`❌ Global error: [${O.type}] ${O.label} (severity: ${O.severity})`),b==null||b.emit(p.OVERLAY_MESSAGE,`❌ ${O.label}`),O.severity==="skip_task"&&s.status==="current"){s.status="error",(l=y==null?void 0:y.sendTaskUpdate)==null||l.call(y,s),Ve(s,e.currentPromptIndex);return}if(O.severity==="pause_processing"){b==null||b.emit(p.PROCESSING_STOP);return}if(O.severity==="terminate"){b==null||b.emit(p.PROCESSING_TERMINATE);return}}const L=Date.now(),B=s.expectedVideos-s.foundVideos,U=m?"image":"video";if(s.foundVideos>=s.expectedVideos&&s.status==="current"){s.status="processed";const x=s.type==="createimage"?"image(s)":"video(s)";console.log(`✅ Task ${s.index} COMPLETE (${s.foundVideos}/${s.expectedVideos} ${x})`),(d=y==null?void 0:y.sendTaskUpdate)==null||d.call(y,s),Ve(s,e.currentPromptIndex);return}if(s.foundVideos>0&&s._lastFoundAt&&L-s._lastFoundAt>w&&s.status==="current"){s.status="processed",console.warn(`⚠️ Task ${s.index}: stall timeout — ${s.foundVideos}/${s.expectedVideos} ${U}(s) (${B} failed)`),b==null||b.emit(p.OVERLAY_MESSAGE,`⚠️ Task ${s.index}: ${s.foundVideos}/${s.expectedVideos} ${U}s — ${B} failed. Continuing...`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${s.index}: partial (${s.foundVideos}/${s.expectedVideos} ${U}s). Moving on.`}),(u=y==null?void 0:y.sendTaskUpdate)==null||u.call(y,s),Ve(s,e.currentPromptIndex);return}if(s.foundVideos===0&&s._scanStartedAt&&L-s._scanStartedAt>E&&s.status==="current"){s.status="error";const x=(E/6e4).toFixed(1);console.error(`❌ Task ${s.index}: zero ${U}s after ${x} min. All ${s.expectedVideos} generations failed.`),b==null||b.emit(p.OVERLAY_MESSAGE,`❌ Task ${s.index}: no ${U}s generated after ${x} min. Skipping...`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${s.index}: all ${s.expectedVideos} ${U}(s) failed (${x}min). Skipping.`}),(c=y==null?void 0:y.sendTaskUpdate)==null||c.call(y,s),Ve(s,e.currentPromptIndex);return}if(s.foundVideos>0&&s._lastFoundAt&&!Y){const x=Math.round((L-s._lastFoundAt)/1e3),R=Math.round((w-(L-s._lastFoundAt))/1e3);x>0&&x%30<5&&console.log(`⏳ Task ${s.index} [${U}]: waiting for ${B} more — stalled ${x}s, timeout in ${R}s`)}}catch(s){console.error("❌ Error in periodicTileScanner:",s)}}function uo(){ye();const e=z?z():{};if(!e.isProcessing&&!e.isPausing)return;const t=e.scanIntervalMs||5e3;console.log(`🔍 Starting tile scanner (every ${t/1e3}s)`),Fe=setInterval(Qt,t)}function ye(){Fe&&(clearInterval(Fe),Fe=null,console.log("🛑 Tile scanner stopped"))}function pt(){He=[],rt=!1}function Xt(){try{const e=Le?Le():{};return!!$(e.QUEUE_FULL_POPUP_XPATH)}catch(e){return console.warn("⚠️ Error checking for queue full:",e),!1}}function mt(){try{const e=Le?Le():{};return!!$(e.PROMPT_POLICY_ERROR_POPUP_XPATH)}catch(e){return console.warn("⚠️ Error checking for policy error:",e),!1}}async function po(){await h(2e3);for(let e=0;e<10;e++){if(Xt())return console.warn("⚠️ Queue is full!"),"QUEUE_FULL";if(mt())return console.warn("⚠️ Prompt violates policy!"),"POLICY_PROMPT";await h(1e3)}return null}function mo(){le(),console.log("🔍 Starting error monitoring..."),Ye=setInterval(async()=>{var t,n,o,r;const e=z?z():{};if(!e.isProcessing&&!e.isPausing){le();return}if(mt()){console.error("❌ Policy error detected during generation!"),le(),ye();const i=(t=e.taskList)==null?void 0:t[e.currentPromptIndex];i&&(i.status="error",(n=y==null?void 0:y.sendTaskUpdate)==null||n.call(y,i)),b==null||b.emit(p.OVERLAY_MESSAGE,"⚠️ Policy violation detected. Skipping this prompt..."),chrome.runtime.sendMessage({action:"updateStatus",status:`Policy violation on prompt: "${(r=(o=e.prompts)==null?void 0:o[e.currentPromptIndex])==null?void 0:r.substring(0,30)}..."`}),setTimeout(()=>{(z?z():{}).isProcessing&&(ze==null||ze({isCurrentPromptProcessed:!0}),i&&(b==null||b.emit(p.TASK_COMPLETED,{task:i,taskIndex:e.currentPromptIndex})))},3e3)}},2e3)}function le(){Ye&&(clearInterval(Ye),Ye=null,console.log("🛑 Error monitoring stopped"))}function Ve(e,t){(z?z():{}).isCurrentPromptProcessed||(ye(),le(),setTimeout(()=>{const o=z?z():{};(o.isProcessing||o.isPausing)&&(b==null||b.emit(p.TASK_COMPLETED,{task:e,taskIndex:t}))},500))}console.log("✅ MonitoringExport module loaded (workflow layer, tile-based scanner — video/image/future)");const Wt=Object.freeze(Object.defineProperty({__proto__:null,checkForErrorsAfterSubmit:po,checkForPromptPolicyError:mt,checkForQueueFull:Xt,downloadTileViaUI:Ht,init:jt,isTileCompleted:Gt,isTileVideo:Kt,periodicTileScanner:Qt,resetDownloadQueue:pt,scanForNewlyCompletedTiles:Bt,snapshotExistingTileIds:so,startErrorMonitoring:mo,startTileScanner:uo,stopErrorMonitoring:le,stopTileScanner:ye},Symbol.toStringTag,{value:"Module"}));let C=null,A=null,g=null,P=null,_=null;function go({getState:e,setState:t,eventBus:n,monitoring:o,stateManager:r}){C=e,A=t,g=n,P=o,_=r,n.on(p.DAILY_LIMIT_FALLBACK,({task:i,taskIndex:a,fallbackModel:l})=>{console.warn(`🔄 DAILY_LIMIT_FALLBACK received — switching all tasks to model: ${l}`);const d=C==null?void 0:C();if(!d)return;A==null||A({fallbackModel:l});const u=d.taskList.map(c=>c.status==="pending"||c.status==="current"?{...c,settings:{...c.settings,model:l},processedTileIds:new Set,foundVideos:0,_scanStartedAt:null,_lastFoundAt:null,status:c.index===i.index?"pending":c.status}:c);A==null||A({taskList:u,lastAppliedSettings:null}),console.log(`✅ Model patched to "${l}" on ${u.filter(c=>c.status==="pending"||c.status==="current").length} task(s)`),setTimeout(()=>{const c=C==null?void 0:C();if(!(c!=null&&c.isProcessing)&&!(c!=null&&c.isPausing))return;const s=c.taskList.find(m=>m.index===i.index);s&&(console.log(`🔁 Re-running Task ${s.index} with fallback model "${l}"...`),g==null||g.emit(p.OVERLAY_MESSAGE,`🔁 Retrying Task ${s.index} with Imagen 4...`),gt(s,a))},2e3)}),console.log("✅ TaskRunner initialized")}async function gt(e,t){var E,I,Q,Y,G,K,O,L,B,U;if(!e){console.error("❌ TaskRunner: No task provided"),g==null||g.emit(p.TASK_ERROR,{task:null,reason:"no_task"});return}const n=e.prompt,o=e.type==="createimage",r=o?"createimage":"createvideo",i=o?"image":"video";A==null||A({currentProcessingPrompt:n,currentTaskStartTime:Date.now()});const a=`Processing ${r} task ${e.index}: "${n==null?void 0:n.substring(0,30)}${(n==null?void 0:n.length)>30?"...":""}"`;console.log(`📌 Task ${e.index} started`),g==null||g.emit(p.OVERLAY_MESSAGE,a);const l=(E=C==null?void 0:C())==null?void 0:E.fallbackModel;if(l&&((I=e.settings)==null?void 0:I.model)!==l&&(console.log(`🔄 Applying fallback model override: ${((Q=e.settings)==null?void 0:Q.model)??"default"} → ${l}`),e={...e,settings:{...e.settings,model:l}}),console.log(`⚙️ Step 0/4: Applying settings for Task ${e.index} (${r})...`),g==null||g.emit(p.OVERLAY_MESSAGE,`Step 0/4: Applying settings for ${r}...`),await Nn(e.type||"createvideo",e.settings||{}))console.log(`✅ Settings applied: ${r}, ${((Y=e.settings)==null?void 0:Y.count)||"1"} ${i}(s), ${((G=e.settings)==null?void 0:G.model)||"default"}, ${((K=e.settings)==null?void 0:K.aspectRatio)||"landscape"}`);else{const x=C==null?void 0:C();if(!(x!=null&&x.isProcessing)&&!(x!=null&&x.isPausing)){console.log("⏸️ Processing stopped during settings application");return}console.warn("⚠️ Failed to apply settings, continuing anyway...")}if(await h(500),e.referenceImages&&((O=e.referenceImages.images)==null?void 0:O.length)>0){const x=e.referenceImages.mode||"ingredients",R=e.referenceImages.images.filter(Boolean);if(R.length>0){if(console.log(`🧹 Step 1.5 pre-flight: Clearing any existing attached references for Task ${e.index}...`),g==null||g.emit(p.OVERLAY_MESSAGE,"Step 1.5/4: Clearing previous references..."),await Wn(),console.log(`🖼️ Step 1.5a/4: Checking/uploading ${R.length} file(s) into Flow [${x}] for Task ${e.index}...`),g==null||g.emit(p.OVERLAY_MESSAGE,`Step 1.5/4: Uploading ${R.length} reference image(s) to Flow library...`),!await Zn(R)){const M=C==null?void 0:C();if(!(M!=null&&M.isProcessing)&&!(M!=null&&M.isPausing)){console.log("⏸️ Processing stopped during file injection");return}console.error("❌ File injection failed — triggering retry"),g==null||g.emit(p.TASK_ERROR,{task:e,taskIndex:t,reason:"image_upload_failed"});return}if(console.log(`🔗 Step 1.5b/4: Attaching ${R.length} image(s) as references [${x}]...`),g==null||g.emit(p.OVERLAY_MESSAGE,`Step 1.5/4: Attaching ${R.length} reference image(s)...`),!await Jn(R,x)){const M=C==null?void 0:C();if(!(M!=null&&M.isProcessing)&&!(M!=null&&M.isPausing)){console.log("⏸️ Processing stopped during reference attachment");return}console.error("❌ Reference attachment failed — triggering retry"),g==null||g.emit(p.TASK_ERROR,{task:e,taskIndex:t,reason:"image_attach_failed"});return}console.log(`✅ All ${R.length} reference image(s) [${x}] uploaded and attached`),await h(500)}}if(console.log(`📝 Step 2/4: Injecting prompt for Task ${e.index}...`),g==null||g.emit(p.OVERLAY_MESSAGE,"Step 2/4: Adding prompt..."),!await An(n)){console.error("❌ Text injection failed — triggering retry"),g==null||g.emit(p.TASK_ERROR,{task:e,taskIndex:t,reason:"inject_failed"});return}if(await h(1e3),_==null||_.updateTask(t,{status:"current"}),g==null||g.emit(p.TASK_START,{task:((L=_==null?void 0:_.getCurrentTask)==null?void 0:L.call(_))??e,taskIndex:t}),console.log(`📋 Task ${e.index} status: current`),console.log(`🚀 Step 3/4: Submitting Task ${e.index}...`),g==null||g.emit(p.OVERLAY_MESSAGE,"Step 3/4: Submitting..."),P!=null&&P.snapshotExistingTileIds){const x=P.snapshotExistingTileIds();A==null||A({preSubmitTileIds:x}),console.log(`📸 Pre-submit tile snapshot: ${x.size} existing tile(s)`)}if(!await Un()){console.error("❌ Submit failed — triggering retry"),g==null||g.emit(p.TASK_ERROR,{task:e,taskIndex:t,reason:"submit_failed"});return}console.log(`✅ Submitted prompt: "${n}"`),console.log("🔍 Step 4/4: Monitoring for completion...");const s=o?"Step 4/4: Monitoring image generation...":"Step 4/4: Monitoring video generation...";g==null||g.emit(p.OVERLAY_MESSAGE,s);const m=P!=null&&P.checkForErrorsAfterSubmit?await P.checkForErrorsAfterSubmit():null;if(m==="QUEUE_FULL")return console.warn("⚠️ Queue full — waiting 30 seconds before retry..."),g==null||g.emit(p.OVERLAY_MESSAGE,"Queue is full. Waiting 30 seconds before retry..."),await h(3e4),gt(e,t);if(m==="POLICY_PROMPT"){console.error("❌ Prompt violates policy — skipping"),g==null||g.emit(p.OVERLAY_MESSAGE,"⚠️ Policy violation detected. Skipping this prompt..."),_==null||_.updateTask(t,{status:"error"}),_==null||_.sendTaskUpdate(e),g==null||g.emit(p.TASK_SKIPPED,{task:e,taskIndex:t,reason:"policy_violation"}),chrome.runtime.sendMessage({action:"updateStatus",status:`Policy violation on prompt: "${n==null?void 0:n.substring(0,30)}..."`}),await h(3e3),A==null||A({isCurrentPromptProcessed:!0}),g==null||g.emit(p.TASK_COMPLETED,{task:e,taskIndex:t});return}console.log("✅ No errors detected, starting tile scanner..."),(B=P==null?void 0:P.startTileScanner)==null||B.call(P),(U=P==null?void 0:P.startErrorMonitoring)==null||U.call(P);const w=o?"Generating images... scanning for images":"Generating flow... scanning for videos";console.log(`⏳ ${w}`),g==null||g.emit(p.OVERLAY_MESSAGE,w),A==null||A({currentRetries:0})}console.log("✅ TaskRunner module loaded");let f=null,F=null,v=null,Ie=null;const it=3,fo=5e3,bo=15e3;function ho({stateManager:e,eventBus:t,monitoring:n}){f=e,F=t,v=n,t.on(p.QUEUE_NEXT,()=>Qe()),t.on(p.TASK_START,wo),t.on(p.TASK_COMPLETED,en),t.on(p.TASK_SKIPPED,xo),t.on(p.TASK_ERROR,Eo),t.on(p.PROCESSING_STOP,xt),t.on(p.PROCESSING_TERMINATE,xt),console.log("✅ QueueController initialized")}function Qe(){var r;const e=f.getState();f.setState({isCurrentPromptProcessed:!1});const t=e.taskList.length>0?e.taskList.length:e.prompts.length;if(!e.isProcessing||e.currentPromptIndex>=t){f.setState({isProcessing:!1}),Jt(),F.emit(p.OVERLAY_HIDE),e.currentPromptIndex>=t&&(chrome.runtime.sendMessage({action:"updateStatus",status:"All flow prompts completed successfully!"}),chrome.runtime.sendMessage({action:"resetPageZoom"}).catch(()=>{}),(r=f.clearStateFromStorage)==null||r.call(f),F.emit(p.PROCESSING_COMPLETE));return}const n=e.prompts[e.currentPromptIndex]||"",o=n.length>30?n.substring(0,30)+"...":n;F.emit(p.OVERLAY_SHOW,`Processing Flow: "${o}"`),e.currentPromptIndex===0&&chrome.runtime.sendMessage({action:"setPageZoom",zoomFactor:.75}).catch(()=>{}),chrome.storage.local.get("quotaStatus",i=>{var l,d,u;const a=i.quotaStatus||{canContinue:!0,isPaid:!1};if(a.isPaid){Et();return}if(!a.canContinue){f.setState({isProcessing:!1}),F.emit(p.OVERLAY_HIDE);const c=(l=f.getCurrentTask)==null?void 0:l.call(f);c&&((d=f.updateTask)==null||d.call(f,e.currentPromptIndex,{status:"error"}),(u=f.sendTaskUpdate)==null||u.call(f,c)),chrome.runtime.sendMessage({action:"error",error:"Your quota has been depleted. Please upgrade to continue."});return}Et()})}async function yo(){var u,c,s,m,w,E;const e=f.getState();if(!e.isCurrentPromptProcessed)return;(u=v==null?void 0:v.stopTileScanner)==null||u.call(v);const t=e.currentPromptIndex+1,n=e.taskList.length>0?e.taskList.length:e.prompts.length;if(f.setState({currentPromptIndex:t}),Jt(),(c=f.saveStateToStorage)==null||c.call(f),!f.getState().isProcessing){(s=v==null?void 0:v.stopTileScanner)==null||s.call(v),(m=v==null?void 0:v.stopErrorMonitoring)==null||m.call(v),f.setState({isPausing:!1}),F.emit(p.OVERLAY_HIDE),chrome.runtime.sendMessage({action:"updateStatus",status:"Processing paused. Click Resume to continue."});return}const r=((w=e.settings)==null?void 0:w.autoClearCache)??!1,i=((E=e.settings)==null?void 0:E.autoClearCacheInterval)??50;if(r&&t>0&&t%i===0&&t<n){console.log(`🗑️ Auto-clear cache milestone: task ${t}/${n} — sending clearFlowCache (fire-and-forget)`),F.emit(p.OVERLAY_MESSAGE,`🧹 Clearing Flow cache (milestone: task ${t}/${n})...`),chrome.runtime.sendMessage({action:"updateStatus",status:`Task ${t} complete — clearing Flow cache for performance...`}),chrome.runtime.sendMessage({action:"clearFlowCache"},I=>{chrome.runtime.lastError});return}if(t>=n){console.log("✅ All tasks done — skipping inter-task countdown"),Qe();return}const a=f.getState(),l=a.taskList.length>0&&a.currentPromptIndex<a.taskList.length?a.taskList[a.currentPromptIndex]:null,d=f.getRandomDelay?f.getRandomDelay(l,a.settings):bo;F.emit(p.COUNTDOWN_START,{ms:d,label:"next prompt"}),Ie=setTimeout(()=>{Ie=null,f.getState().isProcessing&&Qe()},d)}function Zt(){var t,n,o;const e=f.getState();if(e.currentRetries<it){f.setState({currentRetries:e.currentRetries+1});const i=`Retry ${f.getState().currentRetries}/${it}: Waiting for Flow Labs interface...`;F.emit(p.OVERLAY_MESSAGE,i),chrome.runtime.sendMessage({action:"updateStatus",status:i}),setTimeout(Qe,fo)}else{F.emit(p.OVERLAY_HIDE);const r=(t=f.getCurrentTask)==null?void 0:t.call(f);r&&((n=f.updateTask)==null||n.call(f,e.currentPromptIndex,{status:"error"}),(o=f.sendTaskUpdate)==null||o.call(f,r)),chrome.runtime.sendMessage({action:"error",error:"Unable to find Flow Labs interface elements after multiple attempts. Make sure you are on the correct page."}),f.setState({isProcessing:!1})}}function Jt(){const e=f.getState(),t=Math.min(e.currentPromptIndex,e.prompts.length);(e.isProcessing||e.isPausing)&&F.emit(p.PROGRESS_UPDATE,{currentIndex:t}),chrome.runtime.sendMessage({action:"updateProgress",currentPrompt:t<e.prompts.length?e.prompts[t]:"",processed:t,total:e.prompts.length})}function wo({task:e}){e!=null&&e.queueTaskId&&chrome.runtime.sendMessage({action:"taskStatusUpdate",taskId:e.queueTaskId,status:"current"}).catch(()=>{})}function en({task:e,taskIndex:t}){var o,r,i,a;const n=f.getState();n.isCurrentPromptProcessed||(console.log(`✅ Queue: Task ${e==null?void 0:e.index} completed — moving to next`),e!=null&&e.queueTaskId&&chrome.runtime.sendMessage({action:"taskStatusUpdate",taskId:e.queueTaskId,status:"processed"}).catch(()=>{}),F.emit(p.OVERLAY_MESSAGE,`✅ All outputs captured for Task ${e==null?void 0:e.index}`),chrome.runtime.sendMessage({action:"updateStatus",status:`All outputs captured for prompt: "${(r=(o=n.prompts)==null?void 0:o[n.currentPromptIndex])==null?void 0:r.substring(0,30)}..."`}),f.setState({isCurrentPromptProcessed:!0,currentProcessingPrompt:null}),(i=v==null?void 0:v.stopTileScanner)==null||i.call(v),(a=v==null?void 0:v.stopErrorMonitoring)==null||a.call(v),setTimeout(()=>{const l=f.getState();(l.isProcessing||l.isPausing)&&yo()},1e3))}function xo({task:e,taskIndex:t}){e!=null&&e.queueTaskId&&chrome.runtime.sendMessage({action:"taskStatusUpdate",taskId:e.queueTaskId,status:"processed"}).catch(()=>{}),en({task:e,taskIndex:t})}function Eo({task:e,taskIndex:t,reason:n}){console.warn(`⚠️ Queue: Task ${e==null?void 0:e.index} error — reason: ${n}`),f.getState().currentRetries>=it-1&&(e!=null&&e.queueTaskId)&&chrome.runtime.sendMessage({action:"taskStatusUpdate",taskId:e.queueTaskId,status:"error"}).catch(()=>{}),Zt()}function xt(){var e;Ie!==null&&(clearTimeout(Ie),Ie=null,console.log("⏹️ QueueController: inter-task delay cancelled")),(e=f.clearCountdownTimer)==null||e.call(f)}function Et(){var n;const e=f.getState(),t=(n=f.getCurrentTask)==null?void 0:n.call(f);if(!t){console.error("❌ QueueController: No task at current index"),Zt();return}gt(t,e.currentPromptIndex)}console.log("✅ QueueController module loaded");let ft=null,tn=null,nn=null,St=null;function So(e,t){ft=e.getState,nn=e.setState,tn=e.clearCountdownTimer,St=e,t.on(p.OVERLAY_SHOW,n=>To(n)),t.on(p.OVERLAY_HIDE,()=>on()),t.on(p.OVERLAY_MESSAGE,n=>Xe(n)),t.on(p.OVERLAY_PAUSING,()=>Io()),t.on(p.OVERLAY_ERROR_BANNER,n=>Co(n)),t.on(p.OVERLAY_ERROR_BANNER_CLEAR,()=>rn()),t.on(p.COUNTDOWN_START,({ms:n,label:o})=>{St.startCountdown(n,o)}),t.on(p.PROGRESS_UPDATE,({currentIndex:n})=>{Xe(void 0,n)}),console.log("✅ OverlayManager module initialized")}function vo(){if(document.getElementById("labs-flow-overlay-styles"))return;const e=document.createElement("style");e.id="labs-flow-overlay-styles",e.textContent=`
    @keyframes materialFadeIn {
      0% {
        opacity: 0;
        transform: scale(0.9) translateY(20px);
      }
      100% {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }

    @keyframes iconShimmer {
      0%   { transform: translateX(-100%); }
      100% { transform: translateX(200%); }
    }

    @keyframes progressPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.7; }
    }
  `,document.head.appendChild(e)}function ko(){if(document.getElementById("pausing-spinner-style"))return;const e=document.createElement("style");e.id="pausing-spinner-style",e.textContent=`
    @keyframes pausingSpinner {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .pausing-spinner {
      animation: pausingSpinner 1s linear infinite;
    }
  `,document.head.appendChild(e)}function To(e){if(document.getElementById("labs-flow-overlay")){Xe(e);return}vo();const t=ft(),n=document.createElement("div");n.id="labs-flow-overlay",n.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, rgba(186, 230, 253, 0.15), rgba(251, 191, 36, 0.07));
    backdrop-filter: blur(3px);
    z-index: 999999999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  `;const o=document.createElement("div");o.id="labs-flow-message",o.style.cssText=`
    background: linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85));
    backdrop-filter: blur(20px);
    padding: 32px;
    border-radius: 24px;
    max-width: 480px;
    min-width: 360px;
    text-align: center;
    box-shadow:
      0 24px 48px rgba(186, 230, 253, 0.25),
      0 8px 16px rgba(251, 191, 36, 0.10),
      inset 0 1px 0 rgba(255, 255, 255, 0.8);
    border: 1px solid rgba(186, 230, 253, 0.2);
    transform: scale(0.95);
    animation: materialFadeIn 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
  `;const r=document.createElement("div");r.style.cssText=`
    width: 80px;
    height: 80px;
    margin: 0 auto 24px auto;
    background: linear-gradient(135deg, #bae6fd, #38bdf8);
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(56, 189, 248, 0.35);
    position: relative;
    overflow: hidden;
  `;const i=document.createElement("div");i.innerHTML=`
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0
           01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0
           00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  `,r.appendChild(i);const a=document.createElement("div");a.style.cssText=`
    position: absolute;
    inset: 0;
    background: linear-gradient(45deg, transparent 30%, rgba(255, 255, 255, 0.2) 50%, transparent 70%);
    animation: iconShimmer 2s infinite;
  `,r.appendChild(a);const l=document.createElement("h2");l.textContent="Flow Image Automation",l.style.cssText=`
    font-size: 24px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: #1a1a1a;
    letter-spacing: -0.5px;
  `;const d=document.createElement("p");d.id="labs-flow-message-text",d.textContent=e||"Processing...",d.style.cssText=`
    font-size: 16px;
    margin: 0 0 20px 0;
    color: #5f6368;
    line-height: 1.5;
    font-weight: 400;
    white-space: pre-line;
  `;const u=document.createElement("div");u.id="labs-flow-progress",u.style.cssText=`
    background: rgba(241, 245, 249, 0.8);
    border-radius: 12px;
    padding: 16px;
    margin: 20px 0;
    border: 1px solid rgba(148, 163, 184, 0.35);
  `;const c=document.createElement("p");c.id="labs-flow-progress-text",c.textContent=`Image Prompt: ${t.currentPromptIndex+1}/${t.prompts.length}`,c.style.cssText=`
    font-size: 14px;
    margin: 0 0 12px 0;
    color: #0c4a6e;
    font-weight: 600;
  `;const s=document.createElement("div");s.style.cssText=`
    width: 100%;
    height: 6px;
    background: rgba(148, 163, 184, 0.3);
    border-radius: 3px;
    overflow: hidden;
    position: relative;
  `;const m=document.createElement("div");m.id="labs-flow-progress-fill",m.style.cssText=`
    height: 100%;
    background: linear-gradient(90deg, #38bdf8, #fbbf24);
    border-radius: 3px;
    width: 0%;
    animation: progressPulse 2s ease-in-out infinite;
    transition: width 0.3s ease;
  `,s.appendChild(m),u.appendChild(c),u.appendChild(s);const w=document.createElement("div");w.id="labs-flow-button-container",w.style.cssText=`
    display: flex;
    gap: 12px;
    margin-top: 24px;
    justify-content: center;
  `;const E=document.createElement("button");E.id="labs-flow-pause-button",E.textContent="Pause",E.style.cssText=`
    background: linear-gradient(135deg, #ea580c, #f97316);
    border: none;
    color: white;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
    box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);
    font-family: inherit;
    position: relative;
    overflow: hidden;
  `,E.addEventListener("mouseenter",()=>{E.style.transform="translateY(-2px)",E.style.boxShadow="0 6px 20px rgba(234, 88, 12, 0.35)"}),E.addEventListener("mouseleave",()=>{E.style.transform="translateY(0)",E.style.boxShadow="0 4px 12px rgba(234, 88, 12, 0.25)"}),E.addEventListener("click",()=>{chrome.runtime.sendMessage({action:"stopProcessingFromOverlay"})}),w.appendChild(E),o.appendChild(r),o.appendChild(l),o.appendChild(d),o.appendChild(u),o.appendChild(w),n.appendChild(o),document.body.appendChild(n);const I=(t.currentPromptIndex+1)/t.prompts.length*100;setTimeout(()=>{m.style.width=`${Math.min(I,100)}%`},100)}function Xe(e,t){const n=document.getElementById("labs-flow-message-text"),o=document.getElementById("labs-flow-progress-text"),r=document.getElementById("labs-flow-progress-fill");if(n&&e&&(n.innerText=e),t!==void 0){const a=ft().prompts.length||1,l=Math.min((t+1)/a*100,100);o&&(progressText.textContent=`Image Prompt: ${t+1}/${a}`),r&&(r.style.width=`${l}%`)}}function on(){tn();const e=document.getElementById("labs-flow-overlay");e&&document.body.removeChild(e)}function Io(){if(!document.getElementById("labs-flow-overlay"))return;Xe("Pausing after current task completes...");const t=document.getElementById("labs-flow-button-container");if(!t||document.getElementById("labs-flow-pausing-button"))return;const n=document.getElementById("labs-flow-pause-button");n&&n.remove(),ko();const o=document.createElement("button");o.id="labs-flow-pausing-button",o.style.cssText=`
    background: linear-gradient(135deg, #ea580c, #f97316);
    border: none;
    color: white;
    padding: 12px 24px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    box-shadow: 0 4px 12px rgba(234, 88, 12, 0.25);
    font-family: inherit;
    position: relative;
    overflow: hidden;
  `;const r=document.createElement("div");r.style.cssText=`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: opacity 0.2s;
  `,r.innerHTML=`
    <svg class="pausing-spinner" width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2.5">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9
           m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
    <span>Pausing...</span>
  `;const i=document.createElement("div");i.style.cssText=`
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    opacity: 0;
    transition: opacity 0.2s;
  `,i.innerHTML=`
    <svg class="terminate-icon" width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2.5"
         style="transition: transform 0.3s;">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
    <span>Terminate Now</span>
  `,o.appendChild(r),o.appendChild(i),o.addEventListener("mouseenter",()=>{o.style.background="linear-gradient(135deg, #b91c1c, #dc2626)",o.style.transform="translateY(-2px)",o.style.boxShadow="0 6px 20px rgba(220, 38, 38, 0.35)",r.style.opacity="0",i.style.opacity="1";const a=i.querySelector(".terminate-icon");a&&(a.style.transform="rotate(90deg)")}),o.addEventListener("mouseleave",()=>{o.style.background="linear-gradient(135deg, #ea580c, #f97316)",o.style.transform="translateY(0)",o.style.boxShadow="0 4px 12px rgba(234, 88, 12, 0.25)",r.style.opacity="1",i.style.opacity="0";const a=i.querySelector(".terminate-icon");a&&(a.style.transform="rotate(0deg)")}),o.addEventListener("click",()=>{chrome.runtime.sendMessage({action:"terminateProcessingFromOverlay"}),nn({isPausing:!1,isProcessing:!1}),on()}),t.appendChild(o)}function Po(){if(document.getElementById("labs-flow-banner-styles"))return;const e=document.createElement("style");e.id="labs-flow-banner-styles",e.textContent=`
    @keyframes bannerSlideIn {
      0%   { opacity: 0; transform: translateY(-8px) scale(0.98); }
      100% { opacity: 1; transform: translateY(0)    scale(1);    }
    }
  `,document.head.appendChild(e)}function Co({lines:e=[],taskIndex:t="?"}={}){const n=document.getElementById("labs-flow-message");if(!n)return;Po(),rn();const o=document.createElement("div");o.id="labs-flow-error-banner",o.style.cssText=`
    background: linear-gradient(145deg, rgba(255, 237, 213, 0.92), rgba(254, 215, 170, 0.80));
    backdrop-filter: blur(12px);
    border: 1px solid rgba(234, 88, 12, 0.20);
    border-radius: 16px;
    padding: 14px 16px 12px 16px;
    margin: 4px 0 16px 0;
    text-align: left;
    box-shadow:
      0 4px 12px rgba(234, 88, 12, 0.10),
      0 1px 3px  rgba(234, 88, 12, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.60);
    animation: bannerSlideIn 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
    font-family: 'Google Sans', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  `;const r=document.createElement("div");r.style.cssText=`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  `;const i=document.createElement("div");i.style.cssText=`
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: linear-gradient(135deg, #ea580c, #f97316);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(234, 88, 12, 0.30);
  `,i.innerHTML=`
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  `;const a=document.createElement("div"),l=document.createElement("div");l.style.cssText=`
    font-size: 13px;
    font-weight: 600;
    color: #9a3412;
    letter-spacing: -0.1px;
    line-height: 1.3;
  `,l.textContent="Some generations couldn't complete";const d=document.createElement("div");if(d.style.cssText=`
    font-size: 11px;
    font-weight: 400;
    color: #c2410c;
    margin-top: 1px;
    line-height: 1.3;
  `,d.textContent=`Task ${t} • Skipping failed items automatically`,a.appendChild(l),a.appendChild(d),r.appendChild(i),r.appendChild(a),o.appendChild(r),e.length>0){const s=document.createElement("div");s.style.cssText=`
      display: flex;
      flex-direction: column;
      gap: 5px;
    `;for(const m of e){const w=document.createElement("div");w.style.cssText=`
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.50);
        border: 1px solid rgba(234, 88, 12, 0.15);
        border-radius: 8px;
        padding: 5px 10px;
        font-size: 12px;
        color: #7c2d12;
        font-weight: 500;
        line-height: 1.4;
      `;const E=document.createElement("span");E.style.cssText=`
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ea580c;
        flex-shrink: 0;
      `,w.appendChild(E);const I=document.createElement("span");I.textContent=m,w.appendChild(I),s.appendChild(w)}o.appendChild(s)}const u=document.createElement("div");u.style.cssText=`
    font-size: 11px;
    color: #c2410c;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(234, 88, 12, 0.12);
    line-height: 1.4;
  `,u.textContent="Your other prompts will continue processing normally.",o.appendChild(u);const c=document.getElementById("labs-flow-progress");c?n.insertBefore(o,c):n.appendChild(o)}function rn(){const e=document.getElementById("labs-flow-error-banner");e&&e.remove()}console.log("✅ OverlayManager module loaded");let ne=!1,j=new Set,fe=null,We=null,an="1K",sn="720p",ce=!1,N=!1,ie=!1,Se=[],be=null;const Re="cdm-control-panel",at="cdm-styles",he="cdm-tile-overlay",se=e=>new Promise(t=>setTimeout(t,e));function Ao(e){const t=!!e.querySelector('video[src*="media.getMediaUrlRedirect"]'),n=!!e.querySelector('img[src*="media.getMediaUrlRedirect"]');return t||n}function ln(e){return!!e.querySelector("video")}function de(){const e=[],t=new Set;return document.querySelectorAll("[data-tile-id]").forEach(n=>{const o=n.getAttribute("data-tile-id");!o||t.has(o)||(t.add(o),Ao(n)&&e.push({tileId:o,tileEl:n,isVideo:ln(n)}))}),e}function Mo(){if(document.getElementById(at))return;const e=document.createElement("style");e.id=at,e.textContent=`
    /* ── Tile checkbox overlay ──────────────────── */
    /* isolation: isolate on the tile itself creates a self-contained stacking
       context — all z-index values inside the tile are scoped within it, so
       the selection ring never paints over sibling page elements (e.g. textarea) */
    [data-tile-id].cdm-isolated {
      isolation: isolate;
    }
    .cdm-tile-overlay {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 9999;
      pointer-events: none;
    }
    .cdm-tile-overlay.cdm-active {
      pointer-events: all;
      cursor: pointer;
    }
    .cdm-checkbox-wrap {
      position: absolute;
      top: 8px; left: 8px;
      width: 22px; height: 22px;
      z-index: 10001;
      display: flex; align-items: center; justify-content: center;
    }
    .cdm-checkbox {
      width: 18px; height: 18px;
      border-radius: 5px;
      border: 2px solid rgba(255,255,255,0.85);
      background: rgba(15,23,42,0.55);
      backdrop-filter: blur(4px);
      appearance: none; -webkit-appearance: none;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
      flex-shrink: 0;
    }
    .cdm-checkbox:checked {
      background: #6366f1;
      border-color: #6366f1;
    }
    .cdm-checkbox:checked::after {
      content: '';
      display: block;
      margin: 2px auto 0 auto;
      width: 5px; height: 9px;
      border-right: 2px solid white;
      border-bottom: 2px solid white;
      transform: rotate(45deg);
    }
    .cdm-checkbox:hover { transform: scale(1.1); border-color: #a5b4fc; }
    .cdm-tile-selected-ring {
      position: absolute;
      inset: 0;
      border: 3px solid #6366f1;
      border-radius: 8px;
      pointer-events: none;
      box-shadow: inset 0 0 0 1px #a5b4fc;
    }
    .cdm-tile-badge {
      position: absolute;
      top: 8px; right: 8px;
      background: rgba(15,23,42,0.70);
      backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.15);
      border-radius: 6px;
      padding: 2px 6px;
      font-size: 10px;
      font-weight: 600;
      color: #e2e8f0;
      font-family: 'Google Sans', sans-serif;
      pointer-events: none;
      letter-spacing: 0.3px;
    }

    /* ── Control panel ──────────────────────────── */
    @keyframes cdmPanelIn {
      0%   { opacity:0; transform: translateY(16px) scale(0.97); }
      100% { opacity:1; transform: translateY(0)    scale(1); }
    }
    #cdm-control-panel {
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      border-radius: 20px;
      padding: 14px 18px;
      min-width: 360px;
      max-width: 92vw;
      min-height: 120px;
      width: 580px;
      box-sizing: border-box;
      resize: none;
      overflow: hidden;
      font-family: 'Google Sans', 'Roboto', -apple-system, sans-serif;
      animation: cdmPanelIn 0.3s cubic-bezier(0.25,0.8,0.25,1) forwards;
      display: flex;
      flex-direction: column;
      gap: 10px;
      user-select: none;
      transition: background 0.25s, border-color 0.25s, box-shadow 0.25s, color 0.25s;
    }

    /* ── DARK theme (default) ───────────────────── */
    #cdm-control-panel.cdm-dark {
      background: linear-gradient(145deg, rgba(15,23,42,0.97), rgba(30,41,59,0.95));
      backdrop-filter: blur(24px);
      border: 1px solid rgba(99,102,241,0.35);
      color: #e2e8f0;
      box-shadow:
        0 24px 60px rgba(0,0,0,0.55),
        0 8px 20px rgba(99,102,241,0.18),
        inset 0 1px 0 rgba(255,255,255,0.07);
    }
    #cdm-control-panel.cdm-dark .cdm-panel-title { color: #e2e8f0; }
    #cdm-control-panel.cdm-dark .cdm-stats       { color: #94a3b8; }
    #cdm-control-panel.cdm-dark .cdm-stat-chip   {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.09);
      color: #cbd5e1;
    }
    #cdm-control-panel.cdm-dark .cdm-stat-chip.cdm-selected {
      background: rgba(99,102,241,0.18);
      border-color: rgba(99,102,241,0.35);
      color: #a5b4fc;
    }
    #cdm-control-panel.cdm-dark .cdm-btn-secondary {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: #cbd5e1;
    }
    #cdm-control-panel.cdm-dark .cdm-btn-secondary:hover {
      background: rgba(255,255,255,0.12);
      border-color: rgba(255,255,255,0.22);
      color: #e2e8f0;
    }
    #cdm-control-panel.cdm-dark .cdm-quality-label { color: #64748b; }
    #cdm-control-panel.cdm-dark .cdm-quality-select {
      background-color: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      color: #e2e8f0;
    }
    #cdm-control-panel.cdm-dark .cdm-quality-select:hover { border-color: rgba(99,102,241,0.5); }
    #cdm-control-panel.cdm-dark #cdm-progress-bar-track { background: rgba(255,255,255,0.08); }
    #cdm-control-panel.cdm-dark #cdm-progress-label     { color: #94a3b8; }

    /* ── LIGHT theme ──────────────────────────────── */
    #cdm-control-panel.cdm-light {
      background: linear-gradient(145deg, rgba(239,246,255,0.97), rgba(219,234,254,0.95));
      backdrop-filter: blur(24px);
      border: 1px solid rgba(99,102,241,0.25);
      color: #1e3a5f;
      box-shadow:
        0 24px 60px rgba(59,130,246,0.12),
        0 8px 20px rgba(99,102,241,0.10),
        inset 0 1px 0 rgba(255,255,255,0.80);
    }
    #cdm-control-panel.cdm-light .cdm-panel-title { color: #1e3a5f; }
    #cdm-control-panel.cdm-light .cdm-panel-title-icon {
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
    }
    #cdm-control-panel.cdm-light .cdm-stats       { color: #475569; }
    #cdm-control-panel.cdm-light .cdm-stat-chip   {
      background: rgba(99,102,241,0.08);
      border: 1px solid rgba(99,102,241,0.18);
      color: #334155;
    }
    #cdm-control-panel.cdm-light .cdm-stat-chip.cdm-selected {
      background: rgba(99,102,241,0.15);
      border-color: rgba(99,102,241,0.35);
      color: #4338ca;
    }
    #cdm-control-panel.cdm-light .cdm-btn-secondary {
      background: rgba(255,255,255,0.70);
      border: 1px solid rgba(99,102,241,0.20);
      color: #334155;
    }
    #cdm-control-panel.cdm-light .cdm-btn-secondary:hover {
      background: rgba(255,255,255,0.90);
      border-color: rgba(99,102,241,0.40);
      color: #1e293b;
    }
    #cdm-control-panel.cdm-light .cdm-quality-label { color: #64748b; }
    #cdm-control-panel.cdm-light .cdm-quality-select {
      background-color: rgba(255,255,255,0.75);
      border: 1px solid rgba(99,102,241,0.20);
      color: #1e293b;
    }
    #cdm-control-panel.cdm-light .cdm-quality-select:hover { border-color: rgba(99,102,241,0.45); }
    #cdm-control-panel.cdm-light #cdm-progress-bar-track { background: rgba(99,102,241,0.12); }
    #cdm-control-panel.cdm-light #cdm-progress-label     { color: #475569; }
    #cdm-control-panel.cdm-light #cdm-close-btn {
      background: rgba(239,68,68,0.10);
      border: 1px solid rgba(239,68,68,0.22);
      color: #dc2626;
    }
    #cdm-control-panel.cdm-light #cdm-close-btn:hover {
      background: rgba(239,68,68,0.20);
      color: #b91c1c;
    }
    /* Drag cursor anywhere on the panel except interactive elements */
    #cdm-control-panel {
      cursor: grab;
    }
    #cdm-control-panel button,
    #cdm-control-panel select,
    #cdm-control-panel input,
    #cdm-control-panel label,
    #cdm-control-panel a,
    #cdm-resize-handle {
      cursor: auto;
    }
    #cdm-control-panel button { cursor: pointer; }
    #cdm-control-panel select { cursor: pointer; }
    #cdm-control-panel input[type="checkbox"] { cursor: pointer; }
    /* Resize handle — bottom-right corner */
    #cdm-resize-handle {
      position: absolute;
      bottom: 0; right: 0;
      width: 32px; height: 32px;
      cursor: nwse-resize;
      z-index: 10;
      display: flex; align-items: flex-end; justify-content: flex-end;
      padding: 6px;
      border-bottom-right-radius: 20px;
      background: linear-gradient(135deg, transparent 40%, rgba(99,102,241,0.18) 100%);
      transition: background 0.2s;
    }
    #cdm-resize-handle::before {
      content: '';
      position: absolute;
      bottom: 0; right: 0;
      width: 0; height: 0;
      border-style: solid;
      border-width: 0 0 12px 12px;
      border-color: transparent transparent rgba(99,102,241,0.5) transparent;
      border-bottom-right-radius: 20px;
      pointer-events: none;
      transition: border-color 0.2s;
    }
    #cdm-resize-handle svg {
      opacity: 0.55;
      transition: opacity 0.15s, transform 0.15s;
      filter: drop-shadow(0 0 3px rgba(99,102,241,0.6));
    }
    #cdm-resize-handle:hover {
      background: linear-gradient(135deg, transparent 30%, rgba(99,102,241,0.32) 100%);
    }
    #cdm-resize-handle:hover::before {
      border-color: transparent transparent rgba(139,92,246,0.85) transparent;
    }
    #cdm-resize-handle:hover svg {
      opacity: 1;
      transform: scale(1.2);
    }
    /* During drag/resize — disable pointer events inside the page */
    body.cdm-dragging * { pointer-events: none !important; }
    body.cdm-dragging #cdm-control-panel { pointer-events: all !important; cursor: grabbing !important; }
    body.cdm-resizing { cursor: nwse-resize !important; }
    body.cdm-resizing * { pointer-events: none !important; }
    body.cdm-resizing #cdm-control-panel { pointer-events: all !important; }

    /* ── Panel top row ─────────────────────────── */
    #cdm-control-panel .cdm-panel-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-shrink: 0;
    }
    #cdm-control-panel .cdm-panel-title {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; font-weight: 700;
      color: #e2e8f0; letter-spacing: -0.2px;
    }
    #cdm-control-panel .cdm-panel-title-icon {
      width: 26px; height: 26px; border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(99,102,241,0.4);
    }
    #cdm-close-btn {
      width: 26px; height: 26px; border-radius: 8px;
      background: rgba(248,113,113,0.15);
      border: 1px solid rgba(248,113,113,0.25);
      color: #fca5a5; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; line-height: 1;
      transition: background 0.15s, color 0.15s, border-color 0.15s; flex-shrink: 0;
    }
    #cdm-close-btn:hover { background: rgba(248,113,113,0.30); color: #fecaca; }

    /* ── Stats row ─────────────────────────────── */
    #cdm-control-panel .cdm-stats {
      display: flex; align-items: center; gap: 8px;
      font-size: 11px;
      flex-wrap: wrap;
    }
    #cdm-control-panel .cdm-stat-chip {
      border-radius: 6px; padding: 2px 8px;
      font-size: 11px; font-weight: 600;
    }

    /* ── Controls row ──────────────────────────── */
    #cdm-control-panel .cdm-controls {
      display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
    }
    /* Select / Deselect all button */
    .cdm-btn-secondary {
      border-radius: 10px; padding: 6px 12px;
      font-size: 11px; font-weight: 600;
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
      font-family: inherit;
    }

    /* Quality selects */
    .cdm-quality-group {
      display: flex; align-items: center; gap: 6px;
    }
    .cdm-quality-label {
      font-size: 10px; font-weight: 600;
      letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap;
    }
    .cdm-quality-select {
      appearance: none; -webkit-appearance: none;
      border-radius: 8px; padding: 5px 26px 5px 10px;
      font-size: 11px; font-weight: 600;
      cursor: pointer; font-family: inherit;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 8px center;
      transition: border-color 0.15s;
    }
    .cdm-quality-select option { background: #1e293b; color: #e2e8f0; }

    /* Download button */
    #cdm-download-btn {
      margin-left: auto;
      display: flex; align-items: center; gap: 6px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none; border-radius: 10px;
      padding: 7px 16px;
      font-size: 12px; font-weight: 700; color: white;
      cursor: pointer; font-family: inherit;
      box-shadow: 0 4px 12px rgba(99,102,241,0.35);
      transition: all 0.2s; white-space: nowrap;
    }
    #cdm-download-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(99,102,241,0.45);
    }
    #cdm-download-btn:active:not(:disabled) { transform: scale(0.97); }
    #cdm-download-btn:disabled {
      opacity: 0.5; cursor: not-allowed; transform: none;
    }

    /* ── Progress bar ──────────────────────────── */
    #cdm-progress-wrap {
      display: none;
      flex-direction: column; gap: 6px;
    }
    #cdm-progress-wrap.cdm-visible { display: flex; }
    #cdm-progress-label {
      font-size: 11px; color: #94a3b8; font-weight: 500;
    }
    #cdm-progress-bar-track {
      width: 100%; height: 4px;
      background: rgba(255,255,255,0.08);
      border-radius: 2px; overflow: hidden;
    }
    #cdm-progress-bar-fill {
      height: 100%; width: 0%;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      border-radius: 2px;
      transition: width 0.3s ease;
    }
    /* Pause / Stop controls row — visible only during download */
    #cdm-download-controls {
      display: none;
      align-items: center; gap: 8px;
    }
    #cdm-download-controls.cdm-visible { display: flex; }
    /* Pause button — amber */
    #cdm-pause-btn {
      display: flex; align-items: center; gap: 5px;
      background: rgba(245,158,11,0.15);
      border: 1px solid rgba(245,158,11,0.35);
      color: #fbbf24;
      border-radius: 10px; padding: 5px 12px;
      font-size: 11px; font-weight: 700;
      cursor: pointer; font-family: inherit;
      transition: all 0.15s; white-space: nowrap;
    }
    #cdm-pause-btn:hover {
      background: rgba(245,158,11,0.28);
      border-color: rgba(245,158,11,0.55);
      color: #fde68a;
    }
    #cdm-pause-btn.cdm-paused {
      background: rgba(99,102,241,0.18);
      border-color: rgba(99,102,241,0.40);
      color: #a5b4fc;
    }
    #cdm-pause-btn.cdm-paused:hover {
      background: rgba(99,102,241,0.30);
      color: #c7d2fe;
    }
    /* Stop button — red */
    #cdm-stop-btn {
      display: flex; align-items: center; gap: 5px;
      background: rgba(239,68,68,0.12);
      border: 1px solid rgba(239,68,68,0.30);
      color: #f87171;
      border-radius: 10px; padding: 5px 12px;
      font-size: 11px; font-weight: 700;
      cursor: pointer; font-family: inherit;
      transition: all 0.15s; white-space: nowrap;
    }
    #cdm-stop-btn:hover {
      background: rgba(239,68,68,0.25);
      border-color: rgba(239,68,68,0.55);
      color: #fca5a5;
    }
    /* Paused status label */
    #cdm-paused-badge {
      display: none;
      font-size: 10px; font-weight: 700;
      color: #fbbf24;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      animation: cdmPausedPulse 1.2s ease-in-out infinite;
    }
    #cdm-paused-badge.cdm-visible { display: inline; }
    @keyframes cdmPausedPulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }

    /* ── Custom scrollbar (shown when panel is resized smaller) ─── */
    #cdm-control-panel::-webkit-scrollbar {
      width: 5px;
      height: 5px;
    }
    #cdm-control-panel::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.04);
      border-radius: 10px;
    }
    #cdm-control-panel::-webkit-scrollbar-thumb {
      background: rgba(99,102,241,0.45);
      border-radius: 10px;
      transition: background 0.2s;
    }
    #cdm-control-panel::-webkit-scrollbar-thumb:hover {
      background: rgba(99,102,241,0.75);
    }
    #cdm-control-panel::-webkit-scrollbar-corner {
      background: transparent;
    }
    /* Firefox */
    #cdm-control-panel {
      scrollbar-width: thin;
      scrollbar-color: rgba(99,102,241,0.45) rgba(255,255,255,0.04);
    }

    /* ── Spinner for download btn ──────────────── */
    @keyframes cdmSpin {
      from { transform: rotate(0deg); }
      to   { transform: rotate(360deg); }
    }
    .cdm-spinner {
      width: 12px; height: 12px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: cdmSpin 0.7s linear infinite;
      flex-shrink: 0;
    }
  `,document.head.appendChild(e)}function Lo(){if(document.getElementById(Re))return;const e=document.createElement("div");e.id=Re,e.innerHTML=`
    <!-- Top row: title + close -->
    <div class="cdm-panel-top">
      <div class="cdm-panel-title">
        <div class="cdm-panel-title-icon">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
        </div>
        <span>Content Download Manager</span>
      </div>
      <button id="cdm-close-btn" title="Close">✕</button>
    </div>

    <!-- Stats row -->
    <div class="cdm-stats" id="cdm-stats">
      <span class="cdm-stat-chip" id="cdm-total-chip">0 tiles</span>
      <span class="cdm-stat-chip cdm-selected" id="cdm-selected-chip">0 selected</span>
    </div>

    <!-- Controls row -->
    <div class="cdm-controls">
      <button class="cdm-btn-secondary" id="cdm-select-all-btn">Select All</button>
      <button class="cdm-btn-secondary" id="cdm-deselect-all-btn">Deselect All</button>
      <button class="cdm-btn-secondary" id="cdm-select-images-btn">Images Only</button>
      <button class="cdm-btn-secondary" id="cdm-select-videos-btn">Videos Only</button>

      <div class="cdm-quality-group">
        <span class="cdm-quality-label">🖼</span>
        <select class="cdm-quality-select" id="cdm-image-quality">
          <option value="1K">1K — Original</option>
          <option value="2K">2K — Upscaled</option>
          <option value="4K">4K — Upscaled</option>
        </select>
      </div>

      <div class="cdm-quality-group">
        <span class="cdm-quality-label">🎬</span>
        <select class="cdm-quality-select" id="cdm-video-quality">
          <option value="270p">270p — GIF</option>
          <option value="720p" selected>720p — Original</option>
          <option value="1080p">1080p — Upscaled</option>
          <option value="4K">4K — Upscaled</option>
        </select>
      </div>

      <button id="cdm-download-btn" disabled>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        <span id="cdm-download-label">Download (0)</span>
      </button>
    </div>

    <!-- Progress bar (hidden until download starts) -->
    <div id="cdm-progress-wrap">
      <div style="display:flex;align-items:center;gap:8px;">
        <span id="cdm-progress-label" style="flex:1;">Downloading 0 / 0…</span>
        <span id="cdm-paused-badge">⏸ Paused</span>
      </div>
      <div id="cdm-progress-bar-track"><div id="cdm-progress-bar-fill"></div></div>
      <!-- Pause / Stop controls — shown during active download -->
      <div id="cdm-download-controls">
        <button id="cdm-pause-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          <span id="cdm-pause-label">Pause</span>
        </button>
        <button id="cdm-stop-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          <span>Stop</span>
        </button>
      </div>
    </div>

    <!-- Resize handle — bottom-right corner -->
    <div id="cdm-resize-handle" title="Drag to resize">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round">
        <line x1="13" y1="1" x2="1"  y2="13"/>
        <line x1="13" y1="6" x2="6"  y2="13"/>
        <line x1="13" y1="10" x2="10" y2="13"/>
      </svg>
    </div>
  `,document.body.appendChild(e),Ro(),Oo(e),Do(e)}function Ro(){var e,t,n,o,r,i,a,l,d,u;(e=document.getElementById("cdm-close-btn"))==null||e.addEventListener("click",bt),(t=document.getElementById("cdm-select-all-btn"))==null||t.addEventListener("click",()=>{de().forEach(({tileId:c,tileEl:s})=>{Ne(c,s)}),te()}),(n=document.getElementById("cdm-deselect-all-btn"))==null||n.addEventListener("click",()=>{[...j].forEach(c=>{const s=document.querySelector(`[data-tile-id="${c}"]`);s&&je(c,s)}),j.clear(),te()}),(o=document.getElementById("cdm-select-images-btn"))==null||o.addEventListener("click",()=>{de().forEach(({tileId:c,tileEl:s,isVideo:m})=>{m?je(c,s):Ne(c,s)}),te()}),(r=document.getElementById("cdm-select-videos-btn"))==null||r.addEventListener("click",()=>{de().forEach(({tileId:c,tileEl:s,isVideo:m})=>{m?Ne(c,s):je(c,s)}),te()}),(i=document.getElementById("cdm-image-quality"))==null||i.addEventListener("change",c=>{an=c.target.value}),(a=document.getElementById("cdm-video-quality"))==null||a.addEventListener("change",c=>{sn=c.target.value}),(l=document.getElementById("cdm-download-btn"))==null||l.addEventListener("click",jo),(d=document.getElementById("cdm-pause-btn"))==null||d.addEventListener("click",dn),(u=document.getElementById("cdm-stop-btn"))==null||u.addEventListener("click",No)}const _o=["button","select","input","textarea","label","a","#cdm-resize-handle","[data-no-drag]"].join(", ");function Oo(e){let t,n,o,r;function i(l){const d=l.clientX-t,u=l.clientY-n;let c=o+d,s=r+u;c=Math.max(0,Math.min(window.innerWidth-e.offsetWidth,c)),s=Math.max(0,Math.min(window.innerHeight-e.offsetHeight,s)),e.style.left=c+"px",e.style.top=s+"px",e.style.bottom="auto",e.style.transform="none"}function a(){e.style.cursor="grab",document.body.classList.remove("cdm-dragging"),document.removeEventListener("mousemove",i),document.removeEventListener("mouseup",a)}e.addEventListener("mousedown",l=>{if(l.target.closest(_o))return;l.preventDefault();const d=e.getBoundingClientRect();o=d.left,r=d.top,t=l.clientX,n=l.clientY,e.style.left=o+"px",e.style.top=r+"px",e.style.bottom="auto",e.style.transform="none",e.style.cursor="grabbing",document.body.classList.add("cdm-dragging"),document.addEventListener("mousemove",i),document.addEventListener("mouseup",a)})}function Do(e){const t=e.querySelector("#cdm-resize-handle");if(!t)return;const n=360,o=120;let r,i,a,l,d,u;function c(m){const w=m.clientX-r,E=m.clientY-i,I=Math.max(n,Math.min(window.innerWidth-d,a+w)),Q=Math.max(o,Math.min(window.innerHeight-u,l+E));e.style.width=I+"px",e.style.height=Q+"px"}function s(){document.body.classList.remove("cdm-resizing"),document.removeEventListener("mousemove",c),document.removeEventListener("mouseup",s)}t.addEventListener("mousedown",m=>{m.preventDefault(),m.stopPropagation();const w=e.getBoundingClientRect();r=m.clientX,i=m.clientY,a=w.width,l=w.height,d=w.left,u=w.top,e.style.left=w.left+"px",e.style.top=w.top+"px",e.style.bottom="auto",e.style.transform="none",e.style.width=w.width+"px",e.style.height=w.height+"px",e.style.overflow="auto",document.body.classList.add("cdm-resizing"),document.addEventListener("mousemove",c),document.addEventListener("mouseup",s)})}function te(){const t=de().length,n=j.size,o=document.getElementById("cdm-total-chip"),r=document.getElementById("cdm-selected-chip"),i=document.getElementById("cdm-download-btn"),a=document.getElementById("cdm-download-label");o&&(o.textContent=`${t} tile${t!==1?"s":""}`),r&&(r.textContent=`${n} selected`),i&&(i.disabled=n===0||ce),a&&(a.textContent=ce?"Downloading…":`Download (${n})`)}function cn(e,t){const n=t.querySelector("."+he);if(n)return n;window.getComputedStyle(t).position==="static"&&(t.style.position="relative"),t.style.isolation="isolate",t.classList.add("cdm-isolated");const r=document.createElement("div");r.className=he+" cdm-active",r.setAttribute("data-cdm-tile",e);const i=document.createElement("div");i.className="cdm-checkbox-wrap";const a=document.createElement("input");a.type="checkbox",a.className="cdm-checkbox",a.setAttribute("data-tile-cb",e),a.checked=j.has(e),a.addEventListener("change",u=>{u.stopPropagation(),a.checked?Ne(e,t):je(e,t),te()}),r.addEventListener("click",u=>{u.target!==a&&(a.checked=!a.checked,a.dispatchEvent(new Event("change")))}),i.appendChild(a),r.appendChild(i);const l=ln(t),d=document.createElement("div");return d.className="cdm-tile-badge",d.textContent=l?"🎬 VIDEO":"🖼 IMAGE",r.appendChild(d),t.appendChild(r),r}function Ne(e,t){j.add(e);const n=t.querySelector(`[data-tile-cb="${e}"]`);n&&(n.checked=!0);let o=t.querySelector(".cdm-tile-selected-ring");if(!o){o=document.createElement("div"),o.className="cdm-tile-selected-ring";const r=t.querySelector("."+he);r&&r.appendChild(o)}}function je(e,t){j.delete(e);const n=t.querySelector(`[data-tile-cb="${e}"]`);n&&(n.checked=!1);const o=t.querySelector(".cdm-tile-selected-ring");o&&o.remove()}function Uo(){de().forEach(({tileId:e,tileEl:t})=>{cn(e,t)}),te()}function $o(){document.querySelectorAll("."+he).forEach(e=>e.remove()),document.querySelectorAll("[data-cdm-tile-pos]").forEach(e=>{e.style.position="",e.removeAttribute("data-cdm-tile-pos")})}function Vo(){return document.querySelector("[data-virtuoso-scroller]")||document.querySelector('[class*="tileGrid"], [class*="tile-grid"], [class*="TileGrid"]')||document.querySelector("main")||document.body}function qo(){var t;if(fe)return;fe=new MutationObserver(n=>{!ne||!n.some(r=>[...r.addedNodes].some(i=>{var a;return!(i.nodeType!==Node.ELEMENT_NODE||(a=i.classList)!=null&&a.contains(he)||i.id===Re||i.id===at)}))||(clearTimeout(We),We=setTimeout(()=>{ne&&(de().forEach(({tileId:r,tileEl:i})=>{i.querySelector("."+he)||cn(r,i)}),te())},200))});const e=Vo();fe.observe(e,{childList:!0,subtree:!0}),console.log("[CDM] Observer attached to",e.tagName,((t=e.className)==null?void 0:t.slice(0,60))||"")}function zo(){clearTimeout(We),We=null,fe&&(fe.disconnect(),fe=null)}function Fo(e,t){const n=[...e.querySelectorAll('button[role="menuitem"], button')];if(n.length===0)return null;const o=n.map(i=>{var u;const l=((u=i.querySelectorAll("span")[0])==null?void 0:u.textContent.trim())||i.textContent.trim(),d=i.getAttribute("aria-disabled")!=="true";return{btn:i,label:l,enabled:d}}),r=o.filter(i=>i.enabled);if(t){const i=o.find(a=>a.label===t);if(i&&i.enabled)return i.btn}return r.length>0?r[r.length-1].btn:n[0]||null}async function Yo(e,t){try{const n=e.querySelector('video[src*="media.getMediaUrlRedirect"]')||e.querySelector('img[src*="media.getMediaUrlRedirect"]');if(!n)return console.warn("[CDM] No media element in tile"),!1;const o=n.getBoundingClientRect(),r=o.left+o.width/2,i=o.top+o.height/2;n.dispatchEvent(new MouseEvent("mouseenter",{bubbles:!0,clientX:r,clientY:i})),n.dispatchEvent(new MouseEvent("mousemove",{bubbles:!0,clientX:r,clientY:i})),await se(400),n.dispatchEvent(new MouseEvent("contextmenu",{bubbles:!0,cancelable:!0,clientX:r,clientY:i,button:2})),await se(600);const a=document.querySelector('[data-radix-menu-content][data-state="open"]');if(!a)return console.warn("[CDM] Context menu did not open"),!1;const l=[...a.querySelectorAll('[role="menuitem"]')].find(s=>{var m;return((m=s.querySelector("i"))==null?void 0:m.textContent.trim())==="download"});if(!l)return console.warn("[CDM] Download menuitem not found"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;l.click(),await se(600);const d=[...document.querySelectorAll('[data-radix-menu-content][data-state="open"]')],u=d.find(s=>s!==a)||d[d.length-1];if(!u||u===a)return console.warn("[CDM] Quality sub-menu did not open"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1;const c=Fo(u,t);return c?(c.click(),await se(300),!0):(console.warn("[CDM] No quality button in sub-menu"),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1)}catch(n){return console.error("[CDM] downloadTileViaUI error:",n),document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:!0})),!1}}function dn(){N=!N;const e=document.getElementById("cdm-pause-btn"),t=document.getElementById("cdm-pause-label"),n=document.getElementById("cdm-paused-badge");e&&e.classList.toggle("cdm-paused",N),t&&(t.textContent=N?"Resume":"Pause");const o=e==null?void 0:e.querySelector("svg");o&&(o.innerHTML=N?'<polygon points="5,3 19,12 5,21" fill="currentColor"/>':'<rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>'),n&&n.classList.toggle("cdm-visible",N);const r=document.getElementById("cdm-progress-label");r&&N?r.style.opacity="0.5":r&&(r.style.opacity="")}function No(){ce&&(ie=!0,N&&dn())}async function jo(){if(ce||j.size===0)return;ce=!0,N=!1,ie=!1,Se=de().filter(m=>j.has(m.tileId)).map(m=>({tileId:m.tileId,tileEl:m.tileEl,isVideo:m.isVideo,quality:m.isVideo?sn:an}));const t=Se.length;let n=0;const o=document.getElementById("cdm-progress-wrap"),r=document.getElementById("cdm-progress-label"),i=document.getElementById("cdm-progress-bar-fill"),a=document.getElementById("cdm-download-btn"),l=document.getElementById("cdm-download-controls"),d=document.getElementById("cdm-pause-btn"),u=document.getElementById("cdm-pause-label");o&&o.classList.add("cdm-visible"),r&&(r.textContent=`Downloading 0 / ${t}…`),i&&(i.style.width="0%"),l&&l.classList.add("cdm-visible"),d&&d.classList.remove("cdm-paused"),u&&(u.textContent="Pause"),a&&(a.disabled=!0,a.innerHTML=`
      <div class="cdm-spinner"></div>
      <span>Downloading…</span>
    `);for(const m of Se){if(ie){console.log("[CDM] Download stopped by user");break}for(;N&&!ie;)await se(150);if(ie){console.log("[CDM] Download stopped while paused");break}console.log(`[CDM] Downloading tile ${m.tileId} (quality: ${m.quality})`),m.tileEl.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"}),await se(350),await Yo(m.tileEl,m.quality),n++,r&&(r.textContent=`Downloading ${n} / ${t}…`),i&&(i.style.width=`${Math.round(n/t*100)}%`),await se(400)}const c=ie;ce=!1,N=!1,ie=!1,Se=[],l&&l.classList.remove("cdm-visible"),d&&d.classList.remove("cdm-paused"),u&&(u.textContent="Pause");const s=document.getElementById("cdm-paused-badge");s&&s.classList.remove("cdm-visible"),r&&(r.style.opacity=""),c?(r&&(r.textContent=`⛔ Stopped after ${n} / ${t}`),i&&(i.style.width=`${Math.round(n/t*100)}%`)):(r&&(r.textContent=`✅ Downloaded ${n} / ${t} complete`),i&&(i.style.width="100%")),a&&(a.innerHTML=`
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
      </svg>
      <span id="cdm-download-label">Download (${j.size})</span>
    `,a.disabled=j.size===0),console.log(`[CDM] Download run complete: ${n}/${t} (stopped=${c})`),setTimeout(()=>{o&&o.classList.remove("cdm-visible")},3e3)}function st(e){const t=document.getElementById(Re);t&&(t.classList.toggle("cdm-dark",!!e),t.classList.toggle("cdm-light",!e))}function Go(){try{chrome.storage.local.get(["darkMode"],e=>{st(e.darkMode!==!1)})}catch{st(!0)}}function Ko(){if(!be){be=(e,t)=>{t!=="local"||!("darkMode"in e)||st(e.darkMode.newValue!==!1)};try{chrome.storage.onChanged.addListener(be)}catch{}}}function Bo(){if(be){try{chrome.storage.onChanged.removeListener(be)}catch{}be=null}}function un(){ne||(ne=!0,console.log("[CDM] Activating Content Download Manager"),Mo(),Lo(),Go(),Ko(),Uo(),qo(),te())}function bt(){if(!ne)return;ne=!1,console.log("[CDM] Deactivating Content Download Manager"),zo(),Bo(),$o();const e=document.getElementById(Re);e&&e.remove(),j.clear(),ce=!1,Se=[]}function Ho(){ne?bt():un()}function Qo(){return ne}console.log("✅ ContentDownloadManager module loaded");const Xo=Object.freeze(Object.defineProperty({__proto__:null,activate:un,deactivate:bt,isActive:Qo,toggle:Ho},Symbol.toStringTag,{value:"Module"}));Pn(ue);On(ue);zn(ue,ee);Qn(ue);jt({getState:ue,setState:ee,getSelectors:()=>Ot,eventBus:_e,stateManager:Je});go({getState:ue,setState:ee,eventBus:_e,monitoring:Wt,stateManager:Je});ho({stateManager:Je,eventBus:_e,monitoring:Wt});So(Je,_e);It(_e,Xo);console.log("✅ Flow Automation bootstrap complete — all modules wired");console.log("📦 Layers: core | interactions (+ imageUploader) | workflow | ui (+ contentDownloadManager)");
