// Pure Escher-to-scene adapter. Coordinates, IDs and stoichiometry stay in Escher.
export const compartments = {
  c: ['Cytosol', '#60dacb'], m: ['Mitochondria', '#ffa866'],
  n: ['Nucleus', '#a99cff'], e: ['Extracellular', '#70baff'],
  r: ['Endoplasmic reticulum', '#f59bc2'], g: ['Golgi', '#edd77c'],
  l: ['Lysosome', '#d1adff'], p: ['Peroxisome', '#a4d784'],
  x: ['Peroxisome', '#a4d784'], i: ['Inner mitochondria', '#ffcc9a'],
  unknown: ['Other', '#becbd8']
}

export function compartmentOf(node, model) {
  return model?.metabolites?.[node.bigg_id]?.compartment ||
    /_([a-z][a-z0-9]*)$/i.exec(node.bigg_id || '')?.[1] || 'unknown'
}

// Never infer a flux from gene data, fold changes, or an absolute-value color.
export function flowFor(reaction, rawReactionData, basis = 'topology') {
  if (basis !== 'flux') return {directions: reaction.reversibility ? [1, -1] : [1], value: null}
  if (!rawReactionData || Array.isArray(rawReactionData)) return {directions: [], value: null}
  let value = rawReactionData[reaction.bigg_id] ?? rawReactionData[reaction.name]
  if (Array.isArray(value)) value = value.length === 1 ? value[0] : null
  if (typeof value !== 'number' || !Number.isFinite(value)) return {directions: [], value: null}
  return {directions: value === 0 ? [] : [Math.sign(value)], value}
}

function distances(graph, sources) {
  const result = new Map(sources.map(id => [id, 0])), queue = [...sources]
  for (let i = 0; i < queue.length; i++) {
    for (const id of graph.get(queue[i]) || []) {
      if (!result.has(id)) { result.set(id, result.get(queue[i]) + 1); queue.push(id) }
    }
  }
  return result
}

