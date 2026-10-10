# -*- coding: utf-8 -*-
"""
生成《弦养_试点数据台账.xlsx》
四个工作表：① 受访者 ② 需求问卷 ③ 任务与AB ④ 体验问卷
灰色/彩色列为自动公式列，使用者只需填原始作答。
"""
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule
from openpyxl.utils import get_column_letter

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "弦养_试点数据台账.xlsx")

# ---------- 品牌配色 ----------
C_HEAD   = "B0552E"   # 赭石
C_SUB    = "6E8F7C"   # 青瓷玉
C_AUTO   = "EFE6D6"   # 自动列底色（宣纸米偏深）
C_TITLE  = "FBF3E3"
C_GOLD   = "C9A97E"

thin = Side(style="thin", color="B9A98C")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)

F_HEAD  = Font(name="等线", size=10, bold=True, color="FFFFFF")
F_AUTO  = Font(name="等线", size=10, bold=True, color="7A4A22")
F_BODY  = Font(name="等线", size=10)
F_SMALL = Font(name="等线", size=9, color="666666", italic=True)


def style_header(ws, headers, auto_cols=(), width_map=None):
    """写表头 + 返回 {列名: 列号}"""
    for j, h in enumerate(headers, start=1):
        c = ws.cell(row=1, column=j, value=h)
        c.font = F_HEAD
        c.fill = PatternFill("solid", fgColor=C_HEAD if j not in auto_cols else C_SUB)
        c.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        c.border = BORDER
    ws.row_dimensions[1].height = 34
    if width_map:
        for col, w in width_map.items():
            ws.column_dimensions[col].width = w
    for a in auto_cols:
        ws.column_dimensions[get_column_letter(a)].fill = PatternFill("solid", fgColor=C_AUTO)
    ws.freeze_panes = "B2"
    # 自动列整列底色 + 提示
    for a in auto_cols:
        ws.column_dimensions[get_column_letter(a)].width = max(
            ws.column_dimensions[get_column_letter(a)].width or 10, 12)


def dv(ws, opts, rng, title=None):
    """下拉数据校验"""
    formula = '"' + ",".join(opts) + '"'
    d = DataValidation(type="list", formula1=formula, allow_blank=True, showDropDown=False)
    if title:
        d.promptTitle = title
        d.prompt = "请从下拉中选择"
        d.showInputMessage = True
    ws.add_data_validation(d)
    d.add(rng)
    return d


def dv_int(ws, lo, hi, rng):
    d = DataValidation(type="whole", operator="between", formula1=str(lo), formula2=str(hi),
                       allow_blank=True, error="只能填 %d–%d" % (lo, hi), errorTitle="取值范围")
    ws.add_data_validation(d)
    d.add(rng)
    return d


wb = Workbook()

# ==================================================================
# ① 受访者
# ==================================================================
ws1 = wb.active
ws1.title = "① 受访者"
H1 = ["编号", "姓名/称呼", "对应场景", "年龄段", "身份", "最常用练习场所",
      "使用设备", "家里/活动室网络", "A/B 顺序", "完成全部任务?", "测试日期", "备注"]
AUTO1 = ()
style_header(ws1, H1, width_map={"A": 7, "B": 12, "C": 20, "D": 11, "E": 22, "F": 22,
                                 "G": 16, "H": 18, "I": 11, "J": 14, "K": 12, "L": 26})

prefill1 = [
    ("S1", "主场景·居家自练", "60-69", "自己练", "家里", "A→B"),
    ("S2", "主场景·居家自练", "70及以上", "自己练", "家里", "B→A"),
    ("S3", "主场景·机构带练", "36-59", "社区/机构工作人员", "社区活动室/养老机构", "仅访谈"),
    ("S4", "延展·校园职场", "18-25", "自己练", "单位/学校", "A→B"),
    ("S5", "延展·校园职场", "26-35", "自己练", "单位/学校", "B→A"),
]
for i, row in enumerate(prefill1):
    r = 2 + i
    ws1.cell(row=r, column=1, value=row[0]).font = F_BODY
    ws1.cell(row=r, column=3, value=row[1]).font = F_BODY
    ws1.cell(row=r, column=4, value=row[2]).font = F_BODY
    ws1.cell(row=r, column=5, value=row[3]).font = F_BODY
    ws1.cell(row=r, column=6, value=row[4]).font = F_BODY
    ws1.cell(row=r, column=9, value=row[5]).font = F_BODY
    for j in range(1, len(H1) + 1):
        ws1.cell(row=r, column=j).border = BORDER
