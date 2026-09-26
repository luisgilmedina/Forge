"use strict";
const C = FFCore;
const $ = (sel,root=document) => root.querySelector(sel);
const E = C.escapeHTML;
let st = {
  config:C.defaultConfig(), plan:[...C.DEFAULT_PLAN],stats:C.defaultStats(),session:C.defaultSession(),
  materials:[],errors:[],chat:[]
};
let apiKey = "", view = "dashboard", quiz = null, busy = false, currentMaterial = "", chatMaterial = "";
const headings = {dashboard:"PANEL DE MANDO",materials:"MATERIALES",ai:"DIRECTOR IA",quiz:"EXÁMENES",errors:"BAÚL DE ERRORES",settings:"CONFIGURACIÓN"};
function toast(message,error=false){const box=$("#toast");box.textContent=message;box.className="toast"+(error?" error":"");box.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>box.hidden=true,5000);}
function markBusy(on,label){busy=on;const info=$("#busy-status");if(info)info.textContent=on?(label||"Procesando, espera unos segundos…"):"";document.querySelectorAll(".ai-action").forEach(el=>el.disabled=on);}
function fmt(d){return new Date(d).toLocaleDateString("es-ES",{day:"2-digit",month:"short"});}
function msg(type,extra={}){return ffBridge.runtime.sendMessage({type,...extra}).then(reply=>{if(!reply?.ok)throw new Error(reply?.error || "No se recibió respuesta de Chrome");return reply;});}
async function persist(name,value){await ffBridge.storage.local.set({[name]:value});}
async function init(){
  const obj=await ffBridge.storage.local.get(["ff_config","ff_plan","ff_stats","ff_session","ff_materials","ff_errors","ff_chat"]);
  st.config={...C.defaultConfig(),...(obj.ff_config||{})};st.plan=obj.ff_plan||[...C.DEFAULT_PLAN];
  st.stats={...C.defaultStats(),...(obj.ff_stats||{})};st.session=obj.ff_session||C.defaultSession();
  st.materials=obj.ff_materials||[];st.errors=obj.ff_errors||[];st.chat=obj.ff_chat||[];
  apiKey=(await ffBridge.storage.session.get("ff_api_key")).ff_api_key||"";
  document.querySelectorAll(".navlink").forEach(b=>b.addEventListener("click",()=>navigate(b.dataset.view)));
  ffBridge.storage.onChanged.addListener((changes,area)=>{
    if(area==="session"&&changes.ff_api_key){apiKey=changes.ff_api_key.newValue||"";updateChrome();return;}
    if(area!=="local")return;
    const names={ff_config:"config",ff_plan:"plan",ff_stats:"stats",ff_session:"session",ff_materials:"materials",ff_errors:"errors",ff_chat:"chat"};
    for(const [key,field] of Object.entries(names))if(changes[key])st[field]=changes[key].newValue||({config:C.defaultConfig(),plan:[],stats:C.defaultStats(),session:C.defaultSession(),materials:[],errors:[],chat:[]}[field]);
    updateChrome();
    // Don't discard text the user is typing when an unrelated background statistic changes.
    if(changes.ff_session&&view==="dashboard")render();
    if(changes.ff_stats&&view==="dashboard")render();
    if(changes.ff_errors&&view==="errors")render();
    if(changes.ff_materials&&view==="materials")render();
  });
  await msg("PING").catch(()=>{});
  updateChrome();render();setInterval(tick,1000);
}
function navigate(to){if(!headings[to])return;view=to;document.querySelectorAll(".navlink").forEach(b=>b.classList.toggle("selected",b.dataset.view===view));updateChrome();render();window.scrollTo({top:0,behavior:"auto"});}
function updateChrome(){
  $("#page-name").textContent=headings[view];$("#key-status").textContent=apiKey?"✦ IA conectable":"IA sin configurar";
  $("#due-count").textContent=st.errors.filter(x=>x.dueAt<=Date.now()).length;
}
function render(){
  const fn={dashboard:dashboard,materials:materials,ai:director,quiz:exams,errors:errorVault,settings:settings}[view];
  $("#view").innerHTML=fn();
  const bind={dashboard:bindDashboard,materials:bindMaterials,ai:bindDirector,quiz:bindExams,errors:bindErrors,settings:bindSettings}[view];bind();
  if(view==="dashboard")tick();
}
function header(kicker,title,desc){return `<div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="sub">${desc}</p>`;}
function cardStats(){const s=st.stats;return `<section class="stats" aria-label="Estadísticas">
  <div class="stat"><span class="stat-icon">✦ EXPERIENCIA</span><strong>${s.xp}</strong><small>XP ganados</small></div>
  <div class="stat"><span class="stat-icon">◈ MONEDAS</span><strong>${s.coins}</strong><small>Monedas digitales</small></div>
  <div class="stat"><span class="stat-icon">◷ ENFOQUE</span><strong>${s.minutes}</strong><small>Minutos completados</small></div>
  <div class="stat"><span class="stat-icon">◎ VICTORIAS</span><strong>${s.completed}</strong><small>Bloques de estudio</small></div>
  </section>`;}
