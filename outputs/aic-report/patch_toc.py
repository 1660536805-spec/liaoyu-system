# 读取已渲染的 PDF，定位每个目录条目的真实页码，回填到 HTML 的目录里
# 用法: python patch_toc.py <pdf> [html]
import re, sys, json, pymupdf

HTML = sys.argv[2] if len(sys.argv) > 2 else 'outputs/aic-report/report.html'
PDF = sys.argv[1]

html = open(HTML, encoding='utf-8').read()
tocs = re.findall(r'data-toc="([^"]+)"', html)
doc = pymupdf.open(PDF)
pages = [doc[i].get_text() for i in range(doc.page_count)]

def norm(s):
    return re.sub(r'\s+', '', s)

START = 2  # 跳过封面(第1页)与目录(第2页)
res = {}
for t in tocs:
    key = norm(t)
    found = None
    for i in range(START, doc.page_count):
        if key in norm(pages[i]):
            found = i + 1
            break
    res[t] = found

missing = [k for k, v in res.items() if v is None]
print('总页数:', doc.page_count)
print('未定位到的目录项:', missing if missing else '无')

# 回填页码
def repl(m):
    key = m.group(1)
    pg = res.get(key)
    return '<span class="pg" data-toc="%s">%s</span>' % (key, pg if pg else '1')

new = re.sub(r'<span class="pg" data-toc="([^"]+)">[^<]*</span>', repl, html)
open(HTML, 'w', encoding='utf-8').write(new)
print('已回填页码：')
for k, v in res.items():
    print('  %s  ->  %s' % (v, k))
