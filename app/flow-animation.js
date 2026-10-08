// A trail follows its head in the signed direction and never wraps ahead of it.
export function flowParticlePhase(progress, direction, trailIndex, trailGap) {
  const phase=((progress%1)+1)%1-trailIndex*trailGap
  if(phase<0)return null
  return direction<0?1-phase:phase
}