function dashboard(){
  const s=st.session,active=s.phase!=="idle";
  const level=Math.floor(st.stats.xp/100)+1,need=st.stats.xp%100;
  const mascot=level>=5?"🐉":level>=3?"🦅":level>=2?"🐲":"🥚";
  return `<section class="hero"><div><div class="eyebrow">◈ TU MISIÓN COMIENZA AQUÍ</div><h1>Convierte el esfuerzo en poder.</h1><p>Una sesión a la vez. Tú eliges el objetivo; FocusForge sigue el temporizador.</p><div class="pillrow" style="margin-top:18px"><span class="pill">NIVEL ${level}</span><span class="pill">${st.materials.length} materiales</span><span class="pill">${st.errors.filter(e=>e.dueAt<=Date.now()).length} repasos pendientes</span></div></div><div><div class="mascot">${mascot}</div><div class="mascot-label">AVATAR NIVEL ${level}</div></div></section>
 ${cardStats()}
 <div class="two-col"><div><section class="panel"><div class="subheading"><h2>⚡ ${active?"Sesión en marcha":"Lanza tu siguiente plan"}</h2><span class="tag">${active?(s.phase==="study"?"ENFOQUE":"DESCANSO"):"LISTO"}</span></div>
  ${active?`<div class="eyebrow" id="live-subject">${E(s.plan[s.index]?.subject||"")}</div><div id="live-timer" class="timer ${s.phase==="break"?"mode-break":""}">--:--</div><div class="timer-hint" id="live-phase">${s.phase==="study"?"Tiempo de concentración voluntario. Para restringir otras apps, usa los controles de tu tablet.":"Pausa: descansa de la pantalla si lo necesitas."}</div><div class="progress-track"><div id="live-progress" class="progress-fill" style="width:0%"></div></div><div class="actions"><button id="stop" class="button danger">■ Detener sesión</button></div><p class="tiny">Al detener una sesión antes de tiempo no se suman sus recompensas. Siempre puedes detener la sesión.</p>`
  :`<div class="fields"><div class="field" style="min-width:210px"><label for="plan-subject">Asignatura o tarea</label><input id="plan-subject" maxlength="65" placeholder="Ej.: Historia · Tema 4" /></div><div class="field" style="max-width:115px"><label for="plan-minutes">Minutos</label><input id="plan-minutes" type="number" min="1" max="180" value="25" /></div><button class="button" id="add-plan">+ Añadir</button></div>
  <div style="margin-top:18px" id="plan-list">${st.plan.map((p,i)=>`<div class="plan-item"><div><span class="number">${i+1}</span><strong>${E(p.subject)}</strong> <small>· ${p.minutes} min</small></div><button class="button sm" data-remove="${E(p.id)}" aria-label="Quitar ${E(p.subject)}">✕</button></div>`).join("")||'<div class="empty">Añade una asignatura para comenzar.</div>'}</div>
  <div class="fields" style="margin-top:14px"><div class="field" style="max-width:150px"><label for="break-time">Descanso (min)</label><input id="break-time" type="number" min="1" max="30" value="${C.boundedInt(st.config.breakMinutes,1,30,5)}" /></div><div class="field"><span class="muted tiny">El descanso empieza automáticamente entre tareas.</span></div></div>
  <div class="actions"><button id="start" class="button primary" ${st.plan.length?"":"disabled"}>▶ EMPEZAR PLAN</button><button id="clear-plan" class="button">Vaciar plan</button></div>`}
  </section>
  <section class="panel"><h2>🧠 Método sugerido</h2><p>Basado únicamente en las palabras del material. Es una sugerencia orientativa, no un diagnóstico ni una evaluación de tu aprendizaje.</p><div class="pillrow">${st.materials.slice(0,3).map(x=>`<span class="pill">${E(x.name)} · ${E(C.chooseMethod(x.text,x.name).name)}</span>`).join("")||'<span class="pill">Importa apuntes para ver sugerencias</span>'}</div></section>
 </div><div> <section class="panel"><h2>📵 Menos distracciones</h2><span class="tag blue">MODO VOLUNTARIO</span><p>FocusForge no bloquea otras aplicaciones desde el navegador. Combínalo con <strong>Bienestar digital</strong> (Android) o <strong>Tiempo de uso</strong> (iPad) para limitar distracciones.</p><p class="tiny">El temporizador seguirá calculando los tiempos si vuelves a abrir FocusForge.</p><button class="button sm" id="go-settings">Ver opciones →</button></section>
    <section class="panel"><h2>🐣 Tu evolución</h2><p>Nivel ${level} · ${need}/100 XP hacia el siguiente nivel</p><div class="levelbar"><div style="width:${need}%"></div></div><hr class="line"/><h3>Últimas sesiones</h3>${st.stats.history.slice(0,4).map(x=>`<div class="plan-item"><div><strong>${E(x.subject)}</strong><br/><small>${fmt(x.at)}</small></div><span class="tag">${x.minutes} min</span></div>`).join("")||'<p class="tiny">Tu historial aparecerá al completar el primer bloque.</p>'}</section>
 </div></div>`;
}
function tick(){const s=st.session;if(view!=="dashboard"||s.phase==="idle")return;const t=$("#live-timer"),p=$("#live-progress");if(!t)return;const left=Math.max(0,s.endAt-Date.now());t.textContent=C.formatClock(left);const mins=s.phase==="study"?s.plan[s.index].minutes:s.breakMinutes;p.style.width=`${Math.max(0,Math.min(100,100-left/(mins*60000)*100))}%`;
 if(left<=0)msg("PING").catch(()=>{});}
