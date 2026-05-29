const DEFAULT_PET_TYPES = Object.freeze([
  {
    id: 'mamecat',
    name: 'Mame Cat',
    emoji: '🐱',
    palette: ['#ffcf7d', '#40312a'],
    favoriteFood: 'salmon-bite'
  },
  {
    id: 'bunbun',
    name: 'Bunbun',
    emoji: '🐰',
    palette: ['#f7d6e6', '#493146'],
    favoriteFood: 'berry-mochi'
  },
  {
    id: 'pupdot',
    name: 'Pup Dot',
    emoji: '🐶',
    palette: ['#bfe3ff', '#26364a'],
    favoriteFood: 'crunch-bone'
  },
  {
    id: 'starblob',
    name: 'Star Blob',
    emoji: '🌟',
    palette: ['#d7f37f', '#2e4021'],
    favoriteFood: 'moon-drop'
  }
]);

const SHOP_ITEMS = Object.freeze([
  { id: 'kibble', name: 'Kibble', price: 5, hunger: 18, happiness: 2, stock: 3 },
  { id: 'berry-mochi', name: 'Berry Mochi', price: 12, hunger: 24, happiness: 8, stock: 1 },
  { id: 'salmon-bite', name: 'Salmon Bite', price: 12, hunger: 24, happiness: 8, stock: 1 },
  { id: 'crunch-bone', name: 'Crunch Bone', price: 12, hunger: 24, happiness: 8, stock: 1 },
  { id: 'moon-drop', name: 'Moon Drop', price: 16, hunger: 20, happiness: 14, stock: 1 },
  { id: 'medicine', name: 'Medicine', price: 18, health: 35, sickness: -45, stock: 1 }
]);

const LIMITS = Object.freeze({
  hunger: [0, 100],
  happiness: [0, 100],
  health: [0, 100],
  loneliness: [0, 100],
  cleanliness: [0, 100],
  energy: [0, 100],
  sickness: [0, 100],
  coins: [0, 9999]
});

function clamp(value, key) {
  const [min, max] = LIMITS[key] || [0, 100];
  return Math.max(min, Math.min(max, Math.round(value)));
}

function now() {
  return Date.now();
}

function createPetState(options = {}) {
  const petType = DEFAULT_PET_TYPES.some((type) => type.id === options.typeId)
    ? options.typeId
    : DEFAULT_PET_TYPES[0].id;

  return {
    version: 1,
    pet: {
      id: options.id || cryptoRandomId(),
      name: sanitizePetName(options.name || 'Mochi'),
      typeId: petType,
      bornAt: options.createdAt || now(),
      lastTickAt: options.createdAt || now(),
      alive: true,
      causeOfDeath: null,
      hunger: 72,
      happiness: 72,
      health: 88,
      loneliness: 18,
      cleanliness: 82,
      energy: 76,
      sickness: 0,
      coins: 20,
      careStreak: 0,
      totalCareActions: 0,
      mood: 'curious'
    },
    inventory: {
      kibble: 3,
      medicine: 1
    },
    settings: {
      focusMode: false,
      soundEnabled: true,
      launchAtLogin: false,
      position: { x: 24, y: 160 },
      syncMode: 'icloud-file'
    },
    shop: restockShop(options.createdAt || now()),
    events: []
  };
}

