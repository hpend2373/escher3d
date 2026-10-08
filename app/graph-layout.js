import {spatialCoordinates} from './spatial-layout.js'
import { compartmentOf, flowFor, prepareScene } from './scene-data.js'

// These are navigation exclusions, never deletions from the biochemical model.
// Pyrimidine nucleotides and carnosine (carn) are subjects of this map, not
// excluded cofactors. Exact BiGG base IDs keep those distinct from carnitine.
export const currencyIds = new Set('h h2o o2 co2 pi ppi atp adp amp nad nadh nadp nadph fad fadh2 coa crn acp'.split(' '))
const isCurrency = id => currencyIds.has(id.replace(/_[a-z][a-z0-9]*$/i, '').toLowerCase())
const pairKey = (a, b) => JSON.stringify([a, b])

export function mapGraph(map, model, options = {}) {
  const nodes = new Map(), edges = []
  const mappedIds = new Set(Object.values(map.nodes || {}).map(n => n.bigg_id))
  for (const [id, n] of Object.entries(map.nodes || {})) {
    if (n.node_type !== 'metabolite' || !n.bigg_id) continue
    const key = `m:${n.bigg_id}`
    if (!nodes.has(key)) nodes.set(key, {key, type:'node', id, bigg_id:n.bigg_id, name:n.name, compartment:compartmentOf(n, model), primary:!!n.node_is_primary, copies:[]})
    const entry = nodes.get(key)
    entry.copies.push(id)
    if (n.node_is_primary) { entry.primary = true; entry.id = id }
  }
  for (const [key, n] of nodes) {
    if ((options.hideCurrency && isCurrency(n.bigg_id)) || (options.hideSecondary && !n.primary)) nodes.delete(key)
  }
  let missing = 0
  for (const [id, r] of Object.entries(map.reactions || {})) {
    const flow = flowFor(r, options.rawReactionData, options.basis)
    if (options.basis === 'flux' && options.hideZero && flow.value === 0) continue
    const key = `r:${id}`, linked = []
    for (const m of r.metabolites || []) {
      const mk = `m:${m.bigg_id}`
      if (!mappedIds.has(m.bigg_id)) missing++
      if (!nodes.has(mk) || !Number.isFinite(m.coefficient) || m.coefficient === 0) continue
      linked.push({key:pairKey(key,mk), a:m.coefficient < 0 ? mk : key, b:m.coefficient < 0 ? key : mk, reactionId:id, coefficient:m.coefficient, directions:flow.directions, value:flow.value})
    }
    if (!linked.length) continue
    nodes.set(key, {key, type:'reaction', id, bigg_id:r.bigg_id, name:r.name, compartment:'reaction'})
    edges.push(...linked)
  }
  const connected = new Set(edges.flatMap(e => [e.a,e.b]))
  for (const key of nodes.keys()) if (!connected.has(key)) nodes.delete(key)
  const adjacent = new Map([...nodes.keys()].map(k => [k,new Set()]))
  const forward = new Map([...nodes.keys()].map(k => [k,new Set()]))
  const routes = new Map([...nodes.keys()].filter(k=>k.startsWith('m:')).map(k=>[k,new Set()]))
  for (const e of edges) {
    adjacent.get(e.a).add(e.b); adjacent.get(e.b).add(e.a)
    if (e.directions.includes(1)) forward.get(e.a).add(e.b)
    if (e.directions.includes(-1)) forward.get(e.b).add(e.a)
    // A reversible reaction has separate traversal states. Entering with one
    // direction cannot exit with the opposite direction via another substrate.
    for(const direction of e.directions) {
      const rk=`r:${e.reactionId}@${direction>0?'+':'-'}`
      if(!routes.has(rk))routes.set(rk,new Set())
      const a=e.a.startsWith('r:')?rk:e.a, b=e.b.startsWith('r:')?rk:e.b
      routes.get(direction>0?a:b).add(direction>0?b:a)
    }
  }
  return {nodes, edges, adjacent, forward, routes, missing}
}