function bindDashboard(){
 $("#go-settings")?.addEventListener("click",()=>navigate("settings"));
 $("#add-plan")?.addEventListener("click",async()=>{const subject=$("#plan-subject").value.trim();const minutes=C.boundedInt($("#plan-minutes").value,1,180,null);if(!subject||!minutes)return toast("Escribe una asignatura y minutos entre 1 y 180.",true);if(st.plan.length>=15)return toast("Máximo 15 tareas por plan.",true);st.plan=[...st.plan,{id:crypto.randomUUID(),subject:subject.slice(0,65),minutes}];await persist("ff_plan",st.plan);render();});
 document.querySelectorAll("[data-remove]").forEach(el=>el.addEventListener("click",async()=>{st.plan=st.plan.filter(p=>p.id!==el.dataset.remove);await persist("ff_plan",st.plan);render();}));
 $("#clear-plan")?.addEventListener("click",async()=>{st.plan=[];await persist("ff_plan",st.plan);render();});
 $("#start")?.addEventListener("click",async()=>{try{const b=C.boundedInt($("#break-time").value,1,30,null);if(!b)throw Error("El descanso debe durar entre 1 y 30 minutos.");st.config.breakMinutes=b;await persist("ff_config",st.config);await msg("START",{plan:st.plan,breakMinutes:b});toast("¡Plan iniciado! Puedes detenerlo cuando quieras.");}catch(err){toast(err.message,true)}});
 $("#stop")?.addEventListener("click",async()=>{try{await msg("STOP");toast("Sesión detenida.");}catch(err){toast(err.message,true)}});
}
function materials(){return `${header("02 / RECURSOS","Arsenal de materiales","Carga apuntes en texto o usa Gemini para extraer contenido de PDFs e imágenes. También puedes pegar transcripciones y textos de Word.")}
 <div class="panel"><h2>+ Incorporar material</h2><div class="dropzone" id="dropzone"><div style="font-size:34px">↟</div><strong>Arrastra aquí tus archivos</strong><p>.txt, .md, .csv sin IA; .pdf, .png, .jpg y .webp necesitan una clave Gemini.</p><button id="choose-file" type="button" class="button primary">Seleccionar archivos</button><input id="file-input" class="file-input" type="file" multiple accept=".txt,.md,.csv,.pdf,.png,.jpg,.jpeg,.webp,text/plain,text/markdown,application/pdf,image/png,image/jpeg,image/webp"/><p class="tiny">Archivos PDF e imágenes: máx. 8 MB por archivo. Se envían a Gemini solo si configuras la IA.</p><div id="busy-status" class="loading"></div></div><hr class="line"/><h3>O pega aquí tus apuntes</h3><div class="field"><label for="paste-title">Nombre</label><input id="paste-title" placeholder="Ej.: Biología · Células" maxlength="100"/></div><textarea id="paste-text" class="editor" placeholder="Pega apuntes, un glosario o la transcripción de un vídeo…" maxlength="35000"></textarea><button class="button" id="save-text">Guardar texto</button></div>
 <div class="subheading"><h2>Mis materiales (${st.materials.length}/12)</h2></div>
 <div class="list-grid">${st.materials.map(m=>{let method=C.chooseMethod(m.text,m.name);return `<article class="material"><div class="pillrow"><span class="tag blue">${E(m.kind)}</span><span class="tag">${E(method.name)}</span></div><h3>${E(m.name)}</h3><p class="desc">${E(m.text.slice(0,165))}${m.text.length>165?"…":""}</p><small>Guardado el ${fmt(m.at)} · ${m.text.length.toLocaleString("es-ES")} caracteres</small><div class="actions"><button class="button sm" data-use="${E(m.id)}">Practicar →</button><button class="button sm danger" data-delete="${E(m.id)}">Eliminar</button></div></article>`}).join("")||'<div class="empty">Aún no hay materiales. Empieza subiendo un archivo o pegando tus apuntes.</div>'}</div>`;}
