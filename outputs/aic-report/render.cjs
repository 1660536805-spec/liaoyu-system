// 用本机 Chrome 渲染 A4 PDF（供 AIC 作品方案使用）
// 用法: node outputs/aic-report/render.cjs <input.html> <output.pdf>
// 页眉：左上角官方 AIC 标志 + 居中赛事名（标志以 base64 内嵌，保证 file:// 下可见）
const fs = require('fs')
const path = require('path')
const { chromium } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright-core'))

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const FONT = "'Songti SC','STSong','SimSun',serif"

// 官方标志：从大赛模板 .doc 中提取（94×60 PNG）
const logoPath = path.join(__dirname, 'assets', 'aic-logo.png')
const logoUri = 'data:image/png;base64,' + fs.readFileSync(logoPath).toString('base64')
const LOGO_W = '12.5mm' // 8mm 高 × (94/60) 宽
const TITLE = '2026年第八届全球校园人工智能算法精英大赛'

async function main() {
  const inHtml = process.argv[2]
  const outPdf = process.argv[3]
  if (!inHtml || !outPdf) { console.error('用法: node render.cjs in.html out.pdf'); process.exit(1) }

  const browser = await chromium.launch({ executablePath: CHROME, headless: true })
  const page = await browser.newPage()
  await page.goto('file://' + path.resolve(inHtml), { waitUntil: 'networkidle' })
  await page.emulateMedia({ media: 'print' })

  // 页眉：左标志 / 中赛事名 / 右占位（等宽，保证文字真正居中）
  const headerTemplate = `
  <div style="width:100%;box-sizing:border-box;padding:0 30mm;font-family:${FONT};-webkit-print-color-adjust:exact;print-color-adjust:exact;">
    <div style="display:flex;align-items:center;border-bottom:0.5pt solid #b9a98c;padding-bottom:1.2mm;">
      <div style="width:${LOGO_W};flex:0 0 ${LOGO_W};">
        <img src="${logoUri}" style="height:8mm;width:${LOGO_W};display:block;">
      </div>
      <div style="flex:1;text-align:center;font-size:9pt;color:#333;letter-spacing:0.5px;">${TITLE}</div>
      <div style="width:${LOGO_W};flex:0 0 ${LOGO_W};"></div>
    </div>
  </div>`

  // 页脚：页码
  const footerTemplate = `
  <div style="width:100%;box-sizing:border-box;padding:0 30mm;font-family:${FONT};">
    <div style="text-align:center;font-size:9pt;color:#333;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</div>
  </div>`

  await page.pdf({
    path: outPdf,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate,
    footerTemplate,
    margin: { top: '27mm', bottom: '25mm', left: '30mm', right: '30mm' },
  })
  await browser.close()
  console.log('PDF ->', outPdf)
}
main().catch((e) => { console.error(e); process.exit(1) })