r_end = 6
for r in range(2, r_end + 1):
    for j in range(1, len(H1) + 1):
        ws1.cell(row=r, column=j).border = BORDER
        ws1.cell(row=r, column=j).alignment = Alignment(vertical="center", wrap_text=True)

dv(ws1, ["主场景·居家自练", "主场景·机构带练", "延展·校园职场"], "C2:C20", "场景")
dv(ws1, ["18-25", "26-35", "36-59", "60-69", "70及以上"], "D2:D20", "年龄段")
dv(ws1, ["自己练", "家里有长辈练", "社区/机构工作人员", "其他"], "E2:E20", "身份")
dv(ws1, ["家里", "社区活动室/养老机构", "单位/学校", "户外"], "F2:F20", "场地")
dv(ws1, ["手机", "平板", "电视/大屏", "智能音箱"], "G2:G20", "设备")
dv(ws1, ["一直稳定", "有时会断", "基本没有网络", "不清楚"], "H2:H20", "网络")
dv(ws1, ["A→B", "B→A", "仅访谈"], "I2:I20", "A/B 顺序")
dv(ws1, ["是", "否"], "J2:J20", "是否完成")

# ==================================================================
# ② 需求问卷
# ==================================================================
ws2 = wb.create_sheet("② 需求问卷")
Q5 = ["不知对错", "无成就感", "枯燥放弃", "跟不上", "屏幕累", "找不到视频", "其他"]
H2 = (["编号", "Q1 年龄段", "Q2 身份", "Q3 场地", "Q4 频次"]
      + ["Q5_" + x for x in Q5] + ["Q5 首选项★"]
      + ["Q6 不知对错", "Q7 无成就感", "Q8 易放弃", "Q9 琴声更有兴趣",
         "Q10 声音优于口令", "Q11 担心摄像头", "Q12 免注册意愿"]
      + ["Q13 手机", "Q13 平板", "Q13 电视", "Q13 音箱"]
      + ["Q14 网络", "Q15 付费", "Q16 理想体验（原话）", "Q17 古琴曲想法（原话）"])
style_header(ws2, H2, width_map={"A": 7, "D": 18, "E": 10, "AZ": 30})
for col in ["Q1 年龄段", "Q2 身份", "Q3 场地", "Q4 频次", "Q14 网络", "Q15 付费"]:
    ws2.column_dimensions[get_column_letter(H2.index(col) + 1)].width = 16
for i in range(6, 6 + len(Q5)):
    ws2.column_dimensions[get_column_letter(i)].width = 10
for col in ["Q6 不知对错", "Q7 无成就感", "Q8 易放弃", "Q9 琴声更有兴趣",
            "Q10 声音优于口令", "Q11 担心摄像头", "Q12 免注册意愿"]:
    ws2.column_dimensions[get_column_letter(H2.index(col) + 1)].width = 11
ws2.column_dimensions[get_column_letter(H2.index("Q16 理想体验（原话）") + 1)].width = 34
ws2.column_dimensions[get_column_letter(H2.index("Q17 古琴曲想法（原话）") + 1)].width = 34

for i in range(5):
    r = 2 + i
    ws2.cell(row=r, column=1, value="S%d" % (i + 1)).font = F_BODY
    for j in range(1, len(H2) + 1):
        ws2.cell(row=r, column=j).border = BORDER
        ws2.cell(row=r, column=j).alignment = Alignment(vertical="center", wrap_text=True)

dv(ws2, ["18-25", "26-35", "36-59", "60-69", "70及以上"], "B2:B20")
dv(ws2, ["自己练", "家里有长辈练", "社区/机构工作人员", "其他"], "C2:C20")
dv(ws2, ["家里", "社区活动室/养老机构", "单位/学校", "户外"], "D2:D20")
dv(ws2, ["没练过", "1-5次", "6-15次", "16次以上"], "E2:E20")
for i in range(6, 13):
    dv(ws2, ["1", "0"], "%s2:%s20" % (get_column_letter(i), get_column_letter(i)))