function cryptoRandomId() {
  return `pet_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function sanitizePetName(value) {
  return String(value || 'Mochi')
    .replace(/[^\p{L}\p{N} _.-]/gu, '')
    .trim()
    .slice(0, 24) || 'Mochi';
}

function normalizeState(input) {
  const base = createPetState();
  if (!input || typeof input !== 'object') return base;
  const state = {
    ...base,
    ...input,
    pet: { ...base.pet, ...(input.pet || {}) },
    inventory: { ...base.inventory, ...(input.inventory || {}) },
    settings: { ...base.settings, ...(input.settings || {}) },
    shop: Array.isArray(input.shop) ? input.shop : base.shop,
    events: Array.isArray(input.events) ? input.events.slice(-40) : []
  };

  state.pet.name = sanitizePetName(state.pet.name);
  state.pet.typeId = DEFAULT_PET_TYPES.some((type) => type.id === state.pet.typeId)
    ? state.pet.typeId
    : DEFAULT_PET_TYPES[0].id;
  for (const key of Object.keys(LIMITS)) {
    state.pet[key] = clamp(Number(state.pet[key] || 0), key);
  }
  state.pet.alive = Boolean(state.pet.alive);
  state.pet.lastTickAt = Number.isFinite(Number(state.pet.lastTickAt)) ? Number(state.pet.lastTickAt) : now();
  state.settings.focusMode = Boolean(state.settings.focusMode);
  state.settings.soundEnabled = Boolean(state.settings.soundEnabled);
  state.settings.launchAtLogin = Boolean(state.settings.launchAtLogin);
  state.settings.position = {
    x: clampCoordinate(state.settings.position?.x, 24),
    y: clampCoordinate(state.settings.position?.y, 160)
  };
  return state;
}

function clampCoordinate(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(10000, Math.round(number))) : fallback;
}

function restockShop(at = now()) {
  return SHOP_ITEMS.map((item) => ({ ...item, available: item.stock, restockedAt: at }));
}

function tick(rawState, at = now()) {
  const state = normalizeState(rawState);
  if (!state.pet.alive) return state;

  const elapsedMinutes = Math.max(0, Math.min(60 * 24 * 7, (at - state.pet.lastTickAt) / 60000));
  const focusMultiplier = state.settings.focusMode ? 0.55 : 1;
  const hungerLoss = elapsedMinutes * 0.18 * focusMultiplier;
  const lonelyGain = elapsedMinutes * 0.14 * focusMultiplier;
  const energyLoss = elapsedMinutes * 0.08;
  const cleanLoss = elapsedMinutes * 0.1;

  state.pet.hunger = clamp(state.pet.hunger - hungerLoss, 'hunger');
  state.pet.loneliness = clamp(state.pet.loneliness + lonelyGain, 'loneliness');
  state.pet.energy = clamp(state.pet.energy - energyLoss, 'energy');
  state.pet.cleanliness = clamp(state.pet.cleanliness - cleanLoss, 'cleanliness');

  const sicknessPressure = Math.max(0, 35 - state.pet.cleanliness) * 0.0018
    + Math.max(0, 25 - state.pet.hunger) * 0.0022
    + Math.max(0, state.pet.loneliness - 78) * 0.0016;
  state.pet.sickness = clamp(state.pet.sickness + elapsedMinutes * sicknessPressure, 'sickness');

  const healthLoss = Math.max(0, 24 - state.pet.hunger) * 0.006 * elapsedMinutes
    + Math.max(0, state.pet.sickness - 40) * 0.0015 * elapsedMinutes
    + Math.max(0, state.pet.loneliness - 86) * 0.004 * elapsedMinutes;
  state.pet.health = clamp(state.pet.health - healthLoss, 'health');
  state.pet.happiness = clamp(
    state.pet.happiness
      - elapsedMinutes * 0.08
      - Math.max(0, state.pet.loneliness - 70) * 0.008 * elapsedMinutes
      - Math.max(0, state.pet.sickness - 50) * 0.006 * elapsedMinutes,
    'happiness'
  );

  if (state.pet.health <= 0 || (state.pet.hunger <= 0 && elapsedMinutes > 180)) {
    state.pet.alive = false;
    state.pet.causeOfDeath = state.pet.health <= 0 ? 'illness' : 'starvation';
    addEvent(state, 'death', `${state.pet.name} passed away.`);
  } else {
    state.pet.mood = resolveMood(state.pet);
  }

  state.pet.lastTickAt = at;
  maybeDailyRestock(state, at);
  return state;
}

function resolveMood(pet) {
  if (!pet.alive) return 'gone';
  if (pet.sickness > 55 || pet.health < 45) return 'sick';
  if (pet.hunger < 35) return 'hungry';
  if (pet.loneliness > 72) return 'lonely';
  if (pet.energy < 25) return 'sleepy';
  if (pet.happiness > 82 && pet.hunger > 55) return 'sparkly';
  return 'curious';
}

function maybeDailyRestock(state, at) {
  const latest = Math.max(...state.shop.map((item) => Number(item.restockedAt || 0)));
  const dayMs = 24 * 60 * 60 * 1000;
  if (at - latest >= dayMs) {
    state.shop = restockShop(at);
    addEvent(state, 'shop', 'The tiny shop has restocked.');
  }
}

function addEvent(state, type, message) {
  state.events = [
    ...(state.events || []),
    { id: cryptoRandomId(), type, message, at: now() }
  ].slice(-40);
}

function care(rawState, action, options = {}) {
  const state = tick(rawState, options.at || now());
  if (!state.pet.alive && action !== 'rebirth') return state;

  switch (action) {
    case 'feed':
      return feed(state, options.itemId || 'kibble');
    case 'play':
      state.pet.happiness = clamp(state.pet.happiness + 15, 'happiness');
      state.pet.loneliness = clamp(state.pet.loneliness - 24, 'loneliness');
      state.pet.energy = clamp(state.pet.energy - 8, 'energy');
      rewardCare(state, 4, 'Played together.');
      break;
    case 'clean':
      state.pet.cleanliness = clamp(state.pet.cleanliness + 32, 'cleanliness');
      state.pet.sickness = clamp(state.pet.sickness - 12, 'sickness');
      rewardCare(state, 3, 'Cleaned up.');
      break;
    case 'rest':
      state.pet.energy = clamp(state.pet.energy + 34, 'energy');
      state.pet.happiness = clamp(state.pet.happiness + 4, 'happiness');
      rewardCare(state, 2, 'Had a quiet nap.');
      break;
    case 'medicine':
      return useMedicine(state);
    case 'work':
      state.pet.energy = clamp(state.pet.energy - 6, 'energy');
      state.pet.loneliness = clamp(state.pet.loneliness - 8, 'loneliness');
      state.pet.coins = clamp(state.pet.coins + 10, 'coins');
      rewardCare(state, 0, 'Helped with a tiny task and earned coins.');
      break;
    case 'rebirth':
      return createPetState({
        name: options.name || state.pet.name,
        typeId: options.typeId || state.pet.typeId,
        createdAt: options.at || now()
      });
    default:
      addEvent(state, 'noop', 'Nothing happened.');
  }

  state.pet.mood = resolveMood(state.pet);
  return state;
}

function feed(state, itemId) {
  const count = Number(state.inventory[itemId] || 0);
  if (count <= 0) {
    addEvent(state, 'food-empty', 'That food is out of stock.');
    return state;
  }
  const item = SHOP_ITEMS.find((shopItem) => shopItem.id === itemId) || SHOP_ITEMS[0];
  state.inventory[itemId] = count - 1;
  state.pet.hunger = clamp(state.pet.hunger + item.hunger, 'hunger');
  state.pet.happiness = clamp(state.pet.happiness + item.happiness, 'happiness');
  if (item.health) state.pet.health = clamp(state.pet.health + item.health, 'health');
  if (item.sickness) state.pet.sickness = clamp(state.pet.sickness + item.sickness, 'sickness');
  rewardCare(state, 2, `Ate ${item.name}.`);
  state.pet.mood = resolveMood(state.pet);
  return state;
}

function useMedicine(state) {
  const count = Number(state.inventory.medicine || 0);
  if (count <= 0) {
    addEvent(state, 'medicine-empty', 'No medicine left.');
    return state;
  }
  state.inventory.medicine = count - 1;
  state.pet.health = clamp(state.pet.health + 35, 'health');
  state.pet.sickness = clamp(state.pet.sickness - 45, 'sickness');
  rewardCare(state, 1, 'Took medicine.');
  state.pet.mood = resolveMood(state.pet);
  return state;
}

function rewardCare(state, coins, message) {
  state.pet.coins = clamp(state.pet.coins + coins, 'coins');
  state.pet.careStreak += 1;
  state.pet.totalCareActions += 1;
  addEvent(state, 'care', message);
}

function buy(rawState, itemId, quantity = 1, at = now()) {
  const state = tick(rawState, at);
  if (!state.pet.alive) return state;
  const item = state.shop.find((shopItem) => shopItem.id === itemId);
  const amount = Math.max(1, Math.min(20, Math.floor(Number(quantity) || 1)));
  if (!item || item.available < amount) {
    addEvent(state, 'shop-empty', 'The shop is out of that item.');
    return state;
  }
  const total = item.price * amount;
  if (state.pet.coins < total) {
    addEvent(state, 'coins-low', 'Not enough coins.');
    return state;
  }
  item.available -= amount;
  state.pet.coins = clamp(state.pet.coins - total, 'coins');
  state.inventory[itemId] = Number(state.inventory[itemId] || 0) + amount;
  addEvent(state, 'buy', `Bought ${amount} ${item.name}.`);
  return state;
}

function getStatusMessage(state) {
  const pet = normalizeState(state).pet;
  if (!pet.alive) return `${pet.name} is gone. Start a new life when you are ready.`;
  if (pet.mood === 'sick') return `${pet.name} feels unwell.`;
  if (pet.mood === 'hungry') return `${pet.name} is hungry.`;
  if (pet.mood === 'lonely') return `${pet.name} wants attention.`;
  if (pet.mood === 'sleepy') return `${pet.name} is sleepy.`;
  if (pet.mood === 'sparkly') return `${pet.name} is thriving.`;
  return `${pet.name} is watching you work.`;
}

module.exports = {
  DEFAULT_PET_TYPES,
  SHOP_ITEMS,
  createPetState,
  normalizeState,
  tick,
  care,
  buy,
  getStatusMessage,
  sanitizePetName
};
