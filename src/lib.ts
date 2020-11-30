import {
  abort,
  availableAmount,
  buy,
  cliExecute,
  closetAmount,
  eat,
  equip,
  familiarWeight,
  formatDateTime,
  getCampground,
  getFuel,
  getProperty,
  haveEffect,
  haveFamiliar,
  haveSkill,
  inebrietyLimit,
  itemAmount,
  mallPrice,
  maximize,
  mpCost,
  myAdventures,
  myBuffedstat,
  myFamiliar,
  myHp,
  myInebriety,
  myLocation,
  myMaxhp,
  myMaxmp,
  myMp,
  myTurncount,
  print,
  putCloset,
  restoreHp,
  restoreMp,
  setAutoAttack,
  setProperty,
  shopAmount,
  takeCloset,
  takeShop,
  timeToString,
  todayToString,
  urlEncode,
  useFamiliar,
  visitUrl,
  wait,
  weightAdjustment,
} from 'kolmafia';
import { $effect, $familiar, $familiars, $item, $items, $location, $locations, $skill } from 'libram/src';
import { fillAsdonMartinTo } from './asdon';
import { tryEnsureSong } from './mood';
import { getSewersState, throughSewers } from './sewers';

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(n, max));
}

export function getPropertyString(name: string, def: string | null = null) {
  const str = getProperty(name);
  return str === '' ? def : str;
}

export function getPropertyInt(name: string, default_: number | null = null): number {
  const str = getProperty(name);
  if (str === '') {
    if (default_ === null) throw `Unknown property ${name}.`;
    else return default_;
  }
  return parseInt(str, 10);
}

export function getPropertyBoolean(name: string, default_: boolean | null = null) {
  const str = getProperty(name);
  if (str === '') {
    if (default_ === null) throw `Unknown property ${name}.`;
    else return default_;
  }
  return str === 'true';
}

export function setPropertyInt(name: string, value: number) {
  setProperty(name, value);
}

export function setChoice(adv: number, choice: number) {
  setProperty(`choiceAdventure${adv}`, `${choice}`);
}

function has(itemOrSkill: Item | Skill) {
  if (itemOrSkill instanceof Item) {
    return availableAmount(itemOrSkill as Item) > 0;
  } else if (itemOrSkill instanceof Skill) {
    return haveSkill(itemOrSkill as Skill);
  }
}

export function cheapest(...items: Item[]) {
  const prices = items.map(it => mallPrice(it));
  const pricesChecked = prices.map(p => (p < 100 ? 999999999 : p));
  const minIndex = pricesChecked.reduce((i, x, j) => (pricesChecked[i] < x ? i : j), 0);
  return items[minIndex];
}

export function getItem(qty: number, item: Item, maxPrice: number) {
  if (qty * mallPrice(item) > 1000000) abort('bad get!');

  let remaining = qty - itemAmount(item);
  if (remaining <= 0) return;

  const getCloset = Math.min(remaining, closetAmount(item));
  if (!takeCloset(getCloset, item)) abort('failed to remove from closet');
  remaining -= getCloset;
  if (remaining <= 0) return;

  let getMall = Math.min(remaining, shopAmount(item));
  if (!takeShop(getMall, item)) {
    cliExecute('refresh shop');
    cliExecute('refresh inventory');
    remaining = qty - itemAmount(item);
    getMall = Math.min(remaining, shopAmount(item));
    if (!takeShop(getMall, item)) abort('failed to remove from shop');
  }
  remaining -= getMall;
  if (remaining <= 0) return;

  if (buy(remaining, item, maxPrice) < remaining) abort(`Mall price too high for ${item.name}.`);
}

