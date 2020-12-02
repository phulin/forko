import {
  myBuffedstat,
  myFamiliar,
  maximize,
  setProperty,
  haveFamiliar,
  getCounters,
  mallPrice,
  print,
  visitUrl,
  toInt,
  myAscensions,
  itemAmount,
  myInebriety,
  inebrietyLimit,
  getCampground,
  getProperty,
  getFuel,
  mpCost,
  availableAmount,
  cliExecute,
  useFamiliar,
  haveEffect,
  equip,
  myMp,
  restoreMp,
  myHp,
  myMaxhp,
  restoreHp,
  equippedAmount,
  putCloset,
  myTurncount,
  adv1,
  haveSkill,
} from 'kolmafia';
import { $item, $skill, $items, $familiar, $familiars, $locations, $effect, $location } from 'libram/src';
import { fillAsdonMartinTo } from './asdon';
import {
  getPropertyString,
  getPropertyInt,
  clamp,
  setPropertyInt,
  sausageMp,
  getPropertyBoolean,
  myFamiliarWeight,
  getImagePld,
  setChoice,
} from './lib';
import { tryEnsureSong } from './mood';

function has(itemOrSkill: Item | Skill) {
  if (itemOrSkill instanceof Item) {
    return availableAmount(itemOrSkill as Item) > 0;
  } else if (itemOrSkill instanceof Skill) {
    return haveSkill(itemOrSkill as Skill);
  }
}

