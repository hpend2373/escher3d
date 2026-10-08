import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {mapGraph,graphView,shortestPaths,explorationScene,viewIdentity,validateView} from '../app/graph-layout.js'

function fixture() {
  const nodes=Object.fromEntries(['a_c','b_c','c_m','d_m','atp_c'].map((id,i)=>[id,{node_type:'metabolite',bigg_id:id,node_is_primary:true,x:i*50,y:i%2*80}]))
  nodes.copy={...nodes.a_c,x:400}
  const reactions={}
  for(const [id,a,b] of [['ab','a_c','b_c'],['bd','b_c','d_m'],['ac','a_c','c_m'],['cd','c_m','d_m'],['bc','b_c','c_m'],['da','d_m','a_c'],['energy','atp_c','b_c']]) {
    reactions[id]={bigg_id:id,reversibility:false,metabolites:[{bigg_id:a,coefficient:-1},{bigg_id:b,coefficient:1}],segments:{[id]:{from_node_id:a,to_node_id:b}}}
  }
  return {nodes,reactions}
}
const options={layout:'path',scope:'paths',source:'m:a_c',target:'m:d_m',hops:2,k:3,depth:1,basis:'topology',hideCurrency:false,hideZero:false,context:false,hideSecondary:false,labels:true}

test('directed loopless paths preserve alternatives and distinguish unreachable from search budget',()=>{
  const graph=mapGraph(fixture(),null), result=shortestPaths(graph.forward,'m:a_c','m:d_m',3)
  assert.equal(result.paths.length,3)
  assert.deepEqual(result.paths.map(p=>p.length),[5,5,7])
  assert.ok(result.paths.every(p=>new Set(p).size===p.length))
  assert.equal(shortestPaths(graph.forward,'m:a_c','m:atp_c',3).paths.length,0)
  assert.equal(shortestPaths(graph.forward,'m:a_c','m:d_m',3,1).truncated,true)
  const view=graphView(graph,{...options,k:2,context:true})
  assert.ok(view.edges.some(e=>e.reactionId==='da')===false,'off-path reaction nodes are not fabricated')
})

test('automatic coordinates collapse drawing copies but retain compartment IDs and never alter map',()=>{
  const map=fixture(), original=JSON.stringify(map)
  map.nodes.a_m={...map.nodes.a_c,bigg_id:'a_m'}
  map.reactions.transport={bigg_id:'transport',metabolites:[{bigg_id:'a_c',coefficient:-1},{bigg_id:'a_m',coefficient:1}],segments:{}}
  const withTransport=JSON.stringify(map)
  for(const layout of ['path','radial']) {
    const out=explorationScene(map,null,{...options,scope:'all',layout})
    assert.equal(out.nodes.filter(n=>n.bigg_id==='a_c').length,1)
    assert.notEqual(out.points.a_c[2],out.points.a_m[2])
    assert.deepEqual(out.points.copy,out.points.a_c)
    assert.ok(Object.values(out.points).flat().every(Number.isFinite))
    assert.equal(JSON.stringify(map),withTransport)
  }
  const plain=JSON.parse(original)
  assert.equal(explorationScene(plain,null,{...options,scope:'all',layout:'original'}).nodes.length,6)
  assert.ok(Object.values(explorationScene(plain,null,{...options,scope:'all',layout:'original'}).points).every(p=>p[2]===0))
})

test('flux graph honors signed values, zero, missing and reversible topology independently of visibility',()=>{
  const map=fixture();map.reactions.ab.reversibility=true
  const negative=mapGraph(map,null,{basis:'flux',rawReactionData:{ab:-2,bd:0},hideZero:true})
  assert.ok(negative.forward.get('m:b_c').has('r:ab'))
  assert.ok(!negative.forward.get('m:a_c').has('r:ab'))
  assert.ok(!negative.nodes.has('r:bd'))
  assert.ok(negative.nodes.has('r:ac'),'missing is not zero')
  assert.equal(negative.forward.get('r:ac').size,0)
  assert.equal(shortestPaths(negative.forward,'m:a_c','m:b_c').paths.length,0)
  const filtered=mapGraph(map,null,{hideCurrency:true})
  assert.ok(!filtered.nodes.has('m:atp_c'))
  const neighborhood=graphView(filtered,{scope:'neighbors',source:'m:a_c',hops:1})
  assert.ok(neighborhood.keys.has('m:b_c'));assert.ok(neighborhood.keys.has('m:d_m'),'upstream neighbors retained')
})

