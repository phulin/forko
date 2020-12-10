import {
  haveEffect,
  cliExecute,
  toEffect,
  haveSkill,
  turnsPerCast,
  useSkill,
  effectModifier,
  numericModifier,
  use,
  mallPrice,
  getProperty,
  myTurncount,
  myAdventures,
  myMp,
  myMaxmp,
  eat,
  availableAmount,
  mpCost,
  hpCost,
  restoreHp,
  myMaxhp,
  myHp,
  getClanName,
  stashAmount,
  maximize,
  takeStash,
  putStash,
  myEffects,
  retrieveItem,
  print,
} from 'kolmafia';
import { $effect, $effects, $item, $items, $skill } from 'libram/src';
import { fillAsdonMartinTo } from './asdon';
import { clamp, cheapest, getItem, getPropertyBoolean, getPropertyInt, getPropertyString } from './lib';
import { setClan } from './wl';

export function shrug(ef: Effect) {
  if (haveEffect(ef) > 0) {
    cliExecute(`shrug ${ef.name}`);
  }
}
// Mechanics for managing song slots.
const songSlots: Effect[][] = [
  $effects`Stevedave's Shanty of Superiority`,
  $effects`Carlweather's Cantata of Confrontation, The Sonata of Sneakiness`,
  [],
  $effects`Ode to Booze`,
];
export function openSongSlot(song: Effect) {
  for (const songSlot of songSlots) {
    if (songSlot.includes(song)) {
      for (const shruggable of songSlot) {
        shrug(shruggable);
      }
    }
  }
}

export function tryEnsureSong(skill: Skill, turns = 1) {
  const effect = toEffect(skill);
  if (haveEffect(effect) === 0) {
    openSongSlot(effect);
    tryEnsureSkill(skill, turns);
  }
  return haveEffect(effect) >= turns;
}

export function ensureEffect(ef: Effect, turns = 1) {
  if (!tryEnsureEffect(ef, turns)) {
    throw `Failed to get effect ${ef.name}.`;
  }
}

export function tryEnsureEffect(ef: Effect, turns = 1) {
  for (let i = 0; i < 100 && haveEffect(ef) < turns; i++) {
    if (!cliExecute(ef.default)) return false;
  }
  return haveEffect(ef) === 0;
}

export function sausagesAvailable() {
  return Math.min(
    getPropertyInt('_sausagesEaten'),
    availableAmount($item`magical sausage`) + availableAmount($item`magical sausage casing`)
  );
}

export function trySausageMp() {
  const sausagesEdibleByMp = Math.floor((myMaxmp() - myMp()) / 999);
  const sausagesToEat = Math.min(sausagesEdibleByMp, sausagesAvailable());
  if (sausagesToEat > 0) {
    eat(sausagesToEat, $item`magical sausage`);
    return true;
  } else return false;
}

function tryUsePyec() {
  const pyec = $item`Platinum Yendorian Express Card`;
  if (
    (availableAmount($item`Platinum Yendorian Express Card`) > 0 || getPropertyString('pyecClan')) &&
    !getPropertyBoolean('expressCardUsed')
  ) {
    const havePyec = availableAmount(pyec) === 0;
    const currentClan = getClanName();
    let taken = false;
    if (!havePyec || setClan(getPropertyString('pyecClan'))) {
      try {
        maximize('mp', false);
        if (!havePyec && stashAmount(pyec) > 0) {
          taken = takeStash(1, pyec);
        }
        use(1, pyec);
      } finally {
        if (taken) putStash(1, pyec);
        if (getClanName() !== currentClan) setClan(currentClan);
      }
    }
  }
}

export function tryEnsureSkill(skill: Skill, turns = 1) {
  const effect = toEffect(skill);
  const initialTurns = haveEffect(effect);

  if (haveSkill(skill) && effect !== $effect`none` && initialTurns < turns) {
    let oldRemainingCasts = -1;
    let remainingCasts = Math.ceil((turns - haveEffect(effect)) / turnsPerCast(skill));
    while (remainingCasts > 0 && oldRemainingCasts !== remainingCasts) {
      let maxCasts;
      if (hpCost(skill) > 0) {
        restoreHp(myMaxhp());
        maxCasts = myHp() / hpCost(skill);
      } else {
        if (myMp() < 500) {
          tryUsePyec();
        }
        trySausageMp();
        maxCasts = myMp() / mpCost(skill);
      }
      const casts = clamp(remainingCasts, 0, Math.min(100, maxCasts));
      useSkill(casts, skill);
      oldRemainingCasts = remainingCasts;
      remainingCasts = Math.ceil((turns - haveEffect(effect)) / turnsPerCast(skill));
    }
  }
  return haveEffect(effect) > initialTurns;
}

