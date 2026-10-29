"""Optional browser regression; Python/Playwright only used as test tooling, not app runtime."""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.request
import zipfile
import xml.etree.ElementTree as ET

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def rows(xml):
    root = ET.fromstring(xml)
    return [[(c.find('m:is/m:t', NS).text or '') if c.get('t') == 'inlineStr' and c.find('m:is/m:t', NS) is not None else c.findtext('m:v', default='', namespaces=NS) for c in row] for row in root.findall('m:sheetData/m:row', NS)]

with socket.socket() as sock:
    sock.bind(('127.0.0.1',0))
    port=sock.getsockname()[1]
process=subprocess.Popen(['node','tests/serve.cjs'],cwd=ROOT,env=os.environ|{'PORT':str(port)},stdout=subprocess.DEVNULL)
base=f'http://127.0.0.1:{port}/Questionaire/'
try:
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(60):
        try:
            opener.open(base,timeout=1).close()
            break
        except OSError:
            time.sleep(.1)
    else:
        raise AssertionError('static server failed to start')
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        ctx=browser.new_context(viewport={'width':390,'height':844},accept_downloads=True)
        ctx.route('https://good360vr.com/**',lambda route:route.fulfill(status=200,content_type='text/html',body='<p>测试占位视频</p>'))
        page=ctx.new_page()
        errors=[]
        requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        page.goto(base,wait_until='networkidle')
        expect(page.locator('#basicForm')).to_be_visible()
        assert all(v=='' for v in page.evaluate('sheets()[0].rows[1]'))
        page.evaluate("localStorage.setItem('park-survey-static-v1', JSON.stringify({test:'original draft preserved'}))")
        expect(page.locator('#consent')).to_have_count(0)
        expect(page.locator('header h1')).to_have_text('城市公园场景休闲消费意愿调查')
        page.locator('#code').fill('C22')
        for group in page.locator('#basicForm fieldset').all()[1:]:
            group.locator('input[type=radio]').first.check()
        page.get_by_role('button',name='下一步：观看场景').click()
        expect(page.locator('#error')).to_contain_text('重复数字')
        page.locator('#code').fill('C3')
        page.get_by_role('button',name='下一步：观看场景').click()
        expect(page.locator('#error')).to_contain_text('尚未配置')
        page.locator('#code').fill(' c21 ')
        page.locator('[name=q11]').nth(1).check()
        page.locator('[name=experience]').nth(0).check()
        page.locator('[name=experience]').last.check()
        page.locator('#other').fill('=1+1 中文体验')
        page.reload()
        expect(page.locator('#code')).to_have_value(' c21 ')
        expect(page.locator('#other')).to_have_value('=1+1 中文体验')
        page.locator('[name=q11]').first.check()
        expect(page.locator('[name=experience]')).to_have_count(0)
        saved=json.loads(page.evaluate("localStorage.getItem('park-survey-static-v2')"))
        assert saved['experiences']==[] and saved['other']==''
        page.locator('[name=q11]').nth(1).check()
        page.locator('[name=experience]').first.check()
        page.locator('[name=experience]').last.check()
        page.locator('#other').fill('=1+1 中文体验')
        page.get_by_role('button',name='下一步：观看场景').click()
        expect(page.locator('.sticky')).to_contain_text('C2')
        for n in range(13,36,2):
            page.locator(f'#business-{n}').scroll_into_view_if_needed()
            page.locator(f'[name=c{n}][value=none]').check()
        page.locator('[name=c13][value=B]').check()
        page.locator('[name=f13]').nth(2).check()
        expect(page.locator('#confirmed')).to_have_count(0)
        expect(page.locator('details')).to_have_count(0)
        expect(page.locator('.styles strong')).to_have_count(3)
        assert 'autoplay=1' in page.locator('#video').get_attribute('src')
        assert 'autoplay' in page.locator('#video').get_attribute('allow')
        assert page.locator('#video').bounding_box()['height'] >= 844*.46-1
        boxes=[x.bounding_box() for x in page.locator('#follow-13 label').all()]
        assert len(set(round(b['y']) for b in boxes))==2
        boxes=[x.bounding_box() for x in page.locator('#business-13 > .choices label').all()]
        assert len(set(round(b['y']) for b in boxes))==1
        page.get_by_role('button',name='下一场景').click()
        expect(page.locator('.sticky')).to_contain_text('C1')
        expect(page.locator('[data-choice]:checked')).to_have_count(0)
        page.locator('#previous').click()
        expect(page.locator('[name=c13][value=B]')).to_be_checked()
        expect(page.locator('[name=f13]').nth(2)).to_be_checked()
        page.locator('[name=c13][value=none]').check()
        expect(page.locator('[name=f13]')).to_have_count(0)
        page.locator('[name=c13][value=A]').check()
        expect(page.locator('[name=f13]:checked')).to_have_count(0)
        page.locator('[name=f13]').last.check()
        expect(page.locator('[name=c13][value=A]')).to_be_checked()
        page.reload()
        expect(page.locator('[name=c13][value=A]')).to_be_checked()
        expect(page.locator('[name=f13]').last).to_be_checked()
        page.get_by_role('button',name='下一场景').click()
        for n in range(13,36,2):
            page.locator(f'#business-{n}').scroll_into_view_if_needed()
            page.locator(f'[name=c{n}][value=none]').check()
        expect(page.locator('#progress')).to_contain_text('100%')
        page.get_by_role('button',name='完成问卷',exact=True).click()
        expect(page.get_by_role('heading',name='问卷填写完成')).to_be_visible()
        page.reload()
        expect(page.get_by_role('heading',name='问卷填写完成')).to_be_visible()
        with page.expect_download() as event:
            page.locator('#download').click()
        downloaded=Path(event.value.path())
        assert event.value.suggested_filename.endswith('.xlsx')
        with zipfile.ZipFile(downloaded) as z:
            assert z.testzip() is None
            for name in z.namelist():
                ET.fromstring(z.read(name))
            wide=rows(z.read('xl/worksheets/sheet1.xml'))
            multi=rows(z.read('xl/worksheets/sheet2.xml'))
            assert len(wide)==2 and len(wide[0])==73 and len(wide[1])==73
            record=dict(zip(*wide))
            assert record['1. 受试者编号']=='C21'
            assert record['2. 年龄']=='1'
            assert record['12. 其他（填写内容）']=='=1+1 中文体验'
            assert record['12. 过去在公园中有过以下哪些休闲消费经历（多选题）—其他']=='13'
            assert record['12. 过去在公园中有过以下哪些休闲消费经历（多选题）—茶饮服务（如茶饮品鉴、茶文化体验等）']==''
            assert record['C2｜13. 在该公园场景下，您愿意选择哪个休闲消费方案？（演艺观赏服务）']=='1'
            assert record['C2｜14. 针对您刚选择的休闲消费方案，您预估的消费频次是？（演艺观赏服务）']=='6'
            assert record['C1｜13. 在该公园场景下，您愿意选择哪个休闲消费方案？（演艺观赏服务）']=='4'
            assert record['C1｜14. 针对您刚选择的休闲消费方案，您预估的消费频次是？（演艺观赏服务）']==''
            assert len(multi)==14 and multi[-1][2]=='13' and multi[2][2]==''
            assert b'<f>' not in z.read('xl/worksheets/sheet1.xml')
        # If available, use an independent Excel reader as well.
        try:
            import openpyxl
            with downloaded.open('rb') as handle:
                book=openpyxl.load_workbook(handle)
            assert book.sheetnames==['问卷数据','第12题多选']
            assert book['问卷数据']['B2'].value==1
            assert book['问卷数据']['B2'].data_type=='n'
            print('PASS: independent openpyxl XLSX reader')
        except ImportError:
            print('openpyxl not installed; ZIP CRC/XML and exported values verified')
        page.set_viewport_size({'width':1280,'height':900})
        page.locator('#edit').click()
        expect(page.locator('[name=c13][value=none]')).to_be_checked()
        page.locator('[name=c13][value=C]').check()
        page.locator('[name=f13]').first.check()
        page.get_by_role('button',name='完成问卷',exact=True).click()
        with page.expect_download() as event:
            page.locator('#download').click()
        with zipfile.ZipFile(event.value.path()) as z:
            modified=rows(z.read('xl/worksheets/sheet1.xml'))
            record=dict(zip(*modified))
            assert record['C1｜13. 在该公园场景下，您愿意选择哪个休闲消费方案？（演艺观赏服务）']=='3'
            assert record['C1｜14. 针对您刚选择的休闲消费方案，您预估的消费频次是？（演艺观赏服务）']=='1'
        # Old pending cloud drafts must become editable/downloadable without loss.
        page.evaluate("const s=JSON.parse(localStorage.getItem('park-survey-static-v2'));s.submissionSnapshot={submissionId:s.id};localStorage.setItem('park-survey-static-v2',JSON.stringify(s))")
        page.reload()
        expect(page.locator('#download')).to_be_visible()
        page.locator('#edit').click()
        expect(page.locator('[name=c13][value=C]')).to_be_checked()
        # Browser local storage is sufficient; no backend API requests exist.
        assert not any('/api/' in r for r in requests)
        assert not errors,errors
        assert json.loads(page.evaluate("localStorage.getItem('park-survey-static-v1')"))=={'test':'original draft preserved'}
        browser.close()
    print('PASS: project subpath, full mobile/desktop flow, all 36 questions, skips, separate scenes, return/edit, restore, XLSX download/readback, local Excel save and recovery of old pending drafts. Video mocked; file:// not tested (managed Chromium blocks it).')
finally:
    process.terminate()
    process.wait(timeout=10)
