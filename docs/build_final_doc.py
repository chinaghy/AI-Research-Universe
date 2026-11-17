# -*- coding: utf-8 -*-
from docx import Document
from docx.shared import Pt, Cm, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import os

CN = "微软雅黑"
EN = "Calibri"
MONO = "Courier New"
NAVY = RGBColor(0x17, 0x24, 0x45)
TEAL = RGBColor(0x18, 0x7F, 0x8A)
BODY = RGBColor(0x2B, 0x33, 0x45)
MUTED = RGBColor(0x62, 0x6D, 0x82)
LIGHT = RGBColor(0x8A, 0x96, 0xAB)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
RULE = "1F2A44"
HEAD_RULE = "8A96AB"

def font(run, size=10.5, bold=False, color=None, name_en=EN, name_cn=CN):
    run.font.name = name_en
    run.font.size = Pt(size)
    run.bold = bold
    if color is not None:
        run.font.color.rgb = color
    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.rFonts
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts'); rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), name_en)
    rFonts.set(qn('w:hAnsi'), name_en)
    rFonts.set(qn('w:eastAsia'), name_cn)

def border(paragraph, edge='bottom', sz=8, color=TEAL, space=4):
    if not isinstance(color, str):
        color = str(color)
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = pPr.find(qn('w:pBdr'))
    if pBdr is None:
        pBdr = OxmlElement('w:pBdr'); pPr.append(pBdr)
    el = OxmlElement(f'w:{edge}')
    el.set(qn('w:val'), 'single')
    el.set(qn('w:sz'), str(sz))
    el.set(qn('w:space'), str(space))
    el.set(qn('w:color'), color)
    pBdr.append(el)

def page_number(paragraph):
    run = paragraph.add_run()
    f1 = OxmlElement('w:fldChar'); f1.set(qn('w:fldCharType'), 'begin')
    it = OxmlElement('w:instrText'); it.set(qn('xml:space'), 'preserve'); it.text = 'PAGE'
    f2 = OxmlElement('w:fldChar'); f2.set(qn('w:fldCharType'), 'separate')
    tx = OxmlElement('w:t'); tx.text = '1'
    f3 = OxmlElement('w:fldChar'); f3.set(qn('w:fldCharType'), 'end')
    run._r.append(f1); run._r.append(it); run._r.append(f2); run._r.append(tx); run._r.append(f3)
    font(run, 8.5, color=LIGHT)

def margins(cell, top=55, bottom=55, left=80, right=80):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = tcPr.first_child_found_in('w:tcMar')
    if tcMar is None:
        tcMar = OxmlElement('w:tcMar'); tcPr.append(tcMar)
    for nm, v in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = tcMar.find(qn(f'w:{nm}'))
        if node is None:
            node = OxmlElement(f'w:{nm}'); tcMar.append(node)
        node.set(qn('w:w'), str(v)); node.set(qn('w:type'), 'dxa')

def set_cell(cell, text, size=9, bold=False, color=BODY, align=WD_ALIGN_PARAGRAPH.LEFT):
    cell.text = ''
    p = cell.paragraphs[0]
    p.alignment = align
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.2
    r = p.add_run(str(text))
    font(r, size=size, bold=bold, color=color)

def no_table_borders(table):
    tblPr = table._tbl.tblPr
    old = tblPr.find(qn('w:tblBorders'))
    if old is not None:
        tblPr.remove(old)
    b = OxmlElement('w:tblBorders')
    for edge in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        e = OxmlElement(f'w:{edge}')
        if edge in ('top', 'bottom'):
            e.set(qn('w:val'), 'single'); e.set(qn('w:sz'), '14'); e.set(qn('w:space'), '0'); e.set(qn('w:color'), RULE)
        else:
            e.set(qn('w:val'), 'nil')
        b.append(e)
    tblPr.append(b)

def header_bottom(cell):
    tcPr = cell._tc.get_or_add_tcPr()
    old = tcPr.find(qn('w:tcBorders'))
    if old is not None:
        tcPr.remove(old)
    b = OxmlElement('w:tcBorders')
    bt = OxmlElement('w:bottom')
    bt.set(qn('w:val'), 'single'); bt.set(qn('w:sz'), '6'); bt.set(qn('w:space'), '0'); bt.set(qn('w:color'), HEAD_RULE)
    b.append(bt)
    tcPr.append(b)