export function tryEnsurePotionMultiple(items: Item[], turns = 1, maxPricePerTurn = 100) {
  return tryEnsurePotion(cheapest(...items), turns, maxPricePerTurn);
}

export function tryEnsurePotion(item: Item, turns = 1, maxPricePerTurn = 100, actualItem: Item | null = null) {
  // Actual item is for when we might buy the ingredients rather than the potion itself.
  turns = Math.round(clamp(turns, 0, myAdventures() * 1.1 + 5));
  const potion = actualItem || item;
  const effect = effectModifier(potion, 'Effect');
  const effectTurns = haveEffect(effect);
  const turnsPerUse = numericModifier(potion, 'Effect Duration');
  if (mallPrice(item) > maxPricePerTurn * turnsPerUse) return false;
  if (effectTurns < turns) {
    print(`${effect}: going for ${turns} turns, currently ${effectTurns}`);
    const uses = Math.ceil(Math.min((turns - effectTurns) / turnsPerUse, 1000 / turnsPerUse));
    getItem(uses - (actualItem !== null ? availableAmount(actualItem) : 0), item, maxPricePerTurn * turnsPerUse);
    if (actualItem !== null) retrieveItem(uses, actualItem);
    use(uses, potion);
  }
  return haveEffect(effect) >= turns;
}

const triviaMaster = $effect`Trivia Master`;
const triviaMasterItems = $items`Trivial Avocations Card: What?, Trivial Avocations Card: When?, Trivial Avocations Card: Who?, Trivial Avocations Card: Where?`;
export function tryEnsureTriviaMaster(turns = 1) {
  if (triviaMasterItems.map((item: Item) => mallPrice(item)).reduce((s: number, x: number) => s + x, 0) > 3000) {
    return false;
  }
  const triviaMasterTurns = haveEffect(triviaMaster);
  if (triviaMasterTurns < turns) {
    const uses = Math.min(Math.ceil((turns - triviaMasterTurns) / 30), 34);
    for (const item of triviaMasterItems) {
      getItem(uses, item, 3000);
    }
    for (let i = 0; i < uses; i++) {
      for (const item of triviaMasterItems) {
        use(1, item);
      }
    }
  }
  return haveEffect(triviaMaster) >= turns;
}

export function drive(effect: Effect, maxTurns: number) {
  const count = Math.ceil((maxTurns - haveEffect(effect)) / 30);
  fillAsdonMartinTo(count * 37);
  for (let i = 0; i < count; i++) cliExecute(`asdonmartin drive ${effect.name.replace('Driving ', '')}`);
}

export function moodBaseline(maxTurns: number) {
  // Stats.
  tryEnsureSkill($skill`Get Big`, maxTurns);
  tryEnsurePotion($item`Ben-Gal™ balm`, maxTurns);
  // tryEnsureSong($skill`Stevedave's Shanty of Superiority`, maxTurns);
  // tryEnsureTriviaMaster(maxTurns);

  // Combat.
  tryEnsureSkill($skill`Carol of the Hells`, maxTurns);
  tryEnsureSkill($skill`Carol of the Bulls`, maxTurns);
  tryEnsureSkill($skill`Song of Starch`, maxTurns);
  tryEnsureSkill($skill`Quiet Determination`, maxTurns);
  tryEnsureSkill($skill`Springy Fusilli`, maxTurns);
  tryEnsurePotion($item`pec oil`, maxTurns);

  // Elemental res.
  tryEnsureSkill($skill`Elemental Saucesphere`, maxTurns);
  tryEnsureSkill($skill`Astral Shell`, maxTurns);

  // Misc.
  tryEnsureSkill($skill`Blood Bubble`, maxTurns);
  tryEnsureSkill($skill`Blood Bond`, maxTurns);
  tryEnsureSkill($skill`Empathy of the Newt`, maxTurns);
  tryEnsureSkill($skill`Leash of Linguini`, maxTurns);
}

