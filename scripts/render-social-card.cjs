// Deterministic, code-native brand composition; no external assets or user data.
const path = require('node:path');
const {createRequire} = require('node:module');
const runtime = process.env.AROLIX_BROWSER_RUNTIME || '/Users/pedrotorres/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium} = createRequire(path.join(runtime,'playwright/package.json'))('playwright');
(async () => {
  const browser = await chromium.launch({headless:true,channel:'chrome'});
  try {
    const page = await browser.newPage({viewport:{width:1200,height:630},deviceScaleFactor:1});
    await page.goto('file://' + path.resolve(__dirname,'../assets/social/arolix-share.html'));
    await page.evaluate(async () => {await document.fonts.ready; await Promise.all(Array.from(document.images,image => image.decode()));});
    await page.screenshot({path:path.resolve(__dirname,'../assets/social/arolix-share-20261029.png'),type:'png'});
    console.log('Imagem de compartilhamento renderizada: 1200 × 630.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1;});
