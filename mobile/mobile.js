const PET_TYPES = [
  { id: 'mamecat', name: 'Mame Cat', emoji: '🐱', palette: ['#ffcf7d', '#40312a'] },
  { id: 'bunbun', name: 'Bunbun', emoji: '🐰', palette: ['#f7d6e6', '#493146'] },
  { id: 'pupdot', name: 'Pup Dot', emoji: '🐶', palette: ['#bfe3ff', '#26364a'] },
  { id: 'starblob', name: 'Star Blob', emoji: '🌟', palette: ['#d7f37f', '#2e4021'] }
];

const SHOP = [
  { id: 'kibble', name: 'Kibble', price: 5, hunger: 18, happiness: 2, available: 3 },
  { id: 'medicine', name: 'Medicine', price: 18, health: 35, sickness: -45, available: 1 }
];

const els = {
  pet: document.getElementById('pet'),
  effectLayer: document.getElementById('effectLayer'),
  petName: document.getElementById('petName'),
  coins: document.getElementById('coins'),
  message: document.getElementById('message'),
  meters: document.getElementById('meters'),
  shop: document.getElementById('shop')
};

const meterKeys = ['hunger', 'happiness', 'health', 'loneliness', 'cleanliness', 'energy'];
const playEffects = ['spin-hop', 'zigzag-dance', 'star-jump', 'wiggle-pop'];
let state = load();
let playEffectIndex = 0;
let sicknessAnnounced = false;

function create() {
  const at = Date.now();
  return {
    pet: {
      name: 'Mochi',
      typeId: 'mamecat',
      alive: true,
      hunger: 72,
      happiness: 72,
      health: 88,
      loneliness: 18,
      cleanliness: 82,
      energy: 76,
      sickness: 0,
      coins: 20,
      lastTickAt: at,
      mood: 'curious'
    },
    inventory: { kibble: 3, medicine: 1 },
    shop: SHOP
  };
}

function load() {
  try {
    return JSON.parse(localStorage.getItem('pocket-pals-state')) || create();
  } catch {
    return create();
  }
}

