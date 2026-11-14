async function resolveEvent(db,id) {
  const seen=new Set()
  while(id && !seen.has(id) && seen.size<8) {
    seen.add(id)
    const result=await db.collection('events').doc(id).get().catch(()=>null)
    const event=result && result.data
    if(!event)return null
    if(event.status!=='merged')return event
    id=event.mergedInto
  }
  return null
}
module.exports={resolveEvent}
