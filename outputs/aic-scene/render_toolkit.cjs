// 渲染「弦养 · 场景创新赛道 需求调研工具包」（内部执行册）
// 用法: node outputs/aic-scene/render_toolkit.cjs <input.html> <output.pdf>
// 说明：这是内部文件，不加赛事官方页眉；页边距与 HTML 的 @page 保持一致（20/18/18/18mm）
const fs = require('fs')
const path = require('path')
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright-core'))

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FONT = "'Songti SC','STSong','SimSun',serif"

async function main() {
  const inHtml = process.argv[2]
  const outPdf = process.argv[3]
  if (!inHtml || !outPdf) { console.error('用法: node render_toolkit.cjs in.html out.pdf'); process.exit(1) }

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage()
  await page.goto('file://' + path.resolve(inHtml), { waitUntil: 'networkidle' })
  await page.emulateMedia({ media: 'print' })

  const headerTemplate = `<div style="width:100%;height:0;"></div>`
  const footerTemplate = `
  <div style="width:100%;box-sizing:border-box;padding:0 18mm;font-family:${FONT};">
    <div style="text-align:center;font-size:8.5pt;color:#666;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</div>
  </div>`

  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: { top: '20mm', bottom: '18mm', left: '18mm', right: '18mm' },
  })
  await browser.close()
  console.log('PDF ->', outPdf)
}
main().catch((e) => { console.error(e); process.exit(1) })
