// One-time mechanical replacement of duplicated stage reducers with shared policy.
const fs=require('fs'),path=require('path')
for(const [file,importPath] of [['cloudfunctions/fetchEvents/index.js','./lib/stage-resolution'],['cloudfunctions/getEvents/index.js','./stage-resolution']]) {
  const target=path.resolve(__dirname,'..',file)
  let source=fs.readFileSync(target,'utf8')
  if(!source.includes("require('"+importPath+"')")) source="const stageResolution = require('"+importPath+"')\n"+source
  const replacements={
    stageConflictsFromEvents:`function stageConflictsFromEvents(left, right) {
  return stageResolution.resolve(stageCandidates(left, right)).conflicts
}`,
    mergeStageConflicts:`function mergeStageConflicts(left, right) {
  return stageResolution.mergeConflicts(
    (left && left.stageConflicts || []).concat(right && right.stageConflicts || []),
    stageResolution.resolve(stageCandidates(left, right)))
}`,
    mergeEventStages:`function mergeEventStages(left, right) {
  return stageResolution.resolve(stageCandidates(left, right)).stages.slice(0, 16)
}`
  }
  for(const [name,replacement] of Object.entries(replacements)) {
    const start=source.indexOf('function '+name+'(')
    const next=source.indexOf('\nfunction ',start+1)
    if(start<0||next<0)throw Error('Missing function boundary: '+name)
    source=source.slice(0,start)+replacement+'\n'+source.slice(next)
  }
  fs.writeFileSync(target,source)
}