dv(ws2, Q5, "M2:M20", "Q5 最困扰的一项")
for i in range(14, 21):
    dv_int(ws2, 1, 5, "%s2:%s20" % (get_column_letter(i), get_column_letter(i)))
for i in range(21, 25):
    dv(ws2, ["1", "0"], "%s2:%s20" % (get_column_letter(i), get_column_letter(i)))
dv(ws2, ["一直稳定", "有时会断", "基本没有网络", "不清楚"], "Y2:Y20")
dv(ws2, ["完全免费（看广告）", "一次性买断", "按月订阅", "由社区/机构统一购买", "不愿意付费"], "Z2:Z20")

# ==================================================================
# ③ 任务与AB
# ==================================================================
ws3 = wb.create_sheet("③ 任务与AB")
H3 = ["编号", "T1 开摄像头", "T2 找入口选式", "T3 双手托天TTFS", "T4 第2-3式",
      "T5 看练习记录", "完成任务数", "TTFS(秒)",
      "A静音 时长(秒)", "B弦养 时长(秒)", "A 主动重做次数", "B 主动重做次数",
      "A 看屏次数", "B 看屏次数", "A 想再做一遍(1-5)", "B 想再做一遍(1-5)",
      "配对差值 Δ", "主持人观察（写动作不写结论）"]
AUTO3 = (7, 17)
style_header(ws3, H3, auto_cols=AUTO3,
             width_map={"A": 7, "B": 13, "C": 14, "D": 16, "E": 12, "F": 14, "G": 11, "H": 10,
                        "I": 13, "J": 13, "K": 13, "L": 13, "M": 11, "N": 11,
                        "O": 14, "P": 14, "Q": 11, "R": 34})
for i in range(5):
    r = 2 + i
    ws3.cell(row=r, column=1, value="S%d" % (i + 1)).font = F_BODY
    ws3.cell(row=r, column=7,
             value='=IF(COUNTIF(B%d:F%d,"独立完成")=0,"",COUNTIF(B%d:F%d,"独立完成"))' % (r, r, r, r)).font = F_AUTO
    ws3.cell(row=r, column=17,
             value='=IF(OR(O%d="",P%d=""),"",P%d-O%d)' % (r, r, r, r)).font = F_AUTO
    for j in range(1, len(H3) + 1):
        ws3.cell(row=r, column=j).border = BORDER
        ws3.cell(row=r, column=j).alignment = Alignment(vertical="center", wrap_text=True)
    for j in AUTO3:
        ws3.cell(row=r, column=j).fill = PatternFill("solid", fgColor=C_AUTO)
for i in range(2, 7):
    dv(ws3, ["独立完成", "需协助", "未完成"],
       "%s2:%s20" % (get_column_letter(i), get_column_letter(i)))
    dv_int(ws3, 3, 5, "%s2:%s20" % (get_column_letter(i), get_column_letter(i)))
_r3 = lambda col: "%s2:%s20" % (col, col)
for col in "HIJ":
    dv_int(ws3, 0, 600, _r3(col))       # 时长（秒）
for col in "KLMN":
    dv_int(ws3, 0, 30, _r3(col))        # 次数
for col in "OP":
    dv_int(ws3, 1, 5, _r3(col))         # 意愿 1–5
# Δ>0 绿底强调（注意：中文语境下"正向"用品牌金）
ws3.conditional_formatting.add(
    "Q2:Q20",
    CellIsRule(operator="greaterThan", formula=["0"], fill=PatternFill("solid", fgColor="E4EFE7"),
               font=Font(name="等线", size=10, bold=True, color="2F6B4F")))
ws3.conditional_formatting.add(
    "Q2:Q20",
    CellIsRule(operator="lessThan", formula=["0"], fill=PatternFill("solid", fgColor="F7E3DC"),
               font=Font(name="等线", size=10, bold=True, color="A8442A")))

# ==================================================================
# ④ 体验问卷
# ==================================================================
ws4 = wb.create_sheet("④ 体验问卷")
SUS_TXT = ["1 愿意经常用", "2 没必要这么复杂", "3 容易使用", "4 需要技术支持",
           "5 功能整合好", "6 太多不一致", "7 大多数人很快学会", "8 用起来别扭",
           "9 很有信心", "10 需学很多东西"]
