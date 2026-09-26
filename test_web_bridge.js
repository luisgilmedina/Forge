const test=require('node:test');const assert=require('node:assert/strict');
global.FFCore=require('./core.js');
const values=new Map();
global.localStorage={getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
const bridge=require('./web-bridge.js');
const call=async(type,extra={})=>{const r=await bridge.runtime.sendMessage({type,...extra});assert.equal(r.ok,true,r.error);return r;};
test('Inicia y detiene plan sin bloqueo del sistema',async()=>{
 const plan=[{id:'a',subject:'Historia',minutes:1},{id:'b',subject:'Biología',minutes:1}];
 await call('START',{plan,breakMinutes:1});
 const a=(await bridge.storage.local.get('ff_session')).ff_session;
 assert.equal(a.phase,'study');assert.equal(a.plan.length,2);assert.ok(a.endAt>Date.now());
 await call('STOP');
 assert.equal((await bridge.storage.local.get('ff_session')).ff_session.phase,'idle');
});
test('Avanza sesión y descanso al volver a abrirla y concede XP',async()=>{
 await bridge.storage.local.set({ff_stats:FFCore.defaultStats()});
 const plan=[{id:'a',subject:'Inglés',minutes:1},{id:'b',subject:'Historia',minutes:1}];
 await call('START',{plan,breakMinutes:1});
 let s=(await bridge.storage.local.get('ff_session')).ff_session;
 await bridge.storage.local.set({ff_session:{...s,endAt:Date.now()-250000}});
 await call('PING');
 const res=await bridge.storage.local.get(['ff_session','ff_stats']);
 assert.equal(res.ff_session.phase,'idle');assert.equal(res.ff_stats.completed,2);assert.equal(res.ff_stats.xp,50);
 assert.equal(res.ff_stats.minutes,2);
});
test('La clave de IA permanece en memoria y no aparece en exportación local',async()=>{
 await bridge.storage.session.set({ff_api_key:'clave_de_prueba'});
 assert.equal((await bridge.storage.session.get('ff_api_key')).ff_api_key,'clave_de_prueba');
 assert.equal(values.has('ff_tablet_ff_api_key'),false);
 await bridge.storage.session.clear();assert.deepEqual(await bridge.storage.session.get('ff_api_key'),{});
});
test('Recompensa de examen y rechazo de doble inicio',async()=>{
 await call('REWARD_QUIZ',{correct:3});
 assert.equal((await bridge.storage.local.get('ff_stats')).ff_stats.xp,65);
 await call('START',{plan:[{id:'c',subject:'Matemáticas',minutes:3}],breakMinutes:2});
 const retry=await bridge.runtime.sendMessage({type:'START',plan:[{id:'d',subject:'Otro',minutes:1}],breakMinutes:2});
 assert.equal(retry.ok,false);
 await call('STOP');
});
