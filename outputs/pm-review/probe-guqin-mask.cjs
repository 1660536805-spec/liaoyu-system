/* 加载页古琴图收边：满幅方案 + 接缝羽化的两种做法对比。
 * 用法：node outputs/pm-review/probe-guqin-mask.cjs
 */
const { chromium } = require('playwright-core')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const BASE = 'http://127.0.0.1:5400'

const BLEED = `
  #app[data-screen="loading"] > main.loading-screen {
    padding-right: 0 !important;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.08fr) !important;
    column-gap: 0 !important;
  }
  #app[data-screen="loading"] .load-topbar { grid-area: 1 / 1 / 2 / 3 !important; padding-right: 2.6rem; z-index: 3; }
  #app[data-screen="loading"] .load-hero { grid-area: 2 / 1 / 3 / 2 !important; padding-top: 0 !important; }
  #app[data-screen="loading"] .load-guqin {
    grid-area: 1 / 2 / 3 / 3 !important;
    position: relative !important;
    left: auto !important; right: auto !important; top: auto !important; bottom: auto !important;
    align-self: stretch !important; justify-self: stretch !important;
    margin: 0 !important; width: 100% !important; height: 100% !important; overflow: hidden;
  }
  #app[data-screen="loading"] .load-guqin img {
    display: block; width: 100% !important; height: 100% !important; max-width: none !important;
    object-fit: cover !important; object-position: 56% 64% !important;
  }
`

const FEATHER_LONG = `-webkit-mask-image: linear-gradient(92deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.25) 8%, rgba(0,0,0,.7) 17%, #000 30%) !important;
    mask-image: linear-gradient(92deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.25) 8%, rgba(0,0,0,.7) 17%, #000 30%) !important;`

const VARIANTS = {
  'v4-满幅+短羽化(无叠底)': `${BLEED}
    #app[data-screen="loading"] .load-guqin img { ${FEATHER_LONG} }`,
  'v6-满幅+长羽化(无叠底)': `${BLEED}
    #app[data-screen="loading"] .load-guqin img { ${FEATHER_LONG} }`,
  'v7-满幅+长羽化+叠底(解除 isolation)': `${BLEED}
    #app[data-screen="loading"] > main.loading-screen { isolation: auto !important; }
    #app[data-screen="loading"] .load-guqin img { ${FEATHER_LONG} mix-blend-mode: multiply; }`,
  'v8-满幅+长羽化+叠底+提亮': `${BLEED}
    #app[data-screen="loading"] > main.loading-screen { isolation: auto !important; }
    #app[data-screen="loading"] .load-guqin img { ${FEATHER_LONG} mix-blend-mode: multiply; filter: brightness(1.06) saturate(.94); }`,
}

;(async () => {
  const b = await chromium.launch({ executablePath: CHROME })
  for (const [name, css] of Object.entries(VARIANTS)) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
    await p.goto(BASE + '/?screen=loading', { waitUntil: 'load' })
    await p.addStyleTag({ content: css })
    await p.waitForTimeout(2600)
    const f = `/tmp/gq2-${name}.png`
    await p.screenshot({ path: f })
    console.log('→ ' + f)
    await p.close()
  }
  await b.close()
})()