export function distances(graph, root, maxDepth = Infinity) {
  if (!graph.has(root)) return new Map()
  const result = new Map([[root,0]]), queue = [root]
  for (let i=0;i<queue.length;i++) {
    const key = queue[i], d = result.get(key)
    if (d >= maxDepth) continue
    for (const next of graph.get(key) || []) if (!result.has(next)) { result.set(next,d+1); queue.push(next) }
  }
  return result
}

// Yen's loopless k-shortest paths with unit incidence-edge cost. A shared work
// budget bounds interactive latency; an exhausted search is explicitly reported.
export function shortestPaths(graph, source, target, k = 3, limit = 1000000) {
  let work = 0, truncated = false
  function bfs(start, bannedNodes = new Set(), bannedEdges = new Set()) {
    const previous = new Map([[start,null]]), queue = [start]
    if (!graph.has(start) || !graph.has(target)) return null
    for (let i=0;i<queue.length;i++) {
      const at = queue[i]
      if (at === target) { const path=[]; for(let v=at;v!==null;v=previous.get(v))path.unshift(v); return path }
      for (const next of graph.get(at) || []) {
        if (++work > limit) { truncated = true; return null }
        if (bannedNodes.has(next) || bannedEdges.has(pairKey(at,next)) || previous.has(next)) continue
        previous.set(next,at); queue.push(next)
      }
    }
    return null
  }
  const first = bfs(source), paths = first ? [first] : [], candidates = new Map()
  while (paths.length && paths.length < Math.max(1,Math.min(5,k)) && !truncated) {
    const last = paths.at(-1)
    for(let i=0;i<last.length-1;i++) {
      const prefix = last.slice(0,i+1), bannedEdges = new Set()
      for(const path of paths) if(prefix.every((n,j)=>path[j]===n) && path[i+1]) bannedEdges.add(pairKey(path[i],path[i+1]))
      const tail = bfs(last[i],new Set(prefix.slice(0,-1)),bannedEdges)
      if(tail) { const candidate=prefix.slice(0,-1).concat(tail), key=JSON.stringify(candidate); if(!paths.some(p=>JSON.stringify(p)===key))candidates.set(key,candidate) }
      if(truncated)break
    }
    if(truncated || !candidates.size)break
    const [key,path]=[...candidates].sort((a,b)=>a[1].length-b[1].length || a[0].localeCompare(b[0]))[0]
    candidates.delete(key); paths.push(path)
  }
  return {paths,truncated}
}

export function graphView(graph, options) {
  const {scope='all', source, target, hops=2, k=3, context=false} = options
  let keys = new Set(graph.nodes.keys()), paths = [], truncated = false, routeEdges = null
  if(scope === 'neighbors') keys = new Set(distances(graph.adjacent,source,hops*2).keys())
  if(scope === 'paths') {
    const variants=key=>key?.startsWith('r:')?[`${key}@+`,`${key}@-`].filter(k=>graph.routes.has(k)):[key]
    const canonical=k=>k.replace(/@[+-]$/,'')
    const found=new Map()
    for(const start of variants(source))for(const end of variants(target)) {
      const result=shortestPaths(graph.routes,start,end,k)
      truncated ||= result.truncated
      for(const path of result.paths) {
        const normal=path.map(canonical)
        // Do not present a path that revisits the same biochemical reaction.
        if(new Set(normal).size!==normal.length){truncated=true;continue}
        found.set(JSON.stringify(normal),normal)
      }
    }
    paths=[...found.values()].sort((a,b)=>a.length-b.length||JSON.stringify(a).localeCompare(JSON.stringify(b))).slice(0,k)
    keys = new Set(paths.flat()); routeEdges = new Set()
    for(const p of paths)for(let i=1;i<p.length;i++)routeEdges.add(pairKey(p[i-1],p[i]))
  }
  const edges = graph.edges.filter(e=>keys.has(e.a)&&keys.has(e.b)).map(e=>{
    const onPath = !routeEdges || (e.directions.includes(1)&&routeEdges.has(pairKey(e.a,e.b))) || (e.directions.includes(-1)&&routeEdges.has(pairKey(e.b,e.a)))
    return {...e, dim:!onPath, directions:routeEdges && onPath ? e.directions.filter(d=>routeEdges.has(d>0?pairKey(e.a,e.b):pairKey(e.b,e.a))) : e.directions}
  }).filter(e=>context||!e.dim)
  return {keys,edges,paths,truncated}
}

