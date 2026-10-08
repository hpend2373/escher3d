import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {prepareScene,flowFor,moveNode} from '../app/scene-data.js'

const fixture = () => ({
  nodes: {
    a:{node_type:'metabolite',bigg_id:'a_c',x:0,y:0,label_x:5,label_y:5,node_is_primary:true},
    b:{node_type:'multimarker',x:20,y:0}, c:{node_type:'midmarker',x:40,y:0},
    d:{node_type:'metabolite',bigg_id:'d_m',x:60,y:0,node_is_primary:true},
    s:{node_type:'metabolite',bigg_id:'s_c',x:20,y:20,node_is_primary:false}
  },
  reactions:{r:{bigg_id:'R',name:'Reaction',reversibility:false,metabolites:[{bigg_id:'a_c',coefficient:-1},{bigg_id:'d_m',coefficient:1},{bigg_id:'s_c',coefficient:-1}],segments:{
    s1:{from_node_id:'b',to_node_id:'a',b1:null,b2:{x:10,y:0}},
    s2:{from_node_id:'b',to_node_id:'c',b1:null,b2:null},
    s3:{from_node_id:'c',to_node_id:'d',b1:null,b2:null},
    s4:{from_node_id:'s',to_node_id:'b',b1:null,b2:null}
  }}},beziers:{s1_b2:{x:10,y:0}}
})

test('stoichiometry controls direction even when segment endpoints are reversed',()=>{
  const map=fixture(), original=JSON.stringify(map), out=prepareScene(map,null)
  assert.deepEqual(out.edges.map(e=>e.directions),[[-1],[1],[1],[1]])
  assert.equal(JSON.stringify(map),original)
  assert.notEqual(out.points.a[2],out.points.d[2])
  assert.equal(prepareScene(map,null,{depth:0}).points.d[2],0)
  const hidden=prepareScene(map,null,{hideSecondary:true})
  assert.equal(hidden.nodes.length,2);assert.equal(hidden.edges.length,3)
})
test('flux uses signed raw values; zeros, missing, comparisons and gene data cannot fabricate flow',()=>{
  const r=fixture().reactions.r
  for(const [data,expected] of [[{R:-2},[-1]],[{R:2},[1]],[{R:0},[]],[{R:null},[]],[{},[]],[{R:[-2]},[-1]],[{R:[1,2]},[]],[[{R:1},{R:2}],[]],[{R:'2'},[]],[{R:NaN},[]]])assert.deepEqual(flowFor(r,data,'flux').directions,expected)
  r.reversibility=true
  assert.deepEqual(flowFor(r,null).directions,[1,-1])
  assert.deepEqual(flowFor(r,null,'flux').directions,[])
  const map=fixture();assert.deepEqual(prepareScene(map,null,{basis:'flux',rawReactionData:{R:-3}}).edges.map(e=>e.directions),[[1],[-1],[-1],[-1]])
})
test('node move updates label and adjacent Bézier handle, and is reversible',()=>{
  const map=fixture(), original=JSON.stringify(map)
  moveNode(map,'a',12,-4)
  assert.equal(map.nodes.a.x,12);assert.equal(map.nodes.a.label_y,1)
  assert.equal(map.reactions.r.segments.s1.b2.x,22);assert.equal(map.beziers.s1_b2.y,-4)
  moveNode(map,'a',-12,4);assert.equal(JSON.stringify(map),original)
})
test('one-sided exchange reactions orient internal marker segments',()=>{
  const map=fixture();map.reactions.r.metabolites=map.reactions.r.metabolites.filter(m=>m.coefficient<0)
  map.nodes.d.node_type='multimarker'
  assert.deepEqual(prepareScene(map,null).edges[1].directions,[1])
})
test('missing endpoints and empty maps are safe',()=>{
  const map=fixture();map.reactions.r.segments.bad={from_node_id:'missing',to_node_id:'a'}
  assert.equal(prepareScene(map,null).skipped,1)
  assert.equal(prepareScene({nodes:{},reactions:{}},null).edges.length,0)
})
test('real iMM1865 map retains every valid node and segment without changing IDs or source data',()=>{
  const json=JSON.parse(readFileSync(new URL('../app/maps/iMM1865.Pyrimidine and beta-Alanine metabolism (2).json',import.meta.url)))
  const original=JSON.stringify(json), body=json[1], out=prepareScene(body,null)
  assert.equal(out.skipped,0)
  assert.equal(out.nodes.length,Object.values(body.nodes).filter(n=>n.node_type==='metabolite').length)
  assert.equal(out.edges.length,Object.values(body.reactions).reduce((n,r)=>n+Object.keys(r.segments).length,0))
  assert.ok(out.edges.every(e=>[e.p0,e.p1,e.p2,e.p3].flat().every(Number.isFinite)))
  assert.equal(JSON.stringify(json),original)
  console.log(`Validated ${Object.keys(body.reactions).length} reactions, ${out.nodes.length} metabolite nodes, ${out.edges.length} segments.`)
})
