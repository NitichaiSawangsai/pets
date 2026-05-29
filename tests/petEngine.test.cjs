const test = require('node:test');
const assert = require('node:assert/strict');
const { createPetState, tick, care, buy, normalizeState } = require('../src/core/petEngine.cjs');

test('pet loses needs over time without going out of range', () => {
  const createdAt = Date.UTC(2026, 0, 1);
  const state = createPetState({ createdAt });
  const next = tick(state, createdAt + 6 * 60 * 60 * 1000);
  assert.equal(next.pet.alive, true);
  assert.ok(next.pet.hunger < state.pet.hunger);
  assert.ok(next.pet.loneliness > state.pet.loneliness);
  assert.ok(next.pet.hunger >= 0 && next.pet.hunger <= 100);
  assert.ok(next.pet.loneliness >= 0 && next.pet.loneliness <= 100);
});

test('food is finite and feeding consumes inventory', () => {
  const state = createPetState({ createdAt: Date.UTC(2026, 0, 1) });
  state.pet.hunger = 20;
  state.inventory.kibble = 1;
  const fed = care(state, 'feed', { itemId: 'kibble', at: state.pet.lastTickAt });
  assert.equal(fed.inventory.kibble, 0);
  assert.ok(fed.pet.hunger > 20);
  const unfed = care(fed, 'feed', { itemId: 'kibble', at: fed.pet.lastTickAt });
  assert.equal(unfed.inventory.kibble, 0);
});

test('care actions earn coins and shop purchases spend coins', () => {
  const state = createPetState({ createdAt: Date.UTC(2026, 0, 1) });
  state.pet.coins = 0;
  const worked = care(state, 'work', { at: state.pet.lastTickAt });
  assert.equal(worked.pet.coins, 10);
  const bought = buy(worked, 'kibble', 1, worked.pet.lastTickAt);
  assert.equal(bought.pet.coins, 5);
  assert.equal(bought.inventory.kibble, 4);
});

test('neglected pet can die', () => {
  const createdAt = Date.UTC(2026, 0, 1);
  const state = createPetState({ createdAt });
  state.pet.hunger = 1;
  state.pet.health = 2;
  state.pet.sickness = 100;
  const next = tick(state, createdAt + 24 * 60 * 60 * 1000);
  assert.equal(next.pet.alive, false);
  assert.ok(next.pet.causeOfDeath);
});

test('normalization clamps invalid untrusted state', () => {
  const state = normalizeState({
    pet: {
      name: '<script>alert(1)</script>',
      hunger: 999,
      loneliness: -50
    },
    settings: {
      position: { x: -10, y: 1_000_000 }
    }
  });
  assert.equal(state.pet.hunger, 100);
  assert.equal(state.pet.loneliness, 0);
  assert.equal(state.settings.position.x, 0);
  assert.equal(state.settings.position.y, 10000);
  assert.doesNotMatch(state.pet.name, /[<>]/);
});