export function maximizeCached(objective: string) {
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

function exclude(haystack: Item[], needles: Item[]) {
  return haystack.filter(x => !needles.includes(x));
}

const freeRunSources = [
  ['_reflexHammerUsed', 3, $item`Lil' Doctor™ bag`],
  ['_kgbTranquilizerDartUses', 3, $item`Kremlin's Greatest Briefcase`],
  ['_snokebombUsed', 3, $skill`Snokebomb`],
];
const freeRunItems = $items`Louder Than Bomb, tattered scrap of paper, GOTO, green smoke bomb`;
let freeRunFamiliar = $familiar`none`;
for (const testFam of $familiars`Pair of Stomping Boots, Frumious Bandersnatch`) {
  if (haveFamiliar(testFam)) freeRunFamiliar = testFam;
}
const turnOnlyItems = $items`mafia thumb ring`;

export const usualDropItems = $items`lucky gold ring, Mr. Cheeng's spectacles, mafia thumb ring`;

export function inSemirareWindow() {
  return getCounters('Semirare window end', 0, 40).includes('Semirare window end');
}

function averagePrice(items: Item[]) {
  return items.reduce((s, it) => s + mallPrice(it), 0) / items.length;
}

function argmax<T>(values: [T, number][]) {
  return values.reduce(([minValue, minScore], [value, score]) =>
    score > minScore ? [value, score] : [minValue, minScore]
  )[0];
}

function feedToMimic(amount: number, candy: Item) {
  print(`Feeding mimic ${amount} ${candy.plural}`);
  visitUrl(`familiarbinger.php?action=binge&qty=${amount}&whichitem=${toInt(candy)}`);
}

const mimicFeedCandy = $items`Cold Hots candy, Daffy Taffy, Mr. Mediocrebar, Senior Mints, Wint-o-Fresh Mint`;
function maybeFeedMimic() {
  if (
    getPropertyInt('minehobo_lastMimicFeedAscension', 0) < myAscensions() &&
    $familiar`Stocking Mimic`.experience < 600
  ) {
    const totalCandy = mimicFeedCandy.map((candy: Item) => itemAmount(candy)).reduce((s, x) => s + x, 0);
    let remainingCandyToFeed = clamp(totalCandy * 0.03, 0, 800);
    for (const candy of mimicFeedCandy) {
      const toFeed = Math.min(remainingCandyToFeed, itemAmount(candy));
      feedToMimic(toFeed, candy);
      remainingCandyToFeed -= toFeed;
    }
    setPropertyInt('minehobo_lastMimicFeedAscension', myAscensions());
  }
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
export enum PrimaryGoal {
  NONE,
  PLUS_COMBAT,
  MINUS_COMBAT,
}
const primaryGoalToMaximizer = new Map<PrimaryGoal, string[]>([
  [PrimaryGoal.NONE, []],
  [PrimaryGoal.PLUS_COMBAT, ['+combat']],
  [PrimaryGoal.MINUS_COMBAT, ['-combat']],
]);

export function renderObjective(
  primaryGoal: PrimaryGoal,
  auxiliaryGoals: string[],
  forceEquip: Item[] = [],
  banned: Item[] = []
) {
  return [
    ...(primaryGoalToMaximizer.get(primaryGoal) || []),
    ...auxiliaryGoals,
    ...forceEquip.map((item: Item) => `equip ${item}`),
    ...banned.map((item: Item) => `-equip ${item}`),
  ].join(', ');
}

const SAUSAGE_GOBLIN_GOAL = 14;
export class AdventuringManager {
  static lastFamiliar: Familiar | null = null;
  static lastSemirareCheck = -1;

  location: Location;
  primaryGoal: PrimaryGoal;
  auxiliaryGoals: string[];
  forceEquip: Item[] = [];
  banned: Item[] = [];
  willFreeRun = false;
  familiarLocked = false;

  constructor(
    location: Location,
    primaryGoal: PrimaryGoal,
    auxiliaryGoals: string[],
    forceEquip: Item[] = [],
    banned: Item[] = []
  ) {
    this.location = location;
    this.primaryGoal = primaryGoal;
    this.auxiliaryGoals = auxiliaryGoals;
    this.forceEquip = forceEquip;
    this.banned = banned;

    if (myInebriety() > inebrietyLimit()) {
      forceEquip = [...forceEquip, $item`Drunkula's wineglass`];
      auxiliaryGoals = [...auxiliaryGoals, '0.01 weapon damage'];
    } else if (
      getPropertyInt('_sausageFights') < SAUSAGE_GOBLIN_GOAL &&
      !forceEquip.includes($item`hobo code binder`) // AND probability is reasonably high.
    ) {
      forceEquip = [...forceEquip, $item`Kramco Sausage-o-Matic™`];
    }
    banned = [...banned, ...$items`Pigsticker of Violence, porcelain porkpie`];
  }

  limitedFreeRunsAvailable() {
    const additionalEquip: Item[] = [];
    if (
      getCampground()['Asdon Martin keyfob'] !== undefined &&
      !getProperty('banishedMonsters').includes('Spring-Loaded Front Bumper')
    ) {
      if (getFuel() < 50) {
        fillAsdonMartinTo(100);
      }
      return { limitedFreeRuns: true, additionalEquip };
    }

    for (const [pref, maxCount, itemOrSkill] of freeRunSources) {
      if (getPropertyInt(pref as string) < maxCount && has(itemOrSkill as Item | Skill)) {
        if (itemOrSkill instanceof Item) additionalEquip.push(itemOrSkill as Item);
        if (itemOrSkill instanceof Skill) sausageMp(mpCost(itemOrSkill as Skill));
        return { limitedFreeRuns: true, additionalEquip };
      }
    }

    const hasInk = getProperty('latteUnlocks').includes('ink');
    if (
      availableAmount($item`latte lovers member's mug`) > 0 &&
      hasInk &&
      !this.forceEquip.includes($item`hobo code binder`) &&
      (getPropertyBoolean('_latteBanishUsed') ? 0 : 1) + getPropertyInt('_latteRefills') < 4
    ) {
      if (getPropertyBoolean('_latteBanishUsed')) {
        cliExecute('latte refill cinnamon pumpkin ink');
      }
      additionalEquip.push($item`latte lovers member's mug`);
    }

    return { limitedFreeRuns: false, additionalEquip };
  }

  setupFreeRuns() {
    if (getPropertyBoolean('_minehobo_freeRunFamiliarUsed', false) && freeRunFamiliar !== $familiar`none`) {
      maximizeCached(
        renderObjective(
          PrimaryGoal.NONE,
          ['familiar weight', ...this.auxiliaryGoals],
          exclude(this.forceEquip, turnOnlyItems),
          this.banned
        )
      );
      useFamiliar(freeRunFamiliar);
      if (getPropertyInt('_banderRunaways') * 5 < myFamiliarWeight() && tryEnsureSong($skill`The Ode to Booze`)) {
        this.primaryGoal = PrimaryGoal.NONE;
        this.auxiliaryGoals = ['familiar weight', ...this.auxiliaryGoals];
        this.forceEquip = exclude(this.forceEquip, turnOnlyItems);
        this.familiarLocked = true;
        this.willFreeRun = true;
        return;
      }
      // fall through if we've used all our familiar runs.
      setProperty('_minehobo_freeRunFamiliarUsed', 'true');
    }

    if (myInebriety() > inebrietyLimit()) {
      this.familiarLocked = false;
      this.willFreeRun = false;
      return;
    }

    const { limitedFreeRuns, additionalEquip } = this.limitedFreeRunsAvailable();

    this.familiarLocked = false;
    this.willFreeRun = limitedFreeRuns || freeRunItems.some((it: Item) => itemAmount(it) > 0);
    if (this.willFreeRun) this.forceEquip = [...exclude(this.forceEquip, turnOnlyItems), ...additionalEquip];
  }

  pickFamiliar() {
    let pickedFamiliar: Familiar | null = null;
    if (this.willFreeRun) {
      if (this.primaryGoal === PrimaryGoal.MINUS_COMBAT && myFamiliarWeight($familiar`Disgeist`) >= 38) {
        pickedFamiliar = $familiar`Disgeist`;
      } else if (
        this.primaryGoal === PrimaryGoal.PLUS_COMBAT &&
        myFamiliarWeight($familiar`Jumpsuited Hound Dog`) >= 30
      ) {
        pickedFamiliar = $familiar`Jumpsuited Hound Dog`;
      } else if (
        !$locations`A Maze of Sewer Tunnels, Hobopolis Town Square`.includes(this.location) &&
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
        if (this.location === $location`Hobopolis Town Square` && familiar === $familiar`Fist Turkey`) continue;
        const { expected, drop, pref } = rotatingFamiliars[familiarName];
        const dropsAlready = getPropertyInt(pref);
        if (dropsAlready >= expected.length) continue;
        const value = mallPrice(drop) / expected[dropsAlready];
        familiarValue.push([familiar, value]);
      }
      pickedFamiliar = argmax(familiarValue) as Familiar;
    }
    useFamiliar(pickedFamiliar);
    if (pickedFamiliar === $familiar`Stocking Mimic`) {
      equip($item`bag of many confections`);
      maybeFeedMimic();
    }
    if (AdventuringManager.lastFamiliar !== pickedFamiliar) {
      print(`Picked familiar ${myFamiliar()}.`, 'blue');
      AdventuringManager.lastFamiliar = pickedFamiliar;
    }
  }

  // Restore, maximize, pick familiar.
  preAdventure() {
    if (haveEffect($effect`Beaten Up`) > 0) {
      throw 'Got beaten up.';
    }

    maximizeCached(renderObjective(this.primaryGoal, this.auxiliaryGoals, this.forceEquip, this.banned));

    sausageMp(100);
    if (myMp() < 100) restoreMp(100);
    if (myHp() < 0.8 * myMaxhp() || myHp() < 500) restoreHp(myMaxhp());

    if (!this.familiarLocked) this.pickFamiliar();

    maximizeCached(renderObjective(this.primaryGoal, this.auxiliaryGoals, this.forceEquip, this.banned));

    if (equippedAmount($item`lucky gold ring`) > 0) {
      for (const item of $items`hobo nickel, sand dollar`) {
        putCloset(itemAmount(item), item);
      }
    }

    // TODO: Check SR.
    if (
      this.location !== $location`The Purple Light District` &&
      getImagePld() === 10 &&
      inSemirareWindow() &&
      AdventuringManager.lastSemirareCheck < myTurncount()
    ) {
      setChoice(205, 2);
      setChoice(294, 1);
      adv1($location`The Purple Light District`, -1, '');
      AdventuringManager.lastSemirareCheck = myTurncount();
    }
  }
}