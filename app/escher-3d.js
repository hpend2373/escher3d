import * as THREE from './vendor/three/three.module.min.js'
import { OrbitControls } from './vendor/three/OrbitControls.js'
import { compartments, moveNode, flowFor } from './scene-data.js'

import { explorationScene, mapGraph, viewIdentity, validateView } from './graph-layout.js'
import {spatialSpec,getSpatial,setSpatial} from './spatial-layout.js'
import {demoHighlights} from './demo-highlights.js'
import {flowParticlePhase} from './flow-animation.js'

const $ = id => document.getElementById(id)
const header = document.createElement('header')
header.id = 'e3-header'
header.innerHTML = `<div class="e3-brand">Escher<span>3D</span></div>
  <nav class="e3-tabs" aria-label="지도 보기"><button id="e3-tab-2d" aria-pressed="true">2D 편집</button><button id="e3-tab-3d" aria-pressed="false" disabled>3D 흐름</button></nav>
  <button id="e3-sidebar-toggle" aria-controls="e3-sidebar" aria-expanded="true" aria-label="왼쪽 설정창 접기" hidden>설정 접기</button>
  <span class="e3-subtitle">METABOLIC PATHWAY EXPLORER</span>`
document.body.append(header)
const panel = document.createElement('section')
panel.id = 'e3-panel'; panel.hidden = true
panel.setAttribute('aria-label', '3D 대사경로 탐색')
panel.innerHTML = `<aside id="e3-sidebar" class="e3-sidebar" aria-label="3D 보기 설정">
  <p class="e3-eyebrow">SPATIAL VIEW</p><h1>대사경로의<br>흐름을 살펴보세요</h1>
  <div id="e3-map-name" class="e3-muted"></div>
  <div class="e3-row"><button id="e3-import-map">기존 맵 JSON 불러오기</button></div><input id="e3-map-file" type="file" accept=".json,application/json" hidden>
  <div id="e3-demo-card" class="e3-demo-card"><label><input id="e3-demo-toggle" type="checkbox" checked> 시연용 강조</label><strong id="e3-demo-title"></strong><p>색이 있는 연결선·화살표와 같은 색의 이동 입자·잔상이 관심 구간을 구분합니다. 예제 2개에는 노란색 추가 구간이 있으며 나머지 요소의 불투명도는 기존의 60%입니다. 색은 시연용 구분이며 활성 증감을 뜻하지 않습니다.</p><p id="e3-demo-counts" role="status"></p></div>
  <form id="e3-search-form"><div class="e3-row"><input id="e3-search" type="search" aria-label="반응·대사체 검색" placeholder="반응·대사체 검색" autocomplete="off"><button type="submit" aria-label="검색">⌕</button></div></form>
  <div class="e3-section"><h2>지도 배치</h2>
    <label class="e3-field" for="e3-layout">배치 방식</label><select id="e3-layout"><option value="spatial" selected>공간 분산 · 3D</option><option value="original">원본 지도 · 평면</option><option value="compartment">구획별 3D</option><option value="path">경로 중심 · 단계별 3D</option><option value="radial">방사형 · 구획별 3D</option></select>
    <p id="e3-layout-note" class="e3-muted"></p>
    <div class="e3-row"><button id="e3-optimize">현재 보기 정밀 최적화</button><button id="e3-optimize-cancel" hidden>취소</button></div>
    <progress id="e3-optimize-progress" max="1" value="0" hidden aria-label="3D 배치 최적화 진행률" style="width:100%"></progress>
    <p id="e3-optimize-status" class="e3-muted" role="status">기존 맵을 열면 전체 연결을 3D로 변환하고 최적화합니다.</p>
    <label class="e3-field" for="e3-scope">탐색 범위 · 현재 지도 안에서</label><select id="e3-scope"><option value="all">전체 연결</option><option value="neighbors">관심 항목 주변</option><option value="paths">출발–도착 후보 경로</option></select>
    <label class="e3-field" for="e3-source">중심 / 출발</label><select id="e3-source"></select>
    <div id="e3-target-field"><label class="e3-field" for="e3-target">도착</label><select id="e3-target"></select></div>
    <div class="e3-row"><label class="e3-field" for="e3-hops">주변 단계<select id="e3-hops"><option value="1">1</option><option value="2" selected>2</option><option value="3">3</option></select></label><label class="e3-field" for="e3-k">경로 수<select id="e3-k"><option>1</option><option selected>3</option><option>5</option></select></label></div>
    <details class="e3-options"><summary>필터와 연결 표시</summary><label class="e3-field">공통 보조인자 제외<input id="e3-currency" type="checkbox"></label>
    <p class="e3-muted">ATP·ADP·AMP, NAD(P)(H), 물 등 제외. UMP·UTP 등 지도 주제인 뉴클레오타이드는 유지.</p>
    <label class="e3-field">0 플럭스 반응 제외<input id="e3-zero" type="checkbox"></label>
    <label class="e3-field">경로 밖 연결도 보기<input id="e3-context" type="checkbox"></label>
    </details><p id="e3-graph-note" class="e3-muted" role="status"></p>
    <div id="e3-routes" class="e3-routes"></div>
    <button id="e3-reset-view">전체 원본 배치로 복원</button>
  </div>
  <div class="e3-section"><h2>시점과 편집</h2><div class="e3-row"><button id="e3-fit">전체 보기</button><button id="e3-top">위에서 보기</button></div>
    <div class="e3-row"><button id="e3-orbit" aria-pressed="true">회전·이동</button><button id="e3-move" aria-pressed="false">노드 이동</button></div>
    <div class="e3-row"><button id="e3-undo">되돌리기</button><button id="e3-redo">다시 실행</button></div>
    <p class="e3-muted">드래그: 회전 · 우클릭: 이동<br>휠: 확대 · 노드/반응 클릭: 정보<br>반응 추가·텍스트 편집은 2D 편집에서</p>
  </div>
  <div class="e3-section"><h2>흐름 애니메이션</h2>
    <div class="e3-row"><button id="e3-play" aria-pressed="true">일시정지</button><button id="e3-spin" aria-pressed="false">자동 회전</button></div>
    <label class="e3-field" for="e3-basis">흐름 기준</label><select id="e3-basis"><option value="topology">반응식 방향</option><option value="flux">반응 데이터 = 플럭스</option></select>
    <label class="e3-field" for="e3-speed">재생 속도 <output id="e3-speed-value">1.0×</output></label><input class="e3-range" id="e3-speed" type="range" min="0.1" max="3" step="0.1" value="1">
    <p id="e3-flow-note" class="e3-muted">반응식 방향의 시각적 흐름입니다. 가역 반응은 양방향으로 표시합니다.</p>
  </div>
  <div class="e3-section"><h2>공간과 표시</h2>
    <label class="e3-field" for="e3-depth"><span id="e3-depth-label">공간 깊이</span> <output id="e3-depth-value">1.0×</output></label><input class="e3-range" id="e3-depth" type="range" min="0" max="3" step="0.1" value="1">
    <label class="e3-field">이름표<input id="e3-labels-toggle" type="checkbox" checked></label>
    <label class="e3-field">보조 대사체 숨기기<input id="e3-secondary" type="checkbox"></label>
    <div id="e3-legend" class="e3-legend"></div>
  </div>
  <div class="e3-section"><div class="e3-row"><button id="e3-png">3D PNG 저장</button><button id="e3-json">맵 JSON 저장</button></div><div class="e3-row"><button id="e3-save-view">3D 보기 저장</button><button id="e3-load-view">3D 보기 열기</button></div><input id="e3-view-file" type="file" accept=".json,application/json" hidden><a id="e3-last-export" hidden>최근 내보내기 다운로드</a><p class="e3-muted">Map · Data · View 메뉴의 기존 기능을 함께 사용할 수 있습니다.</p></div>
</aside><div id="e3-stage" class="e3-stage"><div id="e3-view-caption" class="e3-view-caption" aria-live="polite"></div><div id="e3-symbol-legend" class="e3-symbol-legend"><span><i class="e3-node-key"></i>대사체 · 구획별 색</span><span id="e3-reaction-key"><i class="e3-reaction-key"></i>반응</span><span><i class="e3-edge-key"></i>연결선</span><span><b>›</b>흐름 방향</span></div><div id="e3-demo-badge" class="e3-demo-badge" hidden>시연용 흐름 강조 · 분석 결과 아님</div><div id="e3-empty" class="e3-empty" hidden></div><div id="e3-labels" class="e3-labels"></div><aside id="e3-details" class="e3-details" hidden aria-label="선택한 항목 정보"></aside><div id="e3-message" role="status"></div></div>
<footer class="e3-footer"><span id="e3-counts">지도 준비 중</span><span id="e3-status">흐름 시각화 · 구획 깊이는 표시용 좌표</span></footer>`
document.body.append(panel)

