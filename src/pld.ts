import { visitUrl, print, setAutoAttack } from 'kolmafia';
import { $location } from 'libram/src';
import { adventureRunOrStasis } from './combat';
import { getState as getEeState } from './ee';
import {
  getImage,
  setChoice,
  mustStop,
  stopAt,
  extractInt,
  maximizeFreeRuns,
  usualDropItems,
  preAdventure,
  GOAL_PLUS_COMBAT,
  wrapMain,
} from './lib';
import { expectedTurns, moodAddItem, moodPlusCombat } from './mood';

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
  if (getImage($location`The Purple Light District`) === 10) {
    print('At Chester.');
    return;
  }

  setChoice(205, 0); // Show Chester in browser.
  setChoice(219, 1); // We shouldn't encounter Furtivity.
  setChoice(223, 1); // Get into the club.
  setChoice(294, 1); // Take SR

  setAutoAttack(0);

  let state = getPldState();
  const diverts = getEeState().diverts;
  while (getImage($location`The Purple Light District`) < 10 && !mustStop(stopTurncount)) {
    const maxFights = FREE_RUN_PLD ? 34 : 25;
    const tryFreeRun = state.fights < maxFights;
    setChoice(223, diverts + state.flimflams < 21 ? 3 : 1);

    const turnsEstimate = Math.max(0, maxFights - state.fights) + Math.max(0, 18 - state.kills);
    const location = $location`The Purple Light District`;
    moodPlusCombat(expectedTurns(stopTurncount), turnsEstimate);
    const { freeRun, familiarLocked } = maximizeFreeRuns('+combat', [], usualDropItems, [], tryFreeRun);
    preAdventure(location, freeRun, familiarLocked, GOAL_PLUS_COMBAT);
    if (!freeRun) moodAddItem();
    adventureRunOrStasis(location, freeRun);

    state = getPldState();
    print('Diverts: ' + diverts);
    print('Flimflams: ' + state.flimflams);
    print('Fights: ' + state.fights);
    print('Image: ' + getImage($location`The Purple Light District`));
  }
  if (getImage($location`The Purple Light District`) >= 10) {
    print('At Chester.');
  }
}

export function main(args: string) {
  wrapMain(() => doPld(stopAt(args)));
}
