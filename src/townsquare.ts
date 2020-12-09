import {
  visitUrl,
  myTurncount,
  cliExecute,
  myBuffedstat,
  numericModifier,
  abort,
  round,
  haveEffect,
  print,
  ceil,
  toFloat,
} from 'kolmafia';
import { $effect, $location, $monster, $skill, $stat } from 'libram/src';
import { AdventuringManager, PrimaryGoal, usualDropItems } from './adventure';
import { adventureMacro, Macro } from './combat';
import { mustStop, setChoice, getImage, extractInt, memoizeTurncount } from './lib';
import { moodBaseline } from './mood';

enum PartType {
  HOT,
  COLD,
  STENCH,
  SLEAZE,
  SPOOKY,
  PHYSICAL,
}

class HoboPart {
  type: PartType;
  name: string;
  regex: RegExp;
  intrinsic: Effect;

  constructor(type: PartType, name: string, regex: RegExp, intrinsic: Effect) {
    this.type = type;
    this.name = name;
    this.regex = regex;
    this.intrinsic = intrinsic;
  }
}

const allParts = new Map<PartType, HoboPart>([
  [PartType.HOT, new HoboPart(PartType.HOT, 'hot', /pairs? of charred hobo boots/, $effect`Spirit of Cayenne`)],
  [PartType.COLD, new HoboPart(PartType.COLD, 'cold', /pairs? of frozen hobo eyes/, $effect`Spirit of Peppermint`)],
  [PartType.STENCH, new HoboPart(PartType.STENCH, 'stench', /piles? of stinking hobo guts/, $effect`Spirit of Garlic`)],
  [PartType.SLEAZE, new HoboPart(PartType.SLEAZE, 'sleaze', /hobo crotch/, $effect`Spirit of Bacon Grease`)],
  [PartType.SPOOKY, new HoboPart(PartType.SPOOKY, 'spooky', /creepy hobo skull/, $effect`Spirit of Wormwood`)],
  [PartType.PHYSICAL, new HoboPart(PartType.PHYSICAL, 'physical', /hobo skin/, $effect`none`)],
]);

class PartPlan {
  type: HoboPart;
  count = 0;

  constructor(type: HoboPart) {
    this.type = type;
  }
}

const currentParts = memoizeTurncount(() => {
  const result = new Map<HoboPart, number>();
  const text = visitUrl('clan_hobopolis.php?place=3&action=talkrichard&whichtalk=3');
  for (const part of allParts.values()) {
    const partRe = new RegExp(`<b>(a|[0-9]+)</b> ${part.regex.source}`, 'g');
    result.set(part, extractInt(partRe, text));
  }
  return result;
});

const pldAccessible = memoizeTurncount(() => {
  return visitUrl('clan_hobopolis.php?place=8').match(/purplelightdistrict[0-9]+.gif/);
});

function getParts(part: HoboPart, desiredParts: number, stopTurncount: number) {
  if ((currentParts().get(part) as number) >= desiredParts || pldAccessible() || mustStop(stopTurncount)) return;

  // This is up here so we have the right effects on for damage prediction.
  moodBaseline(stopTurncount - myTurncount());

  while ((currentParts().get(part) as number) < desiredParts && !pldAccessible() && !mustStop(stopTurncount)) {
    if ([PartType.COLD, PartType.STENCH, PartType.SPOOKY, PartType.SLEAZE].includes(part.type)) {
      const predictedDamage =
        (32 + 0.5 * myBuffedstat($stat`Mysticality`)) * (1 + numericModifier('spell damage percent') / 100);
      if (predictedDamage < 505) {
        abort(`Predicted spell damage ${round(predictedDamage)} is not enough to overkill hobos.`);
      }
      if (haveEffect(part.intrinsic) === 0) {
        cliExecute(part.intrinsic.default);
      }
      Macro.stasis()
        .mIf(Macro.monster($monster`sausage goblin`), Macro.skillRepeat($skill`Saucegeyser`))
        .skill($skill`Stuffed Mortar Shell`)
        .skillRepeat($skill`Cannelloni Cannon`)
        .setAutoAttack();
    } else if (part.type === PartType.HOT) {
      Macro.stasis()
        .skillRepeat($skill`Saucegeyser`)
        .setAutoAttack();
    } else if (part.type === PartType.PHYSICAL) {
      Macro.stasis()
        .skillRepeat($skill`Lunging Thrust-Smack`)
        .setAutoAttack();
    }

    const manager = new AdventuringManager(
      $location`Hobopolis Town Square`,
      PrimaryGoal.NONE,
      ['familiar weight', '-0.05 ml 0 min'],
      usualDropItems
    );
    manager.preAdventure();
    adventureMacro($location`Hobopolis Town Square`, Macro.abort());
  }
}

