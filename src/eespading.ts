import {
  abort,
  cliExecute,
  getClanId,
  getProperty,
  lastChoice,
  myAscensions,
  print,
  runTurn,
  setProperty,
  toUrl,
  visitUrl,
} from "kolmafia";
import { $location, $skill } from "libram";
import { AdventuringManager, PrimaryGoal, usualDropItems } from "./adventure";
import { Macro } from "./combat";
import {
  clamp,
  extractInt,
  getChoice,
  getImage,
  getImageEe,
  lastWasCombat,
  mustStop,
  setChoice,
  stopAt,
  wrapMain,
} from "./lib";
import { expectedTurns, moodBaseline, moodMinusCombat } from "./mood";

// Formatted like clanid:ascension;clanid:ascension
function clanYodelAscensions() {
  const result = new Map<number, number>();
  for (const component of getProperty("forko_eeLastYodel").split(";")) {
    if (component === "") continue;

    const subcomponents = component.split(":");
    result.set(parseInt(subcomponents[0], 10), parseInt(subcomponents[1], 10));
  }
  return result;
}

export function recordYodel() {
  print(`Recording yodel. Current: ${getProperty("forko_eeLastYodel")}`);
  const oldValue = clanYodelAscensions();
  oldValue.set(getClanId(), myAscensions());
  const result = [...oldValue.entries()]
    .map(([clanId, ascension]) => `${clanId}:${ascension}`)
    .join(";");
  print(`New: ${result}`);
  setProperty("forko_eeLastYodel", result);
}

class EEState {
  image = 0;
  pipes = 0;
  diverts = 0;
  flimflams = 0;
  bigYodels = 0;
  littleYodels = 0;
}

export function printState(state: EEState) {
  print(`Image: ${state.image}`);
  print(`Icicles: ${state.pipes}`);
  print(`Diverts: ${state.diverts}`);
  // print(`Flimflams: ${state.flimflams}`);
  print(`Little yodels: ${state.littleYodels}`);
  print(`Big yodels: ${state.bigYodels}`);
}

export function getState(checkImage = true) {
  const state = new EEState();
  if (checkImage) {
    state.image = getImageEe.forceUpdate();
  } else {
    state.image = getImageEe();
  }
  if (state.image < 0) {
    abort("Cannot get to EE.");
  }

  const logText = visitUrl("clan_raidlogs.php");
  const pipeRe = /broke (a|[0-9]+) water pipe/g;
  state.pipes = extractInt(pipeRe, logText);
  const divertRe = /diverted some cold water out of Exposure Esplanade \(([0-9]+) turn/g;
  state.diverts = extractInt(divertRe, logText);
  const flimflamRe = /flimflammed some hobos \(([0-9]+) turn/g;
  state.flimflams = extractInt(flimflamRe, logText);
  const bigYodelRe = /yodeled like crazy \(([0-9]+) turn/g;
  state.bigYodels = extractInt(bigYodelRe, logText);
  const littleYodelRe = /yodeled a little bit \(([0-9]+) turn/g;
  state.littleYodels = extractInt(littleYodelRe, logText);
  return state;
}

export function doEe(stopTurncount: number) {
  let desiredImage = 10;
  let state = getState(true);
  const stop = () => false; // state.pipes >= 30;

  while (state.image < desiredImage && !stop() && !mustStop(stopTurncount)) {
    const makePipes = false; // state.pipes < 30;
    const yodelLittle = false;
    const yodelBig = false;
    const killHobos = !makePipes && state.bigYodels > 0;
    const stopOnImageChange = !makePipes && state.bigYodels > 0;

    setChoice(202, 2); // Run away from Frosty.
    setChoice(273, 1); // Get frozen banquet
    setChoice(215, makePipes ? 3 : 2); // Make icicles or divert
    setChoice(217, yodelLittle ? 1 : yodelBig ? 3 : 0); // Yodel: break
    setChoice(292, 2); // Reject SR

    if (stopOnImageChange && desiredImage === 10) {
      desiredImage = state.image + 1;
      print(`Got to the right number of icicles. Going to image ${desiredImage}.`, "blue");
    }

    const needMinusCombat = makePipes;
    const estimatedTurns = 50;
    if (needMinusCombat) {
      moodMinusCombat(expectedTurns(stopTurncount), clamp(estimatedTurns, 0, 300));
    } else {
      moodBaseline(clamp(estimatedTurns, 0, 300));
    }
    const manager = new AdventuringManager(
      $location`Exposure Esplanade`,
      needMinusCombat ? PrimaryGoal.MINUS_COMBAT : PrimaryGoal.PLUS_COMBAT,
      needMinusCombat ? [] : ["familiar weight", "-equip mushroom badge"],
      usualDropItems
    );
    manager.preAdventure();

    // CLEESH monsters until we get to the icicle count.
    Macro.externalIf(!killHobos, Macro.skill($skill`CLEESH`))
      // .skill($skill`Stuffed Mortar Shell`)
      // .item($item`seal tooth`)
      .skill($skill`Cannelloni Cannon`)
      .repeat()
      .setAutoAttack();
    const html = visitUrl(toUrl($location`Exposure Esplanade`)) + runTurn();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const match of html.match(/knock an icicle loose from the ceiling/g) ?? []) {
      print("Hobo cried out and knocked an icicle loose.");
    }

    if (!lastWasCombat()) {
      if (lastChoice() === 202) {
        break;
      } else if (lastChoice() === 215 && getChoice(215) === 3) {
        state.pipes += 1;
      } else if (lastChoice() === 215 && getChoice(215) === 2) {
        state.diverts += 1;
      }
    }
    state = getState(true);
    printState(state);
  }

  if (!lastWasCombat() && lastChoice() === 217) {
    print(`YODELED ${getChoice(217)}`, "blue");
  }

  if (getImage($location`Exposure Esplanade`) === desiredImage) {
    print(`At image ${desiredImage}. Stopping!`);
  } else {
    print("Done with EE for now.");
  }
}

export function main(args: string) {
  wrapMain(args, () => {
    try {
      cliExecute("debug on");
      doEe(stopAt(args));
    } finally {
      cliExecute("debug off");
    }
  });
}