const SAUSAGE_GOBLIN_GOAL = 14;
export function maximizeCached(maximizeGoals: string[], forceEquip: Item[], banned: Item[] = []) {
  banned = [...banned, ...$items`Pigsticker of Violence, porcelain porkpie`];

  if (myInebriety() > inebrietyLimit()) {
    forceEquip = [...forceEquip, $item`Drunkula's wineglass`];
    maximizeGoals = [...maximizeGoals, '0.01 weapon damage'];
  } else if (getPropertyInt('_sausageFights') < SAUSAGE_GOBLIN_GOAL && !forceEquip.includes($item`hobo code binder`)) {
    forceEquip = [...forceEquip, $item`Kramco Sausage-o-Matic™`];
  }

  const objective = [
    ...maximizeGoals,
    ...forceEquip.map(it => `equip ${it}`),
    ...banned.map(it => `-equip ${it}`),
  ].join(', ');
  const objectiveChanged = getPropertyString('minehobo_lastObjective', '') !== objective;

  let oldStats = getPropertyString('minehobo_lastStats', '0,0,0')
    .split(',')
    .map((s: string) => parseInt(s, 10));
  if (oldStats.length !== 3) oldStats = [0, 0, 0];
  const stats = Stat.get(['Muscle', 'Mysticality', 'Moxie']).map(stat => myBuffedstat(stat));
  const statsChanged = stats.some((newStat, i) => newStat > oldStats[i] && newStat % 10 === 0);

  const oldFamiliar = getPropertyString('minehobo_lastFamiliar', '');
  const familiarChanged = oldFamiliar !== myFamiliar().toString();

  if (!objectiveChanged && !statsChanged && !familiarChanged) return;

  if (maximize(objective, false)) {
    setProperty('minehobo_lastObjective', objective);
    setProperty('minehobo_lastStats', stats.join(','));
    setProperty('minehobo_lastFamiliar', myFamiliar().toString());
  } else {
    throw 'Maximize command failed.';
  }
}

export function sausageMp(target: number) {
  if (
    myMp() < target &&
    myMaxmp() >= 400 &&
    getPropertyInt('_sausagesEaten') < 23 &&
    availableAmount($item`magical sausage casing`) > 0
  ) {
    eat(1, Item.get('magical sausage'));
  }
}

export function myFamiliarWeight(familiar: Familiar | null = null) {
  if (familiar === null) familiar = myFamiliar();
  return familiarWeight(familiar) + weightAdjustment();
}

function exclude(haystack: Item[], needles: Item[]) {
  return haystack.filter(x => !needles.includes(x));
}

