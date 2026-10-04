const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = 'file:///Users/leo/WorkBuddy/疗愈/outputs/xianyang-room.html'
;(async () => {
  const b = await chromium.launch({ executablePath: CHROME, headless: true })
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message))
  p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()) })
  await p.goto(URL, { waitUntil: 'load' })
  await p.waitForTimeout(2500)
  const probe = await p.evaluate(() => {
    const stage = document.querySelector('.room-stage')
    const figs = document.querySelectorAll('.taiji svg')
    const notes = document.querySelectorAll('.note')
    return {
      stageW: stage ? +stage.getBoundingClientRect().width.toFixed(1) : null,
      stageH: stage ? +stage.getBoundingClientRect().height.toFixed(1) : null,
      figureCount: figs.length,
      noteCount: notes.length,
      sceneScale: getComputedStyle(document.querySelector('.room-scene')).getPropertyValue('--room-scale').trim(),
    }
  })
  await p.locator('.room-stage').screenshot({ path: '/Users/leo/WorkBuddy/疗愈/outputs/ui-compare/room-extract.png' })
  console.log('PROBE', JSON.stringify(probe))
  console.log('ERRORS', errs.length ? errs.join('\n') : 'none')
  await b.close()
})()
