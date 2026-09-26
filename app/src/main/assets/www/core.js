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
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  }
  function formatClock(ms) {
    const sec = Math.max(0, Math.ceil(ms/1000));
    return `${String(Math.floor(sec/60)).padStart(2,"0")}:${String(sec%60).padStart(2,"0")}`;
  }
  return {DEFAULT_DOMAINS,DEFAULT_PLAN,defaultConfig,defaultStats,defaultSession,normalizeDomain,cleanDomains,boundedInt,cleanPlan,chooseMethod,nextReview,parseQuiz,escapeHTML,formatClock};
});
