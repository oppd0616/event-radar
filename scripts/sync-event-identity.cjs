const fs=require('fs'),path=require('path')
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'shared/event-identity.js'))
for(const file of ['cloudfunctions/fetchEvents/lib/stable-event-identity.js','cloudfunctions/getEvents/stable-event-identity.js','miniprogram/utils/stable-event-identity.js']) {
  const target=path.join(root,file)
  if(process.argv.includes('--check')) {
    if(!fs.existsSync(target)||!fs.readFileSync(target).equals(source))throw Error('Identity module out of sync: '+file)
  } else fs.writeFileSync(target,source)
}
console.log('Identity modules synchronized')
const stages=fs.readFileSync(path.join(root,'shared/stage-resolution.js'))
for(const file of ['cloudfunctions/fetchEvents/lib/stage-resolution.js','cloudfunctions/getEvents/stage-resolution.js']) {
  const target=path.join(root,file)
  if(process.argv.includes('--check')) {
    if(!fs.existsSync(target)||!fs.readFileSync(target).equals(stages))throw Error('Stage module out of sync: '+file)
  } else fs.writeFileSync(target,stages)
}
const resolver=fs.readFileSync(path.join(root,'shared/event-ref.js'))
for(const name of ['addSubscriptionQuota','recordSignal']) {
  const file=path.join(root,'cloudfunctions',name,'event-ref.js')
  if(process.argv.includes('--check')) { if(!fs.existsSync(file)||!fs.readFileSync(file).equals(resolver))throw Error('Resolver out of sync: '+name) }
  else fs.writeFileSync(file,resolver)
}
