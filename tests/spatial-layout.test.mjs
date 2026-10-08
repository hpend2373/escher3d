import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {mapGraph,explorationScene} from '../app/graph-layout.js'
import {spatialSpec,getSpatial,setSpatial,optimizeSpatial,layoutEnergy} from '../app/spatial-layout.js'

test('precision optimization never worsens the initial energy and saved coordinates round-trip exactly',()=>{
  const map=JSON.parse(readFileSync(new URL('../app/maps/map00410_backbone.json',import.meta.url)))[1]
  const original=JSON.stringify(map),graph=mapGraph(map,null)
  const spec=spatialSpec([...graph.nodes.values()],graph.edges),initial=getSpatial(spec).coordinates
  const before=JSON.stringify(initial),progress=[]
  const out=optimizeSpatial(spec,initial,p=>progress.push(p.progress))
  assert.ok(out.report.bestEnergy<out.report.initialEnergy)
  assert.equal(layoutEnergy(spec,out.coordinates),out.report.bestEnergy)
  assert.equal(progress.at(-1),1)
  assert.ok(progress.every((v,i)=>!i||v>=progress[i-1]))
  assert.equal(JSON.stringify(initial),before)
  const saved=JSON.parse(JSON.stringify(out));setSpatial(spec,saved)
  assert.deepEqual(getSpatial(spec).coordinates,out.coordinates)
  saved.coordinates[0][0]+=10
  assert.notDeepEqual(getSpatial(spec).coordinates,saved.coordinates)
  assert.throws(()=>setSpatial(spec,{coordinates:[[Infinity,0,0]]}))
  const scene=explorationScene(map,null,{layout:'spatial',scope:'all',depth:1})
  for(const node of scene.nodes)assert.deepEqual(node.point,out.coordinates[spec.keys.indexOf(node.key)])
  assert.equal(JSON.stringify(map),original)
  assert.ok(out.coordinates.flat().every(Number.isFinite))
})

test('empty and disconnected graphs remain finite',()=>{
  for(const n of [0,1,6]) {
    const spec=spatialSpec(Array.from({length:n},(_,i)=>({key:`m:${i}`})),[])
    const result=optimizeSpatial(spec,getSpatial(spec).coordinates)
    assert.ok(result.coordinates.flat().every(Number.isFinite))
    assert.ok(result.report.bestEnergy<=result.report.initialEnergy)
  }
})