async function addMaterial(name,kind,text){if(st.materials.length>=12)throw Error("Límite local de 12 materiales. Elimina alguno antes de añadir más.");const item={id:crypto.randomUUID(),name:name.slice(0,100),kind,text:text.trim().slice(0,35000),at:Date.now()};if(!item.text)throw Error("El material no contiene texto legible.");st.materials=[item,...st.materials];await persist("ff_materials",st.materials);return item;}
async function toBase64(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(Error("No se pudo leer el archivo"));r.onload=()=>resolve(String(r.result).split(",")[1]);r.readAsDataURL(file);});}
async function handleFiles(files){if(busy)return;if(!files.length)return;markBusy(true,"Procesando archivos…");try{
  for(const file of [...files]){
    if(st.materials.length>=12)throw Error("Has alcanzado el límite de 12 materiales.");
    let content="",kind="TXT";
    if(/\.(txt|md|csv)$/i.test(file.name)||/^text\//.test(file.type)){if(file.size>1024*1024)throw Error(`${file.name}: máximo 1 MB para texto.`);content=await file.text();kind="TEXTO";}
    else if(/\.(pdf|png|jpe?g|webp)$/i.test(file.name)){
      if(!apiKey)throw Error("Para PDFs e imágenes configura tu clave de Gemini en Configuración.");
      if(file.size>8*1024*1024)throw Error(`${file.name}: supera 8 MB; divídelo en partes.`);
      const mime=/\.pdf$/i.test(file.name)?"application/pdf":/\.png$/i.test(file.name)?"image/png":/\.webp$/i.test(file.name)?"image/webp":"image/jpeg";
      const data=await toBase64(file);
      content=await gemini("Extrae el material de estudio de este archivo de forma fiel: texto, fórmulas descritas, títulos y conceptos importantes. No inventes contenido. Devuelve SOLO apuntes de texto plano útiles para preparar preguntas, con un máximo de 25.000 caracteres.",{attachment:{mime_type:mime,data}});
      kind=mime==="application/pdf"?"PDF + IA":"IMAGEN + IA";
    }else throw Error(`${file.name}: formato no admitido en esta versión.`);
    const item=await addMaterial(file.name,kind,content);toast(`Material «${item.name}» añadido.`);
  }
 }catch(err){toast(err.message,true);}finally{markBusy(false);if(view==="materials")render();}}
function bindMaterials(){
 const fi=$("#file-input"),drop=$("#dropzone");$("#choose-file").addEventListener("click",()=>fi.click());fi.addEventListener("change",()=>handleFiles(fi.files));
 drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("drag");});drop.addEventListener("dragleave",()=>drop.classList.remove("drag"));drop.addEventListener("drop",e=>{e.preventDefault();drop.classList.remove("drag");handleFiles(e.dataTransfer.files);});
 $("#save-text").addEventListener("click",async()=>{try{const name=$("#paste-title").value.trim(),value=$("#paste-text").value.trim();if(!name||!value)throw Error("Introduce un nombre y contenido.");await addMaterial(name,"TEXTO",value);toast("Material guardado.");render();}catch(err){toast(err.message,true)}});
 document.querySelectorAll("[data-delete]").forEach(b=>b.addEventListener("click",async()=>{const m=st.materials.find(x=>x.id===b.dataset.delete);if(!m||!confirm(`¿Eliminar «${m.name}»? Se conservarán los errores ya guardados.`))return;st.materials=st.materials.filter(x=>x.id!==m.id);await persist("ff_materials",st.materials);render();}));
 document.querySelectorAll("[data-use]").forEach(b=>b.addEventListener("click",()=>{currentMaterial=b.dataset.use;navigate("quiz");}));
}
async function gemini(prompt,{attachment=null,history=[]}={}){
 if(!apiKey)throw Error("Necesitas una clave Gemini. Ve a Configuración para conectarla.");
 const model=st.config.model||"gemini-flash-latest";
 if(!/^[a-zA-Z0-9._-]{3,65}$/.test(model))throw Error("Identificador de modelo inválido.");
 const contents=history.map(h=>({role:h.role==="assistant"?"model":"user",parts:[{text:String(h.text).slice(0,6000)}]}));
 const parts=[{text:prompt}];if(attachment)parts.push({inline_data:attachment});contents.push({role:"user",parts});
 const controller=new AbortController();const t=setTimeout(()=>controller.abort(),75000);
 try{
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,{
   method:"POST",headers:{"Content-Type":"application/json","x-goog-api-key":apiKey},body:JSON.stringify({contents,generationConfig:{temperature:0.35,maxOutputTokens:3500}}),signal:controller.signal
  });
  const json=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(`Gemini (${r.status}): ${(json.error?.message||"No se pudo generar contenido").slice(0,250)}`);
  const text=(json.candidates?.[0]?.content?.parts||[]).map(x=>x.text||"").join("\n").trim();
  if(!text)throw Error("Gemini no devolvió texto. Inténtalo otra vez o cambia de modelo.");
  return text;
 }catch(err){if(err.name==="AbortError")throw Error("La solicitud tardó demasiado. Comprueba la conexión o usa un archivo más pequeño.");throw err;}finally{clearTimeout(t);}
}
function materialOptions(selected,includeGeneral=false){return `${includeGeneral?'<option value="">Sin material / preguntas generales</option>':""}${st.materials.map(m=>`<option value="${E(m.id)}" ${selected===m.id?"selected":""}>${E(m.name)}</option>`).join("")}`;}
function director(){const mat=st.materials.find(m=>m.id===chatMaterial);const msgs=st.chat.filter(m=>m.materialId===chatMaterial).slice(-14);return `${header("03 / ASISTENCIA","Director IA","Resuelve dudas con Gemini usando tus apuntes como contexto. La IA puede equivocarse: contrasta las respuestas con tu material.")}
 ${!apiKey?'<div class="notice">Para hablar con el Director, añade tu propia clave Gemini en Configuración. El temporizador y los bloqueos funcionan sin clave.</div>':""}
 <div class="panel"><div class="fields"><div class="field"><label for="ai-material">Material para conversar</label><select id="ai-material">${materialOptions(chatMaterial,true)}</select></div><button id="explain-plan" class="button ai-action">✦ Proponer método</button></div><p class="tiny">${mat?`Contexto: ${E(mat.name)} · ${E(C.chooseMethod(mat.text,mat.name).name)} sugerido`:"Sin documento seleccionado; puedes hacer preguntas generales."}</p>
 <div class="message-list" id="messages">${msgs.map(m=>`<div class="bubble ${m.role==="user"?"user":"assistant"}"><span class="who">${m.role==="user"?"TÚ":"DIRECTOR IA"}</span>${E(m.text)}</div>`).join("")||'<div class="empty">Formula una pregunta sobre tus asignaturas o selecciona un material para empezar.</div>'}</div><form id="ask-form" style="margin-top:13px"><div class="fields"><div class="field"><label for="question-ai">Tu pregunta</label><input id="question-ai" maxlength="1500" placeholder="Ej.: Explícame la fotosíntesis con tres ejemplos…" required /></div><button class="button primary ai-action" ${apiKey?"":"disabled"}>Enviar ↗</button></div></form><div id="busy-status" class="loading"></div></div>
 <div class="panel"><h2>⚙ Tu control, tu ritmo</h2><p>Elige entre las sugerencias de estudio. El asistente puede recomendar un método, pero no modifica tus bloqueos ni horarios sin tu decisión.</p></div>`;}
