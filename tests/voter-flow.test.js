import test from 'node:test'
import assert from 'node:assert/strict'
import {currentPosition,toggleCandidate} from '../src/lib/voterFlow.js'
const candidates=[{id:'f1',gender:'F'},{id:'f2',gender:'F'},{id:'m1',gender:'M'}]
test('cupos impiden sobreselección sin impedir sustituir candidata',()=>{
 const slots={F:1,M:1}
 assert.deepEqual(toggleCandidate(['f1'],'f2',candidates,slots),['f1'])
 const empty=toggleCandidate(['f1'],'f1',candidates,slots)
 assert.deepEqual(toggleCandidate(empty,'f2',candidates,slots),['f2'])
 assert.deepEqual(toggleCandidate(['f1'],'m1',candidates,slots),['f1','m1'])
 assert.deepEqual(toggleCandidate([],'missing',candidates,slots),[])
})
test('ubicación solicita muestra nueva y precisa en cada llamada',async()=>{
 let times=0
 const geolocation={getCurrentPosition(success,failure,options){
  assert.equal(options.maximumAge,0);assert.equal(options.enableHighAccuracy,true)
  success({coords:{latitude:++times,longitude:5}})
 }}
 assert.equal((await currentPosition(geolocation)).lat,1)
 assert.equal((await currentPosition(geolocation)).lat,2)
})
test('GPS ausente o denegado rechaza sin coordenadas por defecto',async()=>{
 await assert.rejects(currentPosition(null),/ubicación/)
 await assert.rejects(currentPosition({getCurrentPosition(success,failure){failure(new Error('denied'))}}),/denied/)
})
