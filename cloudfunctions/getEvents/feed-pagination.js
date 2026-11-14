function paginate(list, suppliedOrder, cursor, size) {
  const byId=new Map()
  for(const event of list) byId.set(event.canonicalEventId || event._id,event)
  const valid=Array.isArray(suppliedOrder) && suppliedOrder.length<=2000 && suppliedOrder.every(id=>typeof id==='string' && id.length<=128)
  const order=valid ? [...new Set(suppliedOrder)] : [...byId.keys()]
  // Slice the original order before removing records that are no longer public.
  // New ranking scores cannot shift already viewed events into subsequent pages.
  const page=order.slice(cursor,cursor+size).map(id=>byId.get(id)).filter(Boolean)
  return {list:page,feedOrder:order,nextCursor:cursor+size<order.length ? cursor+size : null}
}
module.exports={paginate}
