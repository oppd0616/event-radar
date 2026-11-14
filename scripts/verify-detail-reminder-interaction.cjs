const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path')
const source=fs.readFileSync(path.resolve(__dirname,'../miniprogram/pages/detail/detail.js'),'utf8')
const method=source.slice(source.indexOf('  onRemind() {'),source.indexOf('  onShareAppMessage() {'))
let page,saves=0,failSave=false
const grants=[],toasts=[],modals=[]
const api={async addSubscriptionQuota(){saves++;if(failSave)throw Error('offline')},recordSignal:()=>Promise.resolve()}
vm.runInNewContext('page = ({'+method+'})',{set page(value){page=value},api,SUBSCRIBE_TEMPLATE_ID:'template',wx:{requestSubscribeMessage:x=>grants.push(x),showToast:x=>toasts.push(x),showModal:x=>modals.push(x)},console:{error(){}}})
page.data={event:{_id:'event',domain:'game',title:'活动'},reminding:false}
page.setData=data=>Object.assign(page.data,data)
const tick=()=>new Promise(resolve=>setImmediate(resolve))
async function main(){
 page.onRemind();page.onRemind();assert.equal(grants.length,1);assert.equal(page.data.reminding,true)
 grants[0].success({template:'reject'});assert.equal(page.data.reminding,false);assert.equal(saves,0)
 page.onRemind();grants[1].fail({errMsg:'cancel'});assert.equal(page.data.reminding,false)
 page.onRemind();grants[2].success({template:'accept'});page.onRemind();await tick()
 assert.equal(saves,1);assert.equal(grants.length,3);assert.equal(page.data.reminding,false)
 assert.equal(toasts.at(-1).title,'提醒已开启')
 failSave=true;page.onRemind();grants[3].success({template:'accept'});await tick()
 assert.equal(page.data.reminding,false);assert.equal(modals.at(-1).title,'提醒保存失败')
 console.log('PASS: reminder authorization single-flight, refusal/failure recovery, save failure and accurate success message')
}
main().catch(error=>{console.error(error);process.exitCode=1})
