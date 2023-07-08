import {
  Effect,
  abort,
  ceil,
  cliExecute,
  haveEffect,
  inebrietyLimit,
  myBuffedstat,
  myInebriety,
  numericModifier,
  print,
  round,
  toFloat,
  visitUrl,
} from "kolmafia";
import { $effect, $item, $location, $skill, $stat } from "libram";
import { AdventuringManager, PrimaryGoal, usualDropItems } from "./adventure";
import { Macro, adventureMacro } from "./combat";
import {
  extractInt,
  getImage,
  memoizeTurncount,
  mustStop,
  setChoice,
  stopAt,
  turboMode,
  wrapMain,
} from "./lib";
import { ensureEffect, expectedTurns, moodBaseline } from "./mood";

const DESIRED_HOBOS = 1250;

enum PartType {
  HOT,
  COLD,
  STENCH,
  SLEAZE,
  SPOOKY,
  PHYSICAL,
}

class MonsterPart {
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

const allParts = new Map<PartType, MonsterPart>([
  [
    PartType.HOT,
    new MonsterPart(
      PartType.HOT,
      "hot",
      /pairs? of charred hobo boots/,
      $effect`Spirit of Cayenne`
    ),
  ],
  [
    PartType.COLD,
    new MonsterPart(
      PartType.COLD,
      "cold",
      /pairs? of frozen hobo eyes/,
      $effect`Spirit of Peppermint`
    ),
  ],
  [
    PartType.STENCH,
    new MonsterPart(
      PartType.STENCH,
      "stench",
      /piles? of stinking hobo guts/,
      $effect`Spirit of Garlic`
    ),
  ],
  [
    PartType.SLEAZE,
    new MonsterPart(PartType.SLEAZE, "sleaze", /hobo crotch/, $effect`Spirit of Bacon Grease`),
  ],
  [
    PartType.SPOOKY,
    new MonsterPart(PartType.SPOOKY, "spooky", /creepy hobo skull/, $effect`Spirit of Wormwood`),
  ],
  [PartType.PHYSICAL, new MonsterPart(PartType.PHYSICAL, "physical", /hobo skin/, $effect`none`)],
]);

class PartPlan {
  type: MonsterPart;
  count = 0;

