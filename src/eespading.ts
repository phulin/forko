import {
  abort,
  cliExecute,
  getClanId,
  getProperty,
  lastChoice,
  myAscensions,
  print,
  setProperty,
  visitUrl,
} from "kolmafia";
import { $location, $skill } from "libram";
import { AdventuringManager, PrimaryGoal, usualDropItems } from "./adventure";
import { adventureMacroAuto, Macro } from "./combat";
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
  icicles = 0;
  diverts = 0;
  flimflams = 0;
}

export function printState(state: EEState) {
  print(`Image (approx): ${state.image}`);
  print(`Icicles: ${state.icicles}`);
  print(`Diverts: ${state.diverts}`);
  print(`Flimflams: ${state.flimflams}`);
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
  state.icicles = extractInt(pipeRe, logText);
  const divertRe = /diverted some cold water out of Exposure Esplanade \(([0-9]+) turn/g;
  state.diverts = extractInt(divertRe, logText);
  const flimflamRe = /flimflammed some hobos \(([0-9]+) turn/g;
  state.flimflams = extractInt(flimflamRe, logText);
  return state;
}

export const ICICLE_COUNT = 10;
export const DIVERT_COUNT = 16;
export function doEe(stopTurncount: number) {
  let desiredImage = 10;
  let state = getState(true);
  if (state.image < desiredImage && !mustStop(stopTurncount)) {
    setChoice(202, 2); // Run away from Frosty.
    setChoice(273, 1); // Get frozen banquet
    setChoice(215, 3); // Make icicles
    setChoice(217, 1); // Yodel a little
    setChoice(292, 2); // Reject SR

    // First pass: Go until we get to icicle + diverts.
    // Second pass: Go until yodeling.
    // Third pass: Go until done, unless image < 9.
    while (state.image < desiredImage && !mustStop(stopTurncount)) {
      if (state.icicles >= ICICLE_COUNT && desiredImage === 10) {
        desiredImage = state.image + 1;
        print(`Got to the right number of icicles. Going to image ${desiredImage}.`, "blue");
      }

      // Make icicles or, if we're done, divert.
      setChoice(215, state.icicles >= ICICLE_COUNT ? 2 : 3);

      const needMinusCombat = state.icicles < ICICLE_COUNT;
      const estimatedTurns = 50;
      if (needMinusCombat) {
        moodMinusCombat(expectedTurns(stopTurncount), clamp(estimatedTurns, 0, 300));
      } else {
        moodBaseline(clamp(estimatedTurns, 0, 300));
      }
      const manager = new AdventuringManager(
        $location`Exposure Esplanade`,
        needMinusCombat ? PrimaryGoal.MINUS_COMBAT : PrimaryGoal.NONE,
        needMinusCombat ? [] : ["familiar weight"],
        usualDropItems
      );
      manager.preAdventure();
      adventureMacroAuto(
        $location`Exposure Esplanade`,
        // CLEESH monsters until we get to the icicle count.
        Macro.externalIf(state.icicles < ICICLE_COUNT, Macro.skill($skill`CLEESH`))
          .stasis()
          .kill()
      );

      if (!lastWasCombat()) {
        if (lastChoice() === 202) {
          break;
        } else if (lastChoice() === 215 && getChoice(215) === 3) {
          state.icicles += 1;
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