export function moodMinusCombat(maxTurnsBaseline: number, maxTurnsMinusCombat: number, maxPricePerTurn = 100) {
  moodBaseline(maxTurnsBaseline);

  maxTurnsMinusCombat = clamp(maxTurnsMinusCombat, 1, maxTurnsBaseline);

  drive($effect`Driving Stealthily`, maxTurnsMinusCombat);
  tryEnsureSong($skill`The Sonata of Sneakiness`, maxTurnsMinusCombat);
  tryEnsureSkill($skill`Smooth Movement`, maxTurnsMinusCombat);
  tryEnsurePotion(
    cheapest(...$items`snow cleats, snow berries`),
    maxTurnsMinusCombat,
    maxPricePerTurn,
    $item`snow cleats`
  );
  tryEnsurePotion(cheapest(...$items`chunk of rock salt, deodorant`), maxTurnsMinusCombat, maxPricePerTurn);
  tryEnsurePotion($item`Daily Affirmation: Be Superficially Interested`, maxTurnsMinusCombat, maxPricePerTurn);
  tryEnsurePotion($item`shoe gum`, maxTurnsMinusCombat, maxPricePerTurn);
  tryEnsurePotion($item`patent invisibility tonic`, maxTurnsMinusCombat, 3 * maxPricePerTurn);

  if (
    availableAmount($item`Powerful Glove`) > 0 &&
    getPropertyInt('_powerfulGloveBatteryPowerUsed') < 100 &&
    haveEffect($effect`Invisible Avatar`) < maxTurnsMinusCombat
  ) {
    cliExecute('checkpoint');
    cliExecute('equip acc1 Powerful Glove');
    tryEnsureEffect($effect`Invisible Avatar`, maxTurnsMinusCombat);
    cliExecute('outfit checkpoint');
  }

  if (haveEffect($effect`Become Intensely Interested`) > 0) cliExecute('toggle Become Intensely Interested');
  for (const effectName of Object.keys(myEffects())) {
    const effect = Effect.get(effectName);
    if (numericModifier(effect, 'Combat Rate') > 0) shrug(effect as Effect);
  }

  if (getPropertyBoolean('horseryAvailable') && getProperty('_horsery') !== 'dark horse') {
    cliExecute('horsery dark');
  }
}

export function moodPlusCombat(maxTurnsBaseline: number, maxTurnsPlusCombat: number, maxPricePerTurn = 100) {
  moodBaseline(maxTurnsBaseline);

  maxTurnsPlusCombat = clamp(maxTurnsPlusCombat, 1, maxTurnsBaseline);

  drive($effect`Driving Obnoxiously`, maxTurnsPlusCombat);
  tryEnsureSong($skill`Carlweather's Cantata of Confrontation`, maxTurnsPlusCombat);
  tryEnsureSkill($skill`Musk of the Moose`, maxTurnsPlusCombat);
  tryEnsurePotion(cheapest(...$items`reodorant, handful of pine needles`), maxTurnsPlusCombat, maxPricePerTurn);
  tryEnsurePotion($item`patent aggression tonic`, maxTurnsPlusCombat, 3 * maxPricePerTurn);
  tryEnsurePotion($item`lion musk`, maxTurnsPlusCombat, 3 * maxPricePerTurn);

  if (haveEffect($effect`Become Superficially Interested`) > 0) cliExecute('toggle Become Superficially Interested');
  for (const effectName of Object.keys(myEffects())) {
    const effect = Effect.get(effectName);
    if (numericModifier(effect, 'Combat Rate') < 0) shrug(effect as Effect);
  }

  if (getPropertyBoolean('horseryAvailable') && getProperty('_horsery') === 'dark horse') {
    cliExecute('horsery normal');
  }
}
export function moodAddItem() {
  tryEnsureSong($skill`Fat Leon's Phat Loot Lyric`);
  tryEnsureSkill($skill`Singer's Faithful Ocelot`);
  tryEnsureSkill($skill`The Spirit of Taking`);
}

export function expectedTurns(stopTurncount: number) {
  return Math.min(stopTurncount - myTurncount(), myAdventures() * 1.1 + 50);
}
