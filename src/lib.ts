import {
  abort,
  availableAmount,
  buy,
  cliExecute,
  closetAmount,
  eat,
  familiarWeight,
  formatDateTime,
  getProperty,
  haveEffect,
  itemAmount,
  mallPrice,
  myAdventures,
  myFamiliar,
  myLocation,
  myMaxmp,
  myMp,
  myTurncount,
  print,
  setAutoAttack,
  setProperty,
  shopAmount,
  takeCloset,
  takeShop,
  timeToString,
  todayToString,
  urlEncode,
  visitUrl,
  wait,
  weightAdjustment,
} from 'kolmafia';
import { $effect, $item, $items, $location } from 'libram/src';
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

export function getChoice(adv: number) {
  return getPropertyInt(`choiceAdventure${adv}`);
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

export function lastWasCombat() {
  return !myLocation().noncombatQueue.includes(getProperty('lastEncounter'));
}

export function unclosetNickels() {
  for (const item of $items`hobo nickel, sand dollar`) {
    takeCloset(closetAmount(item), item);
  }
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
export function memoizeTurncount<T>(func: (...args: []) => T, turnThreshold = 1) {
  const forceUpdate = (...args: []) => {
    const result = func(...args);
    memoizeStore.set(func, [myTurncount(), result]);
    return result;
  };
  const result = (...args: []) => {
    const [lastTurncount, lastResult] = memoizeStore.get(func) || [-1, null];
    if (myTurncount() >= lastTurncount + turnThreshold) {
      return forceUpdate(...args);
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
