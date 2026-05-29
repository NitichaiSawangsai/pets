const appState = {
  payload: null,
  audioContext: null,
  playEffectIndex: 0,
  sicknessAnnounced: false
};

const playEffects = ['spin-hop', 'zigzag-dance', 'star-jump', 'wiggle-pop'];

const meters = [
  ['hunger', 'Food', '#e85d75'],
  ['happiness', 'Joy', '#e6a91f'],
  ['health', 'HP', '#4dbd98'],
  ['loneliness', 'Lonely', '#7d76d9'],
  ['cleanliness', 'Clean', '#43a6dd'],
  ['energy', 'Energy', '#7857d6']
];

const els = {
  root: document.documentElement,
  body: document.body,
  petBody: document.getElementById('petBody'),
  petFace: document.getElementById('petFace'),
  effectLayer: document.getElementById('effectLayer'),
  petName: document.getElementById('petName'),
  petMood: document.getElementById('petMood'),
  coins: document.getElementById('coins'),
  speech: document.getElementById('speech'),
  meters: document.getElementById('meters'),
  shop: document.getElementById('shop'),
  petPicker: document.getElementById('petPicker'),
  focusToggle: document.getElementById('focusToggle'),
  soundToggle: document.getElementById('soundToggle')
};

async function init() {
  bindActions();
  window.pocketPals.onStateUpdate(render);
  render(await window.pocketPals.getState());
}

function bindActions() {
  document.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.action;
      const payload = action === 'feed'
        ? { action, itemId: chooseFood() }
        : { action };
      render(await window.pocketPals.care(payload));
      triggerEffect(action, { itemId: payload.itemId });
      chirp(action);
    });
  });

  els.focusToggle.addEventListener('click', async () => {
    const focusMode = !appState.payload.state.settings.focusMode;
    render(await window.pocketPals.updateSettings({ focusMode }));
  });

  els.soundToggle.addEventListener('click', async () => {
    const soundEnabled = !appState.payload.state.settings.soundEnabled;
    render(await window.pocketPals.updateSettings({ soundEnabled }));
  });
}

function chooseFood() {
  const inventory = appState.payload.state.inventory;
  return ['kibble', 'berry-mochi', 'salmon-bite', 'crunch-bone', 'moon-drop']
    .find((item) => Number(inventory[item] || 0) > 0) || 'kibble';
}

function render(payload) {
  appState.payload = payload;
  const { state, petTypes, message } = payload;
  const pet = state.pet;
  const petType = petTypes.find((type) => type.id === pet.typeId) || petTypes[0];
  els.body.classList.toggle('focus', state.settings.focusMode);
  els.body.classList.toggle('sick', pet.mood === 'sick');
  els.body.classList.toggle('dead', !pet.alive);
  els.petBody.style.background = petType.palette[0];
  els.petBody.style.borderColor = petType.palette[1];
  els.petFace.textContent = pet.alive ? petType.emoji : '✕';
  els.petName.textContent = pet.name;
  els.petMood.textContent = pet.mood;
  els.coins.textContent = `$${pet.coins}`;
  els.speech.textContent = message.replace(`${pet.name} `, '');
  els.focusToggle.classList.toggle('active', state.settings.focusMode);
  els.soundToggle.classList.toggle('active', state.settings.soundEnabled);
  renderMeters(pet);
  renderShop(payload);
  renderPets(payload);
  if (pet.mood === 'sick' && !appState.sicknessAnnounced) {
    appState.sicknessAnnounced = true;
    triggerEffect('sick');
  }
  if (pet.mood !== 'sick') appState.sicknessAnnounced = false;
}

function renderMeters(pet) {
  els.meters.replaceChildren(...meters.map(([key, label, color]) => {
    const value = Number(pet[key] || 0);
    const wrapper = document.createElement('div');
    wrapper.className = 'meter';
    wrapper.innerHTML = `<label><span></span><strong></strong></label><div class="bar"><span></span></div>`;
    wrapper.querySelector('span').textContent = label;
    wrapper.querySelector('strong').textContent = `${value}`;
    const fill = wrapper.querySelector('.bar span');
    fill.style.width = `${key === 'loneliness' ? 100 - value : value}%`;
    fill.style.background = color;
    return wrapper;
  }));
}

function renderShop(payload) {
  const { state, shopItems } = payload;
  els.shop.replaceChildren(...state.shop.map((item) => {
    const itemMeta = shopItems.find((shopItem) => shopItem.id === item.id) || item;
    const button = document.createElement('button');
    button.type = 'button';
    button.disabled = item.available <= 0 || state.pet.coins < item.price || !state.pet.alive;
    button.textContent = `${itemMeta.name} $${item.price} (${item.available})`;
    button.addEventListener('click', async () => {
      render(await window.pocketPals.buy({ itemId: item.id, quantity: 1 }));
      triggerEffect('buy');
      chirp('buy');
    });
    return button;
  }));
}