let demoEnabled=true, demo=null
const demoColor='#ffc5e3'
let optimizer=null,optimizerSignature=''
let builder, renderer, scene, camera, controls, content, particles, particlePositions, particleOpacities, baseParticleOpacities
let sceneData, currentMap, signature = '', active = false, moving = false, selected = null
let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches
let tracks = [], picks = [], labels = [], symbols = [], arrows = [], elapsed = 0, lastTime = 0, labelTime = 0, metricTime = 0, messageTimer
let layout = 'spatial', scope = 'all', source = '', target = '', hops = 2, pathCount = 3
let hideCurrency = false, hideZero = false, context = false, choicesSignature = ''
let depth = 1, speed = 1, basis = 'topology', size = 1, drag = null, pointerStart = null
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), temp = new THREE.Vector3()
const normal = new THREE.Vector3(0, 0, 1)
const projectedA = new THREE.Vector3(), projectedB = new THREE.Vector3()
const symbolTextures = new Map()
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
const setting = (key, fallback) => { try { return builder.settings.get(key) ?? fallback } catch { return fallback } }
const rawData = () => setting('reaction_data', null)
const buttonPressed = (id, value) => $(id).setAttribute('aria-pressed', String(value))
function message(text) { $('e3-message').textContent = text; clearTimeout(messageTimer); messageTimer = setTimeout(() => { $('e3-message').textContent = '' }, 5000) }
function playState() { buttonPressed('e3-play', playing); $('e3-play').textContent = playing ? '일시정지' : '재생' }
playState()

function initRenderer() {
  if (renderer) return
  renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.setClearColor(0x0c1420, 0)
  renderer.domElement.tabIndex = 0
  renderer.domElement.setAttribute('aria-label', '3D 대사경로. 마우스로 회전하고 휠로 확대합니다. 반응·대사체 검색으로 항목을 선택할 수 있습니다.')
  $('e3-stage').prepend(renderer.domElement)
  scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight(0xd7f5ff, 0x263952, 2.3))
  const light = new THREE.DirectionalLight(0xffffff, 2.5); light.position.set(0, 1, 2); scene.add(light)
  camera = new THREE.PerspectiveCamera(42, 1, 1, 100000)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true; controls.dampingFactor = .09; controls.autoRotateSpeed = .35
  controls.addEventListener('change', () => { labelTime = 0 })
  new ResizeObserver(resize).observe($('e3-stage'))
  const canvas = renderer.domElement
  canvas.addEventListener('pointerdown', pointerDown, true)
  canvas.addEventListener('pointermove', pointerMove)
  canvas.addEventListener('pointerup', pointerUp)
  canvas.addEventListener('pointercancel', cancelDrag)
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); setView(false); message('3D 그래픽 연결이 끊겼습니다. 새로고침하면 다시 사용할 수 있습니다.') })
}

function resize() {
  if (!renderer || !active) return
  const {width, height} = $('e3-stage').getBoundingClientRect()
  renderer.setSize(Math.max(1, width), Math.max(1, height))
  camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix(); labelTime = 0
}

function disposeContent() {
  if (!content) return
  const geometries = new Set(), materials = new Set()
  content.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material) })
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
  scene.remove(content); content = null
  $('e3-labels').replaceChildren(); tracks = []; picks = []; labels = []; symbols = []; arrows = []
}

// Crisp, screen-facing symbols keep nodes and arrowheads legible while their
// positions and edges still occupy the same 3D scene. Texture cache is app-wide.
function symbol(shape, color) {
  if(!symbolTextures.has(shape)) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128
    const ctx=canvas.getContext('2d');ctx.lineJoin='round';ctx.lineCap='round'
    if(shape==='arrow') {
      ctx.beginPath();ctx.moveTo(34,18);ctx.lineTo(88,64);ctx.lineTo(34,110)
      ctx.strokeStyle='#08101d';ctx.lineWidth=27;ctx.stroke()
      ctx.strokeStyle='#ffffff';ctx.lineWidth=13;ctx.stroke()
    } else {
      ctx.beginPath()
      if(shape==='node')ctx.arc(64,64,46,0,Math.PI*2)
      else ctx.roundRect(22,22,84,84,14)
      ctx.fillStyle='#ffffff';ctx.fill();ctx.strokeStyle='#08101d';ctx.lineWidth=12;ctx.stroke()
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace
    symbolTextures.set(shape,texture)
  }
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:symbolTextures.get(shape),color,sizeAttenuation:false,depthTest:true,depthWrite:false,transparent:true,toneMapped:false}))
  sprite.renderOrder=shape==='arrow'?2:3
  return sprite
}
function updateSymbols() {
  if(!camera)return
  const height=Math.max(1,$('e3-stage').clientHeight),width=$('e3-stage').clientWidth
  const unit=2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/height
  const targetDistance=camera.position.distanceTo(controls.target)
  for(const entry of symbols) {
    // Mild perspective sizing makes front/back separation visible without
    // letting distant nodes become unreadable. Arrowheads retain a steady size.
    const cameraDepth=-temp.copy(entry.sprite.position).applyMatrix4(camera.matrixWorldInverse).z
    const perspective=layout==='spatial'?Math.max(.65,Math.min(1.4,targetDistance/Math.max(1,cameraDepth))):1
    entry.sprite.scale.setScalar(entry.pixels*unit*perspective)
  }
  let visible=0
  for(const entry of arrows) {
    projectedA.copy(entry.a).project(camera);projectedB.copy(entry.b).project(camera)
    const dx=(projectedB.x-projectedA.x)*width/2,dy=(projectedB.y-projectedA.y)*height/2
    const projectedLength=Math.hypot(dx,dy)
    // Hide compressed or end-on arrowheads; zooming in reveals them again.
    entry.sprite.visible=projectedA.z>-1&&projectedA.z<1&&projectedB.z>-1&&projectedB.z<1&&projectedLength>5
    entry.sprite.material.rotation=Math.atan2(dy,dx)+(entry.direction<0?Math.PI:0)
    entry.sprite.scale.setScalar(Math.min(entry.pixels,projectedLength*2)*unit)
    if(entry.sprite.visible)visible++
  }
  panel.dataset.visibleArrows=String(visible)
}

function colorOfNode(n) {
  const node = builder.map.nodes[n.id]
  if (builder.map.has_data_on_nodes && node.data !== null && Number.isFinite(node.data)) {
    const element = document.querySelector(`#n${CSS.escape(n.id)} .node-circle`)
    if (element) return getComputedStyle(element).fill
  }
  return (compartments[n.compartment] || compartments.unknown)[1]
}

