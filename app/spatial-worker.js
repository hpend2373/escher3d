import {optimizeSpatial} from './spatial-layout.js'
self.onmessage=({data})=>{
  try {
    const result=optimizeSpatial(data.spec,data.initial,progress=>self.postMessage({type:'progress',...progress}))
    self.postMessage({type:'done',result})
  } catch(error){self.postMessage({type:'error',message:error.message})}
}
