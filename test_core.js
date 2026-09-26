const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('./core.js');
test('el esquema opcional mantiene jerarquía y descarta apartados incompletos',()=>{
 const outline=C.parseOutline(JSON.stringify({esquema:[{titulo:'Tema 1',puntos:['Idea principal','Ejemplo']},{titulo:'',puntos:['No válido']},{titulo:'Tema 2',puntos:['Conclusión']}]}));
 assert.equal(outline.length,2);assert.equal(outline[0].points[1],'Ejemplo');
 assert.throws(()=>C.parseOutline('{"esquema":[{"titulo":"Único","puntos":["Dato"]}]}'));
});
test('La mascota reduce necesidades con el paso de los días sin penalización severa',()=>{
 const now=100*86400000;
 assert.deepEqual(C.petNeeds({...C.defaultPet(),lastCareAt:now-2*86400000},now),{food:57,water:55,joy:59});
 assert.equal(C.petNeeds({...C.defaultPet(),food:1,lastCareAt:now-50*86400000},now).food,20);
});
test('lección valida resumen, tarjetas y guion antes de mostrarlos',()=>{
 const lesson={resumen:['Idea principal','Detalle clave'],tarjetas:[{pregunta:'¿Qué?',respuesta:'La idea'},{pregunta:'¿Cómo?',respuesta:'Con práctica'}],guion:'Una explicación para repasar la lección y escuchar después. '.repeat(3)};
 const parsed=C.parseLesson(JSON.stringify(lesson));
 assert.equal(parsed.cards.length,2);
 assert.equal(parsed.summary[0],'Idea principal');
 assert.throws(()=>C.parseLesson(JSON.stringify({...lesson,tarjetas:[]})));
});
test('valida dominios y evita credenciales/esquemas extraños',()=>{
 assert.equal(C.normalizeDomain('https://www.YouTube.com/watch?v=2'),'youtube.com');
 assert.equal(C.normalizeDomain('evil.com@youtube.com'),null);
 assert.equal(C.normalizeDomain('chrome://settings'),null);
 assert.equal(C.normalizeDomain('example.com:8080'),null);
 assert.deepEqual(C.cleanDomains(['youtube.com','https://www.youtube.com','instagram.com']),['youtube.com','instagram.com']);
});
test('plan acotado y minutos válidos',()=>{
 const plan=C.cleanPlan([{subject:'Historia',minutes:25},{subject:'Inglés',minutes:999}]);
 assert.equal(plan.length,2);assert.equal(plan[1].minutes,25);
});
test('tarjetas pasan a 1,3,7,14 días y fallo reinicia',()=>{
 const now=1_700_000_000_000;let card={successes:0};
 for(const d of [1,3,7,14]){card=C.nextReview(card,true,now);assert.equal(card.dueAt,now+d*86400000);}
 card=C.nextReview(card,false,now);assert.equal(card.successes,0);assert.equal(card.dueAt,now+86400000);
});
test('parsea JSON de exámenes y rechaza respuestas inválidas',()=>{
 const qs=Array.from({length:5},(_,i)=>({pregunta:'Q'+i,opciones:['a','b','c','d'],correcta:1,explicacion:'Porque sí'}));
 assert.equal(C.parseQuiz('```json\n'+JSON.stringify({preguntas:qs})+'\n```').length,5);
 assert.throws(()=>C.parseQuiz(JSON.stringify({preguntas:[{...qs[0],correcta:4}]})));
});
test('escapa contenido no confiable',()=>{
 assert.equal(C.escapeHTML('<script>"test"</script>'),'&lt;script&gt;&quot;test&quot;&lt;/script&gt;');
});
test('formato del reloj y sugerencia no clínica',()=>{
 assert.equal(C.formatClock(65_001),'01:06');
 assert.equal(C.chooseMethod('fórmulas de química').name,'El Manicomio');
});
test('ayudas de IA solo aceptan índices y explicaciones válidos',()=>{
 const result=C.parseMistakeHelp(JSON.stringify({ayudas:[{indice:2,explicacion:'Confundiste los signos.',practica:'Repite el ejercicio 2.'},{indice:99,explicacion:'Fuera de examen.'}],resumen:'Repasa los signos.'}),5);
 assert.equal(result.help.size,1);assert.equal(result.help.get(2).practice,'Repite el ejercicio 2.');
 assert.throws(()=>C.parseMistakeHelp('{"ayudas":[]}',5));
});