function reactionStyle(id) {
  const reaction = builder.map.reactions[id]
  const data = builder.map.has_data_on_reactions
  const element = document.querySelector(`#r${CSS.escape(id)} .segment`)
  const css = element ? getComputedStyle(element) : null
  return { color: data && css ? css.stroke : '#557698', width: data && css ? Math.max(1, parseFloat(css.strokeWidth) / 5) : 1 }
}

function label(text, point, type, id, priority) {
  const el = document.createElement('span'); el.className = `e3-label ${type}`; el.textContent = text
  $('e3-labels').append(el); labels.push({el, point:new THREE.Vector3(...point), type, id, priority})
}

function rebuild(fit = false) {
  if (!active || !builder.map) return
  const map = builder.map
  const changedMap = currentMap !== map
  currentMap = map
  if (changedMap) { demoEnabled=true; $('e3-demo-toggle').checked=true; cancelOptimization(); layout='spatial'; scope='all'; hideCurrency=false; hideZero=false; context=false; depth=1; selected = null; source = ''; target = ''; choicesSignature = ''; $('e3-details').hidden = true }
  syncChoices()
  const preset=demoHighlights(map)
  demo=demoEnabled?preset:null
  $('e3-demo-toggle').disabled=!preset
  $('e3-demo-toggle').checked=Boolean(preset&&demoEnabled)
  $('e3-demo-title').textContent=preset?.title||'예제 4개에서 사용할 수 있습니다.'
  $('e3-demo-badge').hidden=!demo
  const hideSecondary = setting('hide_secondary_metabolites', false)
  $('e3-secondary').checked = hideSecondary
  sceneData = explorationScene(map, builder.cobra_model, {...viewOptions(), rawReactionData:rawData(), hideSecondary})
  if(optimizer && (layout!=='spatial'||spatialSpecFor(sceneData).signature!==optimizerSignature))cancelOptimization('보기 변경으로 계산을 취소했습니다.')
  updateGraphControls()
  const demoNodes=sceneData.nodes.filter(n=>demo?.nodes.has(n.id)).length
  const demoReactions=new Set(sceneData.edges.filter(e=>demo?.reactions.has(e.reactionId)).map(e=>e.reactionId)).size
  $('e3-demo-counts').textContent=demo?`현재 보기: 강조 노드 ${demoNodes}개 · 반응 ${demoReactions}개`:preset?'강조 꺼짐':'기존 맵 JSON 불러오기에서 예제 파일을 선택하세요.'
  size = Math.max(2, sceneData.span / 850)
  disposeContent(); content = new THREE.Group(); scene.add(content)
  const backgroundOpacity = demo ? .6 : 1
  const materialCache = new Map()
  const material = (color, dim = false, opacity = 1) => {
    const key = `${color}:${dim}:${opacity}`
    if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshBasicMaterial({color, transparent:true, opacity:(dim ? .18 : .85)*opacity}))
    return materialCache.get(key)
  }

  const names = setting('identifiers_on_map', 'bigg_id') === 'name'
  const hiddenLabels = setting('hide_all_labels', false)
  const related = new Set()
  if (selected?.type === 'reaction') Object.values(map.reactions[selected.id]?.segments || {}).forEach(s => { related.add(String(s.from_node_id)); related.add(String(s.to_node_id)) })
  for (const n of sceneData.nodes) {
    const isSelected = (selected?.type === 'node' && selected.id === n.id) || (sceneData.auto && n.key===source)
    const node = symbol('node', isSelected ? '#ffffff' : colorOfNode(n))
    const emphasized=demo?.nodes.has(n.id)
    node.material.opacity=emphasized||isSelected ? 1 : backgroundOpacity
    let diameter = (n.primary ? 22 : 16)*(emphasized?1.1:1)
    const nodeSource = map.nodes[n.id]
    if (map.has_data_on_nodes && Number.isFinite(nodeSource.data)) {
      const el = document.querySelector(`#n${CSS.escape(n.id)} .node-circle`)
      if (el) diameter *= Math.max(.5, Math.min(3, Number(el.getAttribute('r')) / 15))
    }
    node.position.set(...n.point); symbols.push({sprite:node,pixels:isSelected ? diameter*1.25 : diameter})
    node.userData = {type:'node', id:n.id}; content.add(node); picks.push(node)
    if (!hiddenLabels && (n.primary || isSelected || emphasized || related.has(n.id))) label((emphasized?'★ ':'')+(names ? nodeSource.name || nodeSource.bigg_id : nodeSource.bigg_id), n.point, emphasized?'node demo':'node', n.id, isSelected ? 0 : emphasized ? 1 : related.has(n.id) ? 2 : 3)
  }
  const styles = new Map()
  for (const edge of sceneData.edges) {
    if (!styles.has(edge.reactionId)) styles.set(edge.reactionId, reactionStyle(edge.reactionId))
    const style = styles.get(edge.reactionId)
    const highlight = selected?.type === 'reaction' && selected.id === edge.reactionId
    const emphasized=demo?.reactions.has(edge.reactionId)
    const demoColor=demo?.colors.get(edge.reactionId)
    const curve = new THREE.CubicBezierCurve3(...[edge.p0, edge.p1, edge.p2, edge.p3].map(p => new THREE.Vector3(...p)))
    const length = curve.getLength()
    if (length < .01) continue
    const fluxWidth = basis === 'flux' && edge.value !== null ? .7 + Math.min(3, Math.log1p(Math.abs(edge.value))) : Math.min(style.width, 3)
    const radius = size * .6 * fluxWidth * (highlight ? 1.6 : 1)
    const edgeColor = basis === 'flux' && edge.value === null ? '#687180' : basis === 'flux' && edge.value === 0 ? '#b2bbca' : style.color
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, radius, 5, false), material(highlight ? '#eefdf8' : demoColor || edgeColor, edge.dim, emphasized||highlight ? 1 : backgroundOpacity))
    tube.userData = {type:'reaction', id:edge.reactionId}; content.add(tube); picks.push(tube)
    // Camera-facing chevrons follow the projected curve tangent, not a cone's
    // lighting or viewing angle. The signed flow still determines orientation.
    for (const direction of edge.dim ? [] : edge.directions) {
      const t = direction > 0 ? .68 : .32
      const arrow = symbol('arrow', highlight ? '#ffffff' : demoColor || '#b6d5ff')
      arrow.material.opacity=emphasized||highlight ? 1 : backgroundOpacity
      arrow.position.copy(curve.getPointAt(t)); arrow.userData=tube.userData
      content.add(arrow); picks.push(arrow)
      arrows.push({sprite:arrow,a:curve.getPointAt(Math.max(0,t-.12)),b:curve.getPointAt(Math.min(1,t+.12)),direction,pixels:15})
      tracks.push({samples:curve.getSpacedPoints(48), length, direction, emphasized, color:demoColor||'#ff4fa3', opacity:highlight ? 1 : backgroundOpacity, trailCount:emphasized?8:1, trailGap:Math.min(.035,size*3.5/length), count:Math.max(1, Math.min(3, Math.floor(length / (size * 55)))), rate:basis === 'flux' ? .35 + Math.min(3, Math.log1p(Math.abs(edge.value))) : 1, reverse:direction < 0})
    }
  }
  for (const r of sceneData.reactionLabels) {
    const emphasized=demo?.reactions.has(r.id)
    if(sceneData.auto) {
      const anchor = symbol('reaction', selected?.type==='reaction' && selected.id===r.id ? '#ffffff' : '#ffc15c')
      anchor.material.opacity=emphasized||(selected?.type==='reaction' && selected.id===r.id) ? 1 : backgroundOpacity
      anchor.position.set(...r.point); symbols.push({sprite:anchor,pixels:14})
      anchor.userData={type:'reaction',id:r.id};content.add(anchor);picks.push(anchor)
    }
    if (!hiddenLabels) label((emphasized?'★ ':'')+(names ? map.reactions[r.id].name || r.text : r.text), r.point, emphasized?'reaction demo':'reaction', r.id, selected?.type === 'reaction' && selected.id === r.id ? 0 : emphasized ? 1 : 4)
  }
  for (const text of Object.values(sceneData.auto || scope !== 'all' ? {} : map.text_labels || {})) {
    if (!hiddenLabels) label(text.text, [text.x - sceneData.center[0], sceneData.center[1] - text.y, 0], 'annotation', '', 2)
  }
  for (const entry of labels) entry.el.style.opacity=String(entry.priority<=1 ? 1 : backgroundOpacity)
  labels.sort((a,b) => a.priority - b.priority)
  const count = tracks.reduce((n,t) => n+t.count*t.trailCount, 0)
  panel.dataset.flowPaths = String(tracks.length)
  panel.dataset.particles = String(count)
  particlePositions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const pointSizes = new Float32Array(count)
  particleOpacities = new Float32Array(count)
  baseParticleOpacities = new Float32Array(count)
  let i = 0
  for (const track of tracks) {
    const c = new THREE.Color(track.color)
    for (let j=0;j<track.count;j++) for(let tail=0;tail<track.trailCount;tail++) {
      const fade=1-tail/track.trailCount
      colors.set([c.r,c.g,c.b],i*3)
      pointSizes[i]=track.emphasized?(tail===0?18:12*fade):9
      baseParticleOpacities[i]=track.emphasized?(tail===0?1:.65*fade):track.opacity
      particleOpacities[i]=baseParticleOpacities[i]
      i++
    }
  }
  const particleGeometry = new THREE.BufferGeometry()
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3).setUsage(THREE.DynamicDrawUsage))
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  particleGeometry.setAttribute('pointSize', new THREE.BufferAttribute(pointSizes, 1))
  particleGeometry.setAttribute('particleOpacity', new THREE.BufferAttribute(particleOpacities, 1).setUsage(THREE.DynamicDrawUsage))
  particles = new THREE.Points(particleGeometry, new THREE.ShaderMaterial({
    vertexColors:true, transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
    // Lift the glow to the camera-facing tube surface; centerline particles
    // otherwise disappear inside opaque reaction tubes.
    uniforms:{pixelRatio:{value:renderer.getPixelRatio()},surfaceOffset:{value:size*3.5}},
    vertexShader:'attribute float pointSize; attribute float particleOpacity; varying vec3 vColor; varying float vOpacity; uniform float pixelRatio; uniform float surfaceOffset; void main(){vColor=color; vOpacity=particleOpacity; vec4 p=modelViewMatrix*vec4(position,1.0); p.z+=surfaceOffset; gl_Position=projectionMatrix*p; gl_PointSize=pointSize*pixelRatio;}',
    fragmentShader:'varying vec3 vColor; varying float vOpacity; void main(){float d=length(gl_PointCoord-vec2(.5)); if(d>.5)discard; vec3 glow=mix(vColor,vec3(1.0),.5*(1.0-smoothstep(.05,.25,d))); gl_FragColor=vec4(glow,(1.0-smoothstep(.18,.5,d))*vOpacity);}'
  }))
  particles.frustumCulled = false; content.add(particles)
  const grid = new THREE.GridHelper(sceneData.span * 1.15, 24, '#294250', '#1a3040')
  grid.rotation.x = Math.PI / 2; grid.position.z = Math.min(0,...Object.values(sceneData.points).map(p=>p[2])) - size*20
  grid.material.transparent = true; grid.material.opacity = .35; content.add(grid)
  $('e3-reaction-key').hidden=!sceneData.auto
  $('e3-symbol-legend').title=map.has_data_on_reactions||map.has_data_on_nodes?'데이터를 불러온 항목은 기존 데이터 색상 척도를 사용합니다.':'대사체는 구획별 색, 반응은 금색, 연결선과 화살표는 청회색 계열입니다.'
  $('e3-legend').replaceChildren()
  for (const code of sceneData.codes) {
    const [name,color] = compartments[code] || [code, compartments.unknown[1]]
    const el = document.createElement('span'), dot = document.createElement('i')
    dot.className = 'e3-dot'; dot.style.color = color; dot.style.background = color
    el.append(dot, document.createTextNode(`${name} · ${code}`)); $('e3-legend').append(el)
  }
  $('e3-map-name').textContent = map.map_name || '현재 Escher 지도'
  document.title = `Escher 3D — ${map.map_name || 'Pathway Editor'}`
  $('e3-counts').textContent = `${sceneData.reactionLabels.length}/${Object.keys(map.reactions).length} 반응 · ${sceneData.nodes.length} 표시 대사체 · ${sceneData.codes.length} 구획${sceneData.skipped ? ` · 잘못된 연결 ${sceneData.skipped}개 제외` : ''}`
  const fluxCount = Object.values(map.reactions).filter(r => flowFor(r, rawData(), 'flux').value !== null).length
  $('e3-flow-note').textContent = basis === 'flux' ? `단일 조건 반응 값을 플럭스로 해석합니다. ${fluxCount}개 반응에 값이 있습니다. 음수: 역방향 · 0: 정지 · 누락/비교값: 정지. 회색: 누락 · 옅은색: 0. 선 굵기·속도는 |flux|의 로그 상대 표시입니다.` : '반응식 방향의 시각적 흐름입니다. 가역 반응은 양방향으로 표시합니다.'
  $('e3-status').textContent = `${sceneData.auto ? '자동 배치 · 원본 좌표 보존' : '원본 지도 좌표'} · ${basis === 'flux' ? '입력 플럭스 · 정상상태 흐름 표시' : '반응식 방향 · 실제 플럭스 아님'}`
  panel.dataset.layout=layout; panel.dataset.scope=scope; panel.dataset.pathCount=String(sceneData.view.paths.length); panel.dataset.nodeCount=String(sceneData.nodes.length)
  if (fit || changedMap) fitCamera()
  updateSymbols()
  signature = stateSignature(); labelTime = 0
  if(changedMap)queueMicrotask(()=>{if(currentMap===map&&active)startOptimization()})
}

