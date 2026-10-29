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
    return [[c.find('m:is/m:t', NS).text if c.get('t') == 'inlineStr' and c.find('m:is/m:t', NS) is not None else c.findtext('m:v', default='', namespaces=NS) for c in row] for row in root.findall('m:sheetData/m:row', NS)]

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
        page.locator('#consent').check()
        page.locator('#start').click()
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
        saved=json.loads(page.evaluate("localStorage.getItem('park-survey-static-v1')"))
        assert saved['experiences']==[] and saved['other']==''
        page.locator('[name=q11]').nth(1).check()
        page.locator('[name=experience]').first.check()
        page.locator('[name=experience]').last.check()
        page.locator('#other').fill('=1+1 中文体验')
        page.get_by_role('button',name='下一步：观看场景').click()
        expect(page.locator('.sticky')).to_contain_text('C2')
        page.locator('#confirmed').check()
        for n in range(13,36,2):
            page.locator(f'[name=c{n}][value=none]').check()
        page.locator('[name=c13][value=B]').check()
        page.locator('[name=f13]').nth(2).check()
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
        page.locator('#retry').click()
        expect(page.locator('#confirmed')).not_to_be_checked()
        expect(page.locator('[name=c13][value=A]')).to_be_checked()
        page.locator('#confirmed').check()
        page.reload()
        expect(page.locator('[name=c13][value=A]')).to_be_checked()
        expect(page.locator('[name=f13]').last).to_be_checked()
        page.get_by_role('button',name='下一场景').click()
        page.locator('#confirmed').check()
        for n in range(13,36,2):
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
            basic=rows(z.read('xl/worksheets/sheet1.xml'))
            scenes=rows(z.read('xl/worksheets/sheet2.xml'))
            plans=rows(z.read('xl/worksheets/sheet3.xml'))
            assert ['12. 其他','=1+1 中文体验'] in basic
            assert len(scenes)==25 and len(plans)==37
            assert scenes[1][3]=='C2' and scenes[13][3]=='C1'
            assert scenes[1][10:15]==['A','主题型','236','每年1-2次','answered']
            assert scenes[2][14]=='not_applicable'
            assert b'<f>' not in z.read('xl/worksheets/sheet1.xml')
        # If available, use an independent Excel reader as well.
        try:
            import openpyxl
            with downloaded.open('rb') as handle:
                book=openpyxl.load_workbook(handle)
            assert book.sheetnames==['基本信息','场景作答','方案配置']
            assert book['场景作答']['M2'].value==236
            assert book['场景作答']['M2'].data_type=='n'
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
            modified=rows(z.read('xl/worksheets/sheet2.xml'))
            assert modified[13][10:14]==['C','自然型','120','每天']
        # Browser local storage is sufficient; no backend API requests exist.
        assert not any('/api/' in r for r in requests)
        assert not errors,errors
        browser.close()
    print('PASS: project subpath, full mobile/desktop flow, all 36 questions, skips, separate scenes, return/edit, restore, XLSX download/readback, no APIs. Video mocked; file:// not tested (managed Chromium blocks it).')
finally:
    process.terminate()
    process.wait(timeout=10)