function bindDirector(){
 const msglist=$("#messages");msglist.scrollTop=msglist.scrollHeight;
 $("#ai-material").addEventListener("change",e=>{chatMaterial=e.target.value;render();});
 $("#explain-plan").addEventListener("click",async()=>{if(busy)return;const m=st.materials.find(x=>x.id===chatMaterial);if(!m)return toast("Selecciona primero un material.",true);markBusy(true,"Preparando sugerencia…");try{const text=await gemini(`Toma SOLO el material siguiente y propone un método de estudio entre Crono-Asalto, El Manicomio e Inmersión Fluida. Explica cuál y da un plan REALISTA de 25 minutos. No prometas eficacia clínica.\nMATERIAL:\n${m.text.slice(0,21000)}`);st.chat=[...st.chat,{id:crypto.randomUUID(),materialId:chatMaterial,role:"assistant",text,at:Date.now()}].slice(-80);await persist("ff_chat",st.chat);render();}catch(err){toast(err.message,true);}finally{markBusy(false);}});
 $("#ask-form").addEventListener("submit",async e=>{e.preventDefault();if(busy)return;const q=$("#question-ai").value.trim();if(!q)return;const m=st.materials.find(x=>x.id===chatMaterial);const history=st.chat.filter(x=>x.materialId===chatMaterial).slice(-8);st.chat=[...st.chat,{id:crypto.randomUUID(),materialId:chatMaterial,role:"user",text:q,at:Date.now()}].slice(-80);await persist("ff_chat",st.chat);render();markBusy(true,"El Director está escribiendo…");try{
 const prompt=`Eres el Director de FocusForge, un tutor de estudio directo, exigente pero respetuoso. No hagas diagnósticos médicos ni prometas resultados. Si falta información, dilo. Responde en español. ${m?`Basarte principalmente en estos apuntes y señalar cuando una respuesta no aparece en ellos:\n${m.text.slice(0,18000)}`:"No hay apuntes adjuntos."}\nConsulta actual: ${q}`;
 const response=await gemini(prompt,{history:history.map(h=>({role:h.role,text:h.text}))});
 st.chat=[...st.chat,{id:crypto.randomUUID(),materialId:chatMaterial,role:"assistant",text:response,at:Date.now()}].slice(-80);await persist("ff_chat",st.chat);render();
 }catch(err){toast(err.message,true);st.chat=[...st.chat,{id:crypto.randomUUID(),materialId:chatMaterial,role:"assistant",text:`No se pudo consultar la IA: ${err.message}`,at:Date.now()}].slice(-80);await persist("ff_chat",st.chat);render();}finally{markBusy(false);}});
}
function exams(){if(!st.materials.some(x=>x.id===currentMaterial)&&st.materials.length)currentMaterial=st.materials[0].id;const m=st.materials.find(x=>x.id===currentMaterial);
 if(!quiz){return `${header("04 / RETOS","Sala de exámenes","Genera preguntas sobre tus propios apuntes y registra tus fallos para repasarlos después.")}${!apiKey?'<div class="notice">Necesitas conectar tu clave Gemini para generar preguntas. El Baúl de errores permite crear tarjetas manualmente sin IA.</div>':""}<section class="panel"><h2>Diseña tu reto</h2><div class="field"><label for="exam-material">Material a evaluar</label><select id="exam-material">${materialOptions(currentMaterial,false)}</select></div><p>Generaremos de 3 a 5 preguntas de opción múltiple a partir del contenido elegido. Comprueba siempre las respuestas importantes.</p><div class="pillrow"><span class="pill">+5 XP por acierto</span><span class="pill">Errores → Baúl</span><span class="pill">Repaso espaciado</span></div><div class="actions"><button id="create-quiz" class="button primary ai-action" ${(!apiKey||!m)?"disabled":""}>⚔ Generar examen</button></div><div id="busy-status" class="loading"></div></section>`;}
 const {questions,done,answers}=quiz;
 return `${header("04 / RETOS","Sala de exámenes",`Tema: ${E(quiz.materialName)} · ${questions.length} preguntas`)}`+
 `<section class="panel"><form id="quiz-form">${questions.map((q,i)=>`<div class="question"><div class="eyebrow">PREGUNTA ${i+1} / ${questions.length}</div><h3>${E(q.pregunta)}</h3>${q.opciones.map((o,j)=>`<label class="option"><input type="radio" name="q${i}" value="${j}" ${done?"disabled":""} ${answers&&answers[i]===j?"checked":""}/><span>${E(o)}</span></label>`).join("")}${done?`<div class="feedback ${answers[i]===q.correcta?"good":"bad"}">${answers[i]===q.correcta?"✓ Correcto":"✕ Incorrecto"} · Respuesta: ${E(q.opciones[q.correcta])}<br/>${E(q.explicacion)}</div>`:""}</div>`).join("")}${done?`<div class="result">Resultado: ${quiz.score}/${questions.length} aciertos. Has ganado ${quiz.score*5} XP y ${quiz.score*2} monedas. ${questions.length-quiz.score} error(es) enviado(s) al Baúl.</div><div class="actions"><button type="button" id="retry" class="button">Nuevo examen</button><button type="button" id="go-errors" class="button primary">Repasar errores →</button></div>`:'<button class="button primary" type="submit">Corregir examen</button><button type="button" id="cancel" class="button">Salir sin guardar</button>'}</form></section>`;
}
function bindExams(){
 if(!quiz){$("#exam-material")?.addEventListener("change",e=>{currentMaterial=e.target.value;render();});$("#create-quiz")?.addEventListener("click",async()=>{
  if(busy)return;const m=st.materials.find(x=>x.id===currentMaterial);if(!m)return toast("Selecciona un material.",true);markBusy(true,"Gemini está preparando tu examen…");try{
   const response=await gemini(`Crea EXACTAMENTE 5 preguntas de test sobre el material incluido abajo. No introduzcas información que no aparezca en el material. Cada pregunta tendrá 4 opciones, una sola respuesta correcta (índice 0-3), una explicación breve. Responde EXCLUSIVAMENTE como JSON válido con esta estructura: {"preguntas":[{"pregunta":"…","opciones":["…","…","…","…"],"correcta":0,"explicacion":"…"}]}. MATERIAL:\n${m.text.slice(0,23000)}`);
   const questions=C.parseQuiz(response);quiz={materialId:m.id,materialName:m.name,questions,done:false,answers:null,score:0};render();
  }catch(err){toast(err.message,true)}finally{markBusy(false);}
 });return;}
 $("#retry")?.addEventListener("click",()=>{quiz=null;render();});$("#go-errors")?.addEventListener("click",()=>navigate("errors"));$("#cancel")?.addEventListener("click",()=>{quiz=null;render();});
 $("#quiz-form").addEventListener("submit",async e=>{e.preventDefault();if(quiz.done)return;const answers=quiz.questions.map((_,i)=>{const choice=$("input[name=q"+i+"]:checked");return choice?Number(choice.value):null;});if(answers.some(x=>x===null))return toast("Responde todas las preguntas antes de corregir.",true);
 const wrong=quiz.questions.flatMap((q,i)=>answers[i]===q.correcta?[]:[{id:crypto.randomUUID(),materialId:quiz.materialId,subject:quiz.materialName,question:q.pregunta,answer:q.opciones[q.correcta]+". "+q.explicacion,successes:0,dueAt:Date.now()+86400000,at:Date.now()}]);
 st.errors=[...wrong,...st.errors].slice(0,200);quiz.answers=answers;quiz.score=quiz.questions.filter((q,i)=>q.correcta===answers[i]).length;quiz.done=true;
 try{await persist("ff_errors",st.errors);await msg("REWARD_QUIZ",{correct:quiz.score});toast("Examen corregido y errores guardados.");}catch(err){toast(err.message,true);}render();
 });
}
function errorVault(){const due=st.errors.filter(e=>e.dueAt<=Date.now()).sort((a,b)=>a.dueAt-b.dueAt);const next=st.errors.filter(e=>e.dueAt>Date.now()).sort((a,b)=>a.dueAt-b.dueAt);return `${header("05 / RECUPERACIÓN","Baúl de las Sombras","Aquí vuelven las preguntas que fallaste. Repásalas en intervalos orientativos de 1, 3, 7 y 14 días.")}
 <div class="stats" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="stat"><small>REPASOS DISPONIBLES</small><strong>${due.length}</strong></div><div class="stat"><small>PROGRAMADOS</small><strong>${next.length}</strong></div></div>
 <section class="panel"><h2>🎯 Para repasar ahora</h2>${due.map((c,i)=>`<div class="question"><div class="eyebrow">${E(c.subject||"Repaso manual")} · TARJETA ${i+1}</div><h3>${E(c.question)}</h3><button class="button sm" data-reveal="${E(c.id)}">Ver respuesta</button><div class="answer" id="answer-${E(c.id)}" hidden>${E(c.answer)}</div><div class="actions" id="grade-${E(c.id)}" hidden><button class="button sm danger" data-grade="${E(c.id)}" data-good="false">No lo recordaba</button><button class="button sm primary" data-grade="${E(c.id)}" data-good="true">Lo he recordado</button></div></div>`).join("")||'<div class="empty">¡Nada pendiente! Los nuevos errores aparecerán aquí después de un examen o al añadir una tarjeta.</div>'}</section>
 <div class="columns-2"><section class="panel"><h2>+ Añadir tarjeta manual</h2><form id="manual-error"><div class="field"><label for="manual-subject">Asignatura</label><input id="manual-subject" maxlength="65" placeholder="Matemáticas" /></div><div class="field" style="margin-top:10px"><label for="manual-question">Pregunta</label><textarea id="manual-question" rows="3" maxlength="600" required></textarea></div><div class="field" style="margin-top:10px"><label for="manual-answer">Respuesta</label><textarea id="manual-answer" rows="3" maxlength="700" required></textarea></div><div class="actions"><button class="button primary" type="submit">Guardar para repasar</button></div></form></section>
 <section class="panel"><h2>◷ Próximos repasos</h2>${next.slice(0,12).map(c=>`<div class="plan-item"><div><strong>${E(c.question.slice(0,70))}</strong><br/><small>${E(c.subject||"General")} · ${fmt(c.dueAt)}</small></div><button class="button sm danger" data-forget="${E(c.id)}">✕</button></div>`).join("")||'<p class="tiny">Aún no hay tarjetas programadas.</p>'}<p class="tiny">Los intervalos son una estrategia de repaso, no una garantía de memorización.</p></section></div>`;}