test('view import validates identity, settings and bounds before applying anything',()=>{
  const map=fixture(), document={format:'escher-3d-view-v1',identity:viewIdentity(map),options}
  assert.deepEqual(validateView(document,map),options)
  assert.throws(()=>validateView({...document,identity:'different'},map))
  assert.throws(()=>validateView({...document,options:{...options,depth:Infinity}},map))
  assert.throws(()=>validateView({...document,options:{...options,source:'m:missing'}},map))
  assert.throws(()=>validateView({...document,options:{...options,k:10000}},map))
})

test('reversible reaction cannot connect two reactants by switching direction inside the reaction',()=>{
  const map=fixture()
  map.reactions={mixed:{bigg_id:'mixed',reversibility:true,metabolites:[{bigg_id:'a_c',coefficient:-1},{bigg_id:'b_c',coefficient:-1},{bigg_id:'d_m',coefficient:1}],segments:{}}}
  const graph=mapGraph(map,null)
  assert.equal(graphView(graph,{...options,target:'m:b_c'}).paths.length,0)
  assert.equal(graphView(graph,{...options,target:'m:d_m'}).paths.length,1)
  assert.equal(graphView(graph,{...options,source:'m:d_m',target:'m:a_c'}).paths.length,1)
  assert.equal(graphView(graph,{...options,source:'r:mixed',target:'m:a_c'}).paths.length,1)
  assert.equal(graphView(graph,{...options,target:'r:mixed'}).paths.length,1)
})

test('real map: finite layouts, stable results, bounded local view and intact original data',()=>{
  const map=JSON.parse(readFileSync(new URL('../app/maps/iMM1865.Pyrimidine and beta-Alanine metabolism (2).json',import.meta.url)))[1]
  const before=JSON.stringify(map),graph=mapGraph(map,null), source=[...graph.nodes.keys()].find(k=>k==='m:ump_c')||graph.nodes.keys().next().value
  for(const layout of ['original','compartment','path','radial','spatial']) {
    const out=explorationScene(map,null,{...options,layout,scope:'neighbors',source,hops:1,hideCurrency:true})
    assert.ok(out.nodes.length>0)
    assert.ok(Object.values(out.points).flat().every(Number.isFinite))
    assert.deepEqual(out.points,explorationScene(map,null,{...options,layout,scope:'neighbors',source,hops:1,hideCurrency:true}).points)
  }
  assert.equal(JSON.stringify(map),before)
})


test('spatial layout uses real volume within one compartment, preserves topology and restores depth',()=>{
  const map=fixture()
  for(const n of Object.values(map.nodes))n.bigg_id=n.bigg_id.replace('_m','_c')
  for(const r of Object.values(map.reactions))for(const m of r.metabolites)m.bigg_id=m.bigg_id.replace('_m','_c')
  const before=JSON.stringify(map), opts={...options,layout:'spatial',scope:'all',target:'m:d_c'}
  const scene=explorationScene(map,null,opts)
  const p=[...scene.nodes,...scene.reactionLabels].map(n=>n.point)
  assert.equal(scene.codes.length,1)
  // Covariance determinant is zero for every planar configuration, including
  // tilted planes. Nonzero per-axis extents alone would miss that regression.
  const mean=[0,1,2].map(d=>p.reduce((sum,q)=>sum+q[d],0)/p.length)
  const c=[0,1,2].map(i=>[0,1,2].map(j=>p.reduce((sum,q)=>sum+(q[i]-mean[i])*(q[j]-mean[j]),0)/p.length))
  const det=c[0][0]*(c[1][1]*c[2][2]-c[1][2]**2)-c[0][1]*(c[0][1]*c[2][2]-c[1][2]*c[0][2])+c[0][2]*(c[0][1]*c[1][2]-c[1][1]*c[0][2])
  assert.ok(det/(c[0][0]*c[1][1]*c[2][2])>.1,'layout must not collapse onto a tilted plane')
  assert.deepEqual(scene.edges.map(e=>e.key),mapGraph(map,null).edges.map(e=>e.key))
  assert.deepEqual(scene.points.copy,scene.points.a_c)
  const flat=explorationScene(map,null,{...opts,depth:0})
  assert.ok(Object.values(flat.points).every(p=>p[2]===0))
  assert.deepEqual(explorationScene(map,null,opts).points,scene.points)
  assert.equal(JSON.stringify(map),before)
  assert.equal(validateView({format:'escher-3d-view-v1',identity:viewIdentity(map),options:opts},map).layout,'spatial')
  const empty=explorationScene({nodes:{},reactions:{}},null,opts)
  assert.deepEqual(empty.points,{})
})
