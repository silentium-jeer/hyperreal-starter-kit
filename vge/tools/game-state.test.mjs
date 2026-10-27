import assert from 'node:assert/strict';
import test from 'node:test';
import { createGameState, loadGame, saveGame, shallowEqual } from '../../src/shared/react/gameState.ts';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('changes in one task are announced once, after the task', async () => {
  const game = createGameState({ player: { health: 100, ammo: 6 }, wave: 1 });
  let announced = 0;
  game.subscribe(() => announced++);
  game.state.player.health -= 10;
  game.state.player.ammo -= 1;
  game.state.wave += 1;
  assert.equal(announced, 0);
  await tick();
  assert.equal(announced, 1);
  assert.equal(game.state.player.health, 90);
});

test('nested objects and arrays are seen when they change; writing the same value is not a change', async () => {
  const game = createGameState({ enemies: [{ id: 'a', alive: true }], shop: { ready: 0 } });
  let announced = 0;
  game.subscribe(() => announced++);
  game.state.shop.ready = 0;
  await tick();
  assert.equal(announced, 0);
  game.state.enemies.push({ id: 'b', alive: true });
  await tick();
  assert.equal(announced, 1);
  game.state.enemies[0].alive = false;
  await tick();
  assert.equal(announced, 2);
  delete game.state.shop.ready;
  await tick();
  assert.equal(announced, 3);
});

test('the tree holds plain objects, never proxies, so it saves as JSON and loads in place', async () => {
  const game = createGameState({ player: { health: 100 }, inventory: [] });
  const player = game.state.player;
  game.state.inventory.push(game.state.player);
  const saved = saveGame(game);
  assert.deepEqual(JSON.parse(saved), { player: { health: 100 }, inventory: [{ health: 100 }] });
  let announced = 0;
  game.subscribe(() => announced++);
  loadGame(game, JSON.stringify({ player: { health: 40 }, inventory: [] }));
  await tick();
  assert.equal(announced, 1);
  assert.equal(game.state.player.health, 40);
  assert.notEqual(game.state.player, player);
});

test('a selector returning new arrays or objects of the same values is equal', () => {
  assert.equal(shallowEqual([1, 'a'], [1, 'a']), true);
  assert.equal(shallowEqual({ health: 1, ammo: 2 }, { ammo: 2, health: 1 }), true);
  assert.equal(shallowEqual({ health: 1 }, { health: 2 }), false);
  assert.equal(shallowEqual([1], { 0: 1 }), false);
});

test('a listener stopped is not called again', async () => {
  const game = createGameState({ value: 0 });
  let announced = 0;
  const stop = game.subscribe(() => announced++);
  stop();
  game.state.value = 1;
  await tick();
  assert.equal(announced, 0);
});