function bindErrors(){
 document.querySelectorAll("[data-reveal]").forEach(b=>b.addEventListener("click",()=>{$(`#answer-${b.dataset.reveal}`).hidden=false;$(`#grade-${b.dataset.reveal}`).hidden=false;b.hidden=true;}));
 document.querySelectorAll("[data-grade]").forEach(b=>b.addEventListener("click",async()=>{const e=st.errors.find(x=>x.id===b.dataset.grade);if(!e)return;const updated=C.nextReview(e,b.dataset.good==="true",Date.now());st.errors=st.errors.map(x=>x.id===e.id?updated:x);await persist("ff_errors",st.errors);render();toast("Próxima revisión programada.");}));
 document.querySelectorAll("[data-forget]").forEach(b=>b.addEventListener("click",async()=>{st.errors=st.errors.filter(x=>x.id!==b.dataset.forget);await persist("ff_errors",st.errors);render();}));
 $("#manual-error").addEventListener("submit",async e=>{e.preventDefault();const question=$("#manual-question").value.trim(),answer=$("#manual-answer").value.trim(),subject=$("#manual-subject").value.trim()||"General";if(!question||!answer)return toast("Completa la pregunta y la respuesta.",true);st.errors=[{id:crypto.randomUUID(),subject,question,answer,successes:0,dueAt:Date.now(),at:Date.now()},...st.errors].slice(0,200);await persist("ff_errors",st.errors);render();toast("Tarjeta guardada.");});
}
function settings(){return `${header("06 / PERSONALIZACIÓN","Centro de control","Configura tu IA y protege tus datos en esta tablet.")}
 <section class="panel"><h2>📵 Concentración en tablet</h2><div class="notice info">Esta versión es una aplicación Android independiente. No bloquea otras aplicaciones ni el dispositivo. Para establecer límites utiliza los controles del sistema.</div><div class="actions"><a class="button" href="https://support.google.com/android/answer/9346420?hl=es" target="_blank" rel="noopener">Bienestar digital · Android ↗</a></div><p>El temporizador se actualiza cuando vuelves a la app. Si cierras la app, no puede enviarte alarmas fiables ni impedir que uses otras aplicaciones.</p></section>
 <section class="panel"><h2>✦ Conectar inteligencia artificial</h2><p>Para consultar apuntes, procesar PDFs o generar exámenes necesitas tu <strong>propia clave de Gemini</strong> y conexión a Internet. La clave se mantiene <strong>solo en memoria</strong> mientras la app permanezca abierta y nunca se incluye en las copias. Cuando utilizas IA, tus consultas y archivos se envían directamente a Google.</p><div class="notice">Versión de prueba personal. La clave podría estar accesible para alguien que tenga acceso a la aplicación abierta, por lo que debes proteger la tablet. No compartas la clave, configura restricciones y no uses esta versión pública con una clave de producción. El proveedor puede aplicar cuotas y cargos.</div><div class="field" style="margin-top:16px"><label for="gemini-key">Clave de Google AI Studio</label><input id="gemini-key" type="password" autocomplete="off" placeholder="${apiKey?"Clave activa hasta que cierres la app":"Pega tu clave personal"}"/></div><div class="field" style="margin-top:12px"><label for="gemini-model">Modelo de IA</label><input id="gemini-model" value="${E(st.config.model)}" placeholder="gemini-flash-latest" maxlength="65"/></div><div class="actions"><button id="save-ai" class="button primary">Guardar conexión</button><button id="test-ai" class="button ai-action">Probar IA</button><button id="forget-key" class="button danger">Quitar clave</button><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" class="button">Obtener clave ↗</a></div><div id="busy-status" class="loading"></div></section>
 <section class="panel"><h2>▤ Copias y privacidad</h2><p>Los apuntes, errores, XP e historial se guardan <strong>solo en esta aplicación de Android</strong>. No se sincronizan automáticamente con Chromebook ni con otros dispositivos. Exporta e importa una copia para trasladarlos.</p><div class="actions"><button id="export-data" class="button">⇩ Exportar copia (.json)</button><button id="import-data" class="button">⇧ Importar copia</button><input type="file" id="restore-input" accept=".json,application/json" hidden/><button id="delete-data" class="button danger">Borrar mis datos</button></div></section>
 <section class="panel"><h2>Limitaciones</h2><p>Los apuntes en texto y herramientas locales vienen incluidos y funcionan sin conexión. La IA y el análisis de PDF/imágenes requieren Internet y una clave personal. No analiza automáticamente vídeos ni DOCX: pega una transcripción o convierte el documento a texto.</p></section>`;}
