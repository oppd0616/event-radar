const fs=require('fs'),path=require('path')
const root=path.resolve(__dirname,'..')
for(const name of ['recordSignal','getEvents','fetchEvents'])fs.copyFileSync(path.join(root,'shared/interest-expansion.js'),path.join(root,'cloudfunctions',name,'interest-expansion.js'))
console.log('Interest expansion synchronized')
