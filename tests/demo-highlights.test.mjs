import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {demoPresets,demoHighlights} from '../app/demo-highlights.js'
import {explorationScene} from '../app/graph-layout.js'

for(const [name,preset] of Object.entries(demoPresets))test(`demo targets exist and render in ${name}`,()=>{
  const data=JSON.parse(readFileSync(new URL(`../examples/${name}.json`,import.meta.url)))
  const map={...data[0],...data[1]},before=JSON.stringify(map)
  const demo=demoHighlights(map)
  assert.equal(demo.reactions.size,preset.reactions.length+(preset.yellowReactions?.length||0))
  assert.deepEqual(new Set(demo.colors.keys()),demo.reactions)
  assert.deepEqual(new Set(demo.colors.values()),new Set(['#ff3020','#287dff',...(preset.yellowReactions?['#ffe229']:[])]))
  assert.deepEqual(new Set([...demo.nodes].map(id=>map.nodes[id].bigg_id)),new Set([...preset.metabolites,...preset.yellowMetabolites||[]]))
  assert.deepEqual(new Set([...demo.colors].filter(([,color])=>color==='#ffe229').map(([id])=>map.reactions[id].bigg_id)),new Set(preset.yellowReactions||[]))
  for(const layout of ['original','spatial']) {
    const scene=explorationScene(map,null,{layout,scope:'all'})
    assert.ok(scene.nodes.some(n=>demo.nodes.has(n.id)))
    assert.equal(new Set(scene.edges.filter(e=>demo.reactions.has(e.reactionId)).map(e=>e.reactionId)).size,preset.reactions.length+(preset.yellowReactions?.length||0))
  }
  assert.equal(JSON.stringify(map),before)
  assert.equal(demoHighlights({...map,map_name:'Unrelated map'}),null)
})
test('missing targets and inherited property names do not create highlights',()=>{
  assert.equal(demoHighlights({map_name:'toString'}),null)
  const demo=demoHighlights({map_name:'RECON1.Glycolysis TCA PPP',nodes:{},reactions:{}})
  assert.equal(demo.nodes.size,0)
  assert.equal(demo.reactions.size,0)
})
