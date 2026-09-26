/* Shared, pure utilities. Exports are available to Node's built-in test runner. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.FFCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const DEFAULT_DOMAINS = ["youtube.com", "tiktok.com", "instagram.com", "reddit.com", "x.com"];
  const DEFAULT_PLAN = [{id:"base",subject:"Mi primera sesión",minutes:25}];
  const defaultConfig = () => ({domains:[...DEFAULT_DOMAINS], blockEnabled:true, breakMinutes:5, model:"gemini-flash-latest"});
  const defaultStats = () => ({xp:0,coins:0,minutes:0,completed:0,history:[]});
  const defaultPet = () => ({earned:0,spent:0,food:65,water:65,joy:65,interactions:0,lastCareAt:0,species:null});
  function petNeeds(pet, now) {
    const elapsed=Math.max(0,Math.floor((now-(Number(pet?.lastCareAt)||now))/86400000));
    const days=Math.min(10,elapsed);
    return {food:Math.max(20,boundedInt(pet?.food,0,100,65)-days*4),water:Math.max(20,boundedInt(pet?.water,0,100,65)-days*5),joy:Math.max(20,boundedInt(pet?.joy,0,100,65)-days*3)};
  }
  function petBudget(stats, pet) {
    const earned = boundedInt(pet?.earned,0,10000000,0);
    const spent = boundedInt(pet?.spent,0,10000000,0);
    return Math.max(0,Math.min(boundedInt(stats?.minutes,0,10000000,0),earned)-spent);
  }
  function carePet(pet, stats, kind) {
    const costs={food:10,water:5,play:15};
    if(!Object.prototype.hasOwnProperty.call(costs,kind))throw Error("Acción desconocida.");
    if(petBudget(stats,pet)<costs[kind])throw Error(`Completa ${costs[kind]} minutos de estudio para esta acción.`);
    const meter=kind==="play"?"joy":kind;
    const needs=petNeeds(pet,Date.now());
    return {...pet,...needs,lastCareAt:Date.now(),spent:boundedInt(pet.spent,0,10000000,0)+costs[kind],interactions:boundedInt(pet.interactions,0,1000000,0)+1,
      [meter]:Math.min(100,needs[meter]+25)};
  }
  function studyGuide(text,title="") {
    const method=chooseMethod(text,title);
    const steps=method.name==="Inmersión Fluida"
      ?["Lee un fragmento y subraya las expresiones nuevas.","Explícalo en voz alta sin mirar.","Practica vocabulario y comprueba los fallos."]
      :method.name==="El Manicomio"
      ?["Identifica las fórmulas o conceptos centrales.","Resuelve un ejemplo sin mirar el material.","Corrige el resultado y anota el error para repetirlo."]
      :["Divide los apuntes en tres bloques de ideas.","Recuerda cada bloque sin mirar, por escrito o en voz alta.","Contrasta con el archivo y repasa lo que falte."];
    return {...method,steps};
  }
  const defaultSession = () => ({phase:"idle",endAt:null,plan:[],index:0,breakMinutes:5});
  function normalizeDomain(raw) {
    if (typeof raw !== "string") return null;
    let value = raw.trim().toLowerCase();
    if (!value || /\s/.test(value)) return null;
    try {
      if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) value = "https://" + value;
      const u = new URL(value);
      if (!["https:","http:"].includes(u.protocol) || u.username || u.password || u.port) return null;
      const host = u.hostname.replace(/^www\./, "").replace(/\.$/, "");
      if (!/^(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,24}$/.test(host)) return null;
      return host;
    } catch (_) { return null; }
  }
  function cleanDomains(input) {
    if (!Array.isArray(input)) return [];
    return [...new Set(input.map(normalizeDomain).filter(Boolean))].slice(0, 60);
  }
  function boundedInt(value, min, max, fallback) {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
  }
  function cleanPlan(input) {
    if (!Array.isArray(input)) return [];
    return input.slice(0, 15).map((item, i) => ({
      id: typeof item?.id === "string" && item.id.length < 80 ? item.id : `plan-${i}`,
      subject: String(item?.subject || `Sesión ${i+1}`).trim().slice(0, 65) || `Sesión ${i+1}`,
      minutes: boundedInt(item?.minutes, 1, 180, 25)
    }));
  }
  function chooseMethod(text, title="") {
    const s = (String(title) + " " + String(text).slice(0, 6000)).toLowerCase();
    if (/(ingl[eé]s|franc[eé]s|alem[aá]n|idioma|language|vocabulario|verbos|listening|speaking)/.test(s)) {
      return {name:"Inmersión Fluida",description:"Lectura, explicación en voz alta y práctica de vocabulario."};
    }
    if (/(f[oó]rmula|ecuaci[oó]n|f[ií]sica|matem[aá]tica|qu[ií]mica|teorema|glosario)/.test(s)) {
      return {name:"El Manicomio",description:"Retos breves de recuperación activa con corrección posterior."};
    }
    return {name:"Crono-Asalto",description:"Divide el temario y repasa sus ideas clave contra reloj."};
  }
  function nextReview(card, correct, now) {
    const successes = correct ? Math.min((card.successes || 0)+1, 4) : 0;
    const days = correct ? [1,3,7,14][successes-1] : 1;
    return {...card,successes,dueAt:now+days*86400000,lastReviewedAt:now};
  }
  function parseQuiz(raw) {
    const match = String(raw||"").match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La IA no devolvió preguntas estructuradas. Vuelve a intentarlo.");
    let result;
    try { result = JSON.parse(match[0]); } catch (_) { throw new Error("Formato de examen no válido. Vuelve a generarlo."); }
    if (!Array.isArray(result.preguntas)) throw new Error("No se recibieron preguntas válidas.");
    const questions = result.preguntas.slice(0, 8).filter(q =>
      typeof q.pregunta === "string" && q.pregunta.trim() &&
      Array.isArray(q.opciones) && q.opciones.length === 4 &&
      q.opciones.every(x => typeof x === "string" && x.trim()) &&
      Number.isInteger(q.correcta) && q.correcta >= 0 && q.correcta < 4 &&
      typeof q.explicacion === "string"
    ).map(q => ({pregunta:q.pregunta.slice(0,600),opciones:q.opciones.map(x => x.slice(0,300)),correcta:q.correcta,explicacion:q.explicacion.slice(0,650)}));
    if (questions.length < 3) throw new Error("La IA devolvió menos de tres preguntas utilizables.");
    return questions;
  }
  function parseMistakeHelp(raw, count) {
    const match=String(raw||"").match(/\{[\s\S]*\}/);
    if(!match)throw Error("La IA no devolvió explicaciones estructuradas.");
    let data;try{data=JSON.parse(match[0]);}catch(_){throw Error("La explicación de IA no tiene un formato válido.");}
    if(!Array.isArray(data.ayudas))throw Error("No se recibieron ayudas para los fallos.");
    const help=new Map();
    for(const item of data.ayudas){
      if(Number.isInteger(item.indice)&&item.indice>=0&&item.indice<count&&typeof item.explicacion==="string"&&item.explicacion.trim())
        help.set(item.indice,{explanation:item.explicacion.trim().slice(0,550),practice:typeof item.practica==="string"?item.practica.trim().slice(0,300):""});
    }
    if(!help.size)throw Error("La IA no explicó ningún fallo.");
    return {help,summary:typeof data.resumen==="string"?data.resumen.trim().slice(0,650):""};
  }
  function parseLesson(raw) {
    const match=String(raw||"").match(/\{[\s\S]*\}/);
    if(!match)throw Error("La IA no devolvió una lección estructurada.");
    let data;try{data=JSON.parse(match[0]);}catch(_){throw Error("La lección no tiene un formato válido.");}
    if(!Array.isArray(data.resumen)||!Array.isArray(data.tarjetas)||typeof data.guion!=="string")throw Error("Faltan partes de la lección.");
    const summary=data.resumen.slice(0,6).filter(x=>typeof x==="string"&&x.trim()).map(x=>x.trim().slice(0,300));
    const cards=data.tarjetas.slice(0,8).filter(x=>x&&typeof x.pregunta==="string"&&x.pregunta.trim()&&typeof x.respuesta==="string"&&x.respuesta.trim()).map(x=>({question:x.pregunta.trim().slice(0,300),answer:x.respuesta.trim().slice(0,500)}));
    const script=data.guion.trim().slice(0,3200);
    if(summary.length<2||cards.length<2||script.length<80)throw Error("La IA devolvió una lección demasiado incompleta.");
    return {summary,cards,script};
  }
  function parseOutline(raw) {
    const match=String(raw||"").match(/\{[\s\S]*\}/);
    if(!match)throw Error("La IA no devolvió un esquema estructurado.");
    let data;try{data=JSON.parse(match[0]);}catch(_){throw Error("El esquema no tiene un formato válido.");}
    if(!Array.isArray(data.esquema))throw Error("La IA no devolvió apartados para el esquema.");
    const sections=data.esquema.slice(0,8).filter(x=>x&&typeof x.titulo==="string"&&x.titulo.trim()&&Array.isArray(x.puntos))
      .map(x=>({title:x.titulo.trim().slice(0,110),points:x.puntos.slice(0,6).filter(p=>typeof p==="string"&&p.trim()).map(p=>p.trim().slice(0,260))}))
      .filter(x=>x.points.length);
    if(sections.length<2)throw Error("La IA devolvió un esquema demasiado incompleto.");
    return sections;
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }
  function formatClock(ms) {
    const sec = Math.max(0, Math.ceil(ms/1000));
    return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;
  }
  return {DEFAULT_DOMAINS,DEFAULT_PLAN,defaultConfig,defaultStats,defaultPet,defaultSession,normalizeDomain,cleanDomains,boundedInt,cleanPlan,chooseMethod,studyGuide,petBudget,petNeeds,carePet,nextReview,parseQuiz,parseMistakeHelp,parseLesson,parseOutline,escapeHTML,formatClock};
});