export function explorationScene(map, model, options = {}) {
  const graph = mapGraph(map,model,options), view = graphView(graph,options)
  const auto = ['path','radial','spatial'].includes(options.layout)
  if(!auto) {
    const base=prepareScene(map,model,{...options,depth:options.layout==='original'?0:options.depth})
    if((options.scope||'all')==='all'&&!options.hideCurrency&&!(options.hideZero&&options.basis==='flux'))return {...base,graph,view,auto}
    const reactions=new Set(view.edges.map(e=>e.reactionId)), brightReactions=new Set(view.edges.filter(e=>!e.dim).map(e=>e.reactionId))
    const shown=id=>map.nodes[id]?.node_type!=='metabolite'||view.keys.has(`m:${map.nodes[id].bigg_id}`)
    base.nodes=base.nodes.filter(n=>shown(n.id))
    base.edges=base.edges.filter(e=>reactions.has(e.reactionId)&&shown(e.a)&&shown(e.b)).map(e=>{
      const allowed=new Set(view.edges.filter(v=>v.reactionId===e.reactionId&&!v.dim).flatMap(v=>v.directions))
      const flow=flowFor(map.reactions[e.reactionId],options.rawReactionData,options.basis)
      return {...e,dim:!brightReactions.has(e.reactionId),directions:e.directions.filter((d,i)=>allowed.has(flow.directions[i]))}
    })
    base.reactionLabels=base.reactionLabels.filter(r=>reactions.has(r.id))
    const used=new Set([...base.nodes.map(n=>n.id),...base.edges.flatMap(e=>[e.a,e.b])])
    base.points=Object.fromEntries(Object.entries(base.points).filter(([id])=>used.has(id)))
    return {...base,graph,view,auto}
  }
  const entries=[...view.keys].map(k=>graph.nodes.get(k)).filter(Boolean)
  const codes=[...new Set(entries.filter(n=>n.type==='node').map(n=>n.compartment))].sort((a,b)=>a==='c'?-1:b==='c'?1:a.localeCompare(b))
  const gap=150*(options.depth??1), center=[0,0], coords=new Map(), points={}
  if(options.layout==='spatial') {
    for(const [key,point] of spatialCoordinates(entries,view.edges,options.depth??1))coords.set(key,point)
  } else {
  const levels=distances(graph.adjacent,options.source)
  const layoutForward=options.scope==='paths'?new Map([...view.keys].map(k=>[k,new Set()])):graph.forward
  if(options.scope==='paths')for(const e of view.edges.filter(e=>!e.dim)) {
    if(e.directions.includes(1))layoutForward.get(e.a).add(e.b)
    if(e.directions.includes(-1))layoutForward.get(e.b).add(e.a)
  }
  const directed=distances(layoutForward,options.source)
  const reverse=new Map([...graph.nodes.keys()].map(k=>[k,new Set()]))
  for(const [a,bs] of layoutForward)for(const b of bs)reverse.get(b).add(a)
  const upstream=distances(reverse,options.source)
  const groups=new Map()
  for(const n of entries) {
    const rank=options.layout==='radial' ? (levels.get(n.key)??Math.max(1,...levels.values())+2) : (directed.get(n.key)??(upstream.has(n.key)?-upstream.get(n.key):(levels.get(n.key)??Math.max(1,...levels.values())+2)))
    if(!groups.has(rank))groups.set(rank,[])
    groups.get(rank).push(n)
  }
  let lastRadius=0
  for(const [rank,group] of [...groups].sort((a,b)=>a[0]-b[0])) {
    group.sort((a,b)=>a.compartment.localeCompare(b.compartment)||a.bigg_id.localeCompare(b.bigg_id)||a.key.localeCompare(b.key))
    const radius=rank===0?0:Math.max(lastRadius+130,Math.abs(rank)*130,group.length*21)
    lastRadius=radius
    group.forEach((n,i)=>{
      const angle=2*Math.PI*i/group.length-Math.PI/2
      const p=options.layout==='radial'?[radius*Math.cos(angle),radius*Math.sin(angle),0]:[rank*150,((group.length-1)/2-i)*65,0]
      if(n.type==='node')p[2]=(codes.indexOf(n.compartment)-(codes.length-1)/2)*gap
      coords.set(n.key,p)
    })
  }
  for(const n of entries.filter(n=>n.type==='reaction')) {
    const metabolites=[...graph.adjacent.get(n.key)].filter(k=>coords.has(k))
    if(metabolites.length)coords.get(n.key)[2]=metabolites.reduce((sum,k)=>sum+coords.get(k)[2],0)/metabolites.length
  }
  }
  const nodes=[],reactionLabels=[]
  for(const n of entries) {
    const point=coords.get(n.key)
    if(n.type==='node') { nodes.push({...n,point}); for(const id of n.copies)points[id]=point }
    else {points[n.key]=point;reactionLabels.push({id:n.id,point,text:n.bigg_id})}
  }
  const edges=view.edges.map(e=>{
    const p0=coords.get(e.a),p3=coords.get(e.b)
    const control=t=>p0.map((v,i)=>v*(1-t)+p3[i]*t)
    return {...e,p0,p1:control(1/3),p2:control(2/3),p3}
  })
  const all=[...coords.values()], extent=i=>all.length?Math.max(...all.map(p=>p[i]))-Math.min(...all.map(p=>p[i])):100
  return {nodes,edges,reactionLabels,points,center,span:Math.max(extent(0),extent(1),extent(2),100),codes,gap,skipped:0,graph,view,auto}
}