function renderPets(payload) {
  const { state, petTypes } = payload;
  els.petPicker.replaceChildren(...petTypes.map((type) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = `${type.emoji} ${type.name}`;
    button.disabled = state.pet.alive && state.pet.typeId === type.id;
    button.addEventListener('click', async () => {
      const name = state.pet.alive ? state.pet.name : type.name;
      render(await window.pocketPals.care({ action: 'rebirth', typeId: type.id, name }));
      triggerEffect('rebirth');
      chirp('rebirth');
    });
    return button;
  }));
}

function chirp(action) {
  if (!appState.payload?.state?.settings?.soundEnabled) return;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  appState.audioContext ||= new AudioContext();
  const ctx = appState.audioContext;
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = action === 'work' ? 440 : 660;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.18);
}

function triggerEffect(action, options = {}) {
  if (!els.effectLayer) return;
  const effectClass = resolveEffectClass(action);
  restartClass(els.petBody, effectClass);

  if (action === 'feed') {
    spawnBurst(foodTokens(options.itemId), 7, 'float-snack');
    els.speech.textContent = 'nom nom';
  } else if (action === 'play') {
    spawnBurst(['✦', '★', '♡', '•'], 10, 'confetti-pop');
    els.speech.textContent = playLine(effectClass);
  } else if (action === 'medicine' || action === 'sick') {
    spawnBurst(['＋', '◇', '…'], 6, 'heal-swirl');
    els.speech.textContent = action === 'sick' ? 'feels wobbly' : 'feeling better';
  } else if (action === 'clean') {
    spawnBurst(['✧', '◇', '○'], 8, 'bubble-rise');
    els.speech.textContent = 'sparkly clean';
  } else if (action === 'rest') {
    spawnBurst(['z', 'Z', '☾'], 5, 'sleep-float');
    els.speech.textContent = 'soft nap';
  } else if (action === 'work' || action === 'buy') {
    spawnBurst(['$', '+', '•'], 7, 'coin-bounce');
    els.speech.textContent = action === 'buy' ? 'snack stash' : 'tiny job done';
  } else if (action === 'rebirth') {
    spawnBurst(['✦', '♡', '★'], 12, 'confetti-pop');
    els.speech.textContent = 'hello again';
  }
}

function resolveEffectClass(action) {
  if (action === 'feed') return 'effect-feed';
  if (action === 'play') {
    const effect = playEffects[appState.playEffectIndex % playEffects.length];
    appState.playEffectIndex += 1;
    return effect;
  }
  if (action === 'medicine') return 'effect-heal';
  if (action === 'sick') return 'effect-sick';
  if (action === 'clean') return 'effect-clean';
  if (action === 'rest') return 'effect-rest';
  if (action === 'work') return 'effect-work';
  if (action === 'buy') return 'effect-buy';
  if (action === 'rebirth') return 'effect-rebirth';
  return 'wiggle-pop';
}

function restartClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), 900);
}

function spawnBurst(tokens, count, className) {
  els.effectLayer.replaceChildren();
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement('span');
    particle.className = `particle ${className}`;
    particle.textContent = tokens[index % tokens.length];
    particle.style.setProperty('--x', `${Math.round((Math.random() - 0.5) * 130)}px`);
    particle.style.setProperty('--y', `${Math.round(-24 - Math.random() * 62)}px`);
    particle.style.setProperty('--delay', `${index * 38}ms`);
    particle.style.setProperty('--spin', `${Math.round((Math.random() - 0.5) * 130)}deg`);
    els.effectLayer.appendChild(particle);
  }
  window.setTimeout(() => els.effectLayer.replaceChildren(), 1200);
}

function foodTokens(itemId) {
  if (itemId === 'berry-mochi') return ['●', '♡', '✦'];
  if (itemId === 'salmon-bite') return ['▰', '♡', '✦'];
  if (itemId === 'crunch-bone') return ['◇', '♡', '✦'];
  if (itemId === 'moon-drop') return ['☾', '★', '♡'];
  return ['●', '♡', '•'];
}

function playLine(effectClass) {
  const lines = {
    'spin-hop': 'spin hop',
    'zigzag-dance': 'zoom zoom',
    'star-jump': 'star jump',
    'wiggle-pop': 'wiggle pop'
  };
  return lines[effectClass] || 'play time';
}

init().catch((error) => {
  els.speech.textContent = error.message || 'Something went wrong.';
});