export function doTownsquare(stopTurncount: number) {
  if (pldAccessible()) {
    print('Finished Town Square. Continuing...');
    return;
  } else if (mustStop(stopTurncount)) {
    print('Out of adventures.');
    return;
  }

  setChoice(230, 0); // Show binder adventure in browser.
  setChoice(200, 0); // Show Hodgman in browser.
  setChoice(272, 2); // Skip marketplace.
  setChoice(225, 3); // Skip tent.

  print('Making available scarehobos.');
  visitUrl('clan_hobopolis.php?preaction=simulacrum&place=3&qty=1&makeall=1');

  const image = getImage($location`Hobopolis Town Square`);
  if (image < 11) {
    // Assume we're at the end of our current image and estimate. This will be conservative.
    const imagesRemaining = 11 - image;
    let hobosRemaining = (imagesRemaining - 1) * 100;
    // Make a plan: how many total scarehobos do we need to make to kill that many?
    // Start with the part with the fewest (should be 0).
    const partCounts = [...currentParts().entries()];
    partCounts.sort((x, y) => x[1] - y[1]);
    const plan = partCounts.map(([part]: [HoboPart, number]) => new PartPlan(part));
    for (const [idx, [, partCount]] of partCounts.entries()) {
      if (hobosRemaining > 0 && idx < partCounts.length - 1) {
        const [, nextPartCount] = partCounts[idx + 1];
        const killsToNext = nextPartCount - partCount;
        // Each part we add to our goal kills this many hobos - for the part with lowest, it's 9.
        // The part with the second lowest, it's 2 hobos plus 1 scarehobo or 10.
        const scarehoboFactor = idx + 9;
        const partsThisRound = Math.min(ceil(hobosRemaining / toFloat(scarehoboFactor) - 0.001), killsToNext);
        for (let idx2 = 0; idx2 <= idx; idx2++) {
          plan[idx2].count += partsThisRound;
        }
        hobosRemaining -= partsThisRound * scarehoboFactor;
      }
    }

    if (hobosRemaining > 0) {
      print(`Remaining after: ${hobosRemaining}`);
      for (const partPlan of plan) {
        partPlan.count += ceil((hobosRemaining * 3) / 7 / 6);
      }
    }

    for (const partPlan of plan) {
      print(`PLAN: For part ${partPlan.type.name}, get ${partPlan.count} more parts.`);
    }
    plan.sort((x, y) => x.type.type - y.type.type);
    for (const partPlan of plan) {
      print(`PLAN: For part ${partPlan.type.name}, get ${partPlan.count} more parts.`);
    }
    for (const partPlan of plan) {
      getParts(partPlan.type, partPlan.count, stopTurncount);
    }
    print('Making available scarehobos.');
    visitUrl('clan_hobopolis.php?preaction=simulacrum&place=3&qty=1&makeall=1');
  }
  print('Close to goal; using 1-by-1 strategy.');

  while (!pldAccessible() && !mustStop(stopTurncount)) {
    for (const part of allParts.values()) {
      getParts(part, 1, stopTurncount);
    }
    print('Making available scarehobos.');
    visitUrl('clan_hobopolis.php?preaction=simulacrum&place=3&qty=1&makeall=1');
    currentParts.forceUpdate();
  }
  if (pldAccessible()) {
    print('PLD accessible. Done with town square.');
  } else if (mustStop(stopTurncount)) {
    print('Out of adventures.');
  }
}
