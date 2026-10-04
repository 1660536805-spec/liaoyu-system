# 拼「改前 / 改后」对比图：左＝旧 canvas 火柴小人，右＝房间版小人 4 帧
from PIL import Image, ImageDraw, ImageFont

D = '/Users/leo/WorkBuddy/疗愈/outputs/coach-judge/'
OLD = D + 'Y-00-旧教练小窗-裁切.png'
NEWS = [D + f'Y-02-教练小窗-帧{i}.png' for i in (1, 2, 3, 4)]
OUT = D + 'Z-教练小窗-改前改后.png'

SONG = '/System/Library/Fonts/Songti.ttc'
HEI = '/System/Library/Fonts/Hiragino Sans GB.ttc'
def F(path, size, idx=0):
    return ImageFont.truetype(path, size, index=idx)

BG = (251, 243, 227)      # 宣纸米
INK = (46, 40, 34)        # 墨
SUB = (120, 106, 92)
ZHE = (176, 85, 46)       # 赭石
QING = (110, 143, 124)    # 青瓷玉

# 目标尺寸
TILE_H = 330
GAP = 18
old = Image.open(OLD).convert('RGB')
o_w = round(old.width * (TILE_H * 2 + GAP) / old.height)  # 高度对齐 2 行网格
old = old.resize((o_w, TILE_H * 2 + GAP), Image.LANCZOS)

news = [Image.open(p).convert('RGB') for p in NEWS]
n_w = round(news[0].width * TILE_H / news[0].height)
news = [im.resize((n_w, TILE_H), Image.LANCZOS) for im in news]

M = 44
TITLE_H = 176
LABEL_H = 46
FOOT_H = 74
grid_w = n_w * 2 + GAP
grid_h = TILE_H * 2 + GAP
content_h = max(grid_h, old.height)
W = M * 2 + o_w + 66 + grid_w
H = TITLE_H + LABEL_H + content_h + FOOT_H

img = Image.new('RGB', (W, H), BG)
d = ImageDraw.Draw(img)

# 顶部细赭石条
d.rectangle([0, 0, W, 8], fill=ZHE)

d.text((M, 40), '教练小窗形象替换 · 改前 / 改后', font=F(SONG, 46, 1), fill=INK)
d.text((M + 2, 108), '左＝改前（原 canvas 火柴小人）    右＝改后（房间版小人，第 1 式循环 4 帧）',
       font=F(HEI, 23), fill=SUB)

lab_y = TITLE_H
d.text((M, lab_y), '改前 · 旧教练', font=F(HEI, 24), fill=SUB)
gx = M + o_w + 66
d.text((gx, lab_y), '改后 · 房间版小人（本次替换）', font=F(HEI, 24), fill=QING)

cy = lab_y + LABEL_H
# 旧图（加淡描边）
d.rectangle([M - 2, cy - 2, M + old.width + 2, cy + old.height + 2], outline=(214, 200, 178), width=2)
img.paste(old, (M, cy))
# 箭头
ax = M + old.width + 20
ay = cy + content_h // 2
d.line([ax, ay, ax + 26, ay], fill=ZHE, width=5)
d.polygon([(ax + 26, ay - 12), (ax + 46, ay), (ax + 26, ay + 12)], fill=ZHE)
# 新 4 帧
for k, im in enumerate(news):
    r, c = divmod(k, 2)
    x = gx + c * (n_w + GAP)
    y = cy + r * (TILE_H + GAP)
    d.rectangle([x - 2, y - 2, x + im.width + 2, y + im.height + 2], outline=(150, 130, 108), width=2)
    img.paste(im, (x, y))
    d.text((x + 6, y + 6), f'帧{k+1}', font=F(HEI, 18), fill=(240, 236, 226))

d.text((M, H - FOOT_H + 6),
       '同一套关键帧解算：搬运保真度校验 2730 个数值，不一致 0，最大偏差 5.7e-14',
       font=F(HEI, 20), fill=SUB)

img.save(OUT)
print('saved', OUT, img.size)
