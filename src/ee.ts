import {
  getProperty,
  getClanId,
  myAscensions,
  print,
  setProperty,
  abort,
  visitUrl,
  lastChoice,
  myTurncount,
} from 'kolmafia';
import { $location } from 'libram/src';
import { adventureMacro, Macro } from './combat';
import {
  mustStop,
  setChoice,
  getImage,
  preAdventure,
  maximizeCached,
  usualDropItems,
  stopAt,
  wrapMain,
  extractInt,
  lastWasCombat,
  clamp,
} from './lib';
import { expectedTurns, moodMinusCombat } from './mood';

// Formatted like clanid:ascension;clanid:ascension
function clanYodelAscensions() {
  const result = new Map<number, number>();
  for (const component of getProperty('minehobo_eeLastYodel').split(';')) {
    if (component === '') continue;

    const subcomponents = component.split(':');
    result.set(parseInt(subcomponents[0], 10), parseInt(subcomponents[1], 10));
  }
  return result;
}

function yodeledThisAscension() {
  return clanYodelAscensions().get(getClanId()) === myAscensions();
}

export function recordYodel() {
  print(`Recording yodel. Current: ${getProperty('minehobo_eeLastYodel')}`);
  const oldValue = clanYodelAscensions();
  oldValue.set(getClanId(), myAscensions());
  const result = [...oldValue.entries()].map(([clanId, ascension]) => `${clanId}:${ascension}`).join(';');
  print(`New: ${result}`);
  setProperty('minehobo_eeLastYodel', result);
}

class EEState {
  image = 0;
  icicles = 0;
  diverts = 0;
  flimflams = 0;
}

export function printState(state: EEState) {
  print('Image (approx): ' + state.image);
  print('Icicles: ' + state.icicles);
  print('Diverts: ' + state.diverts);
  print('Flimflams: ' + state.flimflams);
}

export function getState(checkImage = true) {
  const state = new EEState();
  if (checkImage || myTurncount() % 10 === 0) {
    state.image = getImage($location`Exposure Esplanade`);
    if (state.image < 0) {
      abort('Cannot get to EE.');
    }
  }

  const logText = visitUrl('clan_raidlogs.php');
  const pipeRe = /broke (a|[0-9]+) water pipe/g;
  state.icicles = extractInt(pipeRe, logText);
  const divertRe = /diverted some cold water out of Exposure Esplanade \(([0-9]+) turn/g;
  state.diverts = extractInt(divertRe, logText);
  const flimflamRe = /flimflammed some hobos \(([0-9]+) turn/g;
  state.flimflams = extractInt(flimflamRe, logText);
  return state;
}

export const ICICLE_COUNT = 85;
export const DIVERT_COUNT = 16;
export function doEe(stopTurncount: number, pass: number) {
  let state = getState(true);
  let yodeled = yodeledThisAscension();
  if (
    ((pass === 1 && (state.icicles < ICICLE_COUNT || state.diverts + state.flimflams < DIVERT_COUNT) && !yodeled) ||
      (pass === 2 && !yodeled) ||
      (pass === 3 && state.image >= 9) ||
      pass === 4) &&
    state.image < 10 &&
    !mustStop(stopTurncount)
  ) {
    setChoice(202, 2); // Run away from Frosty.
    setChoice(273, 1); // Get frozen banquet
    setChoice(215, 3); // Make icicles
    setChoice(217, 1); // Yodel a little
    setChoice(292, 2); // Reject SR

    Macro.stasis().kill().setAutoAttack();

    // First pass: Go until we get to icicle + diverts.
    // Second pass: Go until yodeling.
    // Third pass: Go until done, unless image < 9.
    while (
      ((pass === 1 && (state.icicles < ICICLE_COUNT || state.diverts + state.flimflams < DIVERT_COUNT) && !yodeled) ||
        (pass === 2 && !yodeled) ||
        (pass === 3 && state.image >= 9) ||
        pass === 4) &&
      !mustStop(stopTurncount)
    ) {
      if (state.icicles >= ICICLE_COUNT && (state.diverts >= DIVERT_COUNT || state.flimflams + state.diverts >= 21)) {
        // We've done enough BB that making icicles lets us skip an adventure to find yodeling.
        setChoice(215, 3);
      } else {
        // Make icicles or, if we're done, divert.
        setChoice(215, state.icicles >= ICICLE_COUNT ? 2 : 3);
      }
      // Yodel heart out if we're done with icicles.
      setChoice(217, state.icicles >= ICICLE_COUNT ? 3 : 1);

      const estimatedTurns = 2 * (ICICLE_COUNT - state.icicles) + state.image * 10;
      moodMinusCombat(expectedTurns(stopTurncount), clamp(estimatedTurns, 0, 300));
      maximizeCached(['-combat'], usualDropItems);
      preAdventure($location`Exposure Esplanade`);
      maximizeCached(['-combat'], usualDropItems);
      adventureMacro($location`Exposure Esplanade`, Macro.abort());

      if (!lastWasCombat()) {
        if (lastChoice() === 202) {
          break;
        } else if (lastChoice() === 217 && state.icicles >= ICICLE_COUNT) {
          recordYodel();
          yodeled = true;
        }
      }
      state = getState();
      printState(state);
    }

    if (getImage($location`Exposure Esplanade`) === 10) {
      print('At Frosty. Stopping!');
    } else if (getImage($location`Burnbarrel Blvd.`) < 8) {
      print('Stopping EE. Go do BB.');
    } else {
      print('Done with EE for now.');
    }
  }
}

export function main(args: string) {
  wrapMain(() => doEe(stopAt(args), 4));
}