function fitCamera(top = false) {
  if (!sceneData) return
  const box = new THREE.Box3().setFromPoints(Object.values(sceneData.points).map(p => new THREE.Vector3(...p)))
  if (box.isEmpty()) box.set(new THREE.Vector3(-50,-50,-50),new THREE.Vector3(50,50,50))
  const center = box.getCenter(new THREE.Vector3()), extent = box.getSize(new THREE.Vector3())
  let distance = Math.max(extent.y, extent.x / Math.max(camera.aspect,.25), 100) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov/2))) * 1.26 + extent.z
  if(layout==='spatial') {
    const halfFov=Math.min(THREE.MathUtils.degToRad(camera.fov/2),Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.aspect))
    const radius=Math.max(50,...Object.values(sceneData.points).map(p=>new THREE.Vector3(...p).distanceTo(center)))
    distance=radius/Math.sin(halfFov)*1.1
  }
  camera.near = .1; camera.far = Math.max(100000, distance * 10); camera.updateProjectionMatrix()
  controls.target.copy(center)
  camera.position.copy(center).add(new THREE.Vector3(top ? 0 : .18, top ? 0 : -.4, 1).normalize().multiplyScalar(distance))
  camera.up.set(0,1,0); controls.minDistance = size * 15; controls.maxDistance = distance * 5
  controls.update(); labelTime = 0
}

