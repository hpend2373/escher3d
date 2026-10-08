// Shared by the immediate preview and the optimization worker.
export function spatialSpec(entries,edges) {
  const keys=entries.map(n=>n.key).sort(), index=new Map(keys.map((k,i)=>[k,i]))
  const links=edges.map(e=>[index.get(e.a),index.get(e.b)]).sort((a,b)=>a[0]-b[0]||a[1]-b[1])
  return {keys,links,signature:JSON.stringify([keys,links])}
}
function seedPositions(n,seed=0) {
  const radius=70*Math.cbrt(n), golden=Math.PI*(3-Math.sqrt(5))
  return Array.from({length:n},(_,i)=>{
    const j=seed?(i* (seed*2+1))%n:i
    const z=1-2*(j+.5)/n,r=Math.sqrt(1-z*z),angle=(i+seed*.37)*golden
    return [radius*r*Math.cos(angle),radius*r*Math.sin(angle),radius*z]
  })
}
function relax({keys,links},positions,steps,onStep) {
  const n=keys.length
    const forces=positions.map(()=>[0,0,0]), degrees=new Uint32Array(n)
    for(const [a,b] of links){degrees[a]++;degrees[b]++}
    for(let step=0;step<steps;step++) {
      for(let i=0;i<n;i++)for(let d=0;d<3;d++)forces[i][d]=-.008*positions[i][d]
      for(let i=0;i<n;i++)for(let j=i+1;j<n;j++) {
        const a=positions[i],b=positions[j],dx=a[0]-b[0],dy=a[1]-b[1],dz=a[2]-b[2]
        const factor=1700/(dx*dx+dy*dy+dz*dz+1)
        forces[i][0]+=dx*factor;forces[j][0]-=dx*factor
        forces[i][1]+=dy*factor;forces[j][1]-=dy*factor
        forces[i][2]+=dz*factor;forces[j][2]-=dz*factor
      }
      for(const [a,b] of links) {
        const dx=positions[b][0]-positions[a][0],dy=positions[b][1]-positions[a][1],dz=positions[b][2]-positions[a][2]
        const distance=Math.max(.001,Math.hypot(dx,dy,dz))
        const strength=.12/Math.sqrt(Math.min(degrees[a],degrees[b])||1)
        const factor=(distance-95)*strength/distance
        forces[a][0]+=dx*factor;forces[b][0]-=dx*factor
        forces[a][1]+=dy*factor;forces[b][1]-=dy*factor
        forces[a][2]+=dz*factor;forces[b][2]-=dz*factor
      }
      const limit=18*(1-step/steps)+.3
      for(let i=0;i<n;i++) {
        const scale=Math.min(1,limit/Math.max(.001,Math.hypot(...forces[i])))
        for(let d=0;d<3;d++)positions[i][d]+=forces[i][d]*scale
      }
      if(onStep && ((step+1)%50===0 || step===steps-1))onStep(positions,step+1)
    }
  const center=[0,1,2].map(d=>positions.reduce((sum,p)=>sum+p[d],0)/Math.max(1,n))
  return positions.map(p=>p.map((v,d)=>v-center[d]))
}
export function layoutEnergy({keys,links},p) {
  const degrees=new Uint32Array(keys.length)
  for(const [a,b] of links){degrees[a]++;degrees[b]++}
  let energy=0
  for(let i=0;i<p.length;i++) {
    energy+=.004*(p[i][0]**2+p[i][1]**2+p[i][2]**2)
    for(let j=i+1;j<p.length;j++)energy-=850*Math.log(1+p[i].reduce((sum,v,d)=>sum+(v-p[j][d])**2,0))
  }
  for(const [a,b] of links)energy+=.06/Math.sqrt(Math.min(degrees[a],degrees[b])||1)*(Math.hypot(...p[a].map((v,d)=>v-p[b][d]))-95)**2
  return energy
}
// ponytail: bounded pairwise work suits current-map graphs. Use Barnes-Hut for
// whole-model scale. Precision work runs off the main thread and is cancellable.
export function quickSpatial(spec) {
  const n=spec.keys.length,steps=Math.max(1,Math.min(220,Math.floor(24000000/Math.max(1,n*(n-1)))))
  return relax(spec,seedPositions(n),steps)
}
export function optimizeSpatial(spec,initial,onProgress=()=>{}) {
  let best=initial.map(p=>p.slice()),bestEnergy=layoutEnergy(spec,best)
  const initialEnergy=bestEnergy,n=spec.keys.length,candidates=4
  const steps=Math.max(1,Math.min(1000,Math.floor(300000000/Math.max(1,n*(n-1)*candidates))))
  let checked=0
  for(let candidate=0;candidate<candidates;candidate++) {
    const start=candidate===0?best.map(p=>p.slice()):seedPositions(n,candidate)
    relax(spec,start,steps,(p,iteration)=>{
      const energy=layoutEnergy(spec,p);checked++
      if(Number.isFinite(energy)&&energy<bestEnergy){bestEnergy=energy;best=p.map(v=>v.slice())}
      onProgress({progress:(candidate+iteration/steps)/candidates,candidate:candidate+1,candidates,initialEnergy,bestEnergy,checked})
    })
  }
  return {coordinates:best,report:{initialEnergy,bestEnergy,checked,candidates,steps}}
}
const cache=new Map()
export function getSpatial(spec) {
  if(!cache.has(spec.signature)) {
    if(cache.size>=8)cache.delete(cache.keys().next().value)
    cache.set(spec.signature,{coordinates:quickSpatial(spec),report:null})
  }
  return cache.get(spec.signature)
}
export function setSpatial(spec,value) {
  if(!value||value.coordinates?.length!==spec.keys.length||!value.coordinates.every(p=>Array.isArray(p)&&p.length===3&&p.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<1e7)))throw new Error('3D 좌표가 현재 그래프와 일치하지 않습니다.')
  if(cache.size>=8&&!cache.has(spec.signature))cache.delete(cache.keys().next().value)
  cache.set(spec.signature,{coordinates:value.coordinates.map(p=>p.slice()),report:value.report||null})
}
export function spatialCoordinates(entries,edges,depth) {
  const spec=spatialSpec(entries,edges),{coordinates}=getSpatial(spec)
  return new Map(spec.keys.map((k,i)=>[k,coordinates[i].map((v,d)=>v*(d===2?depth:1))]))
}