const freeRunSources = [
  ['_reflexHammerUsed', 3, $item`Lil' Doctor™ bag`],
  ['_kgbTranquilizerDartUses', 3, $item`Kremlin's Greatest Briefcase`],
  ['_latteRefillsUsed', 3, $item`latte lovers member's mug`],
  ['_snokebombUsed', 3, $skill`Snokebomb`],
];
const freeRunItems = $items`Louder Than Bomb, tattered scrap of paper, GOTO, green smoke bomb`;
let freeRunFamiliar = $familiar`none`;
for (const testFam of $familiars`Pair of Stomping Boots, Frumious Bandersnatch`) {
  if (haveFamiliar(testFam)) freeRunFamiliar = testFam;
}
const turnOnlyItems = $items`mafia thumb ring`;
export const usualDropItems = $items`lucky gold ring, Mr. Cheeng's spectacles, mafia thumb ring`;
export function maximizeFreeRuns(
  primaryGoal: string,
  otherGoals: string[],
  forceEquip: Item[],
  banned: Item[] = [],
  tryFreeRun = true
) {
  if (!tryFreeRun) {
    maximizeCached([primaryGoal, ...otherGoals], forceEquip, banned);
    return { familiarLocked: false, freeRun: false };
  }

  if (getPropertyBoolean('_minehobo_freeRunFamiliarUsed', false) && freeRunFamiliar !== $familiar`none`) {
    maximizeCached(['familiar weight', ...otherGoals], exclude(forceEquip, turnOnlyItems), banned);
    useFamiliar(freeRunFamiliar);
    if (getPropertyInt('_banderRunaways') * 5 < myFamiliarWeight() && tryEnsureSong($skill`The Ode to Booze`)) {
      return { familiarLocked: true, freeRun: true };
    }
    // fall through if we've used all our familiar runs.
    setProperty('_minehobo_freeRunFamiliarUsed', 'true');
  }

  if (myInebriety() > inebrietyLimit()) {
    maximizeCached([primaryGoal, ...otherGoals], forceEquip, banned);
    return { familiarLocked: false, freeRun: false };
  }

  const additionalEquip: Item[] = [];
  let limitedFreeRuns = false;
  for (const [pref, maxCount, itemOrSkill] of freeRunSources) {
    if (getPropertyInt(pref as string) < maxCount && has(itemOrSkill as Item | Skill)) {
      if (itemOrSkill instanceof Item) additionalEquip.push(itemOrSkill as Item);
      if (itemOrSkill instanceof Skill) sausageMp(mpCost(itemOrSkill as Skill));
      if (itemOrSkill === $item`latte lovers member's mug` && getPropertyBoolean('_latteBanishUsed')) {
        cliExecute(`latte refill cinnamon pumpkin ${getProperty('latteUnlocks').includes('ink') ? 'ink' : 'vanilla'}`);
      }
      limitedFreeRuns = true;
      break;
    }
  }
  if (
    getCampground()['Asdon Martin keyfob'] !== undefined &&
    !getProperty('banishedMonsters').includes('Spring-Loaded Front Bumper')
  ) {
    if (getFuel() < 50) {
      fillAsdonMartinTo(100);
    }
    limitedFreeRuns = true;
  }
  if (limitedFreeRuns) forceEquip = exclude(forceEquip, turnOnlyItems);
  maximizeCached([primaryGoal, ...otherGoals], forceEquip, banned);
  return { familiarLocked: false, freeRun: limitedFreeRuns || freeRunItems.some((it: Item) => itemAmount(it) > 0) };
}

function averagePrice(items: Item[]) {
  return items.reduce((s, it) => s + mallPrice(it), 0) / items.length;
}

function argmax<T>(values: [T, number][]) {
  return values.reduce(([minValue, minScore], [value, score]) =>
    score > minScore ? [value, score] : [minValue, minScore]
  )[0];
}

// 5, 10, 15, 20, 25 +5/turn: 5.29, 4.52, 3.91, 3.42, 3.03
const rotatingFamiliars: { [index: string]: { expected: number[]; drop: Item; pref: string } } = {
  'Fist Turkey': {
    expected: [3.91, 4.52, 4.52, 5.29, 5.29],
    drop: $item`Ambitious Turkey`,
    pref: '_turkeyBooze',
  },
  'Llama Lama': {
    expected: [3.42, 3.91, 4.52, 5.29, 5.29],
    drop: $item`llama lama gong`,
    pref: '_gongDrops',
  },
  "Li'l Xenomorph": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`transporter transponder`,
    pref: '_transponderDrops',
  },
};

