const params = new URLSearchParams(window.location.search)
const requestedMap = params.get('map')
const mapName = requestedMap === 'merged'
  ? 'merged'
  : requestedMap === 'map00240'
    ? 'map00240'
    : 'map00410'
const mapPath = mapName === 'merged'
  ? './maps/iMM1865.Pyrimidine and beta-Alanine metabolism (2).json'
  : `./maps/${mapName}_backbone.json`

const svgNamespace = 'http://www.w3.org/2000/svg'
const localLabelStorageKey = `imm1865.local-reaction-labels.${mapName}.v1`

function loadLocalLabelPositions () {
  try {
    return JSON.parse(window.localStorage.getItem(localLabelStorageKey) || '{}')
  } catch {
    return {}
  }
}

const localLabelPositions = loadLocalLabelPositions()

function localLabelKey (reactionKey, midmarkerId) {
  return `${reactionKey}:${midmarkerId}`
}

function saveLocalLabelPosition (key, position) {
  localLabelPositions[key] = position
  try {
    window.localStorage.setItem(localLabelStorageKey, JSON.stringify(localLabelPositions))
  } catch {
    // The label remains movable for the current session when storage is blocked.
  }
}

function eventPointInParent (event, parent) {
  const matrix = parent.getScreenCTM()
  const svg = parent.ownerSVGElement
  if (!matrix || !svg) return null
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  return point.matrixTransform(matrix.inverse())
}

function attachLocalLabelDrag (clone, key) {
  if (clone.dataset.dragReady === 'true') return
  clone.dataset.dragReady = 'true'
  clone.addEventListener('mousedown', event => {
    const builder = window.builder
    if (!builder || builder.mode !== 'brush') return
    const startPointer = eventPointInParent(event, clone.parentNode)
    if (!startPointer) return
    const startPosition = clone.__localLabelPosition
    if (!startPosition) return

    event.preventDefault()
    event.stopImmediatePropagation()
    clone.classList.add('is-dragging')

    const move = moveEvent => {
      const pointer = eventPointInParent(moveEvent, clone.parentNode)
      if (!pointer) return
      moveEvent.preventDefault()
      moveEvent.stopImmediatePropagation()
      const position = {
        x: startPosition.x + pointer.x - startPointer.x,
        y: startPosition.y + pointer.y - startPointer.y
      }
      clone.__localLabelPosition = position
      clone.setAttribute('transform', `translate(${position.x},${position.y})`)
    }

    const end = endEvent => {
      endEvent.preventDefault()
      endEvent.stopImmediatePropagation()
      window.removeEventListener('mousemove', move, true)
      window.removeEventListener('mouseup', end, true)
      clone.classList.remove('is-dragging')
      saveLocalLabelPosition(key, clone.__localLabelPosition)
      if (builder.map && builder.map.set_status) {
        builder.map.set_status('Local reaction label moved')
      }
    }

    window.addEventListener('mousemove', move, true)
    window.addEventListener('mouseup', end, true)
  })
}

function reactionMidmarkers (body, reaction) {
  return [...new Set(
    Object.values(reaction.segments)
      .flatMap(segment => [segment.from_node_id, segment.to_node_id])
      .filter(nodeId => body.nodes[nodeId]?.node_type === 'midmarker')
  )]
}

function addSvgStyles (svg) {
  if (svg.querySelector('#imm1865-auxiliary-visual-style')) return
  const defs = svg.querySelector('defs') || svg.insertBefore(
    document.createElementNS(svgNamespace, 'defs'),
    svg.firstChild
  )
  const style = document.createElementNS(svgNamespace, 'style')
  style.id = 'imm1865-auxiliary-visual-style'
  style.textContent = `
    svg.escher-svg .local-reaction-label-clone {
      pointer-events: auto;
      cursor: move;
    }
    svg.escher-svg .local-reaction-label-clone.is-dragging .reaction-label {
      font-weight: 700;
    }
  `
  defs.appendChild(style)
}

function addLocalReactionLabels (body, reactionKey, reaction) {
  const reactionGroup = document.querySelector(`#r${CSS.escape(reactionKey)}`)
  if (!reactionGroup) return
  const midmarkerIds = reactionMidmarkers(body, reaction)
  if (midmarkerIds.length < 2) return

  const nativeLabelPoint = [Number(reaction.label_x), Number(reaction.label_y)]
  const nativeMarkerId = midmarkerIds.reduce((bestId, candidateId) => {
    const best = body.nodes[bestId]
    const candidate = body.nodes[candidateId]
    const bestDistance = Math.hypot(best.x - nativeLabelPoint[0], best.y - nativeLabelPoint[1])
    const candidateDistance = Math.hypot(candidate.x - nativeLabelPoint[0], candidate.y - nativeLabelPoint[1])
    return candidateDistance < bestDistance ? candidateId : bestId
  })

  for (const midmarkerId of midmarkerIds) {
    if (midmarkerId === nativeMarkerId) continue
    const cloneSelector = `.local-reaction-label-clone[data-midmarker-id="${CSS.escape(midmarkerId)}"]`
    let clone = reactionGroup.querySelector(cloneSelector)
    const marker = body.nodes[midmarkerId]
    const key = localLabelKey(reactionKey, midmarkerId)
    if (!clone) {
      clone = document.createElementNS(svgNamespace, 'g')
      // Do not give clones Escher's native reaction-label-group class. Escher
      // selects the first element with that class when attaching its label drag;
      // a clone in front of it makes both the clone and native label immovable.
      clone.classList.add('local-reaction-label-clone')
      clone.dataset.midmarkerId = midmarkerId
      const text = document.createElementNS(svgNamespace, 'text')
      text.classList.add('reaction-label', 'label')
      text.setAttribute('visibility', 'visible')
      text.textContent = reaction.bigg_id
      clone.appendChild(text)
      reactionGroup.appendChild(clone)
      attachLocalLabelDrag(clone, key)
    }
    const position = localLabelPositions[key] || {
      x: Number(marker.x) + 25,
      y: Number(marker.y) - 25
    }
    clone.__localLabelPosition = position
    clone.setAttribute('transform', `translate(${position.x},${position.y})`)
  }
}

async function initializeAuxiliaryVisuals () {
  const response = await fetch(mapPath, { cache: 'no-store' })
  if (!response.ok) return
  const map = await response.json()
  const body = map[1]

  let scheduled = false
  const apply = () => {
    scheduled = false
    const svg = document.querySelector('svg.escher-svg')
    if (!svg) return
    addSvgStyles(svg)
    for (const [reactionKey, reaction] of Object.entries(body.reactions)) {
      addLocalReactionLabels(body, reactionKey, reaction)
    }
  }
  const scheduleApply = () => {
    if (scheduled) return
    scheduled = true
    window.requestAnimationFrame(apply)
  }
  const observer = new MutationObserver(scheduleApply)
  observer.observe(document.getElementById('root'), { childList: true, subtree: true })
  scheduleApply()
}

initializeAuxiliaryVisuals().catch(error => {
  console.warn('Local reaction labels were not applied.', error)
})
