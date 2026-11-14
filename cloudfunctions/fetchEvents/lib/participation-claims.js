function note(value,evidence){
 const text=String(value||'参与入口'),body=String(evidence&&evidence.description||'')
 const claims=[[/无需(?:购票|门票)|不用(?:购票|买票)|免门票|免费入场/,/无需(?:购票|门票)|不用(?:购票|买票)|免门票|免费入场/],[/无需预约|不用预约|免预约/,/无需预约|不用预约|免预约/],[/无需报名|不用报名|免报名/,/无需报名|不用报名|免报名/]]
 if(claims.some(([claim,proof])=>claim.test(text)&&!proof.test(body)))return '入场、预约及费用要求请以主办方最新公告为准。'
 return text
}
module.exports={note}
