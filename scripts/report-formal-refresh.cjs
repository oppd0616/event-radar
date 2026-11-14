const fs=require('fs'),path=require('path')
const dir=path.resolve(process.argv[2]),state=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'))
const verification=JSON.parse(fs.readFileSync(path.join(dir,'verification.json'),'utf8'))
const updated=state.outcomes.filter(x=>x.updated>0),pending=state.targets.filter(x=>!state.outcomes.some(y=>y.id===x.id))
const cell=x=>String(x??'').replace(/\|/g,'／').replace(/[\r\n]/g,' ')
const lines=['# 正式库翻新记录','',`报告时间：${new Date().toISOString()}`,'',
  `- 备份：${state.backup}`,
  `- 范围：备份中未结束、开始时间在未来 90 天以内（或时间缺失）的 ${state.targets.length} 条活动。不是全部历史记录。`,
  `- 已尝试核验：${state.outcomes.length}；已更新：${updated.length}；未更新：${state.outcomes.length-updated.length}；尚未处理：${pending.length}。`,
  `- 已更新中仍报告缺失字段：${updated.filter(x=>x.missing?.length).length} 条。更新不等于所有字段均已核实。`,
  `- 数据库回读：${verification.checked} 条；ID／创建时间／原日期／已验证阶段保留检查异常：${verification.issues.length} 条。该检查不证明内容事实完全正确。`,
  `- 运行状态：${state.status}${state.lastError?'；最近中断原因：'+cell(state.lastError):''}`,'',
  '## 处理原则','',
  '按原活动 ID 更新，不另建标题变体；日期变更、证据不足或已验证阶段丢失时暂缓覆盖。未更新记录保留原值，因此旧值也不能据此视为重新核实通过。备份和每次调用结果均保留。','',
  '## 分领域统计','','| 领域 | 范围 | 已核验 | 已更新 | 待处理 |','| --- | ---: | ---: | ---: | ---: |']
for(const domain of [...new Set(state.targets.map(x=>x.domain))]){
  const targets=state.targets.filter(x=>x.domain===domain),done=state.outcomes.filter(x=>x.domain===domain)
  lines.push(`| ${cell(domain)} | ${targets.length} | ${done.length} | ${done.filter(x=>x.updated>0).length} | ${targets.length-done.length} |`)
}
lines.push('','## 逐条结果','','| 活动 | 结果 | 未解决事项 |','| --- | --- | --- |')
for(const target of state.targets){
  const row=state.outcomes.find(x=>x.id===target.id)
  const reasons=row?[...new Set([...(row.updateBlocked||[]).flatMap(x=>x.reasons||[]),...(row.rejected||[]).map(x=>x.reason+(x.mismatch?':'+x.mismatch:'')),...(row.missing||[]),...(row.error?[row.error]:[])])]:[]
  lines.push(`| ${cell(target.title)} | ${row?row.updated>0?'已更新':row.obsolete?'检索判定已结束，未覆盖':row.writeBlocked?'安全拦截，未覆盖':'未更新':'待处理'} | ${cell(reasons.join('；'))} |`)
}
lines.push('','## 文件','', '`state.json`：断点、目标、逐条调用日志；`summary.json`：统计；`after.json`：已更新记录回读；`verification.json`：保留性检查。','')
fs.writeFileSync(path.join(dir,'README.md'),lines.join('\n'))
console.log(path.join(dir,'README.md'))
