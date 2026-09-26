/* FocusForge tablet storage and foreground session engine.
 * This web app cannot enforce device-wide site/app blocking. No attempt is made.
 */
(function(root, coreFactory){
  'use strict';
  const C = coreFactory;
  const prefix='ff_tablet_';
  const listeners = new Set();
  const sessionMemory = new Map(); // API key is never written to persistent storage.
  let queue=Promise.resolve();
  function decode(name){
    try {const v=root.localStorage.getItem(prefix+name);return v===null?undefined:JSON.parse(v);}
    catch(e){return undefined;}
  }
  function notify(changes,area){
    if(!Object.keys(changes).length)return;
    // Async storage events like Chrome: listeners may re-render without racing a click handler.
    queueMicrotask(()=>listeners.forEach(listener=>listener(changes,area)));
  }
  function makeStorage(which){
    const volatile = which==='session';
    const allNames=['ff_config','ff_plan','ff_stats','ff_session','ff_materials','ff_errors','ff_chat'];
    const read=name=>volatile?sessionMemory.get(name):decode(name);
    return {
      async get(keys){
        const names=keys===null||keys===undefined ? (volatile?[...sessionMemory.keys()]:allNames) : typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys);
        const result={};
        for(const key of names){const value=read(key);if(value!==undefined)result[key]=value;else if(keys && !Array.isArray(keys) && typeof keys==='object' && keys[key]!==undefined)result[key]=keys[key];}
        return result;
      },
      async set(object){
        const changes={};
        for(const [key,value] of Object.entries(object)){
          const oldValue=read(key);
          if(volatile)sessionMemory.set(key,value);
          else root.localStorage.setItem(prefix+key,JSON.stringify(value));
          changes[key]={oldValue,newValue:value};
        }
        notify(changes,which);
      },
      async remove(names){
        const changes={};for(const key of typeof names==='string'?[names]:names){const oldValue=read(key);if(volatile)sessionMemory.delete(key);else root.localStorage.removeItem(prefix+key);if(oldValue!==undefined)changes[key]={oldValue,newValue:undefined};}
        notify(changes,which);
      },
      async clear(){
        const names=volatile?[...sessionMemory.keys()]:allNames;
        const changes={};for(const key of names){const oldValue=read(key);if(oldValue!==undefined){changes[key]={oldValue,newValue:undefined};if(volatile)sessionMemory.delete(key);else root.localStorage.removeItem(prefix+key);}}
        notify(changes,which);
      }
    };
  }
  const local=makeStorage('local');
  const storage={local,session:makeStorage('session'),onChanged:{addListener:fn=>listeners.add(fn)}};
  async function advance(){
    // Recalculate against wall-clock time whenever app wakes or user opens it.
    // No pretend background alarms: alerts are visible only with the app open.
    const snap=await local.get(['ff_session','ff_stats']);
    let s=snap.ff_session||C.defaultSession(), stats={...C.defaultStats(),...(snap.ff_stats||{})};
    let changed=false,statsChanged=false;
    const now=Date.now();
    for(let i=0;i<32 && s.phase!=='idle' && Number.isFinite(s.endAt) && s.endAt<=now;i++){
      const endedAt=s.endAt;
      if(s.phase==='study'){
        const done=s.plan[s.index];if(!done){s=C.defaultSession();changed=true;break;}
        stats.xp+=25;stats.coins+=10;stats.minutes+=done.minutes;stats.completed+=1;
        stats.history=[{at:endedAt,subject:done.subject,minutes:done.minutes},...stats.history].slice(0,100);
        statsChanged=true;
        if(s.index>=s.plan.length-1){s=C.defaultSession();changed=true;break;}
        s={...s,phase:'break',endAt:endedAt+s.breakMinutes*60000};
      }else if(s.phase==='break'){
        const index=s.index+1;
        if(!s.plan[index]){s=C.defaultSession();changed=true;break;}
        s={...s,index,phase:'study',endAt:endedAt+s.plan[index].minutes*60000};
      }else{s=C.defaultSession();}
      changed=true;
    }
    if(statsChanged)await local.set({ff_stats:stats});
    if(changed)await local.set({ff_session:s});
  }
  async function perform(action){
    if(action.type==='PING'){await advance();return {ok:true};}
    if(action.type==='STOP'){await local.set({ff_session:C.defaultSession()});return {ok:true};}
    if(action.type==='START'){
      await advance();
      const snap=await local.get('ff_session');
      if(snap.ff_session && snap.ff_session.phase!=='idle')throw Error('Ya hay una sesión activa.');
      const plan=C.cleanPlan(action.plan);
      if(!plan.length)throw Error('Añade al menos una asignatura.');
      const breakMinutes=C.boundedInt(action.breakMinutes,1,30,5);
      const now=Date.now();
      const session={phase:'study',endAt:now+plan[0].minutes*60000,plan,index:0,breakMinutes,startedAt:now};
      await local.set({ff_session:session});return {ok:true,session};
    }
    if(action.type==='REWARD_QUIZ'){
      const snap=await local.get('ff_stats'), stats={...C.defaultStats(),...(snap.ff_stats||{})};
      const correct=C.boundedInt(action.correct,0,8,0);
      stats.xp+=correct*5;stats.coins+=correct*2;
      await local.set({ff_stats:stats});return {ok:true};
    }
    throw Error('Acción desconocida.');
  }
  const runtime={sendMessage:action=>{
    const next=queue.then(()=>perform(action));queue=next.catch(()=>{});
    return next.catch(e=>({ok:false,error:e.message}));
  }};
  const bridge={runtime,storage};
  root.ffBridge=bridge;
  if(root.document){
    const ping=()=>{void runtime.sendMessage({type:'PING'});};
    root.document.addEventListener('visibilitychange',()=>{if(!root.document.hidden)ping();});
    root.addEventListener('focus',ping);
    root.setInterval(ping,1500);
  }
  if(typeof module==='object'&&module.exports)module.exports=bridge;
})(typeof globalThis!=='undefined'?globalThis:this, FFCore);