function bindSettings(){
 $("#save-ai").addEventListener("click",async()=>{const key=$("#gemini-key").value.trim();const model=$("#gemini-model").value.trim();if(!/^[a-zA-Z0-9._-]{3,65}$/.test(model))return toast("Modelo no válido.",true);st.config.model=model;await persist("ff_config",st.config);if(key){apiKey=key;await ffBridge.storage.session.set({ff_api_key:key});$("#gemini-key").value="";}toast(apiKey?"Conexión guardada para esta sesión. Usa «Probar IA».":"Modelo guardado. Para conectar Gemini introduce tu clave.");updateChrome();});
 $("#test-ai").addEventListener("click",async()=>{if(busy)return;markBusy(true,"Probando Gemini…");try{const text=await gemini("Responde únicamente con una frase corta en español confirmando que puedes actuar como tutor de estudio.");toast(`Gemini responde: ${text.slice(0,140)}`);}catch(err){toast(err.message,true)}finally{markBusy(false);}});
 $("#forget-key").addEventListener("click",async()=>{apiKey="";await ffBridge.storage.session.remove("ff_api_key");toast("Clave descartada.");render();updateChrome();});
 $("#export-data").addEventListener("click",()=>{const data={format:"focusforge-0.1",createdAt:new Date().toISOString(),ff_config:st.config,ff_plan:st.plan,ff_stats:st.stats,ff_materials:st.materials,ff_errors:st.errors,ff_chat:st.chat};const json=JSON.stringify(data,null,2);if(window.FocusForgeAndroid?.saveBackup){window.FocusForgeAndroid.saveBackup(json);toast("Elige dónde guardar la copia en Android.");return;}const blob=new Blob([json],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="focusforge-copia-"+new Date().toISOString().slice(0,10)+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);});
 $("#import-data").addEventListener("click",()=>$("#restore-input").click());
 $("#restore-input").addEventListener("change",async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>2*1024*1024)throw Error("Copia demasiado grande (máx. 2 MB).");const data=JSON.parse(await f.text());if(data.format!=="focusforge-0.1"||!Array.isArray(data.ff_materials)||!Array.isArray(data.ff_errors))throw Error("No es una copia de FocusForge válida.");if(st.session.phase!=="idle")throw Error("Detén primero tu sesión de estudio.");if(!confirm("¿Restaurar esta copia y reemplazar tus materiales, tarjetas e historial actuales?"))return;
   const config={...C.defaultConfig(),...data.ff_config,domains:C.cleanDomains(data.ff_config?.domains)};config.model=/^[a-zA-Z0-9._-]{3,65}$/.test(config.model)?config.model:"gemini-flash-latest";
   const plan=C.cleanPlan(data.ff_plan);
   const materials=data.ff_materials.slice(0,12).filter(m=>typeof m.name==="string"&&typeof m.text==="string").map(m=>({id:crypto.randomUUID(),name:m.name.slice(0,100),kind:String(m.kind||"TEXTO").slice(0,25),text:m.text.slice(0,35000),at:Date.now()}));
   // Imported cards are new local cards; imported content will never be rendered as HTML.
   const errors=data.ff_errors.slice(0,200).filter(c=>typeof c.question==="string"&&typeof c.answer==="string").map(c=>({id:crypto.randomUUID(),subject:String(c.subject||"General").slice(0,65),question:c.question.slice(0,600),answer:c.answer.slice(0,700),successes:C.boundedInt(c.successes,0,4,0),dueAt:Math.max(Date.now(),Number(c.dueAt)||Date.now()),at:Date.now()}));
   const oldstats=data.ff_stats||{};const stats={...C.defaultStats(),xp:C.boundedInt(oldstats.xp,0,10000000,0),coins:C.boundedInt(oldstats.coins,0,10000000,0),minutes:C.boundedInt(oldstats.minutes,0,10000000,0),completed:C.boundedInt(oldstats.completed,0,1000000,0),history:[]};
   await ffBridge.storage.local.set({ff_config:config,ff_plan:plan,ff_stats:stats,ff_materials:materials,ff_errors:errors,ff_chat:[]});toast("Copia restaurada. Conversaciones e IDs antiguos no se importan por seguridad.");navigate("dashboard");
  }catch(err){toast(err.message,true)}});
 $("#delete-data").addEventListener("click",async()=>{if(!confirm("Esto eliminará permanentemente materiales, tarjetas y estadísticas de ESTE perfil. ¿Continuar?"))return;try{await msg("STOP");await ffBridge.storage.local.clear();await ffBridge.storage.session.clear();apiKey="";st={config:C.defaultConfig(),plan:[...C.DEFAULT_PLAN],stats:C.defaultStats(),session:C.defaultSession(),materials:[],errors:[],chat:[]};await ffBridge.storage.local.set({ff_config:st.config,ff_plan:st.plan,ff_stats:st.stats,ff_session:st.session});toast("Datos borrados en este perfil.");navigate("dashboard");}catch(err){toast(err.message,true)}});
}
init().catch(err=>{$("#view").textContent="No se pudo iniciar la aplicación: "+err.message;console.error(err);});
