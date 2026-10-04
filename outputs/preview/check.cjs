const { chromium } = require('playwright-core')
const CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
;(async()=>{
  const b=await chromium.launch({executablePath:CHROME})
  const p=await b.newPage({viewport:{width:1280,height:1000},deviceScaleFactor:2})
  const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); p.on('pageerror',e=>errs.push('pageerror: '+e.message))
  const bad=[]; p.on('response',r=>{if(r.status()>=400)bad.push(r.status()+' '+r.url())})
  await p.goto('http://127.0.0.1:5400/outputs/preview/',{waitUntil:'networkidle'})
  await p.waitForTimeout(900)
  await p.screenshot({path:'outputs/preview/launchpad.png',fullPage:true})
  const info=await p.evaluate(()=>({
    cards:document.querySelectorAll('.card').length,
    links:[...document.querySelectorAll('.card .go')].map(a=>a.getAttribute('href')),
    imgs:[...document.images].map(i=>({src:i.getAttribute('src'),ok:i.naturalWidth>0,w:i.naturalWidth})),
  }))
  console.log('cards =',info.cards)
  console.log('links =',JSON.stringify(info.links,null,0))
  console.log('imgs  =',info.imgs.map(i=>i.src+':'+(i.ok?i.w:'BROKEN')).join(', '))
  console.log('errors=',errs.length?errs:'0'); console.log('http>=400 =',bad.length?bad:'0')
  await b.close()
})()