export function prepareScene(map, model, options = {}) {
  const nodes = map.nodes || {}, reactions = map.reactions || {}
  const valid = Object.entries(nodes).filter(([, n]) => Number.isFinite(n.x) && Number.isFinite(n.y))
  const xs = valid.map(([, n]) => n.x), ys = valid.map(([, n]) => n.y)
  const bounds = valid.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [0, 100, 0, 100]
  const center = [(bounds[0] + bounds[1]) / 2, (bounds[2] + bounds[3]) / 2]
  const span = Math.max(bounds[1] - bounds[0], bounds[3] - bounds[2], 100)
  const codes = [...new Set(valid.filter(([, n]) => n.node_type === 'metabolite').map(([, n]) => compartmentOf(n, model)))].sort((a, b) => a === 'c' ? -1 : b === 'c' ? 1 : a.localeCompare(b))
  const gap = span * .045 * (options.depth ?? 1)
  const z = code => (codes.indexOf(code) - (codes.length - 1) / 2) * gap
  const points = {}, visible = [], edges = [], reactionLabels = []
  for (const [id, n] of valid) points[id] = [n.x - center[0], center[1] - n.y, n.node_type === 'metabolite' ? z(compartmentOf(n, model)) : 0]
  let skipped = 0
  for (const [id, reaction] of Object.entries(reactions)) {
    const segments = Object.entries(reaction.segments || {})
    const graph = new Map(), coeff = new Map((reaction.metabolites || []).map(m => [m.bigg_id, Number(m.coefficient)]))
    for (const [, s] of segments) {
      const a = String(s.from_node_id), b = String(s.to_node_id)
      if (!points[a] || !points[b]) { skipped++; continue }
      if (!graph.has(a)) graph.set(a, [])
      if (!graph.has(b)) graph.set(b, [])
      graph.get(a).push(b); graph.get(b).push(a)
    }
    const reactants = [...graph.keys()].filter(k => coeff.get(nodes[k].bigg_id) < 0)
    const products = [...graph.keys()].filter(k => coeff.get(nodes[k].bigg_id) > 0)
    const dr = distances(graph, reactants), dp = distances(graph, products)
    // Connected copies of a reaction get their own local compartment depth.
    const visited = new Set()
    for (const key of graph.keys()) {
      if (visited.has(key)) continue
      const connected = [...distances(graph, [key]).keys()]
      connected.forEach(k => visited.add(k))
      const metabolites = connected.filter(k => nodes[k].node_type === 'metabolite')
      const primary = metabolites.filter(k => nodes[k].node_is_primary)
      const pool = primary.length ? primary : metabolites
      const depth = pool.length ? pool.reduce((sum, k) => sum + points[k][2], 0) / pool.length : 0
      connected.filter(k => nodes[k].node_type !== 'metabolite').forEach(k => { points[k][2] = depth })
    }
    const flow = flowFor(reaction, options.rawReactionData, options.basis)
    let labelPoint = null
    for (const [segmentId, s] of segments) {
      const a = String(s.from_node_id), b = String(s.to_node_id)
      if (!points[a] || !points[b]) continue
      if (options.hideSecondary && [a, b].some(k => nodes[k].node_type === 'metabolite' && !nodes[k].node_is_primary)) continue
      let sign = 0
      if (nodes[a].node_type === 'metabolite' && coeff.has(nodes[a].bigg_id)) sign = -Math.sign(coeff.get(nodes[a].bigg_id))
      else if (nodes[b].node_type === 'metabolite' && coeff.has(nodes[b].bigg_id)) sign = Math.sign(coeff.get(nodes[b].bigg_id))
      else {
        const score = k => !products.length ? (dr.get(k) ?? Infinity)
          : !reactants.length ? -(dp.get(k) ?? Infinity)
            : (dr.get(k) ?? Infinity) - (dp.get(k) ?? Infinity)
        const delta = score(b) - score(a)
        if (!Number.isNaN(delta)) sign = Math.sign(delta)
      }
      const p0 = [...points[a]], p3 = [...points[b]]
      const control = (p, t) => p && Number.isFinite(p.x) && Number.isFinite(p.y)
        ? [p.x - center[0], center[1] - p.y, p0[2] * (1 - t) + p3[2] * t]
        : p0.map((v, i) => v * (1 - t) + p3[i] * t)
      edges.push({reactionId: id, segmentId, a, b, p0, p1: control(s.b1, 1 / 3), p2: control(s.b2, 2 / 3), p3, directions: flow.directions.map(d => d * sign).filter(Boolean), value: flow.value})
      if (nodes[a].node_type === 'midmarker') labelPoint = p0
      else if (!labelPoint) labelPoint = p3
    }
    if (labelPoint) reactionLabels.push({id, point: labelPoint, text: reaction.bigg_id})
  }
  for (const [id, n] of valid) {
    if (n.node_type !== 'metabolite' || (options.hideSecondary && !n.node_is_primary)) continue
    visible.push({id, point: points[id], compartment: compartmentOf(n, model), primary: !!n.node_is_primary})
  }
  return {nodes: visible, edges, reactionLabels, points, center, span, codes, gap, skipped}
}

// Keep adjacent Bézier handles and labels attached when a metabolite is dragged.
export function moveNode(map, id, dx, dy) {
  const node = map.nodes[id]
  if (!node || !Number.isFinite(dx) || !Number.isFinite(dy)) return
  node.x += dx; node.y += dy
  if (Number.isFinite(node.label_x)) node.label_x += dx
  if (Number.isFinite(node.label_y)) node.label_y += dy
  for (const reaction of Object.values(map.reactions)) {
    for (const [sid, segment] of Object.entries(reaction.segments)) {
      for (const [end, handle] of [['from_node_id', 'b1'], ['to_node_id', 'b2']]) {
        if (String(segment[end]) !== String(id) || !segment[handle]) continue
        segment[handle].x += dx; segment[handle].y += dy
        const bezier = map.beziers?.[`${sid}_${handle}`]
        if (bezier) { bezier.x += dx; bezier.y += dy }
      }
    }
  }
}
