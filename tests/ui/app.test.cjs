const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mkdtempSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
test('Electron opens the existing local interface', {timeout:30000}, async t=>{
 const {_electron}=require('playwright');
 const app=await _electron.launch({env:{...process.env,XDG_CONFIG_HOME:mkdtempSync(path.join(tmpdir(),'blego-config-')),XDG_CACHE_HOME:mkdtempSync(path.join(tmpdir(),'blego-cache-'))},args:[...(process.env.BLEGO_HEADLESS?['--ozone-platform=headless']:[]),'.',`--user-data-dir=${mkdtempSync(path.join(tmpdir(),'blego-ui-'))}`]});
 t.after(()=>app.close());
 const page=await app.firstWindow(); await page.locator('.brand-name').waitFor();
 assert.equal(await page.locator('.brand-name').textContent(),'BLEGO');
});
