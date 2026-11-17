# -*- coding: utf-8 -*-
from docx import Document
from docx.shared import Pt, Cm, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_TAB_ALIGNMENT
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.enum.section import WD_SECTION
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.text import WD_LINE_SPACING
import os

FONT_CN = "微软雅黑"
FONT_EN = "Calibri"
NAVY = RGBColor(0x17, 0x24, 0x45)
TEAL = RGBColor(0x18, 0x7F, 0x8A)
MUTED = RGBColor(0x5E, 0x6A, 0x82)
LIGHT = RGBColor(0x8A, 0x96, 0xAB)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
DARK_BG = "172445"
TEAL_BG = "E8F5F5"
LIGHT_BG = "F4F6FA"
BORDER = "D8DEE9"

DOC_TITLE = "AI 科研知识宇宙"
DOC_SUB = "基于 OpenAlex 与 Anime.js 的科研知识可视化"
VERSION = "V1.0"
DATE = "2026-11-11"

def set_font(run, size=10.5, bold=False, color=None, font_cn=FONT_CN, font_en=FONT_EN):
    run.font.name = font_en
    run.font.size = Pt(size)
    run.bold = bold
    if color is not None:
        run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.rFonts
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts'); rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), font_en)
    rFonts.set(qn('w:hAnsi'), font_en)
    rFonts.set(qn('w:eastAsia'), font_cn)

def shade(cell, hex_color):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:fill'), hex_color)
    shd.set(qn('w:val'), 'clear')
    tcPr.append(shd)

def cell_margins(cell, top=60, bottom=60, left=90, right=90):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in("w:tcMar")
    if tcMar is None:
        tcMar = OxmlElement('w:tcMar'); tcPr.append(tcMar)
    for name, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = tcMar.find(qn(f'w:{name}'))
        if node is None:
            node = OxmlElement(f'w:{name}'); tcMar.append(node)
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')

def set_cell_text(cell, text, size=9.5, bold=False, color=None, align=WD_ALIGN_PARAGRAPH.LEFT):
    cell.text = ''
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.25
    run = p.add_run(str(text))
    set_font(run, size=size, bold=bold, color=color)

def add_table(doc, headers, rows, widths=None, header_bg=DARK_BG, font_size=9.2, first_col_bold=False):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = 'Table Grid'
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    hdr = table.rows[0].cells
    for i, h in enumerate(headers):
        set_cell_text(hdr[i], h, size=9.2, bold=True, color=WHITE)
        shade(hdr[i], header_bg)
        cell_margins(hdr[i])
    # repeat header row on page breaks; never split a table row across pages
    trPr = table.rows[0]._tr.get_or_add_trPr()
    tblHeader = OxmlElement('w:tblHeader'); tblHeader.set(qn('w:val'), 'true')
    trPr.append(tblHeader)
    if widths:
        for i, w in enumerate(widths):
            for row in table.rows:
                row.cells[i].width = Cm(w)
    for ri, row in enumerate(rows):
        cells = table.add_row().cells
        for ci, val in enumerate(row):
            set_cell_text(cells[ci], val, size=font_size, bold=(first_col_bold and ci == 0))
            cell_margins(cells[ci])
            if ri % 2 == 1:
                shade(cells[ci], LIGHT_BG)
    for row in table.rows:
        trPr = row._tr.get_or_add_trPr()
        cantSplit = OxmlElement('w:cantSplit'); cantSplit.set(qn('w:val'), 'true')
        trPr.append(cantSplit)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table

def add_caption(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run(text)
    set_font(r, size=8.2, color=LIGHT)

def add_page_number(paragraph):
    run = paragraph.add_run()
    fldChar1 = OxmlElement('w:fldChar'); fldChar1.set(qn('w:fldCharType'), 'begin')
    instr = OxmlElement('w:instrText'); instr.set(qn('xml:space'), 'preserve'); instr.text = 'PAGE'
    fldChar2 = OxmlElement('w:fldChar'); fldChar2.set(qn('w:fldCharType'), 'separate')
    t = OxmlElement('w:t'); t.text = '1'
    fldChar3 = OxmlElement('w:fldChar'); fldChar3.set(qn('w:fldCharType'), 'end')
    run._r.append(fldChar1); run._r.append(instr); run._r.append(fldChar2); run._r.append(t); run._r.append(fldChar3)
    set_font(run, size=8.5, color=LIGHT)

def add_bottom_border(paragraph, color="187F8A", size=8):
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), str(size))
    bottom.set(qn('w:space'), '4')
    bottom.set(qn('w:color'), color)
    pBdr.append(bottom); pPr.append(pBdr)

