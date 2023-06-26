import {
  $effect,
  $familiar,
  $familiars,
  $item,
  $items,
  $location,
  $locations,
  $skill,
  get,
  have,
} from "libram";
import {
  availableAmount,
  cliExecute,
  equippedAmount,
  Familiar,
  getCampground,
  getCounters,
  getFuel,
  getProperty,
  haveEffect,
  haveFamiliar,
  haveSkill,
  inebrietyLimit,
  Item,
  itemAmount,
  Location,
  mallPrice,
  maximize,
  mpCost,
  myAscensions,
  myBasestat,
  myFamiliar,
  myHp,
  myInebriety,
  myMaxhp,
  myMaxmp,
  myMp,
  myTurncount,
  print,
  putCloset,
  restoreHp,
  restoreMp,
  reverseNumberology,
  setLocation,
  setProperty,
  shopAmount,
  Skill,
  Stat,
  toInt,
  totalTurnsPlayed,
  use,
  useFamiliar,
  visitUrl,
} from "kolmafia";
import {
  clamp,
  getPropertyBoolean,
  getPropertyInt,
  getPropertyString,
  myFamiliarWeight,
  sausageMp,
  setPropertyInt,
  turboMode,
} from "./lib";
import { fillAsdonMartinTo } from "./asdon";
import { tryEnsureSong } from "./mood";

function has(itemOrSkill: Item | Skill) {
  if (itemOrSkill instanceof Item) {
    return availableAmount(itemOrSkill as Item) > 0;
  } else if (itemOrSkill instanceof Skill) {
    return haveSkill(itemOrSkill as Skill);
  } else return false;
}

export function maximizeCached(objective: string) {
  const objectiveChanged = getPropertyString("forko_lastObjective", "") !== objective;

  let oldStats = getPropertyString("forko_lastStats", "0,0,0")
    .split(",")
    .map((s: string) => parseInt(s, 10));
  if (oldStats.length !== 3) oldStats = [0, 0, 0];
  const stats = Stat.get(["Muscle", "Mysticality", "Moxie"]).map((stat) => myBasestat(stat));
  const checkMod = turboMode() ? 25 : 10;
  const statsChanged = stats.some(
    (newStat, i) => newStat > oldStats[i] && oldStats[i] < 300 && newStat % checkMod === 0
  );

  const oldFamiliar = getPropertyString("forko_lastFamiliar", "");
  const familiarChanged = oldFamiliar !== myFamiliar().toString();

  if (!objectiveChanged && !statsChanged && !familiarChanged) return;

  if (maximize(objective, false)) {
    setProperty("forko_lastObjective", objective);
    setProperty("forko_lastStats", stats.join(","));
    setProperty("forko_lastFamiliar", myFamiliar().toString());
  } else {
    throw "Maximize command failed.";
  }
}

function exclude(haystack: Item[], needles: Item[]) {
  return haystack.filter((x) => !needles.includes(x));
}

const freeRunSources: [string, number | boolean, Item | Skill][] = [
  // ["_reflexHammerUsed", 3, $item`Lil' Doctor™ bag`],
  // ["_kgbTranquilizerDartUses", 3, $item`Kremlin's Greatest Briefcase`],
  // ["_snokebombUsed", 3, $skill`Snokebomb`],
  // ["_mafiaMiddleFingerRingUsed", true, $item`mafia middle finger ring`],
];
const freeRunItems = $items`Louder Than Bomb, tattered scrap of paper, GOTO, green smoke bomb`;
let freeRunFamiliar: Familiar | null = null;
for (const testFam of $familiars`Pair of Stomping Boots, Frumious Bandersnatch`) {
  if (haveFamiliar(testFam)) freeRunFamiliar = testFam;
}

export const usualDropItems = []; // $items`lucky gold ring, Mr. Cheeng's spectacles, mafia thumb ring, pantogram pants`;
const turnOnlyItems = $items`mafia thumb ring`;
const fightOnlyItems = $items`lucky gold ring, Mr. Cheeng's spectacles, mafia thumb ring`;

