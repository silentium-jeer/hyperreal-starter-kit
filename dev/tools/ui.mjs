// Drives the HTML UI inside a running game through the embedded browser's DevTools port
// (start the game with -cefdebug=9222). For agents verifying UI work in the real game:
//   node tools/ui.mjs text                      visible text of the page
//   node tools/ui.mjs click "<css selector>"    click an element (real input through CEF)
//   node tools/ui.mjs select "<css>" <value>    choose an <option>
//   node tools/ui.mjs eval "<js expression>"    evaluate in the page and print the result
//   node tools/ui.mjs console [ms]              print the page console for a while
// VGE_CDP overrides the endpoint (default http://127.0.0.1:9222, the HUD of `npm run play`'s game; the shell's
// page is on http://127.0.0.1:9221).
import { chromium } from 'playwright-core';

const [command, ...args] = process.argv.slice(2);
const endpoint = process.env.VGE_CDP ?? 'http://127.0.0.1:9222';

// Each process shows one page: a game's HUD, or the shell's app.
const browser = await chromium.connectOverCDP(endpoint);
const page = browser.contexts().flatMap((context) => context.pages())[0];
if (!page) {
  console.error(`no page at ${endpoint}`);
  process.exit(1);
}

if (command === 'text') {
  console.log(await page.locator('body').innerText());
} else if (command === 'click') {
  await page.locator(args[0]).first().click();
  console.log(`clicked ${args[0]}`);
} else if (command === 'select') {
  await page.locator(args[0]).first().selectOption(args[1]);
  console.log(`selected ${args[1]} in ${args[0]}`);
} else if (command === 'eval') {
  console.log(JSON.stringify(await page.evaluate(args[0]), null, 2));
} else if (command === 'console') {
  page.on('console', (message) => console.log(`[${message.type()}] ${message.text()}`));
  page.on('pageerror', (error) => console.log(`[pageerror] ${error.message}`));
  await new Promise((resolve) => setTimeout(resolve, Number(args[0] ?? 5000)));
} else {
  console.error('usage: node tools/ui.mjs text | click <css> | select <css> <value> | eval <js> | console [ms]');
  process.exit(1);
}
await browser.close();