export function viewIdentity(map) {
  // Same IDs and stoichiometry are required; edited drawing coordinates are fine.
  return JSON.stringify([Object.values(map.nodes||{}).filter(n=>n.node_type==='metabolite').map(n=>n.bigg_id).sort(),Object.entries(map.reactions||{}).map(([id,r])=>[id,r.bigg_id,r.reversibility,r.metabolites]).sort((a,b)=>a[0].localeCompare(b[0]))])
}

export function validateView(document, map) {
  if(document?.format!=='escher-3d-view-v1'||document.identity!==viewIdentity(map))throw new Error('현재 지도와 일치하는 3D 보기 파일이 아닙니다.')
  const o=document.options
  if(!o||!['original','compartment','path','radial','spatial'].includes(o.layout)||!['all','neighbors','paths'].includes(o.scope)||!['topology','flux'].includes(o.basis)||!Number.isInteger(o.hops)||o.hops<1||o.hops>3||!Number.isInteger(o.k)||o.k<1||o.k>5||!Number.isFinite(o.depth)||o.depth<0||o.depth>3)throw new Error('보기 설정 값이 올바르지 않습니다.')
  const keys=new Set([...Object.values(map.nodes||{}).map(n=>`m:${n.bigg_id}`),...Object.keys(map.reactions||{}).map(id=>`r:${id}`)])
  if(![o.source,o.target].every(k=>k===''||keys.has(k)))throw new Error('보기 파일의 시작/도착 항목이 현재 지도에 없습니다.')
  for(const key of ['hideCurrency','hideZero','context','hideSecondary','labels'])if(typeof o[key]!=='boolean')throw new Error('보기 필터 값이 올바르지 않습니다.')
  return Object.fromEntries(['layout','scope','source','target','hops','k','depth','basis','hideCurrency','hideZero','context','hideSecondary','labels'].map(k=>[k,o[k]]))
}