  constructor(type: MonsterPart) {
    this.type = type;
  }
}

const currentParts = memoizeTurncount(() => {
  const result = new Map<MonsterPart, number>();
  const text = visitUrl("clan_hobopolis.php?place=3&action=talkrichard&whichtalk=3");
  for (const part of allParts.values()) {
    const partRe = new RegExp(`<b>(a|[0-9]+)</b> ${part.regex.source}`, "g");
    result.set(part, extractInt(partRe, text));
  }
  return result;
});

const pldAccessible = memoizeTurncount(() => {
  return visitUrl("clan_hobopolis.php?place=8").match(/purplelightdistrict[0-9]+.gif/);
});

function getParts(part: MonsterPart, desiredParts: number, stopTurncount: number) {
  const current = currentParts().get(part) as number;
  if (current >= desiredParts || pldAccessible() || mustStop(stopTurncount)) return;

  // This is up here so we have the right effects on for damage prediction.
  const expected = expectedTurns(stopTurncount);
  moodBaseline(expected);
  ensureEffect($effect`Ur-Kel's Aria of Annoyance`, current - desiredParts);

  while (
    (currentParts().get(part) as number) < desiredParts &&
    !pldAccessible() &&
    !mustStop(stopTurncount)
  ) {
    const manager = new AdventuringManager(
      $location`Hobopolis Town Square`,
      PrimaryGoal.NONE,
      ["spell damage percent", "-equip mushroom cap", "-equip mushroom badge"],
      usualDropItems
    );
    manager.preAdventure();

    if (
      [PartType.HOT, PartType.COLD, PartType.STENCH, PartType.SPOOKY, PartType.SLEAZE].includes(
        part.type
      )
    ) {
      const predictedDamage =
        (32 + 0.5 * myBuffedstat($stat`Mysticality`)) *
        (1 + numericModifier("spell damage percent") / 100);
      if (predictedDamage < 505) {
        abort(`Predicted spell damage ${round(predictedDamage)} is not enough to overkill hobos.`);
      }
      if (haveEffect(part.intrinsic) === 0) {
        cliExecute(part.intrinsic.default);
      }
      Macro.stasis()
        .if_("monstername sausage goblin", Macro.skill($skill`Saucegeyser`).repeat())
        .skill($skill`Stuffed Mortar Shell`)
        .externalIf(!turboMode(), Macro.skill($skill`Cannelloni Cannon`).repeat())
        .item($item`seal tooth`)
        .setAutoAttack();
    } else if (part.type === PartType.PHYSICAL) {
      Macro.stasis()
        .skill($skill`Spaghetti Spear`)
        .item($item`New Age healing crystal`)
        .item($item`New Age hurting crystal`)
        .repeat()
        .setAutoAttack();
    }

    adventureMacro($location`Hobopolis Town Square`, Macro.abort());
  }
}

export function doTownsquare(stopTurncount: number) {
  if (pldAccessible()) {
    print("Finished Town Square. Continuing...");
    return;
  } else if (mustStop(stopTurncount)) {
    print("Out of adventures.");
    return;
  }

  setChoice(230, 0); // Show binder adventure in browser.
  setChoice(200, 0); // Show Hodgman in browser.
  setChoice(272, 2); // Skip marketplace.
  setChoice(225, 3); // Skip tent.

  // print('Making available scarehobos.');
  visitUrl("clan_hobopolis.php?preaction=simulacrum&place=3&qty=1&makeall=1");

  const image = getImage($location`Hobopolis Town Square`);
  const desiredImage = Math.floor(DESIRED_HOBOS / 100);
  if (image < desiredImage && myInebriety() <= inebrietyLimit()) {
    // Assume we're at the end of our current image and estimate. This will be conservative.
    const imagesRemaining = desiredImage - image;
    let hobosRemaining = (imagesRemaining - 1) * 100;
    // Make a plan: how many total scarehobos do we need to make to kill that many?
    // Start with the part with the fewest (should be 0).
    const partCounts = [...currentParts().entries()];
    partCounts.sort((x, y) => x[1] - y[1]);
    const plan = partCounts.map(([part]: [MonsterPart, number]) => new PartPlan(part));
    for (const [idx, [, partCount]] of partCounts.entries()) {
      if (hobosRemaining > 0 && idx < partCounts.length - 1) {
        const [, nextPartCount] = partCounts[idx + 1];
        const killsToNext = nextPartCount - partCount;
        // Each part we add to our goal kills this many hobos - for the part with lowest, it's 9.
        // The part with the second lowest, it's 2 hobos plus 1 scarehobo or 10.
        const scarehoboFactor = idx + 9;
        const partsThisRound = Math.min(
          ceil(hobosRemaining / toFloat(scarehoboFactor) - 0.001),
          killsToNext
        );
        for (let idx2 = 0; idx2 <= idx; idx2++) {
          plan[idx2].count += partsThisRound;
        }
        hobosRemaining -= partsThisRound * scarehoboFactor;
      }
    }

    if (hobosRemaining > 0) {
      print(`Remaining after: ${hobosRemaining}`);
      for (const partPlan of plan) {
        partPlan.count += Math.ceil((hobosRemaining * 3) / 7 / 6);
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
    print("Making available scarehobos.");
    visitUrl("clan_hobopolis.php?preaction=simulacrum&place=3&qty=1&makeall=1");
  }
  print("Close to goal; using 1-by-1 strategy.");

  while (getImage($location`Hobopolis Town Square`) < desiredImage && !mustStop(stopTurncount)) {
    if (myInebriety() <= inebrietyLimit()) {
      for (const part of allParts.values()) {
        getParts(part, 1, stopTurncount);
      }
      print("Making available scarehobos.");
      visitUrl("clan_hobopolis.php?preaction=simulacrum&place=3&qty=1&makeall=1");
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const physical = allParts.get(PartType.PHYSICAL)!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      getParts(physical, currentParts().get(physical)! + 1, stopTurncount);
    }
    currentParts.forceUpdate();
  }
  if (getImage($location`Hobopolis Town Square`) === 5) {
    print("EE accessible. Done with town square.");
  } else if (mustStop(stopTurncount)) {
    print("Out of adventures.");
  }
}

export function main(args: string) {
  wrapMain(args, () => doTownsquare(stopAt(args)));
}