function updateLabels() {
  const width = $('e3-stage').clientWidth, height = $('e3-stage').clientHeight
  const enabled = $('e3-labels-toggle').checked, occupied = []
  for (const entry of labels) {
    temp.copy(entry.point).project(camera)
    const x = (temp.x + 1) * width / 2 + (entry.type.startsWith('node') ? 14 : 9), y = (1 - temp.y) * height / 2 - 8
    const w = Math.min(260, entry.el.textContent.length * 6 + 8), h = 17
    let visible = enabled && temp.z > -1 && temp.z < 1 && x>0 && x+w<width && y>0 && y+h<height
    if (visible && entry.priority > 0) visible = occupied.length < 120 && !occupied.some(b => x < b[0]+b[2] && x+w > b[0] && y < b[1]+b[3] && y+h > b[1])
    entry.el.hidden = !visible
    if (visible) { entry.el.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`; occupied.push([x,y,w,h]) }
  }
}

function animate(time) {
  if (!active || document.hidden) { lastTime = 0; return }
  const dt = lastTime ? Math.min((time-lastTime)/1000,.08) : 0; lastTime = time
  if (playing) elapsed += dt * speed
  let index = 0
  for (const track of tracks) {
    const progress = elapsed * size * 22 * track.rate / track.length
    for (let j=0;j<track.count;j++) for(let tail=0;tail<track.trailCount;tail++) {
      const t=flowParticlePhase(progress+j/track.count,track.direction,tail,track.trailGap)
      particleOpacities[index]=t===null?0:baseParticleOpacities[index]
      const sample=(t??0)*48,k=Math.min(47,Math.floor(sample)),fraction=sample-k
      temp.lerpVectors(track.samples[k],track.samples[k+1],fraction)
      particlePositions[index*3]=temp.x;particlePositions[index*3+1]=temp.y;particlePositions[index*3+2]=temp.z
      index++
    }
  }
  if (particles) {
    particles.geometry.attributes.position.needsUpdate=true
    particles.geometry.attributes.particleOpacity.needsUpdate=true
  }
  controls.update(dt)
  updateSymbols()
  if (time-labelTime > 90) { updateLabels(); labelTime = time }
  renderer.render(scene,camera)
  if(time-metricTime>250){panel.dataset.flowTime=elapsed.toFixed(3);metricTime=time}
}

function setView(three) {
  if (three && !builder?.map) return
  cancelDrag()
  try { if (three) initRenderer() } catch(error) {
    console.error('Escher 3D unavailable:',error)
    $('e3-tab-3d').textContent = '3D 사용 불가 (WebGL)'; $('e3-tab-3d').disabled = true
    builder.map.set_status('3D에는 WebGL2 지원 브라우저가 필요합니다. 2D 편집은 계속 사용할 수 있습니다.')
    return
  }
  $('e3-sidebar-toggle').hidden=!three
  active = three; panel.hidden = !three; document.body.classList.toggle('e3-active',three)
  document.querySelector('#root .escher-zoom-container')?.setAttribute('aria-hidden',String(three))
  buttonPressed('e3-tab-2d',!three); buttonPressed('e3-tab-3d',three)
  if (three) { resize(); rebuild(!currentMap); lastTime=0; renderer.setAnimationLoop(animate) }
  else if (renderer) renderer.setAnimationLoop(null)
}

function hit(event) {
  const rect = renderer.domElement.getBoundingClientRect()
  pointer.set((event.clientX-rect.left)/rect.width*2-1, -(event.clientY-rect.top)/rect.height*2+1)
  raycaster.setFromCamera(pointer,camera)
  return raycaster.intersectObjects(picks,false)[0]
}

function pointerDown(event) {
  if (event.button !== 0) return
  pointerStart = [event.clientX,event.clientY]
  const found = hit(event)
  if (sceneData.auto || !moving || found?.object.userData.type !== 'node') return
  event.stopImmediatePropagation(); event.preventDefault(); controls.enabled=false
  const id = found.object.userData.id, node = builder.map.nodes[id]
  const plane = new THREE.Plane(normal,-sceneData.points[id][2])
  const point = raycaster.ray.intersectPlane(plane,new THREE.Vector3())
  if (!point) { controls.enabled=true; return }
  drag = {id, map:builder.map, plane, point, x:node.x, y:node.y}
  renderer.domElement.setPointerCapture(event.pointerId)
}

function pointerMove(event) {
  if (!drag) return
  hit(event)
  const p = raycaster.ray.intersectPlane(drag.plane,new THREE.Vector3())
  if (!p) return
  const node = drag.map.nodes[drag.id]
  moveNode(drag.map, drag.id, drag.x+p.x-drag.point.x-node.x, drag.y-p.y+drag.point.y-node.y)
  // Geometry rebuild is bounded by pointer events; no source-map replacement.
  rebuild()
}

function pointerUp(event) {
  if (drag) {
    const {map,id,x,y} = drag, node=map.nodes[id], dx=node.x-x, dy=node.y-y
    drag=null; controls.enabled=true
    if (dx || dy) {
      map.draw_everything()
      map.undo_stack.push(() => { moveNode(map,id,-dx,-dy); map.draw_everything(); rebuild() }, () => { moveNode(map,id,dx,dy); map.draw_everything(); rebuild() })
      message('노드 이동을 저장했습니다. 되돌리기와 맵 JSON 저장에 반영됩니다.')
    }
    select({type:'node',id}); pointerStart=null; return
  }
  if (!pointerStart || Math.hypot(event.clientX-pointerStart[0],event.clientY-pointerStart[1])>5) return
  pointerStart=null
  const found=hit(event)
  if (found) select(found.object.userData)
  else { selected=null; $('e3-details').hidden=true; rebuild() }
}

function cancelDrag() {
  if (drag) {
    const node=drag.map.nodes[drag.id]
    moveNode(drag.map,drag.id,drag.x-node.x,drag.y-node.y)
    drag.map.draw_everything(); drag=null
    if(active) rebuild()
  }
  if(controls) controls.enabled=true
}

function select(item, focus=false) {
  selected={type:item.type,id:item.id}
  const map=builder.map, object=item.type==='node'?map.nodes[item.id]:map.reactions[item.id]
  if (!object) return
  if (item.type==='node') map.select_metabolite_with_id(item.id)
  const detail=$('e3-details'); detail.replaceChildren(); detail.hidden=false
  const close=document.createElement('button'); close.className='e3-close'; close.textContent='×'; close.setAttribute('aria-label','정보 닫기')
  close.onclick=()=>{selected=null;detail.hidden=true;rebuild()}; detail.append(close)
  const title=document.createElement('h2');title.textContent=object.bigg_id;detail.append(title)
  const paragraph=text=>{const p=document.createElement('p');p.textContent=text;detail.append(p)}
  paragraph(object.name||'')
  if (item.type==='reaction') {
    const side=sign=>(object.metabolites||[]).filter(m=>Math.sign(m.coefficient)===sign).map(m=>`${Math.abs(m.coefficient)===1?'':Math.abs(m.coefficient)+' '}${m.bigg_id}`).join(' + ')
    paragraph(`${side(-1)} ${object.reversibility?'⇌':'→'} ${side(1)}`)
    if(object.gene_reaction_rule) paragraph(`GPR: ${object.gene_reaction_rule}`)
    if(object.data_string) paragraph(`데이터: ${object.data_string}`)
    const flux=flowFor(object,rawData(),'flux').value
    if(basis==='flux') paragraph(flux===null?'단일 조건 플럭스 없음':`입력 플럭스: ${flux}`)
  } else {
    const n=sceneData.nodes.find(n=>n.id===item.id)
    paragraph(`구획: ${n?.compartment||'x'} · ${object.node_is_primary?'주 대사체':'보조 대사체'}`)
    if(object.data_string) paragraph(`데이터: ${object.data_string}`)
  }
  const actions=document.createElement('div');actions.className='e3-row'
  for(const [caption,role] of [['중심 / 출발로','source'],['도착으로','target']]) {
    const btn=document.createElement('button');btn.textContent=caption;btn.onclick=()=>{
      const key=item.type==='node'?`m:${object.bigg_id}`:`r:${item.id}`
      if(role==='source'){source=key;scope='neighbors'}else{target=key;scope='paths'}
      if(!sceneData.auto)layout='path'
      syncViewInputs();rebuild(true)
    };actions.append(btn)
  }
  detail.append(actions)
  if(focus) {
    const point=item.type==='node'?sceneData.points[item.id]:sceneData.reactionLabels.find(r=>r.id===item.id)?.point
    if(point) {const target=new THREE.Vector3(...point), offset=camera.position.clone().sub(controls.target).normalize().multiplyScalar(sceneData.span*.22); controls.target.copy(target);camera.position.copy(target).add(offset);controls.update()}
  }
  rebuild()
}

function viewOptions() {
  return {layout,scope,source,target,hops,k:pathCount,depth,basis,hideCurrency,hideZero,context,hideSecondary:setting('hide_secondary_metabolites',false),labels:$('e3-labels-toggle').checked}
}
function syncChoices() {
  const graph=mapGraph(builder.map,builder.cobra_model), key=JSON.stringify([...graph.nodes].map(([k,n])=>[k,n.bigg_id,n.name]))
  if(key===choicesSignature)return
  choicesSignature=key
  const entries=[...graph.nodes.values()].sort((a,b)=>a.type.localeCompare(b.type)||a.bigg_id.localeCompare(b.bigg_id))
  if(!graph.nodes.has(source))source=entries.find(n=>n.bigg_id==='ump_c')?.key || entries.find(n=>n.type==='node'&&n.primary)?.key || entries[0]?.key || ''
  if(!graph.nodes.has(target))target=''
  for(const id of ['e3-source','e3-target']) {
    const select=$(id);select.replaceChildren(new Option(id==='e3-source'?'중심 선택':'도착 선택',''))
    for(const n of entries)select.add(new Option(`${n.bigg_id} · ${n.type==='node'?'대사체':'반응'}${n.name?' · '+n.name:''}`,n.key))
  }
  syncViewInputs()
}
function syncViewInputs() {
  for(const [id,value] of Object.entries({'e3-layout':layout,'e3-scope':scope,'e3-source':source,'e3-target':target,'e3-hops':hops,'e3-k':pathCount,'e3-depth':depth,'e3-basis':basis}))$(id).value=String(value)
  for(const [id,value] of Object.entries({'e3-currency':hideCurrency,'e3-zero':hideZero,'e3-context':context}))$(id).checked=value
  $('e3-depth-value').textContent=`${depth.toFixed(1)}×`
}
function updateGraphControls() {
  const auto=sceneData.auto
  if(auto)moveMode(false)
  $('e3-move').disabled=auto
  $('e3-move').title=auto?'자동 배치는 탐색용입니다. 원본 배치에서 노드를 이동하세요.':''
  $('e3-depth').disabled=layout==='original'
  $('e3-target-field').hidden=scope!=='paths'
  $('e3-hops').parentElement.hidden=scope!=='neighbors';$('e3-k').parentElement.hidden=scope!=='paths'
  $('e3-target').disabled=scope!=='paths';$('e3-k').disabled=scope!=='paths'
  $('e3-hops').disabled=scope!=='neighbors';$('e3-context').disabled=scope!=='paths'
  $('e3-zero').disabled=basis!=='flux'
  $('e3-optimize').disabled=!!optimizer||!sceneData.view.keys.size
  if(!optimizer) {
    const report=layout==='spatial'?getSpatial(spatialSpecFor()).report:null
    $('e3-optimize-status').textContent=report?.restored?'저장한 최적화 좌표를 복원했습니다.':report?`완료 · ${report.candidates}개 후보 / ${report.checked}개 중간 배치 비교. 현재 그래프의 최적 후보를 표시합니다.`:'현재 보기에서 정밀 최적화를 실행할 수 있습니다.'
  }
  $('e3-depth-label').textContent=layout==='spatial'?'공간 깊이':'구획 간격'
  $('e3-layout-note').textContent=layout==='spatial'?'연결 관계에 따라 3차원 공간에 분산합니다. 드래그로 앞뒤 연결을 확인하세요. 실제 세포 위치는 아닙니다.':auto?'원본 좌표는 보존됩니다. 구획별 높이는 실제 세포 치수가 아닙니다.':layout==='original'?'기존 Escher 좌표를 평면으로 표시합니다.':'기존 Escher 좌표에 구획별 깊이를 더합니다.'
  let note=scope==='paths' ? !target?'도착 항목을 선택하세요.':sceneData.view.paths.length?`${sceneData.view.paths.length}개 후보 · 연결 단계가 짧은 순서. 표시 노드 사이의 경로 밖 연결은 옅게 표시할 수 있습니다.`:'현재 방향·필터에서 경로를 찾지 못했습니다.' : scope==='neighbors'?`중심에서 최대 ${hops}개 반응 거리 · 상·하류 연결 포함.`:'현재 지도의 연결을 모두 표시합니다. 순환·우회 연결을 유지합니다.'
  if(scope!=='all'&&!sceneData.graph.nodes.has(source))note='선택한 중심이 필터로 제외되었습니다. 중심을 바꾸거나 필터를 해제하세요.'
  if(sceneData.view.truncated)note+=' 탐색 한도 또는 반복 반응 제외로 결과가 일부일 수 있습니다.'
  if(scope==='paths')note+=' 후보 경로는 화학양론적 실행 가능성·탄소 전달을 보장하지 않습니다.'
  if(sceneData.graph.missing)note+=` 지도에 없는 반응 참여 대사체 연결 ${sceneData.graph.missing}건 제외.`
  $('e3-graph-note').textContent=note
  $('e3-empty').hidden=sceneData.nodes.length>0||sceneData.reactionLabels.length>0
  $('e3-empty').textContent=note
  const sourceName=sceneData.graph.nodes.get(source)?.bigg_id||'중심 미선택', targetName=sceneData.graph.nodes.get(target)?.bigg_id||'도착 미선택'
  $('e3-view-caption').textContent=`${{spatial:'공간 분산 3D',original:'원본 지도',compartment:'구획별 3D',path:'경로 중심 3D',radial:'방사형 3D'}[layout]} · ${scope==='paths'?`${sourceName} → ${targetName}`:scope==='neighbors'?`${sourceName} 주변 ${hops}단계`:'현재 지도 전체'}`
  $('e3-routes').replaceChildren()
  sceneData.view.paths.forEach((path,i)=>{
    const details=document.createElement('details'),summary=document.createElement('summary'),p=document.createElement('p')
    summary.textContent=`경로 ${i+1} · ${path.filter(k=>k.startsWith('r:')).length}개 반응`
    p.textContent=path.map(k=>sceneData.graph.nodes.get(k).bigg_id).join(' → ')
    details.append(summary,p);$('e3-routes').append(details)
  })
}
for(const id of ['e3-layout','e3-scope','e3-source','e3-target','e3-hops','e3-k','e3-currency','e3-zero','e3-context'])$(id).onchange=()=>{
  const wasAuto=['path','radial','spatial'].includes(layout)
  layout=$('e3-layout').value;scope=$('e3-scope').value;source=$('e3-source').value;target=$('e3-target').value
  hops=Number($('e3-hops').value);pathCount=Number($('e3-k').value)
  hideCurrency=$('e3-currency').checked;hideZero=$('e3-zero').checked;context=$('e3-context').checked
  if(id==='e3-layout'&&!wasAuto&&['path','radial'].includes(layout)&&scope==='all')scope='neighbors'
  syncViewInputs();rebuild(true)
}
$('e3-reset-view').onclick=()=>{layout='original';scope='all';hideCurrency=false;hideZero=false;context=false;builder.settings.set('hide_secondary_metabolites',false);builder.map.draw_everything();syncViewInputs();rebuild(true)}
function spatialSpecFor(data=sceneData) {
  return spatialSpec([...data.view.keys].map(k=>data.graph.nodes.get(k)).filter(Boolean),data.view.edges)
}
function cancelOptimization(note) {
  optimizer?.terminate();optimizer=null;optimizerSignature=''
  $('e3-optimize-cancel').hidden=true;$('e3-optimize-progress').hidden=true
  $('e3-optimize').disabled=false
  if(note)$('e3-optimize-status').textContent=note
}
function startOptimization() {
  if(!active||!sceneData?.view.keys.size)return
  cancelOptimization()
  if(layout!=='spatial'){layout='spatial';syncViewInputs();rebuild(true)}
  const spec=spatialSpecFor(),map=builder.map
  if(spec.keys.length<2){$('e3-optimize-status').textContent='최적화할 연결이 없습니다.';return}
  try {
    const worker=new Worker(new URL('./spatial-worker.js',import.meta.url),{type:'module'})
    optimizer=worker;optimizerSignature=spec.signature
    $('e3-optimize').disabled=true;$('e3-optimize-cancel').hidden=false
    $('e3-optimize-progress').hidden=false;$('e3-optimize-progress').value=0
    $('e3-optimize-status').textContent=`${spec.keys.length}개 노드 · 4개 초기 배치 비교 중…`
    worker.onmessage=({data})=>{
      if(optimizer!==worker)return
      if(map!==builder.map||layout!=='spatial'||spatialSpecFor().signature!==spec.signature){cancelOptimization('지도 변경으로 계산을 취소했습니다.');return}
      if(data.type==='progress') {
        $('e3-optimize-progress').value=data.progress
        $('e3-optimize-status').textContent=`후보 ${data.candidate}/${data.candidates} · ${Math.round(data.progress*100)}% · 연결 길이와 밀집도 계산 중`
      } else if(data.type==='done') {
        setSpatial(spec,data.result);cancelOptimization();rebuild(true)
        const r=data.result.report
        $('e3-optimize-status').textContent=`완료 · 4개 후보 / ${r.checked}개 중간 배치 비교. ${r.bestEnergy<r.initialEnergy?'더 낮은 배치 에너지의 결과를 적용했습니다.':'현재 배치가 가장 좋아 유지했습니다.'}`
      } else if(data.type==='error')cancelOptimization(`최적화 실패: ${data.message}. 현재 배치를 유지합니다.`)
    }
    worker.onerror=()=>cancelOptimization('최적화 작업을 실행하지 못했습니다. 현재 배치를 유지합니다.')
    worker.postMessage({spec,initial:getSpatial(spec).coordinates})
  } catch(error){cancelOptimization(`최적화 실패: ${error.message}`)}
}
$('e3-optimize').onclick=startOptimization
$('e3-optimize-cancel').onclick=()=>cancelOptimization('계산을 취소했습니다. 현재 배치를 유지합니다.')
$('e3-sidebar-toggle').onclick=()=>{
  const collapsed=panel.classList.toggle('e3-sidebar-collapsed')
  $('e3-sidebar').hidden=collapsed
  $('e3-sidebar-toggle').setAttribute('aria-expanded',String(!collapsed))
  $('e3-sidebar-toggle').setAttribute('aria-label',collapsed?'왼쪽 설정창 펼치기':'왼쪽 설정창 접기')
  $('e3-sidebar-toggle').textContent=collapsed?'설정 펼치기':'설정 접기'
  requestAnimationFrame(resize)
}
$('e3-demo-toggle').onchange=event=>{demoEnabled=event.target.checked;rebuild()}
$('e3-import-map').onclick=()=>$('e3-map-file').click()
$('e3-map-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return
  let previous=null
  try {
    if(file.size>50*1024*1024)throw new Error('맵 파일은 50 MB 이하만 열 수 있습니다.')
    const data=JSON.parse(await file.text()),map=data?.[1]
    if(!Array.isArray(data)||data.length!==2||!data[0]||!map||!map.nodes||!map.reactions||!map.canvas)throw new Error('Escher 맵 JSON 형식이 아닙니다. 모델 JSON과 3D 보기 파일은 별도 형식입니다.')
    for(const n of Object.values(map.nodes))if(!n||!Number.isFinite(n.x)||!Number.isFinite(n.y)||!['metabolite','midmarker','multimarker'].includes(n.node_type))throw new Error('노드 좌표 또는 종류가 올바르지 않습니다.')
    for(const r of Object.values(map.reactions))if(!r||!Array.isArray(r.metabolites)||!r.segments||r.metabolites.some(m=>typeof m.bigg_id!=='string'||!Number.isFinite(m.coefficient)))throw new Error('반응 데이터가 올바르지 않습니다.')
    previous=builder.map.map_for_export();cancelOptimization()
    builder.load_map(data);setView(true)
    message('기존 맵을 3D로 변환했습니다. 전체 연결 배치를 최적화합니다.')
  } catch(error){if(previous){builder.load_map(previous);setView(true)}message(`맵 열기 실패: ${error.message}`)}
  event.target.value=''
}
$('e3-save-view').onclick=()=>{
  const spec=layout==='spatial'?spatialSpecFor():null
  const spatial=spec?{signature:spec.signature,coordinates:getSpatial(spec).coordinates}:null
  download(new Blob([JSON.stringify({format:'escher-3d-view-v1',identity:viewIdentity(builder.map),options:viewOptions(),positions:sceneData.points,spatial,camera:{position:camera.position.toArray(),target:controls.target.toArray()},note:'Display coordinates only. Reaction datasets are loaded separately.'},null,2)],{type:'application/json'}),`${builder.map.map_name||'escher'}-3d-view.json`)
}
$('e3-load-view').onclick=()=>$('e3-view-file').click()
$('e3-view-file').onchange=async event=>{
  const file=event.target.files[0];if(!file)return
  try {
    if(file.size>10*1024*1024)throw new Error('보기 파일은 10 MB 이하만 열 수 있습니다.')
    const document=JSON.parse(await file.text()),o=validateView(document,builder.map)
    if(document.spatial && o.layout==='spatial') {
      const preview=explorationScene(builder.map,builder.cobra_model,{...o,rawReactionData:rawData()})
      const spec=spatialSpecFor(preview)
      if(spec.signature!==document.spatial.signature)throw new Error('저장한 최적화 그래프와 현재 필터/반응 데이터가 일치하지 않습니다.')
      setSpatial(spec,{coordinates:document.spatial.coordinates,report:{restored:true}})
    }
    cancelOptimization('저장한 3D 배치를 복원했습니다.')
    ;({layout,scope,source,target,hops,depth,basis,hideCurrency,hideZero,context}=o);pathCount=o.k
    builder.settings.set('hide_secondary_metabolites',o.hideSecondary);builder.map.draw_everything();$('e3-labels-toggle').checked=o.labels
    syncViewInputs();rebuild(true)
    const valid=v=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e7)
    if(valid(document.camera?.position)&&valid(document.camera?.target)&&Math.hypot(...document.camera.position.map((v,i)=>v-document.camera.target[i]))>1){camera.position.fromArray(document.camera.position);controls.target.fromArray(document.camera.target);controls.update()}
    message('3D 보기를 복원했습니다. 반응 데이터 파일은 별도로 불러오세요.')
  } catch(error){message(`보기 열기 실패: ${error.message}`)}
  event.target.value=''
}

function stateSignature() {
  return JSON.stringify([builder.map.nodes,builder.map.reactions,builder.map.text_labels,rawData(),
    ['hide_secondary_metabolites','hide_all_labels','identifiers_on_map','reaction_styles','metabolite_styles','reaction_scale','metabolite_scale'].map(k=>setting(k,null))])
}

function download(blob,name) {
  const a=$('e3-last-export')
  if(a.href.startsWith('blob:'))URL.revokeObjectURL(a.href)
  a.href=URL.createObjectURL(blob);a.download=name;a.hidden=false;a.textContent=`다운로드: ${name}`;a.click()
  message('파일이 준비됐습니다. 자동 다운로드가 시작되지 않으면 왼쪽 다운로드 링크를 누르세요.')
}
$('e3-tab-2d').onclick=()=>setView(false)
$('e3-tab-3d').onclick=()=>setView(true)
$('e3-fit').onclick=()=>fitCamera()
$('e3-top').onclick=()=>fitCamera(true)
$('e3-play').onclick=()=>{playing=!playing;playState()}
$('e3-spin').onclick=()=>{controls.autoRotate=!controls.autoRotate;buttonPressed('e3-spin',controls.autoRotate)}
$('e3-speed').oninput=event=>{speed=Number(event.target.value);$('e3-speed-value').textContent=`${speed.toFixed(1)}×`}
$('e3-depth').oninput=event=>{depth=Number(event.target.value);$('e3-depth-value').textContent=`${depth.toFixed(1)}×`;rebuild(layout==='spatial')}
$('e3-basis').onchange=event=>{basis=event.target.value;rebuild()}
$('e3-labels-toggle').onchange=()=>{labelTime=0}
$('e3-secondary').onchange=event=>{builder.settings.set('hide_secondary_metabolites',event.target.checked);builder.map.draw_everything();rebuild()}
function moveMode(value){moving=value && !sceneData?.auto;buttonPressed('e3-move',moving);buttonPressed('e3-orbit',!moving);$('e3-stage').dataset.moving=String(moving)}
$('e3-orbit').onclick=()=>moveMode(false)
$('e3-move').onclick=()=>moveMode(true)
$('e3-undo').onclick=()=>{builder.map.undo_stack.undo();rebuild()}
$('e3-redo').onclick=()=>{builder.map.undo_stack.redo();rebuild()}
$('e3-search-form').onsubmit=event=>{
  event.preventDefault();const q=$('e3-search').value.trim().toLowerCase();if(!q)return
  const matches=[]
  for(const [id,n] of Object.entries(builder.map.nodes)) if(n.node_type==='metabolite'&&(n.bigg_id.toLowerCase().includes(q)||(n.name||'').toLowerCase().includes(q)))matches.push({type:'node',id,exact:n.bigg_id.toLowerCase()===q})
  for(const [id,r] of Object.entries(builder.map.reactions)) if(r.bigg_id.toLowerCase().includes(q)||(r.name||'').toLowerCase().includes(q)||(r.gene_reaction_rule||'').toLowerCase().includes(q))matches.push({type:'reaction',id,exact:r.bigg_id.toLowerCase()===q})
  matches.sort((a,b)=>Number(b.exact)-Number(a.exact))
  if(matches.length){const match=matches[0];
    const key=match.type==='node'?`m:${builder.map.nodes[match.id].bigg_id}`:`r:${match.id}`
    if(!sceneData.view.keys.has(key)){source=key;scope='neighbors';hideCurrency=false;hideZero=false;syncViewInputs();rebuild(true)}
    if(match.type==='node'&&!sceneData.nodes.some(n=>n.id===match.id)){builder.settings.set('hide_secondary_metabolites',false);builder.map.draw_everything();rebuild()}select(match,true);message(`${matches.length}개 일치 · ${builder.map[match.type==='node'?'nodes':'reactions'][match.id].bigg_id}`)}else message('현재 지도에 일치하는 항목이 없습니다.')
}
$('e3-json').onclick=()=>download(new Blob([JSON.stringify(builder.map.map_for_export())],{type:'application/json'}),`${builder.map.map_name||'escher'}.json`)
$('e3-png').onclick=()=>{
  updateSymbols();renderer.render(scene,camera);updateLabels()
  const out=document.createElement('canvas'), source=renderer.domElement, ratio=renderer.getPixelRatio();out.width=source.width;out.height=source.height
  const ctx=out.getContext('2d');ctx.fillStyle='#0c1420';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(source,0,0);ctx.scale(ratio,ratio)
  for(const entry of labels)if(!entry.el.hidden){temp.copy(entry.point).project(camera);ctx.font=entry.el.classList.contains('demo')?'bold 10px sans-serif':entry.type==='reaction'?'9px sans-serif':'10px sans-serif';ctx.fillStyle=entry.el.classList.contains('demo')?demoColor:entry.type==='reaction'?'#a6bbc8':'#dbe9f0';ctx.fillText(entry.el.textContent,(temp.x+1)*out.width/ratio/2+13,(1-temp.y)*out.height/ratio/2+5)}
  ctx.fillStyle='#bcd0df';ctx.font='11px sans-serif';ctx.fillText(basis==='flux'?'Escher 3D · input flux visualization':'Escher 3D · reaction direction visualization',16,out.height/ratio-16)
  if(demo){ctx.fillStyle=demoColor;ctx.font='bold 12px sans-serif';ctx.fillText('DEMO HIGHLIGHTS · illustrative only, not analysis results',16,24)}
  out.toBlob(blob=>{if(blob)download(blob,`${builder.map.map_name||'escher'}-3d.png`)},'image/png')
}
reducedMotion.addEventListener('change',event=>{if(event.matches){playing=false;if(controls)controls.autoRotate=false;buttonPressed('e3-spin',false);playState()}})
// Keep Escher keyboard shortcuts from editing the map while typing in 3D controls.
panel.addEventListener('keydown',event=>{
  if(event.target.matches('input,select,textarea'))event.stopPropagation()
  else if(event.key==='Escape'){cancelDrag();selected=null;$('e3-details').hidden=true;rebuild()}
})
document.addEventListener('visibilitychange',()=>{lastTime=0;if(renderer)renderer.setAnimationLoop(active&&!document.hidden?animate:null)})

const ready=setInterval(()=>{
  if(!window.builder?.map?.nodes)return
  clearInterval(ready);builder=window.builder
  $('e3-tab-3d').disabled=false
  builder.callback_manager.set('set_mode.escher3d',mode=>{if(active&&['build','brush','rotate','text'].includes(mode))setView(false)})
  setInterval(()=>{if(active&&!drag){try{if(currentMap!==builder.map||stateSignature()!==signature)rebuild()}catch(error){console.error('3D sync failed',error);setView(false);builder.map.set_status('3D 동기화 실패. 2D 편집에서 지도를 확인하세요.')}}},900)
  if(new URLSearchParams(location.search).get('view')!=='2d')setView(true)
},200)