def remove_all_borders(table):
    tblPr = table._tbl.tblPr
    old = tblPr.find(qn('w:tblBorders'))
    if old is not None:
        tblPr.remove(old)
    b = OxmlElement('w:tblBorders')
    for edge in ['top', 'left', 'bottom', 'right', 'insideH', 'insideV']:
        e = OxmlElement(f'w:{edge}')
        e.set(qn('w:val'), 'nil')
        b.append(e)
    tblPr.append(b)

def table_caption(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    font(r, 8.8, bold=True, color=NAVY)

def three_line(doc, caption, headers, rows, widths, font_size=8.8, first_bold=False):
    if caption:
        table_caption(doc, caption)
    t = doc.add_table(rows=1, cols=len(headers))
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    no_table_borders(t)
    # header
    for i, h in enumerate(headers):
        c = t.rows[0].cells[i]
        c.width = Cm(widths[i])
        set_cell(c, h, size=8.8, bold=True, color=NAVY)
        margins(c)
        header_bottom(c)
    # repeat header on page break
    trPr = t.rows[0]._tr.get_or_add_trPr()
    th = OxmlElement('w:tblHeader'); th.set(qn('w:val'), 'true'); trPr.append(th)
    for ri, row in enumerate(rows):
        cells = t.add_row().cells
        for ci, val in enumerate(row):
            cells[ci].width = Cm(widths[ci])
            set_cell(cells[ci], val, size=font_size, bold=(first_bold and ci == 0))
            margins(cells[ci])
        trPr = t.rows[-1]._tr.get_or_add_trPr()
        cs = OxmlElement('w:cantSplit'); cs.set(qn('w:val'), 'true'); trPr.append(cs)
    # small gap after table
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(2)
    return t

def caption_figure(doc, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run(text)
    font(r, 8, color=LIGHT)

def figure(doc, path, width, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(0)
    p.add_run().add_picture(path, width=Inches(width))
    caption_figure(doc, text)

def para(doc, text, size=10.5, color=BODY, bold=False, before=0, after=5, align=WD_ALIGN_PARAGRAPH.JUSTIFY, indent=0):
    p = doc.add_paragraph()
    p.alignment = align
    p.paragraph_format.space_before = Pt(before)
    p.paragraph_format.space_after = Pt(after)
    if indent:
        p.paragraph_format.left_indent = Cm(indent)
    r = p.add_run(text)
    font(r, size=size, bold=bold, color=color)
    return p

def bullets(doc, items):
    for item in items:
        p = doc.add_paragraph(style='List Bullet')
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.3
        r = p.add_run(item)
        font(r, 10)

def h1(doc, text, page_break=False):
    p = doc.add_paragraph(style='Heading 1')
    p.paragraph_format.page_break_before = page_break
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(10)
    r = p.add_run(text)
    font(r, 17, bold=True, color=NAVY)
    border(p, 'bottom', 10, TEAL, 5)

def h2(doc, text):
    p = doc.add_paragraph(style='Heading 2')
    p.paragraph_format.space_before = Pt(9)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    font(r, 12.5, bold=True, color=TEAL)

def code_caption(doc, text):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(5)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    r = p.add_run(text)
    font(r, 8.3, bold=True, color=MUTED)

def code_block(doc, caption, code):
    if caption:
        code_caption(doc, caption)
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Cm(.18)
    p.paragraph_format.right_indent = Cm(.1)
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.line_spacing = 1.0
    pPr = p._p.get_or_add_pPr()
    shd = OxmlElement('w:shd'); shd.set(qn('w:val'), 'clear'); shd.set(qn('w:fill'), 'F3F6F9')
    pPr.append(shd)
    border(p, 'left', 8, 'B7D9DD', 3)
    lines = code.strip('\n').split('\n')
    for i, line in enumerate(lines):
        r = p.add_run(line if line else ' ')
        font(r, 8.1, color=RGBColor(0x24, 0x31, 0x44), name_en=MONO, name_cn=CN)
        if i < len(lines) - 1:
            r.add_break()

def new_doc():
    doc = Document()
    s = doc.sections[0]
    s.page_width = Cm(21.0); s.page_height = Cm(29.7)
    s.top_margin = Cm(2.2); s.bottom_margin = Cm(2.0)
    s.left_margin = Cm(2.2); s.right_margin = Cm(2.2)
    s.different_first_page_header_footer = True

    normal = doc.styles['Normal']
    normal.font.name = EN; normal.font.size = Pt(10.5); normal.font.color.rgb = BODY
    normal.paragraph_format.line_spacing = 1.42
    normal.paragraph_format.space_after = Pt(5)
    rPr = normal.element.get_or_add_rPr(); rFonts = rPr.rFonts
    if rFonts is None:
        rFonts = OxmlElement('w:rFonts'); rPr.append(rFonts)
    rFonts.set(qn('w:ascii'), EN); rFonts.set(qn('w:hAnsi'), EN); rFonts.set(qn('w:eastAsia'), CN)
    for lvl, size, color in [(1, 17, NAVY), (2, 12.5, TEAL)]:
        st = doc.styles[f'Heading {lvl}']
        st.font.name = EN; st.font.size = Pt(size); st.font.bold = True; st.font.color.rgb = color
        st.paragraph_format.keep_with_next = True
        rPr = st.element.get_or_add_rPr(); rFonts = rPr.rFonts
        if rFonts is None:
            rFonts = OxmlElement('w:rFonts'); rPr.append(rFonts)
        rFonts.set(qn('w:ascii'), EN); rFonts.set(qn('w:hAnsi'), EN); rFonts.set(qn('w:eastAsia'), CN)

    header = s.header.paragraphs[0]
    header.text = ''
    header.paragraph_format.tab_stops.add_tab_stop(Cm(16.6), WD_TAB_ALIGNMENT.RIGHT)
    r = header.add_run("AI 科研知识宇宙  /  项目交付文档")
    font(r, 8, color=LIGHT)
    r = header.add_run("\tOPENALEX · ANIME.JS")
    font(r, 7, color=LIGHT)
    border(header, 'bottom', 4, 'D8DEE9', 2)
    footer = s.footer.paragraphs[0]
    footer.text = ''
    footer.paragraph_format.tab_stops.add_tab_stop(Cm(16.6), WD_TAB_ALIGNMENT.RIGHT)
    r = footer.add_run("AI 科研知识宇宙 · 项目交付文档  V1.0")
    font(r, 7.5, color=LIGHT)
    r = footer.add_run("\t")
    font(r, 7.5, color=LIGHT)
    page_number(footer)
    return doc

def cover(doc):
    for _ in range(3):
        p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(0)
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(12)
    r = p.add_run("RESEARCH VISUALIZATION  /  FINAL DELIVERY")
    font(r, 8, bold=True, color=TEAL)
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(4)
    r = p.add_run("AI 科研知识宇宙")
    font(r, 34, bold=True, color=NAVY)
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(4)
    r = p.add_run("项目交付文档")
    font(r, 22, bold=True, color=NAVY)
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(10)
    r = p.add_run("需求文档 · 可运行组件 · 交互测试页 · 合作分工")
    font(r, 12, color=MUTED)

    line = doc.add_paragraph(); line.paragraph_format.space_after = Pt(16)
    border(line, 'bottom', 14, TEAL, 7)

    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(24)
    r = p.add_run("把 945 篇高被引论文，组织成一座可以走进去的知识星系。")
    font(r, 11.5, color=TEAL)

    meta = [
        ("项目名称", "AI 科研知识宇宙 / AI Research Universe"),
        ("文档类型", "项目交付文档（四部分合并）"),
        ("项目成员", "单人项目（组内仅 1 人）"),
        ("版本 / 日期", "V1.0 / 2026-11-11"),
        ("技术栈", "HTML / CSS / JavaScript / Anime.js v4 / Canvas 2D"),
        ("数据来源", "OpenAlex 开放科研知识图谱（CC0）"),
    ]
    t = doc.add_table(rows=0, cols=2)
    t.autofit = False
    remove_all_borders(t)
    for k, v in meta:
        cells = t.add_row().cells
        cells[0].width = Cm(3.6); cells[1].width = Cm(10.5)
        set_cell(cells[0], k, 9, True, MUTED)
        set_cell(cells[1], v, 9)
        margins(cells[0], 45,45,0,50); margins(cells[1], 45,45,0,50)
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(28)
    r = p.add_run("课程设计 · 答辩 · 科技主题展览")
    font(r, 9, color=LIGHT)
    p = doc.add_paragraph()
    r = p.add_run("单人项目  /  2026-11-11  /  V1.0")
    font(r, 8, color=LIGHT)
    doc.add_page_break()

def toc(doc):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run("目录")
    font(r, 18, bold=True, color=NAVY)
    border(p, 'bottom', 8, TEAL, 5)
    entries = [
        ("第一部分", "需求文档", "背景、目标、功能、可视化设计、数据口径、亮点、风险"),
        ("第二部分", "可运行组件代码", "运行方式、文件结构、交互说明、关键代码块、扩展方式"),
        ("第三部分", "可运行交互测试页面", "启动方式、8 项自动测试、验收结果、手工清单"),
        ("第四部分", "合作分工", "单人角色拆分、工时预算、阶段安排、答辩分工"),
    ]
    for no, title, desc in entries:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(1)
        r = p.add_run(no + "  ")
        font(r, 9, bold=True, color=TEAL)
        r = p.add_run(title)
        font(r, 12, bold=True, color=NAVY)
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(.75)
        p.paragraph_format.space_after = Pt(4)
        r = p.add_run(desc)
        font(r, 9, color=MUTED)
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    r = p.add_run("文档说明：本文档将四项交付合为一个 Word 文件。数据表统一采用三线表；第二部分附关键组件代码节选，完整代码见 js/app.js。")
    font(r, 8.8, color=LIGHT)
    three_line(doc, "表 0  四项交付与文件", ["交付物", "文件", "用途"], [
        ["需求文档", "01-需求文档.docx / .pdf / .md", "背景、需求、设计、亮点与验收"],
        ["可运行组件", "index.html + css/ + js/ + vendor/", "完整可视化页面"],
        ["交互测试页", "test.html", "8 项自动验收 + 实时预览"],
        ["合作分工", "04-合作分工.docx / .pdf / .md", "单人角色、工时与答辩安排"],
    ], widths=[3.2, 7.4, 6.0], font_size=8.8)

# ============================================================
def part1(doc):
    h1(doc, "第一部分  需求文档", True)
    h2(doc, "1.1 项目背景")
    para(doc, "AI 研究同时表现为三种规模：产出规模、引用规模与知识规模。本作品覆盖的 OpenAlex AI / 计算机视觉 / 信号处理领域，2012—2025 年约 304 万条记录，年产出从约 14.5 万条增长到 43.1 万条，约 2.97 倍。仅 945 篇高被引样本，就累计约 648 万次引用，形成 9,111 条样本内真实引用关系。")
    para(doc, "OpenAlex 是 CC0 的开放科研知识图谱，官方快照约 6.26 亿条记录。传统文献计量页面通常只回答“谁最高”“哪年最多”，无法同时呈现规模、时间、地理、引用和主题五种维度。项目因此把论文组织成“知识星系”：相似论文聚成星云，引用关系形成光链，时间播放让新论文从中心诞生，国家网络让星尘落回地球。")

    h2(doc, "1.2 目标与用户")
    para(doc, "项目希望同时做到“可进入、可讲述、可验证、可展示”：打开页面就看到整体星图；用时间轴、国家网络、知识流与洞察串起研究叙事；每个数字都能追溯到 OpenAlex；桌面、平板、手机均可展示。")
    three_line(doc, "表 1  用户场景与页面回应", ["用户 / 场景", "核心需求", "页面回应"], [
        ["课程答辩评委", "理解选题、数据方法与创新点", "总览 → 洞察 → 测试页"],
        ["科技展观众", "不需要教程也能被吸引", "默认自转、悬停提示、主题胶囊"],
        ["研究者 / 同学", "查找方向、国家或论文", "主题聚焦、国家画像、论文摘要"],
        ["课程教师", "检查真实性与可复现性", "README、需求文档、test.html"],
    ], widths=[3.2, 6.4, 6.8])

    h2(doc, "1.3 功能需求")
    three_line(doc, "表 2  功能需求清单", ["编号", "功能", "需求说明", "优先级"], [
        ["F01", "知识星系", "945 篇论文按 7 个主题聚类，真实引用边连接；星点大小/亮度映射引用", "P0"],
        ["F02", "语义缩放", "领域全景 → 主题 → 论文 → 摘要逐级显示", "P0"],
        ["F03", "论文档案", "标题、作者、年份、引用、主题、摘要与样本内引用网络", "P0"],
        ["F04", "双时间语义", "论文点亮 / 引用点亮；后者按逐年被引历史累积亮度", "P0"],
        ["F05", "国家网络", "可旋转地球；节点大小=论文数，弧线=跨国合作", "P0"],
        ["F06", "极轴自转与锁定", "默认 15 秒/圈绕北极—南极连线旋转；右下角锁定/恢复", "P1"],
        ["F07", "国家研究指纹", "用 RCA 雷达展示相对专业化，而非单一主题占比", "P1"],
        ["F08", "跨星云知识流", "41 条有向主题通道；点击查看流量与桥梁论文", "P0"],
        ["F09", "研究洞察", "领域产出、注意力迁移、国家 × 主题矩阵、跨界桥梁", "P1"],
        ["F10", "响应式与测试", "四档布局；test.html 自动验收 8 项核心交互", "P1"],
    ], widths=[1.3, 3.1, 9.7, 1.5])
    para(doc, "非功能要求：无需后端与安装，断网可运行；1440×900 下 Canvas 动画保持 60fps 量级；现代 Chrome / Edge / Safari；数据口径在页面与文档中一致。")

    h2(doc, "1.4 可视化设计")
    three_line(doc, "表 3  视觉编码", ["视觉元素", "数据含义", "交互含义"], [
        ["星云 / 颜色", "7 个宏观主题；颜色即主题身份", "点击图例或星云标签聚焦"],
        ["星点", "一篇论文；大小映射总被引", "悬停看标题；点击看摘要"],
        ["引用光链", "样本内真实 referenced_works 关系", "悬停论文时点亮一阶邻接"],
        ["时间轴", "2012—2025；论文从中心诞生", "播放、拖动、切换双时间语义"],
        ["地球节点", "第一作者国家；颜色=主导主题", "点击国家查看画像 / RCA / 合作"],
        ["知识流弧线", "主题 A 引用主题 B 的有向流量", "点击查看通道与桥梁论文"],
    ], widths=[3.2, 7.2, 6.0])
    para(doc, "页面由四个视图组成：知识星系回答“整体长什么样”；国家网络回答“谁与谁合作、各国擅长什么”；知识流回答“知识如何穿过星云”；研究洞察给出可被讲述的研究信号。")
    figure(doc, "shots/hero.png", 6.0, "图 1  知识星系总览：7 个主题星云、引用光链与双时间语义")
    figure(doc, "shots/flow.png", 5.8, "图 2  跨星云知识流：弧线颜色=引用方主题，箭头指向被引用方")

    h2(doc, "1.5 数据口径")
    three_line(doc, "表 4  数据指标", ["指标", "数值", "说明"], [
        ["高被引样本", "945 篇", "2012—2025；按年高被引梯度 + 14 篇 AI for Science 地标论文"],
        ["样本累计被引", "6,486,062", "OpenAlex cited_by_count 汇总"],
        ["样本内引用边", "9,111", "referenced_works 交集；主画布显示 1,500 条代表边"],
        ["跨主题引用", "3,333", "引用方与被引用方主题不同"],
        ["有向主题通道", "41", "7×6 可能通道中实际出现的通道"],
        ["国家 / 地区", "57", "作者机构国家码去重；网络节点 26 个"],
        ["领域总量", "3,044,875", "AI / CV / 信号处理 2012—2025"],
    ], widths=[4.0, 3.8, 8.2])
    para(doc, "引用点亮使用 OpenAlex counts_by_year，计算截至当前年份的累计被引与当年热度；只统计到 2025 年。主题划分使用 OpenAlex primary_topic + 标题关键词 + 经典论文人工校正，属于策展聚类，不是官方分类。国家取第一作者首个机构；RCA = 本国主题占比 ÷ 全球主题占比，>1 表示相对专业化。星系位置为叙事性螺旋布局，不表示严格语义距离。")

    h2(doc, "1.6 项目亮点")
    bullets(doc, [
        "双时间语义：同一批星星，既可看“何时发表”，也可看“何时被看见”。",
        "知识流：3,333 条跨主题引用聚合成 41 条有向通道，避免网络毛线球。",
        "RCA 国家指纹：从论文数量排名推进到相对研究方向结构。",
        "可讲述层级：领域 → 主题 → 论文 → 摘要，四个颗粒度对应四种观看方式。",
        "展陈级行为：国家网络 15 秒/圈极轴自转，可一键锁定，兼顾展台运动与讲解静止。",
        "可验证交付：独立 test.html 的 8 项自动验收覆盖数据、标题、双模式、知识流、国家网络、自转锁定与洞察。",
    ])

    h2(doc, "1.7 风险与限制")
    para(doc, "高被引样本不代表全领域绝对产出；主题规则为启发式，少量论文归属可讨论；RCA 样本较小，只作方向观察；国家取第一作者机构，多机构论文只归一个主国家；星系位置是叙事布局，不表示严格语义距离；OpenAlex 引用数随快照变化，作品记录快照日期与时间窗口。")

# ============================================================
def part2(doc):
    h1(doc, "第二部分  可运行组件代码", True)
    h2(doc, "2.1 使用说明")
    para(doc, "组件是零构建、零后端的静态页面。直接打开 index.html 即可；如果需要运行 test.html，建议使用本地 HTTP 服务器：")
    code_block(doc, "代码 1  启动方式", """# 方式一：直接打开
open index.html

# 方式二：推荐（同时用于测试页）
python3 -m http.server 8000
# http://localhost:8000/index.html
# http://localhost:8000/test.html""")
    para(doc, "主页面无需联网：Anime.js v4 与 Space Grotesk 字体均已本地化到 vendor/。测试页依赖同源 iframe，因此必须通过本地服务器访问，不能直接双击。")

    h2(doc, "2.2 文件结构")
    code_block(doc, "代码 2  目录结构", """index.html            页面骨架、四视图、HUD、时间轴、详情、洞察
css/style.css         深空视觉、布局、响应式、面板与图表
js/app.js             Canvas 渲染、状态机、交互命中、Anime.js
js/data.js            945 篇论文 + hist + 9,111 条边 + 国家/洞察
vendor/anime.min.js   Anime.js v4.0.2（本地）
vendor/fonts/         Space Grotesk
test.html             交互验收台（8 项自动测试）
shots/                展示截图""")
    para(doc, "核心页面按职责分离：index.html 负责结构与可访问按钮；style.css 负责视觉与响应式；app.js 负责 Canvas 投影、状态机、交互和 Anime.js 时间线；data.js 是唯一数据事实源。")

    h2(doc, "2.3 交互说明")
    three_line(doc, "表 5  主要交互", ["操作", "效果", "适用视图"], [
        ["拖拽 / 滚轮", "旋转场景、缩放层级", "星系、国家、知识流"],
        ["悬停星点 / 国家 / 弧线", "显示卡片并点亮关联", "对应视图"],
        ["点击星点", "打开论文档案与引用网络", "知识星系"],
        ["论文点亮 / 引用点亮", "切换时间语义", "知识星系"],
        ["点击国家", "国家画像、合作与 RCA 指纹", "国家网络"],
        ["锁定自转", "停止/恢复 15 秒/圈极轴自转", "国家网络"],
        ["点击知识流弧线", "通道详情与桥梁论文", "知识流"],
        ["Esc / 空格 / 方向键", "返回 / 播放 / 切年", "全局"],
    ], widths=[4.0, 7.6, 4.8])

    h2(doc, "2.4 关键组件代码")
    para(doc, "下列代码为关键机制的节选，完整实现见 js/app.js。")

    code_block(doc, "代码 3  数据契约与逐年被引", """// js/data.js（结构节选）
window.AI_DATA = {
  meta: { works: 945, edges: 9111, yearMin: 2012, yearMax: 2025 },
  themes: { language: { name, color, count, top, years }, ... },
  works: [{
    i, title, year, cites, theme, abs, authors, countries,
    hist: [/* 2012—2025 逐年被引 */],
    pos: [x, y, z]
  }],
  edges:    [[citingIndex, citedIndex], ...], // 主画布 1,500 条
  allEdges: [[citingIndex, citedIndex], ...], // 完整 9,111 条
  countries: [{ code, zh, lon, lat, count, themes }],
  insights: { growth, bridges, matrix, fieldSeries }
};""")

    code_block(doc, "代码 4  3D 星系投影", """function projectRaw(x, y, z) {
  const cy = Math.cos(camera.yaw), sy = Math.sin(camera.yaw);
  const x1 = x * cy - z * sy;
  const z1 = x * sy + z * cy;
  const cp = Math.cos(camera.pitch), sp = Math.sin(camera.pitch);
  const y1 = y * cp - z1 * sp;
  const z2 = y * sp + z1 * cp;
  const s = (FOCAL / (CAM_DIST + z2)) * camera.zoom * view.fit;
  return { x: view.cx + x1 * s, y: view.cy + y1 * s, s, z: z2 };
}
// 星点位置 = lerp(星系中心, 论文最终位置, reveal)
// reveal 由发表年或引用累积驱动，实现“从中心诞生”""")

    code_block(doc, "代码 5  引用点亮亮度", """function citationStats(w, year = state.year) {
  const idx = clamp(year - D.meta.yearMin, 0, D.meta.yearMax - D.meta.yearMin);
  const cum = w._cumHist?.[idx] || 0;
  const annual = w.hist?.[idx] || 0;
  const frac = clamp(cum / Math.max(1, w._finalCum), 0, 1);
  const heat = annual > 0
    ? Math.log10(1 + annual) / Math.log10(1 + maxAnnual) : 0;
  const lum = clamp(.16 + .72 * Math.pow(frac, .5)
    + .16 * Math.pow(heat, .7), 0, 1);
  return { cum, annual, frac, heat, lum };
}
// alpha *= .28 + .72 * lum
// size  = starSize(max(1, cum)) * ...  // 被引用越多，星越亮、越大""")

    code_block(doc, "代码 6  国家研究指纹 RCA", """const globalTotal = Object.values(themes).reduce((a, t) => a + t.count, 0);
const values = themeOrder.map(th => {
  const local = (c.themes[th] || 0) / Math.max(1, c.count);
  const global = themes[th].count / globalTotal;
  return { th, rca: local / Math.max(1e-9, global) };
});
// RCA = 本国主题占比 ÷ 全球主题占比
// >1 表示相对专业化；雷达固定 4× 上限，样本较小时仅作方向观察""")

    code_block(doc, "代码 7  极轴自转与锁定", """// 国家网络：绕 Y 轴旋转，等价于北极—南极连线
if (state.view === 'countries' && !state.dragging
    && !state.selectedCountry && !state.panelOpen
    && !globe.locked) {
  globe.yaw += globe.autoSpeed * (dt / 1000);
}
// autoSpeed = (Math.PI * 2) / 15  → 15 秒/圈
// 右下角按钮切换 globe.locked，文案在“锁定自转 / 已锁定”间同步""")

    h2(doc, "2.5 扩展方式")
    para(doc, "换数据：保持 js/data.js 的 works / themes / edges / countries / insights 结构，重新生成数据包。换视觉：修改 css/style.css 的 :root 色板或 js/data.js 中 themes.*.color。换默认时间语义：设置 state.lightMode 为 publish 或 citation。嵌入其他站点：使用 iframe 指向 index.html；test.html 本身也是 iframe 集成示例。")
    para(doc, "页面暴露 window.__GALAXY__ 作为调试与测试接口，例如 setView('flows')、setYear(2017,false)、setLightMode('citation')、selectCountry('GB')、selectFlowEdge('language','vision')。")

# ============================================================
def part3(doc):
    h1(doc, "第三部分  可运行交互测试页面", True)
    h2(doc, "3.1 启动方式")
    para(doc, "test.html 是一个独立的交互验收台：左侧为 1440×900 的真实 iframe 预览，右侧为测试用例与运行日志。页面加载后会自动执行，也可以点“重新检测”。")
    code_block(doc, "代码 8  测试页启动", """cd 项目根目录
python3 -m http.server 8000
# 浏览器访问：
http://localhost:8000/test.html""")
    para(doc, "注意：测试页需要通过同源 iframe 读取主页面状态，不要直接双击 test.html。主页面 index.html 可以直接双击打开。")

    h2(doc, "3.2 自动测试项")
    three_line(doc, "表 6  8 项自动验收", ["编号", "验收项", "判定标准", "结果"], [
        ["T01", "数据快照", "945 篇 / 7 主题 / 9,111 边 / 57 国家", "PASS"],
        ["T02", "标题完整", "两行标题高度 > 20px，第二行颜色不透明", "PASS"],
        ["T03", "双时间语义", "切换后 lightMode 与按钮、年份 DOM 同步", "PASS"],
        ["T04", "知识流", "进入 flows，5 条列表，打开通道详情", "PASS"],
        ["T05", "国家网络 & RCA", "选中英国，RCA 雷达与专业化标签存在", "PASS"],
        ["T06", "自转与锁定", "默认 yaw 变化；锁定时停止；可恢复", "PASS"],
        ["T07", "研究洞察", "4 张卡片、领域曲线、国家矩阵", "PASS"],
        ["T08", "返回清理", "返回星系，时间轴与 body 状态恢复", "PASS"],
    ], widths=[1.3, 4.2, 9.6, 1.4])
    figure(doc, "shots/test-page.png", 6.1, "图 3  交互验收页：8 项自动测试全部通过")
    para(doc, "当前已验证：8 / 8 PASS。桌面 1440×900、1024×768、平板 768×1024、手机 390×844 均做过布局与交互检查；页面无控制台错误。")

    h2(doc, "3.3 手工验收清单")
    bullets(doc, [
        "打开主页面，5 秒内完成开场；两行大标题完整可见。",
        "拖拽旋转、滚轮放大，放大后出现论文标签。",
        "悬停星点出现标题卡片；点击打开论文摘要。",
        "时间轴切到 2017，切换“引用点亮”，星光随时间累积变化。",
        "进入知识流，悬停弧线看到流量；点击打开桥梁论文。",
        "进入国家网络，地球默认自转；点“锁定自转”停止，再点恢复。",
        "点击国家节点，RCA 雷达、合作国家与代表论文显示。",
        "打开研究洞察，4 张卡片完整；按 Esc 返回。",
    ])
    para(doc, "如果测试页提示无法访问 iframe，请使用本地 HTTP 服务器；如果主页面没有动画，检查系统是否开启了“减少动态效果”。国家网络只绘制前半球连线，完整合作数据仍在国家面板中。")

# ============================================================
def part4(doc):
    h1(doc, "第四部分  合作分工（单人）", True)
    para(doc, "本项目组内只有 1 人，不虚构成员。采用“角色拆分”替代“团队拆分”：把完整项目拆成 6 个可验收角色，由同一人按阶段承担。每个角色都有明确输入、输出和验收标准。")
    three_line(doc, "表 7  单人角色、职责与工时", ["角色", "主要职责", "关键产出", "工时"], [
        ["项目负责人 / 产品", "选题、研究问题、范围、优先级与验收口径", "需求文档、功能清单、验收标准", "6 h"],
        ["数据工程", "抓取、筛选、去重、引用历史、国家聚合", "945 篇样本、9,111 条边、hist", "11 h"],
        ["信息设计 / 视觉", "星系隐喻、色彩、四视图、图表与信息层级", "视觉规范、页面结构", "8 h"],
        ["前端开发", "Canvas、Anime.js、状态机、响应式与交互命中", "index.html / app.js / style.css", "20 h"],
        ["测试与质量", "自动测试、跨尺寸、性能、回归", "test.html、8 项验收", "5 h"],
        ["文档与答辩", "需求、组件、测试、分工、演示稿", "全套交付文档", "7 h"],
    ], widths=[3.4, 7.8, 6.0, 1.8])
    para(doc, "合计约 57 小时。阶段安排：D1—D3 需求与数据（16 h）；D4 视觉设计（6 h）；D5—D7 核心实现（18 h）；D8—D9 扩展实现（10 h）；D10 测试与优化（4 h）；D11 文档与答辩（3 h）。如课程周期更短，优先保证 P0 功能，压缩视觉打磨。")
    para(doc, "答辩按角色切换：0:00—0:40 问题与背景；0:40—1:40 知识星系与双时间语义；1:40—2:30 国家网络、RCA 与自转锁定；2:30—3:20 知识流；3:20—4:10 研究洞察；4:10—5:00 测试、限制与交付。")
    para(doc, "协作机制（单人自审）：每阶段结束写 3 行交接；改动先跑 test.html；大改前备份 css/style.css 与 js/app.js；8 项测试全过才进入文档与答辩。")
    para(doc, "本人确认：组内仅 1 人，以上角色均由本人承担；不存在虚构成员或代做。", bold=False)



def main():
    doc = new_doc()
    cover(doc)
    toc(doc)
    part1(doc)
    part2(doc)
    part3(doc)
    part4(doc)
    out = "AI科研知识宇宙-项目交付文档.docx"
    doc.save(out)
    print("saved", out)

if __name__ == '__main__':
    main()
