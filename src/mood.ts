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
} from 'kolmafia';
import { $effect, $effects, $item, $items, $skill } from 'libram/src';
import { fillAsdonMartinTo } from './asdon';
import { clamp, cheapest, getItem, getPropertyBoolean, getPropertyInt, getPropertyString } from './lib';
import { setClan } from './wl';

export function shrug(ef: Effect) {
  if (haveEffect(ef) > 0) {
    cliExecute('shrug ' + ef.name);
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

export function tryEnsurePotion(item: Item, turns = 1, maxPricePerTurn = 100) {
  turns = clamp(turns, 0, myAdventures() * 1.1 + 5);
  const effect = effectModifier(item, 'Effect');
  const effectTurns = haveEffect(effect);
  const turnsPerUse = numericModifier(item, 'Effect Duration');
  if (effectTurns < turns) {
    const uses = Math.ceil(Math.min((turns - effectTurns) / turnsPerUse, 1000 / turnsPerUse));
    getItem(uses, item, maxPricePerTurn * turnsPerUse);
    use(uses, item);
  }
  return haveEffect(effect) >= turns;
}

const triviaMaster = $effect`Trivia Master`;
const triviaMasterItems = $items`Trivial Avocations Card: What?, Trivial Avocations Card: When?, Trivial Avocations Card: Who?, Trivial Avocations Card: Where?`;
export function tryEnsureTriviaMaster(turns = 1) {
  if (triviaMasterItems.map(it => mallPrice(it)).reduce((s, x) => s + x, 0) > 3000) {
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

export function driveStealthily(maxTurns: number) {
  const count = Math.ceil(maxTurns / 30);
  fillAsdonMartinTo(count * 37);
}

export function moodBaseline(maxTurns: number) {
  // Stats.
  tryEnsureSkill($skill`Get Big`, maxTurns);
  tryEnsureSong($skill`Stevedave's Shanty of Superiority`, maxTurns);
  tryEnsureTriviaMaster(maxTurns);

  // Combat.
  tryEnsureSkill($skill`Carol of the Hells`, maxTurns);
  tryEnsureSkill($skill`Carol of the Bulls`, maxTurns);
  tryEnsureSkill($skill`Song of Starch`, maxTurns);
  tryEnsureSkill($skill`Quiet Determination`, maxTurns);
  tryEnsureSkill($skill`Springy Fusilli`, maxTurns);
  if (mallPrice($item`pec oil`) < 200) {
    tryEnsureEffect($effect`Oiled-Up`, maxTurns);
  }

  // Elemental res.
  tryEnsureSkill($skill`Elemental Saucesphere`, maxTurns);
  tryEnsureSkill($skill`Astral Shell`, maxTurns);

  // Misc.
  tryEnsureSkill($skill`Blood Bubble`, maxTurns);
  tryEnsureSkill($skill`Blood Bond`, maxTurns);
  tryEnsureSkill($skill`Empathy of the Newt`, maxTurns);
  tryEnsureSkill($skill`Leash of Linguini`, maxTurns);
}

export function moodNoncombat(maxTurnsBaseline: number, maxTurnsNoncombat: number, maxPricePerTurn = 100) {
  moodBaseline(maxTurnsBaseline);

  driveStealthily(maxTurnsNoncombat);
  tryEnsureSong($skill`The Sonata of Sneakiness`, maxTurnsNoncombat);
  tryEnsureSkill($skill`Smooth Movement`, maxTurnsNoncombat);
  tryEnsurePotion(cheapest(...$items`snow cleats, winter berries`), maxTurnsNoncombat, maxPricePerTurn);
  tryEnsurePotion(cheapest(...$items`chunk of rock salt, deodorant`), maxTurnsNoncombat, maxPricePerTurn);
  tryEnsurePotion($item`Daily Affirmation: Be Superficially Interested`, maxTurnsNoncombat, maxPricePerTurn);
  tryEnsurePotion($item`shoe gum`, maxTurnsNoncombat, maxPricePerTurn);
  tryEnsurePotion($item`patent invisibility tonic`, maxTurnsNoncombat, 3 * maxPricePerTurn);

  for (const effect of myEffects()) {
    if (effect === $effect`Become Intensely Interested`) cliExecute('toggle Become Intensely Interested');
    else if (numericModifier(effect, 'Combat Rate') > 0) shrug(effect);
  }

  if (getPropertyBoolean('horseryAvailable') && getProperty('Horsery') !== 'dark horse') {
    cliExecute('horsery dark');
  }
}

export function moodAddItem() {
  tryEnsureSong($skill`Fat Leon's Phat Loot Lyric`);
  tryEnsureSkill($skill`Singer's Faithful Ocelot`);
  tryEnsureSkill($skill`The Spirit of Taking`);
}

export function expectedTurns(stopTurncount: number) {
  return Math.min(stopTurncount - myTurncount(), myAdventures());
}
