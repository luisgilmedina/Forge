"""Smoke-test HTML bundled into the APK on a tablet-sized Chromium viewport.
This is NOT a real Android WebView or an APK installation test.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

assets = Path(__file__).parent / 'app/src/main/assets/www'
html = (assets / 'index.html').read_text()
html = html.replace('<link rel="stylesheet" href="style.css" />',
                    f'<style>{(assets / "style.css").read_text()}</style>')
for name in ['core.js', 'web-bridge.js', 'app.js']:
    html = html.replace(f'<script src="{name}" defer></script>',
                        f'<script>{(assets / name).read_text()}</script>')

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                args=['--no-sandbox', '--disable-dev-shm-usage'])
    page = browser.new_page(viewport={'width': 768, 'height': 1024})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.evaluate("""() => {
      const mem = new Map();
      Object.defineProperty(window, 'localStorage', {
        value: {getItem:k => mem.has(k) ? mem.get(k) : null,
                setItem:(k,v)=>mem.set(k,v), removeItem:k=>mem.delete(k)}
      });
      if (!crypto.randomUUID) crypto.randomUUID=()=>String(Math.random());
      window.FocusForgeAndroid = {saveBackup: text => window.__lastBackup = JSON.parse(text)};
    }""")
    page.set_content(html, wait_until='domcontentloaded')
    page.locator('#plan-subject').wait_for(timeout=6000)
    page.locator('#plan-subject').fill('Biología')
    page.locator('#plan-minutes').fill('1')
    page.locator('#add-plan').click()
    assert page.get_by_text('Biología').count() > 0
    page.locator('#start').click()
    page.locator('#stop').wait_for(timeout=4000)
    page.locator('#stop').click()
    page.locator('[data-view="materials"]').click()
    page.locator('#paste-title').fill('Apuntes de prueba')
    page.locator('#paste-text').fill('Contenido de biología.')
    page.locator('#save-text').click()
    assert page.get_by_text('Apuntes de prueba').count() > 0
    page.locator('[data-view="errors"]').click()
    page.locator('#manual-question').fill('¿Qué es la mitosis?')
    page.locator('#manual-answer').fill('División celular.')
    page.locator('#manual-error').evaluate('(el) => el.requestSubmit()')
    assert page.get_by_text('¿Qué es la mitosis?').count() > 0
    page.locator('[data-view="settings"]').click()
    page.locator('#export-data').click()
    backup = page.evaluate('window.__lastBackup')
    assert backup['format'] == 'focusforge-0.1'
    assert backup['ff_materials'][0]['name'] == 'Apuntes de prueba'
    assert not errors, errors
    print('QA visual/funcional navegador 768px: PASS (sesión, apuntes, tarjetas, copia Android JS)')
    browser.close()