const mimicDropValue = averagePrice($items`Polka Pop, BitterSweetTarts, Piddles`) / (6.29 * 0.95 + 1 * 0.05);
export const GOAL_NONE = Symbol('none');
export const GOAL_PLUS_COMBAT = Symbol('+combat');
export const GOAL_MINUS_COMBAT = Symbol('-combat');
export function pickFamiliar(location: Location, freeRun: boolean, goal = GOAL_NONE) {
  let pickedFamiliar: Familiar | null = null;
  if (freeRun) {
    if (goal === GOAL_MINUS_COMBAT && myFamiliarWeight($familiar`Disgeist`) >= 38) {
      pickedFamiliar = $familiar`Disgeist`;
    } else if (goal === GOAL_PLUS_COMBAT && myFamiliarWeight($familiar`Jumpsuited Hound Dog`) >= 30) {
      pickedFamiliar = $familiar`Jumpsuited Hound Dog`;
    } else if (
      !$locations`A Maze of Sewer Tunnels, Hobopolis Town Square`.includes(location) &&
      haveFamiliar($familiar`Space Jellyfish`)
    ) {
      pickedFamiliar = $familiar`Space Jellyfish`;
    } else if (getPropertyInt('_gothKidFights') < 7) {
      pickedFamiliar = $familiar`Artistic Goth Kid`;
    }
    // TODO: Could include LHM here, but difficult
  }

  if (pickedFamiliar === null) {
    const mimicWeight = myFamiliarWeight($familiar`Stocking Mimic`);
    const actionPercentage = 1 / 3 + (haveEffect($effect`Jingle Jangle Jingle`) ? 0.1 : 0);
    const mimicValue = mimicDropValue + ((mimicWeight * actionPercentage * 1) / 4) * 10 * 4 * 1.2;

    const familiarValue: [Familiar, number][] = [[$familiar`Stocking Mimic`, mimicValue]];
    for (const familiarName of Object.keys(rotatingFamiliars)) {
      const familiar: Familiar = Familiar.get(familiarName);
      const { expected, drop, pref } = rotatingFamiliars[familiarName];
      const dropsAlready = getPropertyInt(pref);
      if (dropsAlready >= expected.length) continue;
      const value = mallPrice(drop) / expected[dropsAlready];
      familiarValue.push([familiar, value]);
    }
    pickedFamiliar = argmax(familiarValue) as Familiar;
  }
  useFamiliar(pickedFamiliar);
  if (pickedFamiliar === $familiar`Stocking Mimic`) equip($item`bag of many confections`);
  if (getProperty('minehobo_lastPickedFamiliar') !== `${pickedFamiliar}`) {
    print(`Picked familiar ${myFamiliar()}.`, 'blue');
    setProperty('minehobo_lastPickedFamiliar', `${pickedFamiliar}`);
  }
}

export function preAdventure(location: Location, freeRun = false, familiarLocked = false, goal = GOAL_NONE) {
  if (haveEffect($effect`Beaten Up`) > 0) {
    throw 'Got beaten up.';
  }

  sausageMp(100);
  if (myMp() < 100) restoreMp(100);
  if (myHp() < 0.8 * myMaxhp() || myHp() < 500) restoreHp(myMaxhp());
  if (!familiarLocked) pickFamiliar(location, freeRun, goal);
  for (const item of $items`hobo nickel, sand dollar`) {
    if (itemAmount(item) > 0) {
      putCloset(itemAmount(item), item);
    }
  }
  // TODO: Check SR.
}

export function lastWasCombat() {
  return !myLocation().noncombatQueue.includes(getProperty('lastEncounter'));
}

export function unclosetNickels() {
  /*for (const item of $items`hobo nickel, sand dollar`) {
    takeCloset(closetAmount(item), item);
  }*/
}

export function stopAt(args: string) {
  let stopTurncount = myTurncount() + myAdventures() * 1.1 + 50;
  if (Number.isFinite(parseInt(args, 10))) {
    stopTurncount = myTurncount() + parseInt(args, 10);
  }
  return Math.round(stopTurncount);
}

export function mustStop(stopTurncount: number) {
  return myTurncount() >= stopTurncount || myAdventures() === 0;
}

export function ensureJingle() {
  if (haveEffect($effect`Jingle Jangle Jingle`) === 0) {
    cliExecute(`csend to buffy || ${Math.round(myAdventures() * 1.1 + 200)} jingle`);
    for (let i = 0; i < 5; i++) {
      wait(3);
      cliExecute('refresh status');
      if (haveEffect($effect`Jingle Jangle Jingle`) > 0) break;
    }
    if (haveEffect($effect`Jingle Jangle Jingle`) === 0) abort('Get Jingle Bells first.');
  }
}

function writeWhiteboard(text: string) {
  visitUrl(`clan_basement.php?pwd&action=whitewrite&whiteboard=${urlEncode(text)}`, true, true);
}