function save() {
  localStorage.setItem('pocket-pals-state', JSON.stringify(state));
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function tick() {
  if (!state.pet.alive) return;
  const elapsed = Math.max(0, Math.min(10080, (Date.now() - state.pet.lastTickAt) / 60000));
  state.pet.hunger = clamp(state.pet.hunger - elapsed * 0.42);
  state.pet.loneliness = clamp(state.pet.loneliness + elapsed * 0.24);
  state.pet.energy = clamp(state.pet.energy - elapsed * 0.13);
  state.pet.cleanliness = clamp(state.pet.cleanliness - elapsed * 0.18);
  state.pet.sickness = clamp(state.pet.sickness + Math.max(0, 35 - state.pet.hunger) * 0.02 * elapsed);
  state.pet.health = clamp(state.pet.health - Math.max(0, state.pet.sickness - 40) * 0.012 * elapsed);
  if (state.pet.health <= 0 || state.pet.hunger <= 0) state.pet.alive = false;
  state.pet.mood = mood();
  state.pet.lastTickAt = Date.now();
}

function mood() {
  const pet = state.pet;
  if (!pet.alive) return 'gone';
  if (pet.sickness > 55 || pet.health < 45) return 'sick';
  if (pet.hunger < 35) return 'hungry';
  if (pet.loneliness > 72) return 'lonely';
  if (pet.energy < 25) return 'sleepy';
  return 'curious';
}

function care(action) {
  tick();
  const pet = state.pet;
  if (!pet.alive) return;
  let didAct = false;
  if (action === 'feed' && state.inventory.kibble > 0) {
    state.inventory.kibble -= 1;
    pet.hunger = clamp(pet.hunger + 18);
    pet.happiness = clamp(pet.happiness + 2);
    pet.coins += 2;
    didAct = true;
  }
  if (action === 'play') {
    pet.happiness = clamp(pet.happiness + 15);
    pet.loneliness = clamp(pet.loneliness - 24);
    pet.energy = clamp(pet.energy - 8);
    pet.coins += 4;
    didAct = true;
  }
  if (action === 'clean') {
    pet.cleanliness = clamp(pet.cleanliness + 32);
    pet.sickness = clamp(pet.sickness - 12);
    pet.coins += 3;
    didAct = true;
  }
  if (action === 'rest') {
    pet.energy = clamp(pet.energy + 34);
    pet.coins += 2;
    didAct = true;
  }
  if (action === 'medicine' && state.inventory.medicine > 0) {
    state.inventory.medicine -= 1;
    pet.health = clamp(pet.health + 35);
    pet.sickness = clamp(pet.sickness - 45);
    didAct = true;
  }
  if (action === 'work') {
    pet.energy = clamp(pet.energy - 6);
    pet.loneliness = clamp(pet.loneliness - 8);
    pet.coins += 10;
    didAct = true;
  }
  pet.mood = mood();
  save();
  render();
  if (didAct) triggerEffect(action);
}

function buy(itemId) {
  tick();
  const item = state.shop.find((entry) => entry.id === itemId);
  if (!item || item.available <= 0 || state.pet.coins < item.price) return;
  item.available -= 1;
  state.pet.coins -= item.price;
  state.inventory[itemId] = Number(state.inventory[itemId] || 0) + 1;
  save();
  render();
  triggerEffect('buy');
}

function render() {
  tick();
  const petType = PET_TYPES.find((type) => type.id === state.pet.typeId) || PET_TYPES[0];
  els.petName.textContent = state.pet.name;
  els.pet.textContent = state.pet.alive ? petType.emoji : '✕';
  els.pet.style.background = petType.palette[0];
  els.pet.style.borderColor = petType.palette[1];
  document.body.classList.toggle('sick', state.pet.mood === 'sick');
  els.coins.textContent = `$${state.pet.coins}`;
  els.message.textContent = state.pet.alive ? `Mood: ${state.pet.mood}` : 'Start a new life on desktop.';
  els.meters.replaceChildren(...meterKeys.map((key) => {
    const value = state.pet[key];
    const node = document.createElement('div');
    node.className = 'meter';
    node.innerHTML = `<label><span>${key}</span><strong>${value}</strong></label><div class="bar"><span style="width:${key === 'loneliness' ? 100 - value : value}%"></span></div>`;
    return node;
  }));
  els.shop.replaceChildren(...state.shop.map((item) => {
    const button = document.createElement('button');
    button.textContent = `${item.name} $${item.price}`;
    button.disabled = item.available <= 0 || state.pet.coins < item.price;
    button.addEventListener('click', () => buy(item.id));
    return button;
  }));
  save();
  if (state.pet.mood === 'sick' && !sicknessAnnounced) {
    sicknessAnnounced = true;
    triggerEffect('sick');
  }
  if (state.pet.mood !== 'sick') sicknessAnnounced = false;
}

function triggerEffect(action) {
  const effectClass = resolveEffectClass(action);
  restartClass(els.pet, effectClass);
  if (action === 'feed') {
    spawnBurst(['●', '♡', '•'], 8, 'float-snack');
    els.message.textContent = 'nom nom';
  } else if (action === 'play') {
    spawnBurst(['✦', '★', '♡', '•'], 12, 'confetti-pop');
    els.message.textContent = effectClass.replace('-', ' ');
  } else if (action === 'medicine' || action === 'sick') {
    spawnBurst(['＋', '◇', '…'], 7, 'heal-swirl');
    els.message.textContent = action === 'sick' ? 'feels wobbly' : 'feeling better';
  } else if (action === 'clean') {
    spawnBurst(['✧', '◇', '○'], 9, 'bubble-rise');
    els.message.textContent = 'sparkly clean';
  } else if (action === 'rest') {
    spawnBurst(['z', 'Z', '☾'], 6, 'sleep-float');
    els.message.textContent = 'soft nap';
  } else if (action === 'work' || action === 'buy') {
    spawnBurst(['$', '+', '•'], 8, 'coin-bounce');
    els.message.textContent = action === 'buy' ? 'snack stash' : 'tiny job done';
  }
}

function resolveEffectClass(action) {
  if (action === 'feed') return 'effect-feed';
  if (action === 'play') {
    const effect = playEffects[playEffectIndex % playEffects.length];
    playEffectIndex += 1;
    return effect;
  }
  if (action === 'medicine') return 'effect-heal';
  if (action === 'sick') return 'effect-sick';
  if (action === 'clean') return 'effect-clean';
  if (action === 'rest') return 'effect-rest';
  if (action === 'work') return 'effect-work';
  if (action === 'buy') return 'effect-buy';
  return 'wiggle-pop';
}

function restartClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  setTimeout(() => element.classList.remove(className), 900);
}

function spawnBurst(tokens, count, className) {
  els.effectLayer.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement('span');
    particle.className = `particle ${className}`;
    particle.textContent = tokens[index % tokens.length];
    particle.style.setProperty('--x', `${Math.round((Math.random() - 0.5) * 210)}px`);
    particle.style.setProperty('--y', `${Math.round(-45 - Math.random() * 105)}px`);
    particle.style.setProperty('--delay', `${index * 32}ms`);
    particle.style.setProperty('--spin', `${Math.round((Math.random() - 0.5) * 150)}deg`);
    els.effectLayer.appendChild(particle);
  }
  setTimeout(() => els.effectLayer.replaceChildren(), 1200);
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', () => care(button.dataset.action));
});

render();
setInterval(() => {
  tick();
  save();
  render();
}, 60000);
