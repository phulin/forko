import { visitUrl, myAdventures, myInebriety, inebrietyLimit, getClanName, print, myTurncount } from 'kolmafia';
import { $location } from 'libram/src';
import { adventureRunOrStasis } from './combat';
import { maximizeFreeRuns, mustStop, preAdventure, setChoice, usualDropItems } from './lib';
import { expectedTurns, moodAddItem, moodNoncombat } from './mood';

export function getSewersState() {
  const logText = visitUrl('clan_raidlogs.php');
  const grateRe = new RegExp('opened (a|[0-9]+) sewer grate');
  let grates = 0;
  let valves = 0;
  let match;
  while ((match = grateRe.exec(logText)) !== null) {
    if (match[1] == 'a') {
      grates += 1;
    } else {
      grates += parseInt(match[1], 10);
    }
  }
  const valveRe = new RegExp('lowered the water level( ([0-9]+) time)?');
  while ((match = valveRe.exec(logText)) !== null) {
    if (match[2] == 'a') {
      grates += 1;
    } else {
      grates += parseInt(match[2], 10);
    }
  }
  return { grates, valves };
}

function throughSewers() {
  return visitUrl('clan_hobopolis.php').includes('clan_hobopolis.php?place=2');
}

function sewerAccess() {
  return visitUrl('clan_hobopolis.php').includes('adventure.php?snarfblat=166');
}

function doContinue(stopTurncount: number, grates: number, valves: number) {
  return (
    sewerAccess() &&
    !mustStop(stopTurncount) &&
    myAdventures() >= 10 &&
    !(grates >= 20 && valves >= 20 && myInebriety() > inebrietyLimit())
  );
}

export function doSewers(stopTurncount: number) {
  if (!throughSewers() && !sewerAccess()) throw `You do not have dungeon access in clan ${getClanName()}.`;

  let state = getSewersState();
  if (!doContinue(stopTurncount, state.grates, state.valves)) {
    const overdrunk = myInebriety() > inebrietyLimit();
    const freeRun = !overdrunk;
    if (overdrunk) {
      print('WARNING: Going through sewers while overdrunk is not recommended.', 'red');
    }

    // Gnaw through bars
    setChoice(211, 1);
    setChoice(212, 1);
    // Turn valve
    setChoice(197, 3);
    // Open grate
    setChoice(198, 3);
    // Ladder - skip.
    setChoice(199, 2);

    while (doContinue(stopTurncount, state.grates, state.valves)) {
      const { familiarLocked } = maximizeFreeRuns('-combat', [], usualDropItems);

      if (state.valves >= 20) setChoice(197, 1); // Take tunnel and open grates.
      if (state.grates >= 20) setChoice(198, 1); // Take tunnel and open valves.
      if (state.grates + state.valves >= 32) setChoice(199, 1); // Take tunnel on useless ladder NC.

      const maxTurnsEstimate = 150 - (state.grates + state.valves) * 3.2;

      const location = $location`A Maze of Sewer Tunnels`;
      moodNoncombat(expectedTurns(stopTurncount), maxTurnsEstimate);
      if (!freeRun) moodAddItem();
      preAdventure(location, familiarLocked);
      adventureRunOrStasis(location, freeRun);

      state = getSewersState();
      print(`Opened ${state.grates} grates, turned ${state.valves} valves.`);
    }
  }

  if (throughSewers()) print('Cleared sewers!');
  else print('Stopping prematurely... not through sewers.');
}

export function main() {
  doSewers(myTurncount() + 10000);
}