H4 = (["编号"] + ["SUS" + str(i + 1) for i in range(10)] + ["SUS 分"]
      + ["B1 有琴声更想做完", "B2 没声音更想做完", "Δ主观 B1-B2", "B3 立刻明白对了", "B4 完成感"]
      + ["B5 NPS(0-10)", "NPS 类别", "B6 卡在哪一步", "B7 一个词", "B7 为什么",
         "B8 觉得不对的一刻", "B9 还差什么", "B10 补充"])
AUTO4 = (12, 15, 19)   # 12=SUS分 15=Δ主观 19=NPS类别（19 是公式列；18 是 B5 NPS 手填列）
style_header(ws4, H4, auto_cols=AUTO4,
             width_map={"A": 7, "L": 9, "M": 15, "N": 15, "O": 11, "P": 14, "Q": 12,
                        "R": 11, "S": 11, "T": 24, "U": 12, "V": 24, "W": 24, "X": 24, "Y": 24})
for i in range(2, 12):
    ws4.column_dimensions[get_column_letter(i)].width = 8
for i in range(5):
    r = 2 + i
    ws4.cell(row=r, column=1, value="S%d" % (i + 1)).font = F_BODY
    ws4.cell(row=r, column=12,
             value=('=IF(COUNT(B%d:K%d)<10,"",((B%d-1)+(5-C%d)+(D%d-1)+(5-E%d)+(F%d-1)'
                    '+(5-G%d)+(H%d-1)+(5-I%d)+(J%d-1)+(5-K%d))*2.5)'
                    % ((r,) * 12))).font = F_AUTO
    ws4.cell(row=r, column=15,
             value='=IF(OR(M%d="",N%d=""),"",M%d-N%d)' % (r, r, r, r)).font = F_AUTO
    ws4.cell(row=r, column=19,
             value='=IF(R%d="","",IF(R%d>=9,"推荐者",IF(R%d>=7,"中立","贬损者")))' % (r, r, r)).font = F_AUTO
    for j in range(1, len(H4) + 1):
        ws4.cell(row=r, column=j).border = BORDER
        ws4.cell(row=r, column=j).alignment = Alignment(vertical="center", wrap_text=True)
    for j in AUTO4:
        ws4.cell(row=r, column=j).fill = PatternFill("solid", fgColor=C_AUTO)
for i in range(2, 12):
    dv_int(ws4, 1, 5, "%s2:%s20" % (get_column_letter(i), get_column_letter(i)))
for i in range(13, 18):
    dv_int(ws4, 1, 5, "%s2:%s20" % (get_column_letter(i), get_column_letter(i)))
dv_int(ws4, 0, 10, "R2:R20")
ws4.conditional_formatting.add(
    "L2:L20",
    CellIsRule(operator="greaterThanOrEqual", formula=["68"],
               fill=PatternFill("solid", fgColor="E4EFE7"),
               font=Font(name="等线", size=10, bold=True, color="2F6B4F")))
ws4.conditional_formatting.add(
    "L2:L20",
    CellIsRule(operator="lessThan", formula=["68"],
               fill=PatternFill("solid", fgColor="F7E3DC"),
               font=Font(name="等线", size=10, bold=True, color="A8442A")))

# ---------- 页脚提示 ----------
notes = [
    "填法：只需填白色单元格；蓝绿色表头下的灰底列是自动公式列，请勿手改。",
    "S3 为机构工作人员，只做访谈（不填 A/B 任务与问卷B 的 SUS）。",
    "「完成全部任务?」「完成任务数」由 T1–T5 结果自动汇总；Δ 与 SUS 分同样自动计算。",
    "所有开放题请抄受访者原话，不要转述、不要润色——引语的价值就在「原样」。",
]
for ws in (ws1, ws2, ws3, ws4):
    for i, t in enumerate(notes[:2], start=1):
        ws.cell(row=22 + i, column=1, value="· " + t).font = F_SMALL

wb.save(OUT)
print("saved:", OUT, os.path.getsize(OUT), "bytes")
print("sheets:", wb.sheetnames)