def new_doc(header_text, footer_text):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width = Cm(21.0)
    sec.page_height = Cm(29.7)
    sec.top_margin = Cm(2.2)
    sec.bottom_margin = Cm(2.0)
    sec.left_margin = Cm(2.2)
    sec.right_margin = Cm(2.2)
    sec.different_first_page_header_footer = True

    styles = doc.styles
    normal = styles['Normal']
    normal.font.name = FONT_EN
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor(0x2B, 0x33, 0x45)
    normal.paragraph_format.line_spacing = 1.45
    normal.paragraph_format.space_after = Pt(6)
    rPr = normal.element.get_or_add_rPr()
    rFonts = rPr.rFonts
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts'); rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), FONT_EN); rFonts.set(qn('w:hAnsi'), FONT_EN); rFonts.set(qn('w:eastAsia'), FONT_CN)

    heading_specs = [(1, 16, NAVY, 14, 8), (2, 13, TEAL, 10, 5), (3, 11.5, NAVY, 8, 3)]
    for level, size, color, before, after in heading_specs:
        st = styles[f'Heading {level}']
        st.font.name = FONT_EN
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = color
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True
        rPr = st.element.get_or_add_rPr()
        rFonts = rPr.rFonts
        if rFonts is None:
            rFonts = OxmlElement('w:rFonts'); rPr.append(rFonts)
        rFonts.set(qn('w:ascii'), FONT_EN); rFonts.set(qn('w:hAnsi'), FONT_EN); rFonts.set(qn('w:eastAsia'), FONT_CN)

    # header
    hdr = sec.header
    hp = hdr.paragraphs[0]
    hp.text = ''
    hp.paragraph_format.tab_stops.add_tab_stop(Cm(16.6), WD_TAB_ALIGNMENT.RIGHT)
    r = hp.add_run(header_text)
    set_font(r, size=8, color=LIGHT)
    r = hp.add_run('\tOPENALEX · ANIME.JS')
    set_font(r, size=7, color=LIGHT)
    add_bottom_border(hp, "D8DEE9", 4)

    # footer
    ftr = sec.footer
    fp = ftr.paragraphs[0]
    fp.text = ''
    fp.paragraph_format.tab_stops.add_tab_stop(Cm(16.6), WD_TAB_ALIGNMENT.RIGHT)
    r = fp.add_run(footer_text)
    set_font(r, size=7.5, color=LIGHT)
    r = fp.add_run('\t')
    set_font(r, size=7.5, color=LIGHT)
    add_page_number(fp)

    return doc

def cover(doc, title, subtitle, doc_type, meta_rows):
    for _ in range(3):
        p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(0)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(14)
    r = p.add_run("RESEARCH VISUALIZATION  /  " + doc_type)
    set_font(r, size=8, bold=True, color=TEAL)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = .9
    r = p.add_run(title)
    set_font(r, size=31, bold=True, color=NAVY)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(12)
    r = p.add_run(subtitle)
    set_font(r, size=13, color=MUTED)

    line = doc.add_paragraph()
    line.paragraph_format.space_after = Pt(17)
    add_bottom_border(line, "187F8A", 12)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(22)
    r = p.add_run("把 945 篇高被引论文，组织成一座可以走进去的知识星系。")
    set_font(r, size=11.5, color=TEAL)

    table = doc.add_table(rows=0, cols=2)
    table.autofit = False
    for k, v in meta_rows:
        cells = table.add_row().cells
        cells[0].width = Cm(3.6); cells[1].width = Cm(10.5)
        set_cell_text(cells[0], k, size=9, bold=True, color=MUTED)
        set_cell_text(cells[1], v, size=9, color=RGBColor(0x35,0x3F,0x55))
        for c in cells:
            cell_margins(c, top=45, bottom=45, left=0, right=50)
            c._tc.get_or_add_tcPr().append(OxmlElement('w:tcBorders')) if False else None

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(36)
    r = p.add_run("课程设计 · 答辩 · 科技主题展览")
    set_font(r, size=9, color=LIGHT)
    p = doc.add_paragraph()
    r = p.add_run("单人项目  /  " + DATE + "  /  " + VERSION)
    set_font(r, size=8, color=LIGHT)
    doc.add_page_break()

