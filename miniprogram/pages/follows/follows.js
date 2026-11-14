const api = require('../../utils/api'), dayjs = require('dayjs')
const { DOMAIN_MAP, STORAGE_KEYS } = require('../../utils/constants')
function decorate(row, now) {
  const event = row.event || {}, meta = DOMAIN_MAP[event.domain] || { label:'活动',color:'#727B9E',bg:'#EEF0F7' }
  const dated=event.startTime && event.timePrecision !== 'month_range'
  const displayStart=event.openingState && event.openingState.key==='today' ? now : event.openingState && event.openingState.key==='upcoming' && event.openingState.nextDate ? Date.parse(event.openingState.nextDate+'T00:00:00+08:00') : event.startTime
  const start=dated ? dayjs(displayStart) : null,end=dated && event.endTime ? dayjs(event.endTime) : null
  const date = event.openingState ? event.openingState.text : start ? start.format('M月D日') + (end && end.format('YYYY-MM-DD') !== start.format('YYYY-MM-DD') ? ' — '+end.format('M月D日') : '') : '日期待公布'
  const location = (event.participationGuide || {}).location || event.city || '地点待公布'
  const stages = (event.stages || []).filter(s => s.timePrecision !== 'month_range').sort((a,b) => a.startTime-b.startTime)
  const upcoming = stages.find(s => s.startTime > now)
  const deadline=row.plan && row.plan.key === 'deadline' ? '参与入口于'+dayjs(row.plan.at).format('M月D日')+'截止' : ''
  const month=start ? start.format('YYYY') === dayjs(now).format('YYYY') ? start.format('M月') : start.format('YYYY年M月') : '待定'
  const today=dayjs(now).format('YYYY-MM-DD'), dateKey=start ? start.format('YYYY-MM-DD') : ''
  const dayOffset=start ? Math.floor((Number(event.startTime)+8*3600000)/86400000)-Math.floor((now+8*3600000)/86400000) : null
  const archived=row.agenda && row.agenda.key==='archive' && start
  const showStage=!row.unavailable && !archived
  const stageName=event.currentStageName || '',stageState=event.currentStageState
  const phase=showStage && stageName ? stageState==='active' ? '当前：'+stageName : stageState==='started' ? '已开始：'+stageName : !stageState ? '阶段：'+stageName : '' : ''
  const nextName=stageState==='upcoming' && stageName ? stageName : upcoming && upcoming.name!==stageName ? upcoming.name : ''
  const next=showStage && nextName ? '下一阶段：'+nextName : ''
  let status='',statusTone='quiet'
  if(!row.unavailable && !archived){
    if(deadline){
      const left=Math.floor((Number(row.plan.at)+8*3600000)/86400000)-Math.floor((now+8*3600000)/86400000)
      status=left===0 ? '参与入口今天截止' : left===1 ? '参与入口明天截止' : deadline;statusTone='deadline'
    }else if(event.openingState){status=event.openingState.text;statusTone=event.openingState.key==='today' ? 'live' : 'quiet'}
    else if(row.plan && row.plan.key==='ongoing'){status='正在进行';statusTone='live'}
    else if(dayOffset===1) status='明天开始'
    else if(dayOffset===0) status='今天开始'
    else if(row.hasUpdate) status='信息有更新'
  }
  return Object.assign({},row,{id:event._id || row.eventId,title:event.title || row.title,meta,date,location,phase,deadline,month,day:start ? start.format('DD') : '—',dateKey,isToday:dateKey===today,status,statusTone,archiveNote:archived ? (end || start).format('M月')+'已结束' : '',live:row.plan && row.plan.key === 'ongoing',next})
}
function groupRows(list) {
  const groups=[{key:'week',title:'本周'},{key:'later',title:'之后'},{key:'undated',title:'日期待定'},{key:'unavailable',title:'暂不可查看'},{key:'archive',title:'已结束收藏'}]
  return groups.map(group=>{
    const rows=list.map((row,index)=>Object.assign({},row,{listIndex:index})).filter(row=>(row.agenda && row.agenda.key || 'unavailable')===group.key)
    const buckets=[]
    rows.forEach(row=>{let bucket=row.dateKey && buckets.find(b=>b.key===row.dateKey);if(!bucket){bucket={key:row.dateKey,rows:[]};buckets.push(bucket)};bucket.rows.push(row)})
    return Object.assign({},group,{rows:buckets.reduce((all,bucket)=>all.concat(bucket.rows.map((row,index)=>Object.assign({},row,{showDate:index===0}))),[])})
  }).filter(group=>group.rows.length)
}
function summarize(list,filter,partial){
  if(filter==='ended') return '留住走过的兴趣，也留住下一次的期待。'
  const active=list.filter(row=>!row.unavailable && (!row.agenda || row.agenda.key!=='archive'))
  const deadlines=active.filter(row=>row.statusTone==='deadline').length
  const week=active.filter(row=>row.agenda && row.agenda.key==='week').length
  const prefix=partial ? '已加载的关注中，' : ''
  return deadlines ? prefix+'有 '+deadlines+' 场活动的参与入口即将截止' : week ? prefix+'本周有 '+week+' 场你关注的活动' : '留住喜欢的活动，按自己的节奏参与。'
}
Page({
  data:{filter:'all',list:[],groups:[],summary:'留住喜欢的活动，按自己的节奏参与。',loading:true,loadingMore:false,error:'',moreError:'',total:0,nextCursor:null,archiveExpanded:false},
  onShow(){ if(typeof this.getTabBar==='function' && this.getTabBar()) this.getTabBar().syncSelected(); return this.load(true,true,true) },
  onUnload(){ this.request=(this.request || 0)+1 },
  onPullDownRefresh(){ this.load(true,true).finally(() => wx.stopPullDownRefresh()) },
  onReachBottom(){ if(this.data.nextCursor !== null && !this.data.loading && !this.data.loadingMore && !this.data.moreError && !this.refreshing) this.load(false) },
  async load(reset,retain,preserveDepth){
    if(!reset && (this.refreshing || this.data.loading || this.data.loadingMore)) return
    const keepVisible=reset && retain && this.data.list.length>0
    const targetCount=keepVisible && preserveDepth ? this.data.list.length : 0
    const filter=this.data.filter
    const request = (this.request || 0)+1; this.request=request
    this.refreshing=!!reset
    this.setData(keepVisible ? {error:'',moreError:'',loadingMore:false} : reset ? {loading:true,loadingMore:false,error:'',moreError:'',summary:'留住喜欢的活动，按自己的节奏参与。',list:[],groups:[],nextCursor:null} : {loadingMore:true,moreError:''})
    try{
      let cursor=reset ? 0 : this.data.nextCursor,res
      const fetched=[],seenCursors=new Set()
      // Refresh every previously visible page before replacing the list on return.
      // An error on any page leaves the existing rows and pagination intact.
      do {
        if(seenCursors.has(cursor) || seenCursors.size>=100) throw new Error('分页异常')
        seenCursors.add(cursor)
        res=await api.getFollows({action:'list',filter,cursor})
        if(request !== this.request) return
        fetched.push(...(res.list || []).map(row=>decorate(row,res.serverTime || Date.now())))
        cursor=res.nextCursor
      } while(targetCount>fetched.length && cursor!=null)
      const list=(reset ? [] : this.data.list).concat(fetched)
      const unique=list.filter((row,index)=>list.findIndex(item=>item.id===row.id)===index)
      this.setData({list:unique,groups:groupRows(unique),summary:summarize(unique,this.data.filter,res.nextCursor != null),total:res.total || 0,nextCursor:res.nextCursor == null ? null : res.nextCursor})
    }catch(error){ if(request===this.request){ if(keepVisible) wx.showToast({title:'刷新失败，已保留当前关注',icon:'none'}); else this.setData(reset ? {error:'关注列表加载失败，请重试'} : {moreError:'加载更多失败，点击重试'}) } }
    finally{ if(request===this.request){this.refreshing=false;this.setData({loading:false,loadingMore:false})} }
  },
  onFilter(e){ const filter=e.currentTarget.dataset.filter;if(!['all','ended'].includes(filter) || filter===this.data.filter) return;this.setData({filter,archiveExpanded:false});this.load(true) },
  onArchive(){this.setData({archiveExpanded:!this.data.archiveExpanded})},
  retry(){ this.load(true) },
  retryMore(){ if(this.data.nextCursor !== null && !this.data.loading && !this.data.loadingMore) this.load(false) },
  open(e){
    const row=this.data.list[e.currentTarget.dataset.index]
    if(!row || row.unavailable) return
    if(row.event) try { wx.setStorageSync(STORAGE_KEYS.currentEvent,Object.assign({},row.event,{_cardOnly:true})) } catch(error) { /* Preview cache is optional. */ }
    wx.navigateTo({url:'/pages/detail/detail?id='+encodeURIComponent(row.id)+'&followSnapshot='+encodeURIComponent(row.snapshot || '')})
  },
  remove(e){
    const row=this.data.list[e.currentTarget.dataset.index]
    if(!row) return
    wx.showModal({title:'取消关注？',content:'活动将从关注列表移除，已开启的微信提醒不受影响。',success:async res => {
      if(!res.confirm || this.removing) return
      this.removing=true
      try{ await api.setFollow(row.id,false); await this.load(true) }
      catch(error){ wx.showToast({title:'取消失败，请重试',icon:'none'}) }
      finally{this.removing=false}
    }})
  },
  more(e){
    wx.showActionSheet({itemList:['取消关注'],success:res=>{if(res.tapIndex===0) this.remove(e)}})
  },
  explore(){ wx.switchTab({url:'/pages/home/home'}) }
})
