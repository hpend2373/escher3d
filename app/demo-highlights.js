// Presentation presets only: these are not measured activity or importance scores.
export const demoPresets = {
  'RECON1.Glycolysis TCA PPP': {
    title:'빨강·파랑: PFK 주변 / 노랑: TCA 진입 구간',
    reactions:['PGI','PFK','FBA'],
    metabolites:['g6p_c','f6p_c','fdp_c','g3p_c'],
    yellowReactions:['CSm','ACONTm','ICDHxm'],
    yellowMetabolites:['oaa_m','cit_m','icit_m','akg_m']
  },
  'RECON1.Tryptophan metabolism': {
    title:'빨강·파랑: 키뉴레닌 경로 / 노랑: 멜라토닌 합성 구간',
    reactions:['TRPO2','FKYNH','KYN3OX'],
    metabolites:['trp__L_c','Lfmkynr_c','Lkynr_c','hLkynr_c'],
    yellowReactions:['SRTNACT','ACSRTNMT'],
    yellowMetabolites:['srtn_c','Nacsertn_c','melatn_c']
  },
  'iJO1366.Fatty acid beta-oxidation': {
    title:'지방산 베타 산화 · 한 회전 구간',
    reactions:['ACOAD7f','ECOAH7','HACD7','ACACT7r'],
    metabolites:['pmtcoa_c','hdd2coa_c','3hhdcoa_c','3ohdcoa_c','tdcoa_c']
  },
  'iJO1366.Fatty acid biosynthesis (saturated)': {
    title:'지방산 합성 · 말로닐-CoA 공급',
    reactions:['ACCOAC','MCOATA','KAS15'],
    metabolites:['accoa_c','malcoa_c','malACP_c','actACP_c']
  }
}

export function demoHighlights(map) {
  const preset=Object.hasOwn(demoPresets,map.map_name)?demoPresets[map.map_name]:null
  if(!preset)return null
  const reactionColors=new Map(preset.reactions.map((id,index)=>[id,['#ff3020','#287dff'][index%2]]))
  for(const id of preset.yellowReactions||[])reactionColors.set(id,'#ffe229')
  const colors=new Map(Object.entries(map.reactions||{}).filter(([,r])=>reactionColors.has(r.bigg_id)).map(([id,r])=>[id,reactionColors.get(r.bigg_id)]))
  const metabolites=new Set([...preset.metabolites,...preset.yellowMetabolites||[]])
  return {
    title:preset.title,
    colors,
    reactions:new Set(colors.keys()),
    nodes:new Set(Object.entries(map.nodes||{}).filter(([,n])=>n.node_type==='metabolite'&&metabolites.has(n.bigg_id)).map(([id])=>id))
  }
}