export function recordInstanceState() {
  const sewers = getSewersState();
  const lines = [
    `Sewers at ${sewers.grates} grates, ${sewers.valves} valves`,
    `Ol' Scratch at image ${getImage($location`Burnbarrel Blvd.`)}`,
    `Frosty at image ${getImage($location`Exposure Esplanade`)}`,
    `Oscus at image ${getImage($location`The Heap`)}`,
    `Zombo at image ${getImage($location`The Ancient Hobo Burial Ground`)}`,
    `Chester at image ${getImage($location`The Purple Light District`)}`,
  ];
  let whiteboard = '';
  const date = formatDateTime('yyyyMMdd', todayToString(), 'yyyy-MM-dd');
  whiteboard += `Status as of ${date} ${timeToString()}:\n`;
  for (const line of lines) {
    print(line);
    whiteboard += `${line}\n`;
  }
  writeWhiteboard(whiteboard);
  print('"Mining" complete.');
}

const places: { [index: string]: { name: string; number: number } } = {
  'Hobopolis Town Square': {
    name: 'townsquare',
    number: 2,
  },
  'Burnbarrel Blvd.': {
    name: 'burnbarrelblvd',
    number: 4,
  },
  'Exposure Esplanade': {
    name: 'exposureesplanade',
    number: 5,
  },
  'The Heap': {
    name: 'theheap',
    number: 6,
  },
  'The Ancient Hobo Burial Ground': {
    name: 'burialground',
    number: 7,
  },
  'The Purple Light District': {
    name: 'purplelightdistrict',
    number: 8,
  },
};
export function getImage(location: Location) {
  const { name, number } = places[location.toString()];
  const text = visitUrl('clan_hobopolis.php?place=' + number);
  const match = text.match(new RegExp(name + '([0-9]+)o?.gif'));
  if (!match) return -1;
  return parseInt(match[1], 10);
}

const memoizeStore = new Map<() => unknown, [number, unknown]>();
export function memoizeTurncount<T>(func: (...args: []) => T, defaultTurnThreshold = 1) {
  const forceUpdate = (...args: []) => {
    return memoizeStore.set(func, [myTurncount(), func(...args)]);
  };
  const result = (...args: []) => {
    const [lastTurncount, lastResult] = memoizeStore.get(func) || [-1, null];
    if (myTurncount() >= lastTurncount + defaultTurnThreshold) {
      return (forceUpdate(...args).get(func) || [-1, null])[1] as T;
    } else {
      return lastResult as T;
    }
  };
  result.forceUpdate = forceUpdate;
  return result;
}

export const getImageTownsquare = memoizeTurncount(() => getImage($location`Hobopolis Town Square`), 10);
export const getImageBb = memoizeTurncount(() => getImage($location`Burnbarrel Blvd.`));
export const getImageEe = memoizeTurncount(() => getImage($location`Exposure Esplanade`), 10);
export const getImageHeap = memoizeTurncount(() => getImage($location`The Heap`), 10);
export const getImagePld = memoizeTurncount(() => getImage($location`The Purple Light District`), 10);
export const getImageAhbg = memoizeTurncount(() => getImage($location`The Ancient Hobo Burial Ground`), 10);

export function wrapMain(action: () => void) {
  try {
    ensureJingle();
    cliExecute('counters nowarn Fortune Cookie');
    cliExecute('mood apathetic');
    cliExecute('ccs minehobo2');
    action();
    print('Done mining.');
  } finally {
    setAutoAttack(0);
    setProperty('minehobo_lastObjective', '');
    setProperty('minehobo_lastStats', '');
    setProperty('minehobo_lastFamiliar', '');
    unclosetNickels();
    if (throughSewers()) recordInstanceState();
  }
}

export function extractInt(regex: RegExp, text: string, group = 1) {
  if (!regex.global) throw 'Regexes must be global.';
  let result = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[group] === 'a') {
      result += 1;
    } else {
      result += parseInt(match[group], 10);
    }
  }
  return result;
}
