import { visitUrl, print, setAutoAttack, lastChoice } from 'kolmafia';
import { $location } from 'libram/src';
import { AdventuringManager, PrimaryGoal, usualDropItems } from './adventure';
import { adventureRunOrStasis } from './combat';
import { getState as getEeState } from './ee';
import { setChoice, mustStop, stopAt, extractInt, wrapMain, getImagePld, lastWasCombat } from './lib';
import { expectedTurns, moodPlusCombat } from './mood';

const FREE_RUN_PLD = true;

class PLDState {
  fights = 0;
  flimflams = 0;
  kills = 0;
}

function getPldState() {
  const result = new PLDState();
  const logText = visitUrl('clan_raidlogs.php');
  result.fights = extractInt(/started (a|[0-9]+) barfight/g, logText);
  result.flimflams = extractInt(/flimflammed some hobos \(([0-9]+) turn/g, logText);
  result.kills = extractInt(/defeated +Sleaze hobo x ([0-9]+)/g, logText);
  return result;
}

export function doPld(stopTurncount: number) {
  if (getImagePld() === 10) {
    print('At Chester.');
    return;
  }

  setChoice(205, 2); // Leave Chester.
  setChoice(219, 1); // We shouldn't encounter Furtivity.
  setChoice(223, 1); // Get into the club.
  setChoice(294, 1); // Take SR

  setAutoAttack(0);

  let state = getPldState();
  const diverts = getEeState().diverts;
  while (!mustStop(stopTurncount)) {
    const maxFights = FREE_RUN_PLD ? 34 : 25;
    const tryFreeRun = state.fights < maxFights;
    setChoice(223, diverts + state.flimflams < 21 ? 3 : 1);
    setChoice(224, tryFreeRun ? 2 : 1);

    const turnsEstimate = Math.max(0, maxFights - state.fights) + Math.max(0, 18 - state.kills);
    const location = $location`The Purple Light District`;
    moodPlusCombat(expectedTurns(stopTurncount), turnsEstimate);
    const manager = new AdventuringManager(
      $location`The Purple Light District`,
      PrimaryGoal.PLUS_COMBAT,
      [],
      usualDropItems
    );
    if (tryFreeRun) manager.setupFreeRuns();
    manager.preAdventure();
    adventureRunOrStasis(location, manager.willFreeRun);

    state = getPldState();
    print(`Diverts: ${diverts}`);
    print(`Flimflams: ${state.flimflams}`);
    print(`Fights: ${state.fights}`);
    print(`Image (approx): ${getImagePld()}`);

    if (!lastWasCombat() && lastChoice() === 205) {
      break;
    }
  }

  if (getImagePld.forceUpdate() >= 10) {
    print('At Chester.');
  }
}

export function main(args: string) {
  wrapMain(() => doPld(stopAt(args)));
}
