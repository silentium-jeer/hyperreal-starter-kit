// Fab for agents: find assets with Fab's own search and show the user a listing in the shell's Fab window, where the
// user signs in and presses the button that adds it to the project (content/fab.mjs takes it from there).
//   node vge/tools/fab.mjs search "<words>" [--free] [--format unreal-engine|gltf|fbx] [--count 10]
//                                          Fab's search (https://www.fab.com/i/listings/search, what fab.com's own
//                                          search page calls), run inside the Fab window's page; prints each listing
//                                          with its link
//   node vge/tools/fab.mjs open <listing link or id>   the Fab window on that listing (opened if it is not)
//   node vge/tools/fab.mjs installs                     what was added from the Fab window: state, progress, where it landed
//   node vge/tools/fab.mjs pack <Pack> [--from <dir>]   a pack already on disk (the launcher's download, VaultCache/<Name>/data)
//                                                   into Content/<Pack> and its own container, as Add to Project does
//   node vge/tools/fab.mjs plugin <dir>                 a plugin already on disk (<Name>.uplugin and Source) into
//                                                   Plugins/Marketplace/<Name> and a runtime build, as Install Plugin does
//                                                   after its download; waits for the build (half an hour)
// Needs this kit's dev server and shell (npm run dev, npm run shell). The search goes through the Fab window because
// fab.com answers only a browser that passed its bot check; when the window shows that check, the user passes it.
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { devServerUrl, ports } from './engine.mjs';

const [command, ...rest] = process.argv.slice(2);
const VALUED = ['format', 'count', 'from'];
const options = {};
const positional = [];
for (let index = 0; index < rest.length; index++) {
  const name = rest[index].startsWith('--') ? rest[index].slice(2) : null;
  if (name === null) positional.push(rest[index]);
  else options[name] = VALUED.includes(name) ? rest[++index] : true;
}
const option = (name, fallback) => options[name] ?? fallback;
const flag = (name) => options[name] === true;

const listingUrl = (idOrUrl) => (/^https?:\/\//.test(idOrUrl) ? idOrUrl : `https://www.fab.com/listings/${idOrUrl}`);

async function post(path, body) {
  const response = await fetch(`${devServerUrl()}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

async function open(url) {
  const { pages } = await post('/__vge/fab/open', { url });
  if (!pages) throw new Error('no shell page is connected to the dev server: start the shell (npm run shell)');
}

// The Fab window's page in the shell's DevTools (the shell opens it when it is not there yet).
async function fabPage() {
  const endpoint = `http://127.0.0.1:${ports().shell}`;
  const browser = await chromium.connectOverCDP(endpoint).catch(() => {
    throw new Error(`the shell is not running (no DevTools at ${endpoint}): npm run shell`);
  });
  const find = () => browser.contexts().flatMap((context) => context.pages()).find((page) => /^https:\/\/(www\.)?fab\.com\//.test(page.url()));
  if (!find()) await open('https://www.fab.com/plugins/ue5');
  for (let waited = 0; !find() && waited < 20000; waited += 500) await new Promise((resolve) => setTimeout(resolve, 500));
  const page = find();
  if (!page) throw new Error('the Fab window did not open');
  await page.waitForLoadState('domcontentloaded');
  return { browser, page };
}

async function search(words) {
  const params = new URLSearchParams({ q: words, count: option('count', '10') });
  if (flag('free')) params.set('is_free', '1');
  if (option('format')) params.set('asset_formats', option('format'));
  const { browser, page } = await fabPage();
  const answer = await page.evaluate(async (query) => {
    const response = await fetch(`/i/listings/search?${query}`, { headers: { accept: 'application/json' } });
    return { status: response.status, title: document.title, body: response.ok ? await response.json() : null };
  }, params.toString());
  await browser.close();
  if (!answer.body) {
    throw new Error(`Fab's search answered HTTP ${answer.status} (window: "${answer.title}"); if the Fab window shows a bot check, the user passes it there`);
  }
  for (const listing of answer.body.results) {
    const formats = (listing.assetFormats ?? []).map((format) => format.assetFormatType?.code).filter(Boolean);
    const price = listing.isFree ? 'free' : listing.startingPrice ? `from ${listing.startingPrice.price} USD` : 'price on the page';
    console.log(`${listing.title}\n  ${listingUrl(listing.uid)}\n  ${listing.listingType}; formats: ${formats.join(', ')}; ${price}; by ${listing.user?.sellerName ?? '?'}`);
  }
  if (!answer.body.results.length) console.log('nothing found');
}

try {
  if (command === 'search' && positional.length) await search(positional.join(' '));
  else if (command === 'open' && positional[0]) {
    await open(listingUrl(positional[0]));
    console.log(`[fab] the Fab window shows ${listingUrl(positional[0])}`);
  } else if (command === 'pack' && positional[0]) {
    const response = await fetch(`${devServerUrl()}/__vge/fab/pack`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: positional[0], from: option('from') }) });
    const answer = await response.json();
    if (answer.error) throw new Error(answer.error);
    console.log(JSON.stringify(answer, null, 2));
  } else if (command === 'plugin' && positional[0]) {
    const from = resolve(positional[0]);
    const answer = await (await fetch(`${devServerUrl()}/__vge/fab/plugin`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from }) })).json();
    if (answer.error) throw new Error(answer.error);
    const name = readdirSync(from).find((file) => /\.uplugin$/i.test(file)).replace(/\.uplugin$/i, '');
    let shown = '';
    for (;;) {
      await new Promise((done) => setTimeout(done, 5000));
      const entry = (await (await fetch(`${devServerUrl()}/__vge/fab/installs`)).json())[`plugin:${name}`];
      const line = `${entry?.state} ${entry?.progress?.stage ?? ''}`;
      if (line !== shown) console.log(`[fab] ${name}: ${(shown = line)}`);
      if (entry?.state === 'done') { console.log(JSON.stringify(entry.result, null, 2)); break; }
      if (entry?.state === 'failed') throw new Error(entry.error);
    }
  } else if (command === 'installs') {
    const response = await fetch(`${devServerUrl()}/__vge/fab/installs`);
    console.log(JSON.stringify(await response.json(), null, 2));
  } else {
    console.error('usage: node vge/tools/fab.mjs search "<words>" [--free] [--format unreal-engine|gltf|fbx] [--count 10] | open <listing link or id> | installs | pack <Pack> [--from <dir>] | plugin <dir>');
    process.exit(1);
  }
} catch (err) {
  console.error(`[fab] ${err.message}`);
  process.exit(1);
}