def para(doc, text, size=10.5, color=None, bold=False, before=0, after=6, indent=0, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    r = p.add_run(text)
    set_font(r, size=size, bold=bold, color=color)
    return p

def bullets(doc, items, size=10.2):
    for item in items:
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.35
        r = p.add_run(item)
        set_font(r, size=size)

def quote(doc, text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.cell(0,0)
    shade(cell, TEAL_BG)
    cell_margins(cell, top=100, bottom=100, left=150, right=150)
    cell.text = ''
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.4
    r = p.add_run(text)
    set_font(r, size=10, color=RGBColor(0x1A,0x58,0x61))
    doc.add_paragraph().paragraph_format.space_after = Pt(2)

def h(doc, text, level=1):
    p = doc.add_paragraph(style=f'Heading {level}')
    r = p.add_run(text)
    set_font(r, size={1:16,2:13,3:11.5}[level], bold=True, color={1:NAVY,2:TEAL,3:NAVY}[level])
    if level == 1:
        add_bottom_border(p, "B7D9DD", 6)
    return p

def image(doc, path, width, caption):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(5)
    p.paragraph_format.space_after = Pt(0)
    p.add_run().add_picture(path, width=Inches(width))
    add_caption(doc, caption)

# ============================================================
# 需求文档
# ============================================================
def build_requirements():
    doc = new_doc("AI 科研知识宇宙  /  需求文档", "AI 科研知识宇宙  ·  需求文档  " + VERSION)
    cover(doc, DOC_TITLE, DOC_SUB + "\n需求文档", "SOFTWARE REQUIREMENTS", [
        ("项目名称", "AI 科研知识宇宙 / AI Research Universe"),
        ("文档类型", "需求文档（含背景、可视化设计与亮点说明）"),
        ("项目成员", "单人项目（组内仅 1 人）"),
        ("版本 / 日期", f"{VERSION} / {DATE}"),
        ("技术栈", "HTML / CSS / JavaScript / Anime.js v4 / Canvas 2D"),
        ("数据来源", "OpenAlex 开放科研知识图谱（CC0）"),
        ("配套文件", "index.html（交互页面）、test.html（交互测试页面）"),
    ])

    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(2)
    r = p.add_run("目录"); set_font(r, 15, bold=True, color=NAVY)
    add_bottom_border(p, "187F8A", 8)
    toc = [
        ("01", "项目背景与问题定义"), ("02", "项目目标与用户场景"),
        ("03", "功能需求"), ("04", "信息与可视化设计"),
        ("05", "数据口径与指标"), ("06", "技术方案与实现"),
        ("07", "项目亮点"), ("08", "验收标准与测试"),
        ("09", "风险、限制与应对"), ("10", "交付物清单"),
        ("附录", "领域年度产出与数据指标")
    ]
    for num, title in toc:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(3)
        r = p.add_run(f"{num}    {title}")
        set_font(r, size=9.5, color=RGBColor(0x3B,0x45,0x5C))
    doc.add_page_break()

    h(doc, "01  项目背景与问题定义")
    h(doc, "1.1 领域背景", 2)
    para(doc, "2026 年的 AI 研究已经不是一个“单一学科”。它同时表现为三种规模：")
    bullets(doc, [
        "产出规模：本作品使用的 OpenAlex AI / 计算机视觉 / 信号处理领域，2012—2025 年约有 304 万条记录；年产出从 2012 年的约 14.5 万条增长到 2025 年的约 43.1 万条，约 2.97 倍。",
        "引用规模：仅本作品的 945 篇高被引样本，就累计了约 648 万次引用，形成 9,111 条样本内真实引用关系。",
        "知识规模：语言、视觉、生成、智能体、AI for Science、可信 AI、机器学习基础等方向彼此渗透，新的突破越来越多地发生在学科交界处。",
    ])
    para(doc, "OpenAlex 作为 CC0 的开放科研知识图谱，为这种“可计算的研究全景”提供了基础。官方快照约 6.26 亿条记录，覆盖论文、作者、机构、主题、国家与引用关系。问题在于：数据规模越大，普通用户越难建立整体感知。")

    h(doc, "1.2 问题定义", 2)
    para(doc, "传统文献计量页面通常只回答“谁最高”“哪年最多”。但研究现场真正被追问的是：")
    bullets(doc, [
        "哪些研究主题正在快速增长？",
        "不同国家分别擅长哪些方向？",
        "哪些论文连接了原本分离的研究领域？",
        "一个热点从出现到爆发，经历了什么过程？",
    ])
    para(doc, "这些问题需要同时呈现“规模、时间、地理、引用和主题”五种维度。静态条形图无法承载这种多维关系，普通网络图又容易变成不可读的毛线球。因此，项目需要一个既有整体空间感、又能逐层下潜的叙事型可视化。")

    h(doc, "1.3 项目机会", 2)
    quote(doc, "把论文组织成“知识星系”：相似论文聚成星云，引用关系形成光链，时间播放让新论文从中心诞生，国家网络让星尘落回地球。")
    para(doc, "“星系”不是装饰性隐喻，而是一套可操作的信息结构：星云对应主题，星点大小对应被引，亮度对应时间语义，连线对应引用，缩放对应从领域到论文的语义层级。它让观众先获得整体感，再被允许选择自己的探索路径。")

    h(doc, "02  项目目标与用户场景")
    h(doc, "2.1 项目目标", 2)
    bullets(doc, [
        "可进入：打开页面即看到 945 篇论文组成的 7 个主题星云，而不是一张需要阅读说明的图例。",
        "可讲述：用时间轴、国家网络、知识流和研究洞察，串起“出现—扩散—爆发—连接”的研究叙事。",
        "可验证：每个数字、每条引用、每个国家指标都能追溯到 OpenAlex 记录，测试页面可复现验收。",
        "可展示：桌面、平板、手机三档布局，适配课程答辩与科技主题展览。",
    ])
    h(doc, "2.2 用户体验目标", 2)
    add_table(doc, ["维度", "目标", "对应设计"], [
        ["第一印象", "10 秒内理解“这是一张可探索的科研地图”", "星系总览 + 大标题 + 主题图例"],
        ["探索深度", "从领域全景下潜到单篇摘要不超过 3 步", "星云 → 星点 → 论文档案"],
        ["数据可信", "任何结论都能说明样本口径", "方法论抽屉、洞察脚注、RCA 提示"],
        ["展示稳定", "离线、本地、无后端依赖", "静态文件 + vendored Anime.js / 字体"],
    ], widths=[3.0, 7.0, 6.0], font_size=9)

    h(doc, "2.3 用户与场景", 2)
    add_table(doc, ["用户 / 场景", "核心需求", "页面回应"], [
        ["课程答辩评委", "快速理解选题价值、数据方法与创新点", "总览 → 策展式观察 → 洞察页 → 测试页"],
        ["科技展观众", "不需要教程也能被吸引，并能随手互动", "默认自转、悬停提示、锁定自转、主题胶囊"],
        ["研究者 / 同学", "想知道某个方向、国家或论文的位置", "主题聚焦、国家画像、论文摘要、引用网络"],
        ["课程教师", "检查数据真实性、工程完成度与可复现性", "README、需求文档、自动化测试页"],
    ], widths=[3.2, 6.4, 6.4], font_size=9)

    h(doc, "03  功能需求")
    h(doc, "3.1 功能清单", 2)
    add_table(doc, ["编号", "功能", "需求说明", "优先级"], [
        ["F01", "知识星系", "945 篇论文按 7 个宏观主题聚类，主题间以真实引用边连接；星点大小/亮度映射引用。", "P0"],
        ["F02", "语义缩放", "滚轮或双指缩放，从领域全景逐级显示主题标签、论文标签、论文档案。", "P0"],
        ["F03", "论文档案", "点击星点查看标题、作者、年份、引用、主题、摘要、样本内引用网络与原文链接。", "P0"],
        ["F04", "双时间语义", "在“论文点亮 / 引用点亮”之间切换；后者按逐年被引历史累积亮度。", "P0"],
        ["F05", "国家网络", "星系切换为可旋转地球；节点大小=高被引论文数，弧线=跨国合作。", "P0"],
        ["F06", "极轴自转与锁定", "国家网络默认绕北极—南极连线自转（15 秒/圈），右下角可锁定/恢复。", "P1"],
        ["F07", "国家研究指纹", "用 RCA 雷达展示相对专业化，不只展示主题占比。", "P1"],
        ["F08", "跨星云知识流", "7 个主题排成圆环，41 条有向通道展示 3,333 条跨主题引用；可查看桥梁论文。", "P0"],
        ["F09", "研究洞察", "领域产出、注意力迁移、国家 × 主题矩阵、跨界桥梁四张洞察卡片。", "P1"],
        ["F10", "响应式", "适配 1440 / 1024 / 768 / 390 四档宽度；移动端使用底部主题胶囊。", "P1"],
        ["F11", "数据说明", "页面内展示样本口径、RCA 公式、引用时间窗口与主画布边筛选说明。", "P1"],
        ["F12", "交互测试页", "独立 test.html，自动验证数据、标题、双模式、知识流、国家网络、自转锁定与洞察。", "P1"],
    ], widths=[1.2, 3.0, 9.0, 1.8], font_size=8.8)

    h(doc, "3.2 非功能需求", 2)
    add_table(doc, ["类别", "要求", "验收方式"], [
        ["性能", "1440×900 下 Canvas 动画稳定 60fps；主画布 1,500 条代表边，悬停时切换完整邻接。", "本机帧率采样 + 交互测试"],
        ["可运行性", "无需安装依赖、无需后端；可直接打开 index.html，或通过静态服务器访问。", "断网环境打开页面"],
        ["兼容性", "Chrome / Edge / Safari 现代版本；4 档响应式布局。", "桌面 / 平板 / 手机截图与测试"],
        ["可维护性", "数据、渲染、样式、测试分离；数据可通过 js/data.js 替换。", "组件说明文档 + 代码结构"],
        ["可访问性", "中文标签、按钮 aria 状态、键盘 Esc / 空格 / 方向键、低动态偏好。", "键盘走查 + 代码检查"],
        ["数据透明", "所有统计口径、样本筛选和限制均写入页面与文档。", "需求文档第 5 节 + 洞察脚注"],
    ], widths=[2.2, 9.4, 4.6], font_size=9)

    h(doc, "04  信息与可视化设计")
    h(doc, "4.1 视觉隐喻与编码", 2)
    add_table(doc, ["视觉元素", "数据含义", "交互含义"], [
        ["星云 / 颜色", "7 个宏观主题；颜色即主题身份", "点击图例或星云标签聚焦"],
        ["星点", "一篇论文；大小映射总被引，高被引更亮", "悬停看标题/年份/引用；点击看摘要"],
        ["引用光链", "样本内真实 referenced_works 关系", "悬停论文时点亮一阶邻接；默认显示 1,500 条代表边"],
        ["时间轴", "2012—2025；论文从星系中心诞生", "播放、拖动、切换双时间语义"],
        ["地球节点", "第一作者国家；大小=论文数，颜色=主导主题", "点击国家查看画像/RCA/合作"],
        ["知识流弧线", "主题 A 引用主题 B 的有向流量", "悬停看流量，点击看桥梁论文"],
        ["RCA 雷达", "本国主题占比 ÷ 全球主题占比", "读相对专业化，不误读绝对规模"],
    ], widths=[3.2, 7.0, 5.8], font_size=8.8)

    h(doc, "4.2 四个视图", 2)
    para(doc, "页面不是四个独立页面，而是同一份数据的四种“观看方式”。")
    add_table(doc, ["视图", "回答的问题", "主要视觉"], [
        ["知识星系", "整体长什么样？热点在哪里？", "7 个主题星云、引用光链、时间轴"],
        ["国家网络", "谁在与谁合作？各国擅长什么？", "可旋转地球、合作弧线、RCA 雷达"],
        ["知识流", "知识如何穿过星云？谁连接了分离领域？", "圆环节点、41 条有向通道、桥梁论文"],
        ["研究洞察", "有哪些可被讲述的研究信号？", "领域曲线、主题脉冲、国家矩阵、桥梁榜"],
    ], widths=[3.0, 8.0, 5.0], font_size=9)

    image(doc, "shots/hero.png", 6.2, "图 1  知识星系总览：7 个主题星云、引用光链与时间轴")
    image(doc, "shots/flow.png", 6.2, "图 2  跨星云知识流：弧线颜色=引用方主题，箭头指向被引用方")

    h(doc, "4.3 关键交互", 2)
    add_table(doc, ["交互", "结果", "设计目的"], [
        ["拖拽 / 滚轮", "旋转星系、缩放层级", "建立空间感与“可进入”感"],
        ["点击星星", "聚焦论文并打开档案", "从宏观叙事落到具体证据"],
        ["论文 / 引用点亮", "切换时间语义", "把“发表”与“被引用”区分成两种知识生命"],
        ["国家网络自转", "默认 15 秒/圈，按钮锁定", "展陈带来生命感，阅读时可即时静止"],
        ["点击国家", "打开国家画像与 RCA 指纹", "把国家维度从排名变成研究方向结构"],
        ["点击知识流弧线", "打开通道详情与桥梁论文", "让跨领域连接从“连线”变成可读的证据"],
        ["Esc / 方向键 / 空格", "返回 / 切年 / 播放", "键盘可完成主要演示路径"],
    ], widths=[3.4, 6.4, 6.2], font_size=9)

    h(doc, "4.4 视觉风格", 2)
    para(doc, "整体采用深空底色与高饱和主题光：语言=玫红，视觉=青蓝，生成=紫，智能体=暖金，AI for Science=薄荷绿，可信=珊瑚红，基础=钴蓝。标题、坐标、面板使用低饱和白蓝，避免与数据颜色争夺注意力。")
    para(doc, "字体使用 Space Grotesk（数字/英文）与系统中文字体；标题采用实色 + 光晕而非背景裁切，保证跨浏览器可见性。所有动画服务于叙事：相机飞行、星星诞生、引用脉冲、面板入场，不使用无意义的循环装饰。")

    h(doc, "05  数据口径与指标")
    h(doc, "5.1 数据来源与样本", 2)
    para(doc, "数据来自 OpenAlex Works API（CC0）。筛选 primary_topic.subfield 为 Artificial Intelligence、Computer Vision and Pattern Recognition、Signal Processing 的记录，按年取 cited_by_count 前 70 篇，并补入 14 篇 AI for Science 地标论文；随后去重、清理明显的跨领域噪声，得到 945 篇高被引样本。")
    add_table(doc, ["指标", "数值", "说明"], [
        ["高被引样本", "945 篇", "2012—2025，按年高被引梯度抽样"],
        ["样本累计被引", "6,486,062", "OpenAlex 当前 cited_by_count 汇总"],
        ["样本内引用边", "9,111", "referenced_works 交集"],
        ["主画布代表边", "1,500", "为可读性筛选；详情使用完整邻接"],
        ["跨主题引用", "3,333", "引用方与被引用方主题不同"],
        ["有向主题通道", "41", "7×6 可能通道中实际出现的通道"],
        ["国家 / 地区", "57", "作者机构国家码去重"],
        ["国家网络节点", "26", "高被引样本中的主要第一作者国家"],
        ["合作连线", "124", "同篇论文国家共现 ≥2 次"],
        ["领域总量", "3,044,875", "AI / CV / 信号处理 2012—2025"],
    ], widths=[4.2, 4.0, 7.8], font_size=9)

    h(doc, "5.2 双时间语义", 2)
    para(doc, "“论文点亮”以发表年为出现依据，适合观察每年新增了什么；“引用点亮”为每篇论文补抓 OpenAlex counts_by_year，计算截至当前年份的累计被引与当年引用热度，使星点随学术影响力逐渐变亮。时间轴只统计到 2025 年，避免把 2026 年的引用错误计入历史切面。")
    h(doc, "5.3 主题与知识流", 2)
    para(doc, "主题划分使用 OpenAlex primary_topic + 标题关键词规则，并对经典论文做人工校正。它是策展用的宏观聚类，不是 OpenAlex 官方分类。跨主题引用 = 引用方主题 ≠ 被引用方主题的边；知识流弧线颜色取引用方主题，箭头指向被引用方。")
    h(doc, "5.4 国家研究指纹", 2)
    para(doc, "RCA（Revealed Comparative Advantage）= 本国某主题占比 ÷ 全球该主题占比。RCA > 1 表示相对专业化，而不是绝对论文更多。由于样本量较小，页面同时标注“仅作方向观察”，雷达图固定 4× 上限以便比较。")

    h(doc, "06  技术方案与实现")
    h(doc, "6.1 架构", 2)
    add_table(doc, ["文件 / 模块", "职责"], [
        ["index.html", "页面骨架、四个视图、HUD、时间轴、详情面板、洞察覆盖层"],
        ["css/style.css", "深空视觉系统、布局、响应式、面板与图表样式"],
        ["js/app.js", "Canvas 投影渲染、状态机、交互命中、Anime.js 时间线、国家/知识流/洞察逻辑"],
        ["js/data.js", "945 篇论文、hist 逐年被引、9,111 条边、国家、RCA/洞察数据、陆地点阵"],
        ["test.html", "iframe 交互验收台，自动执行 8 项测试并显示日志"],
        ["vendor/anime.min.js", "Anime.js v4.0.2（本地化，无 CDN 依赖）"],
    ], widths=[4.5, 11.0], font_size=9)
    para(doc, "核心状态机包含 galaxy / countries / flows 三个场景，加一个 insights 覆盖层。Canvas 2D 以透视投影绘制星云、星点、引用曲线、地球经纬网与知识流弧线；DOM 负责 HUD、详情、洞察与可访问按钮。")
    h(doc, "6.2 Anime.js 的使用", 2)
    bullets(doc, [
        "开场：HUD 交错入场、标题行揭示、星点按年份从中心诞生。",
        "相机：主题聚焦、论文下潜使用 Anime.js 缓动对象驱动。",
        "时间：年度批次星点 p 值动画、主题脉冲、引用点亮亮度变化。",
        "面板：详情滑入、RCA/知识流条形图生长、洞察 SVG 路径绘制。",
        "自转：国家网络的极轴自转用帧间隔计算，Anime.js 负责过渡与锁定状态 UI。",
    ])
    h(doc, "6.3 性能与稳健性", 2)
    bullets(doc, [
        "Canvas 星点使用缓存 sprite，引用边按主题批处理，避免每帧创建渐变。",
        "主画布只绘制 1,500 条代表边，保留完整 9,111 条邻接用于悬停/详情。",
        "响应式三档布局，节点与标签命中按屏幕像素计算。",
        "标题使用实色回退，避免 background-clip:text 在部分渲染环境导致整行透明。",
        "全部资源本地化，断网可运行；iframe 测试需通过本地 HTTP 服务器。",
    ])

    h(doc, "07  项目亮点")
    highlights = [
        ("亮点一：双时间语义", "大多数论文可视化只按发表年出现。本作品把“论文点亮 / 引用点亮”做成可切换的时间语义：同一批星星，既可以看“什么时候出现”，也可以看“什么时候被看见”。"),
        ("亮点二：知识流而不是连线堆", "将 3,333 条跨主题引用聚合成 41 条有向通道，既保留方向，又避免网络毛线球；每条通道都能展开到具体桥梁论文。"),
        ("亮点三：RCA 国家指纹", "把国家从“论文数量排名”推进到“相对研究方向结构”：英国不是论文最多，但智能体与 AI for Science 的 RCA 明显更高。"),
        ("亮点四：可讲述的层级", "领域全景 → 主题星云 → 论文星点 → 摘要与引用网络，四个层级对应四种叙事颗粒度。"),
        ("亮点五：展陈级默认行为", "国家网络默认绕极轴 15 秒/圈，右下角可立即锁定；既能在展台上持续运动，也能在讲解时瞬间静止。"),
        ("亮点六：可验证交付", "独立的 test.html 以真实页面 iframe 运行 8 项自动验收，覆盖数据、标题、双模式、知识流、国家网络、自转锁定、洞察与返回。"),
    ]
    for title, body in highlights:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(5)
        p.paragraph_format.space_after = Pt(1)
        r = p.add_run(title)
        set_font(r, 10.8, bold=True, color=TEAL)
        para(doc, body, size=10, after=4)

    h(doc, "08  验收标准与测试")
    para(doc, "验收以 test.html 的自动化结果为主，辅以人工观感检查。8 项自动化用例全部通过即视为功能验收通过。")
    add_table(doc, ["编号", "验收项", "判定标准"], [
        ["T01", "数据快照", "945 篇、7 主题、9,111 引用边、57 国家"],
        ["T02", "标题完整性", "两行标题均可见；第二行颜色不透明"],
        ["T03", "双时间语义", "引用/论文点亮切换，年份 DOM 与状态同步"],
        ["T04", "知识流", "flow 视图、5 条列表、通道详情与桥梁论文"],
        ["T05", "国家网络 & RCA", "选中英国，RCA 雷达与专业化标签存在"],
        ["T06", "自转与锁定", "默认 yaw 变化；锁定时 yaw 停止；可恢复"],
        ["T07", "研究洞察", "4 张洞察卡片、领域曲线、国家矩阵"],
        ["T08", "返回与状态清理", "返回星系，时间轴/DOM 状态恢复"],
    ], widths=[1.4, 4.0, 10.2], font_size=9)
    image(doc, "shots/test-page.png", 6.3, "图 3  交互验收台：8 项自动测试全部通过")

    h(doc, "09  风险、限制与应对")
    add_table(doc, ["风险 / 限制", "影响", "应对"], [
        ["高被引样本偏差", "样本不能代表全领域产出", "页面与文档明确“高被引样本”口径；领域总量单独使用 OpenAlex 全量 group_by"],
        ["主题规则为启发式", "少量论文主题归属可讨论", "README 公开规则；经典论文人工校正；主题面板标注策展属性"],
        ["RCA 样本较小", "国家指标易受少量论文影响", "固定 4× 上限，提示“仅作方向观察”，不做因果推断"],
        ["国家取第一作者机构", "多机构论文只归一个主国家", "合作边另行统计国家共现；页面说明口径"],
        ["星系位置是叙事布局", "不表示严格语义距离", "文档与 README 明确非 UMAP；引用/年份/主题仍来自数据"],
        ["数据快照会变化", "引用数随时间增长", "记录快照日期；引用点亮只统计到 2025"],
    ], widths=[4.0, 5.0, 7.0], font_size=8.8)

    h(doc, "10  交付物清单")
    add_table(doc, ["交付物", "文件", "说明"], [
        ["需求文档", "docs/01-需求文档.docx / .md", "本文件；背景、需求、设计、亮点、验收"],
        ["可运行组件代码", "index.html + css/ + js/ + vendor/", "完整静态可视化，直接打开即可"],
        ["交互测试页面", "test.html", "8 项自动验收 + 实时预览 + 日志"],
        ["合作分工", "docs/04-合作分工.docx / .md", "单人项目的角色、阶段、工时与答辩安排"],
        ["组件说明", "docs/02-组件说明.md", "运行方式、文件职责、数据契约、扩展方式"],
        ["测试说明", "docs/03-测试说明.md", "测试运行方式、用例说明、人工验收清单"],
    ], widths=[4.0, 6.0, 6.0], font_size=9)

    h(doc, "附录  领域年度产出与关键数据")
    add_table(doc, ["年份", "领域记录数", "样本论文数", "样本累计数"], [
        ["2012", "144,995", "65", "65"], ["2013", "148,922", "65", "130"],
        ["2014", "151,148", "64", "194"], ["2015", "152,726", "67", "261"],
        ["2016", "167,242", "67", "328"], ["2017", "162,803", "68", "396"],
        ["2018", "184,706", "64", "460"], ["2019", "205,062", "66", "526"],
        ["2020", "214,694", "67", "593"], ["2021", "229,170", "71", "664"],
        ["2022", "236,176", "67", "731"], ["2023", "278,789", "77", "808"],
        ["2024", "337,428", "66", "874"], ["2025", "431,014", "71", "945"],
    ], widths=[2.4, 5.2, 4.2, 4.2], font_size=9)
    para(doc, "注：样本按年 top 70 抓取，并补入 14 篇 AI for Science 地标论文；经去重、跨领域清理与经典论文校正后得到 945 篇，各年样本数为 64—77 篇。2012—2025 领域总量合计 3,044,875 条。", size=8.8, color=MUTED)
    para(doc, "参考资料：OpenAlex (openalex.org) · OpenAlex Snapshot 文档 · Anime.js v4 (animejs.com) · Natural Earth 1:110m land。", size=8.5, color=LIGHT)

    doc.save("docs/01-需求文档.docx")
    print("saved requirements docx")

# ============================================================
# 合作分工
# ============================================================
def build_collaboration():
    doc = new_doc("AI 科研知识宇宙  /  合作分工", "AI 科研知识宇宙  ·  合作分工  " + VERSION)
    cover(doc, "合作分工详细安排", "AI 科研知识宇宙 · 单人项目\n角色拆分、工时预算与答辩分工", "TEAM PLAN", [
        ("项目名称", "AI 科研知识宇宙 / AI Research Universe"),
        ("项目成员", "组内 1 人（单人完成全部角色）"),
        ("文档类型", "合作分工详细安排"),
        ("版本 / 日期", f"{VERSION} / {DATE}"),
        ("总工时预算", "约 57 小时（可按课程周期压缩）"),
        ("分工原则", "不虚设成员；以角色拆分替代团队拆分"),
        ("交付物", "需求文档、组件代码、交互测试页、本分工文档"),
    ])

    h(doc, "01  项目组织与分工原则")
    para(doc, "本项目组内只有 1 人，因此不采用“成员 A / 成员 B”的虚构分工，而是把完整项目拆成 6 个可验收角色，由同一人按阶段承担。这样做的好处是：")
    bullets(doc, [
        "每个角色都有明确输入、输出和验收标准，避免“一个人做完了但说不清做了什么”。",
        "阶段之间有质量门禁，数据、视觉、交互和文档不会互相挤压。",
        "答辩时可以按角色说明完整闭环，而不是只展示最终页面。",
    ])
    quote(doc, "单人项目的合作分工，不是把任务分给别人，而是把任务分成可以独立交付、独立验收的“岗位”。")

    h(doc, "02  角色分工与工时")
    add_table(doc, ["角色", "主要职责", "关键产出", "工时"], [
        ["项目负责人 / 产品", "确定选题、研究问题、范围与优先级；控制进度与验收口径", "需求文档、功能清单、验收标准", "6 h"],
        ["数据工程", "OpenAlex 抓取、样本筛选、去重清洗、引用历史、国家/机构聚合", "945 篇样本、9,111 条边、hist 数据", "11 h"],
        ["信息设计 / 视觉", "知识星系隐喻、色彩系统、四视图布局、信息层级与图表设计", "视觉规范、星云/国家/知识流稿", "8 h"],
        ["前端开发", "Canvas 渲染、Anime.js 时间线、四视图状态机、响应式与交互命中", "index.html、app.js、style.css", "20 h"],
        ["测试与质量", "自动测试页、跨尺寸检查、性能与回归、缺陷修复", "test.html、8 项验收记录", "5 h"],
        ["文档与答辩", "需求文档、组件说明、测试说明、分工文档、演示脚本", "全套交付文档与答辩稿", "7 h"],
    ], widths=[3.4, 7.8, 6.0, 1.8], font_size=8.8)
    para(doc, "合计约 57 小时；如课程周期更短，可优先保证 P0 功能，压缩视觉打磨与展陈细节。", size=9, color=MUTED)

    h(doc, "03  阶段计划")
    add_table(doc, ["阶段", "时间", "核心任务", "里程碑"], [
        ["S1 需求与调研", "D1 / 4 h", "确定四个研究问题；比较 OpenAlex 数据字段；确定“知识星系”方向", "需求文档 v0.1"],
        ["S2 数据工程", "D2—D3 / 12 h", "按年抓取、去重、主题归类、引用边、国家与合作、逐年引用历史", "945 篇数据快照"],
        ["S3 视觉设计", "D4 / 6 h", "星系布局、七主题色、四视图信息结构、面板与时间轴", "高保真视觉稿"],
        ["S4 核心实现", "D5—D7 / 18 h", "Canvas 星图、缩放、论文档案、时间轴双模式、国家网络", "主页面可运行"],
        ["S5 扩展实现", "D8—D9 / 10 h", "知识流、RCA 指纹、研究洞察、自转锁定、响应式", "四视图完整"],
        ["S6 测试与优化", "D10 / 4 h", "自动化验收、跨尺寸、性能、标题兼容性修复", "8 项测试通过"],
        ["S7 文档与答辩", "D11 / 3 h", "需求文档、组件/测试说明、分工文档、5 分钟演示", "交付包"],
    ], widths=[3.0, 2.6, 9.0, 4.3], font_size=8.8)

    h(doc, "04  工作分解结构（WBS）")
    add_table(doc, ["编号", "任务", "输入", "输出", "工时"], [
        ["W01", "选题与竞品分析", "OpenAlex / 现有科研可视化", "研究问题与范围", "3 h"],
        ["W02", "数据抓取与清洗", "Works API", "945 篇样本 + 9,111 边", "8 h"],
        ["W03", "主题体系与洞察", "topic + 标题关键词", "7 主题、增长/桥梁指标", "4 h"],
        ["W04", "视觉概念与布局", "星系隐喻", "色彩、版式、四视图", "5 h"],
        ["W05", "星图渲染与缩放", "Canvas / 数据", "星云、边、语义缩放", "10 h"],
        ["W06", "时间轴与双模式", "hist 数据", "论文/引用点亮", "4 h"],
        ["W07", "国家网络与锁定", "国家/合作数据", "地球、RCA、自转锁定", "6 h"],
        ["W08", "知识流", "跨主题边", "41 通道 + 桥梁面板", "4 h"],
        ["W09", "洞察与测试页", "聚合指标", "4 卡片 + 8 项测试", "4 h"],
        ["W10", "响应式与兼容", "三档布局", "桌面/平板/手机", "2 h"],
        ["W11", "QA 与修复", "test.html", "验收记录", "3 h"],
        ["W12", "文档与答辩", "全流程材料", "交付包 + 演示稿", "4 h"],
    ], widths=[1.2, 4.0, 5.0, 5.8, 1.6], font_size=8.6)
    para(doc, "WBS 合计约 57 小时，作为计划上限；实际实施通过复用视觉组件、减少无效探索和自动化测试控制超时。", size=8.8, color=MUTED)

    h(doc, "05  单人协作机制")
    h(doc, "5.1 自审与交接", 2)
    bullets(doc, [
        "每个阶段结束写 3 行交接：完成了什么、还缺什么、下一阶段第一步是什么。",
        "需求 → 设计 → 实现之间使用同一份验收清单，避免“做出来但不符合需求”。",
        "代码改动先跑 test.html，再做人工视觉走查；测试失败不进入下一阶段。",
        "所有数据口径只写一处，页面、README、需求文档互相引用，避免三套说法。",
    ])
    h(doc, "5.2 时间与精力管理", 2)
    bullets(doc, [
        "上午做需要连续注意力的数据/渲染；下午做视觉与交互；晚上做文档与轻量修复。",
        "每个阶段设置 30 分钟硬超时，避免在单一星云位置或颜色上无限打磨。",
        "先完成 P0 闭环，再做 P1 增强；任何新增功能必须回答“它对应哪个研究问题”。",
    ])
    h(doc, "5.3 版本与回滚", 2)
    bullets(doc, [
        "关键节点保存可运行快照：数据完成、主页面完成、四视图完成、测试通过。",
        "每次大改前备份 css/style.css 与 js/app.js；出现回归直接回退到上一快照。",
        "测试页作为最终门禁：8 项全过才进入文档与答辩阶段。",
    ])

    h(doc, "06  质量门禁")
    add_table(doc, ["门禁", "检查内容", "通过标准"], [
        ["G1 数据", "样本数、引用边、国家、hist 完整性", "945 / 9,111 / 57 / hist=945"],
        ["G2 视觉", "标题两行、星云可读、面板不溢出", "四档尺寸截图通过"],
        ["G3 交互", "点击、悬停、缩放、切换、锁定", "自动化 + 人工走查通过"],
        ["G4 性能", "1440×900 Canvas 动画", "稳定 60fps 量级"],
        ["G5 文档", "需求、组件、测试、分工四件套", "版本号与日期一致"],
    ], widths=[3.2, 8.0, 5.0], font_size=9)

    h(doc, "07  答辩分工与 5 分钟脚本")
    para(doc, "虽然是单人项目，答辩仍按“角色切换”组织，保证每个问题都有明确负责人。")
    add_table(doc, ["时间", "内容", "承担角色"], [
        ["0:00—0:40", "问题：AI 研究规模爆炸，传统图表无法同时呈现时间、地理、主题与引用", "项目负责人"],
        ["0:40—1:40", "知识星系：945 篇、7 主题、9,111 条引用；双时间语义", "前端 / 视觉"],
        ["1:40—2:30", "国家网络：合作弧线、RCA 指纹、15 秒极轴自转与锁定", "数据 / 信息设计"],
        ["2:30—3:20", "知识流：3,333 条跨主题引用聚成 41 条通道", "数据 / 前端"],
        ["3:20—4:10", "研究洞察：领域增长、注意力迁移、国家矩阵、桥梁论文", "产品 / 数据"],
        ["4:10—5:00", "测试与交付：8 项自动化验收、限制与下一步", "测试 / 文档"],
    ], widths=[2.2, 11.0, 3.4], font_size=8.8)
    para(doc, "答辩前检查：主页面已刷新、test.html 服务已启动、浏览器缩放 100%、声音关闭、网络可断（页面应仍可用）。")

    h(doc, "08  风险与个人应对")
    add_table(doc, ["风险", "触发信号", "应对"], [
        ["范围膨胀", "不断想加新视图", "回到四个研究问题；新增功能必须映射到问题"],
        ["数据口径混乱", "页面数字与文档不一致", "以 js/data.js / meta 为单一事实源"],
        ["视觉返工", "星云布局反复调整", "先锁定 7 主题色与四视图骨架，再做细节"],
        ["性能下降", "拖拽掉帧", "减少同时可见边、缓存 sprite、按主题批处理"],
        ["答辩紧张", "演示路径记不住", "固定 5 分钟脚本 + 测试页兜底"],
    ], widths=[4.0, 5.4, 6.4], font_size=8.8)

    h(doc, "09  分工确认")
    para(doc, "本人确认：本项目组内仅 1 人，以上角色均由本人承担；不存在虚构成员或代做。工时预算为计划值，实际投入以项目日志为准。")
    add_table(doc, ["确认项", "内容"], [
        ["项目成员", "1 人（全部角色）"],
        ["总工时", "约 57 小时（计划）"],
        ["交付确认", "需求文档 / 组件代码 / 测试页面 / 分工文档"],
        ["签字", "____________________"],
        ["日期", DATE],
    ], widths=[4.0, 11.0], font_size=9)
    doc.save("docs/04-合作分工.docx")
    print("saved collaboration docx")

if __name__ == '__main__':
    os.makedirs('docs', exist_ok=True)
    build_requirements()
    build_collaboration()