export function inSemirareWindow() {
  return getCounters("Semirare window end", 0, 40).includes("Semirare window end");
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

const mimicFeedCandy = $items`Cold Hots candy, Daffy Taffy, Mr. Mediocrebar, Senior Mints, Wint-O-Fresh mint`;
function maybeFeedMimic() {
  if (
    have($familiar`Stocking Mimic`) &&
    getPropertyInt("forko_lastMimicFeedAscension", 0) < myAscensions() &&
    $familiar`Stocking Mimic`.experience < 600
  ) {
    const totalCandy = mimicFeedCandy
      .map((candy: Item) => itemAmount(candy))
      .reduce((s: number, x: number) => s + x, 0);
    let remainingCandyToFeed = clamp(totalCandy * 0.03, 0, 800);
    for (const candy of mimicFeedCandy) {
      const toFeed = Math.min(remainingCandyToFeed, itemAmount(candy));
      feedToMimic(toFeed, candy);
      remainingCandyToFeed -= toFeed;
    }
    setPropertyInt("forko_lastMimicFeedAscension", myAscensions());
  }
}

// 5, 10, 15, 20, 25 +5/turn: 5.29, 4.52, 3.91, 3.42, 3.03
const rotatingFamiliars: { [index: string]: { expected: number[]; drop: Item; pref: string } } = {
  "Fist Turkey": {
    expected: [3.91, 4.52, 4.52, 5.29, 5.29],
    drop: $item`Ambitious Turkey`,
    pref: "_turkeyBooze",
  },
  "Llama Lama": {
    expected: [3.42, 3.91, 4.52, 5.29, 5.29],
    drop: $item`llama lama gong`,
    pref: "_gongDrops",
  },
  "Li'l Xenomorph": {
    expected: [3.03, 3.42, 3.91, 4.52, 5.29],
    drop: $item`transporter transponder`,
    pref: "_transponderDrops",
  },
};

let savedMimicDropValue: number | null = null;
function mimicDropValue() {
  return (
    savedMimicDropValue ??
    (savedMimicDropValue =
      averagePrice($items`Polka Pop, BitterSweetTarts, Piddles`) / (6.29 * 0.95 + 1 * 0.05))
  );
}
export enum PrimaryGoal {
  NONE,
  PLUS_COMBAT,
  MINUS_COMBAT,
}
const primaryGoalToMaximizer = new Map<PrimaryGoal, string[]>([
  [PrimaryGoal.NONE, []],
  [PrimaryGoal.PLUS_COMBAT, ["+combat"]],
  [PrimaryGoal.MINUS_COMBAT, ["-combat"]],
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
  ].join(", ");
}

export function getKramcoWandererChance() {
  const fights = parseInt(getProperty("_sausageFights"));
  const lastFight = parseInt(getProperty("_lastSausageMonsterTurn"));
  const totalTurns = totalTurnsPlayed();
  if (fights < 1) {
    return lastFight === totalTurns && myTurncount() < 1 ? 0.5 : 1.0;
  }
  const turnsSinceLastFight = totalTurns - lastFight;
  return Math.min(1.0, (turnsSinceLastFight + 1) / (5 + fights * 3 + Math.max(0, fights - 5) ** 3));
}

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
    if (myInebriety() > inebrietyLimit()) {
      forceEquip = [...exclude(forceEquip, [$item`hobo code binder`]), $item`Drunkula's wineglass`];
      auxiliaryGoals = [...auxiliaryGoals, "0.01 weapon damage"];
    } else if (
      have($item`Kramco Sausage-o-Matic™`) &&
      getKramcoWandererChance() > 0.04 &&
      !forceEquip.includes($item`hobo code binder`) // AND probability is reasonably high.
    ) {
      forceEquip = [...forceEquip, $item`Kramco Sausage-o-Matic™`];
    }

    banned = [
      ...banned,
      ...$items`Pigsticker of Violence, porcelain porkpie, miniature crystal ball`,
    ];

    this.location = location;
    this.primaryGoal = primaryGoal;
    this.auxiliaryGoals = auxiliaryGoals;
    this.forceEquip = forceEquip;
    this.banned = banned;
  }

  limitedFreeRunsAvailable() {
    const additionalEquip: Item[] = [];
    if (
      getCampground()["Asdon Martin keyfob"] !== undefined &&
      !getProperty("banishedMonsters").includes("Spring-Loaded Front Bumper")
    ) {
      if (getFuel() < 50) {
        fillAsdonMartinTo(100);
      }
      return { limitedFreeRuns: true, additionalEquip };
    }

    for (const [pref, maxCount, itemOrSkill] of freeRunSources) {
      const available =
        typeof maxCount === "number" ? getPropertyInt(pref) < maxCount : !getPropertyBoolean(pref);
      print(`${itemOrSkill} available: ${available}`);
      if (available && has(itemOrSkill as Item | Skill)) {
        if (itemOrSkill instanceof Item) additionalEquip.push(itemOrSkill as Item);
        if (itemOrSkill instanceof Skill) sausageMp(mpCost(itemOrSkill as Skill));
        return { limitedFreeRuns: true, additionalEquip };
      }
    }

    /* const hasInk = getProperty('latteUnlocks').includes('ink');
    if (
      availableAmount($item`latte lovers member's mug`) > 0 &&
      hasInk &&
      !this.forceEquip.includes($item`hobo code binder`) &&
      (getPropertyBoolean('_latteBanishUsed') ? 0 : 1) + getPropertyInt('_latteRefillsUsed') < 3
    ) {
      if (getPropertyBoolean('_latteBanishUsed')) {
        cliExecute('latte refill cinnamon pumpkin ink');
      }
      additionalEquip = [...exclude(additionalEquip, $item`Kramco Sausage-o-Matic™`), $item`latte lovers member's mug`];
      return { limitedFreeRuns: true, additionalEquip };
    } */

    return { limitedFreeRuns: false, additionalEquip };
  }

  setupFreeRuns() {
    if (!getPropertyBoolean("_forko_freeRunFamiliarUsed", false) && freeRunFamiliar !== null) {
      useFamiliar(freeRunFamiliar);
      maximizeCached(
        renderObjective(
          PrimaryGoal.NONE,
          ["familiar weight", ...this.auxiliaryGoals],
          exclude(this.forceEquip, fightOnlyItems),
          this.banned
        )
      );
      if (
        getPropertyInt("_banderRunaways") < Math.floor(myFamiliarWeight() / 5) &&
        tryEnsureSong($skill`The Ode to Booze`)
      ) {
        this.primaryGoal = PrimaryGoal.NONE;
        this.auxiliaryGoals = ["familiar weight", ...this.auxiliaryGoals];
        this.forceEquip = exclude(this.forceEquip, fightOnlyItems);
        this.familiarLocked = true;
        this.willFreeRun = true;
        return;
      }
      // fall through if we've used all our familiar runs.
      setProperty("_forko_freeRunFamiliarUsed", "true");
    }

    if (myInebriety() > inebrietyLimit()) {
      this.familiarLocked = false;
      this.willFreeRun = false;
      return;
    }

    const { limitedFreeRuns, additionalEquip } = this.limitedFreeRunsAvailable();

    this.familiarLocked = false;
    this.willFreeRun = limitedFreeRuns || freeRunItems.some((it: Item) => itemAmount(it) > 0);
    if (this.willFreeRun)
      this.forceEquip = [...exclude(this.forceEquip, turnOnlyItems), ...additionalEquip];
  }

  pickFamiliar() {
    let pickedFamiliar: Familiar | null = null;
    const lowMp =
      myMp() < Math.min(myMaxmp() - 50, myFamiliar() === $familiar`Stocking Mimic` ? 400 : 200);
    const turbo = turboMode();

    if (myInebriety() === (myFamiliar() === $familiar`Stooper` ? 0 : 1) + inebrietyLimit()) {
      pickedFamiliar = $familiar`Stooper`;
    } else {
      pickedFamiliar = $familiar`Star Starfish`;
    }

    if (pickedFamiliar === null && this.willFreeRun) {
      if (
        this.primaryGoal === PrimaryGoal.MINUS_COMBAT &&
        myFamiliarWeight($familiar`Disgeist`) >= 38
      ) {
        pickedFamiliar = $familiar`Disgeist`;
      } else if (myInebriety() <= inebrietyLimit() && lowMp && !turbo) {
        pickedFamiliar = $familiar`Machine Elf`;
      } else if (
        !$locations`A Maze of Sewer Tunnels, Hobopolis Town Square`.includes(this.location) &&
        haveFamiliar($familiar`Space Jellyfish`)
      ) {
        pickedFamiliar = $familiar`Space Jellyfish`;
      } /* else if (getPropertyInt('_gothKidFights') < 7) {
        pickedFamiliar = $familiar`Artistic Goth Kid`;
      } */
      // TODO: Could include LHM here, but difficult
    }

    if (pickedFamiliar === null && myInebriety() <= inebrietyLimit() && lowMp) {
      pickedFamiliar = $familiar`Stocking Mimic`;
    }

    if (pickedFamiliar === null) {
      const familiarValue: [Familiar, number][] = [[$familiar`Red-Nosed Snapper`, 0]];

      const jellyProbability = [1, 0.5, 0.33, 0.25, 0.2, 0.05][
        clamp(getPropertyInt("_spaceJellyfishDrops"), 0, 5)
      ];
      if (this.location === $location`The Purple Light District`) {
        const jellyfishValue = mallPrice($item`sleaze jelly`) * jellyProbability;
        familiarValue.push([$familiar`Space Jellyfish`, jellyfishValue]);
      } else if (this.location === $location`The Heap`) {
        const jellyfishValue = mallPrice($item`stench jelly`) * jellyProbability;
        familiarValue.push([$familiar`Space Jellyfish`, jellyfishValue]);
      }

      if (!this.willFreeRun) {
        if (!turbo && myInebriety() <= inebrietyLimit()) {
          const mimicWeight = myFamiliarWeight($familiar`Stocking Mimic`);
          const actionPercentage = 1 / 3 + (haveEffect($effect`Jingle Jangle Jingle`) ? 0.1 : 0);
          const mimicValue =
            mimicDropValue() + ((mimicWeight * actionPercentage * 1) / 4) * 10 * 4 * 1.2;
          familiarValue.push([$familiar`Stocking Mimic`, mimicValue]);
        }

        if (getCounters("Digitize Monster", 0, 0).trim() !== "Digitize Monster") {
          const cologne = $item`beggin' cologne`;
          const colognePrice =
            mallPrice(cologne) - 10 * (shopAmount(cologne) + availableAmount(cologne));
          familiarValue.push([$familiar`Red-Nosed Snapper`, colognePrice / 11]);
        }

        for (const familiarName of Object.keys(rotatingFamiliars)) {
          const familiar: Familiar = Familiar.get(familiarName);
          if (
            this.location === $location`Hobopolis Town Square` &&
            familiar === $familiar`Fist Turkey`
          )
            continue;
          const { expected, drop, pref } = rotatingFamiliars[familiarName];
          const dropsAlready = getPropertyInt(pref);
          if (dropsAlready >= expected.length) continue;
          const value = mallPrice(drop) / expected[dropsAlready];
          familiarValue.push([familiar, value]);
        }
      }

      pickedFamiliar = argmax(familiarValue) as Familiar;
    }
    useFamiliar(pickedFamiliar);
    if (pickedFamiliar === $familiar`Stocking Mimic`) {
      maybeFeedMimic();
    }
    if (
      pickedFamiliar === $familiar`Red-Nosed Snapper` &&
      getProperty("redSnapperPhylum") !== "hobo"
    ) {
      visitUrl("familiar.php?action=guideme&pwd");
      visitUrl("choice.php?pwd&whichchoice=1396&option=1&cat=hobo");
    }
    if (AdventuringManager.lastFamiliar !== pickedFamiliar) {
      print(`Picked familiar ${myFamiliar()}.`, "blue");
      AdventuringManager.lastFamiliar = pickedFamiliar;
    }
  }

  forceEquipWithFamiliar() {
    if (myFamiliar() === $familiar`Stocking Mimic`) {
      return [...this.forceEquip, $item`bag of many confections`];
    } else {
      return [...this.forceEquip, $item`Li'l Businessman Kit`];
    }
  }

  // Restore, maximize, pick familiar.
  preAdventure() {
    if (haveEffect($effect`Beaten Up`) > 0) {
      // throw "Got beaten up.";
      use($item`tiny house`);
    }

    setLocation(this.location);

    // if (
    //   this.location !== $location`Hobopolis Town Square` &&
    //   !this.willFreeRun &&
    //   myInebriety() <= inebrietyLimit()
    // ) {
    //   if (getPropertyInt("_chestXRayUsed") < 3) {
    //     this.forceEquip = [...exclude(this.forceEquip, turnOnlyItems), $item`Lil' Doctor™ bag`];
    //   } else if (!getPropertyBoolean("_firedJokestersGun")) {
    //     this.forceEquip = [...exclude(this.forceEquip, turnOnlyItems), $item`The Jokester's gun`];
    //   } else if (!getPropertyBoolean("_missileLauncherUsed")) {
    //     this.forceEquip = exclude(this.forceEquip, turnOnlyItems);
    //     fillAsdonMartinTo(100);
    //   }
    // }

    maximizeCached(
      renderObjective(
        this.primaryGoal,
        this.auxiliaryGoals,
        this.forceEquipWithFamiliar(),
        this.banned
      )
    );

    sausageMp(100);
    if (myMp() < 100) restoreMp(100);
    if (myHp() < 0.8 * myMaxhp() || myHp() < 500) restoreHp(myMaxhp());

    if (!this.familiarLocked) this.pickFamiliar();

    // Maximize again to make sure we have the right familiar equipment.
    // Will only trigger if familiar has changed.
    maximizeCached(
      renderObjective(
        this.primaryGoal,
        this.auxiliaryGoals,
        this.forceEquipWithFamiliar(),
        this.banned
      )
    );

    if (equippedAmount($item`lucky gold ring`) > 0) {
      for (const item of $items`hobo nickel, sand dollar`) {
        putCloset(itemAmount(item), item);
      }
    }

    while (
      get("_universeCalculated") < get("skillLevel144") &&
      reverseNumberology()[69] !== undefined
    ) {
      cliExecute("numberology 69");
    }
  }
}
