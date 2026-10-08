import {test} from 'node:test'
import assert from 'node:assert/strict'
import {flowParticlePhase} from '../app/flow-animation.js'

test('trails stay behind the moving head in both signed directions',()=>{
  for(const direction of [1,-1]) {
    const head=flowParticlePhase(.6,direction,0,.03)
    const tail=flowParticlePhase(.6,direction,5,.03)
    assert.ok(direction*(head-tail)>0)
    assert.ok(Math.abs(Math.abs(head-tail)-.15)<1e-10)
    assert.ok(direction*(flowParticlePhase(.7,direction,0,.03)-head)>0)
  }
})
test('new heads hide trailing samples at the boundary instead of wrapping ahead',()=>{
  for(const direction of [1,-1]) {
    assert.equal(flowParticlePhase(1.01,direction,1,.03),null)
    assert.notEqual(flowParticlePhase(1.01,direction,0,.03),null)
    for(let j=0;j<8;j++) {
      const phase=flowParticlePhase(25.8,direction,j,.03)
      assert.ok(phase>=0&&phase<=1)
    }
  }
})
