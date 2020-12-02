import { print, lastChoice, visitUrl, lastMonster, myTurncount } from 'kolmafia';
import { $location, $monster } from 'libram/src';
import { adventureMacro, Macro } from './combat';
import {
  getPropertyInt,
  setChoice,
  mustStop,
  lastWasCombat,
  setPropertyInt,
  extractInt,
  clamp,
  usualDropItems,
  stopAt,
  wrapMain,
  getImageHeap,
  AdventuringManager,
  PrimaryGoal,
} from './lib';
import { expectedTurns, moodMinusCombat } from './mood';

class HeapState {
  defeated = 0;
  trashcanos = 0;
}
function getHeapState() {
  const result = new HeapState();
  const logText = visitUrl('clan_raidlogs.php');
  result.defeated = extractInt(/defeated +Stench hobo x ([0-9]+)/g, logText);
  result.trashcanos = extractInt(/started ([0-9]+) trashcano/g, logText);
  return result;
}

function estimateRemaining(heapState: HeapState) {
  return 500 - (heapState.defeated + heapState.trashcanos * 5);
}

// const FREE_RUN_HEAP = false;
export function doHeap(stopTurncount: number) {
  if (getImageHeap() >= 10) {
    setPropertyInt('minehobo_heapNcsUntilCompost', 0);
    print('At Oscus. Heap complete!');
    return;
  }

  setChoice(203, 2); // Show Oscus in browser
  setChoice(214, 1); // Trashcano
  setChoice(218, 1); // I Refuse!
  setChoice(295, 1); // Take SR

  // const tryFreeRun = FREE_RUN_HEAP && myInebriety() <= inebrietyLimit();

  Macro.stasis().kill().setAutoAttack();

  let state = getHeapState();

  while (!mustStop(stopTurncount)) {
    print('NCS until we compost: ' + getPropertyInt('minehobo_heapNcsUntilCompost', 0));
    print('Image (approx): ' + getImageHeap());

    setChoice(216, getPropertyInt('minehobo_heapNcsUntilCompost', 0) <= 0 ? 1 : 2);

    const estimatedTurns = estimateRemaining(state) / 1.9;
    moodMinusCombat(expectedTurns(stopTurncount), clamp(estimatedTurns, 0, 300));
    const manager = new AdventuringManager($location`The Heap`, PrimaryGoal.MINUS_COMBAT, [], usualDropItems);
    manager.preAdventure();
    adventureMacro($location`The Heap`, Macro.abort());

    if (lastWasCombat() && lastMonster() === $monster`stench hobo`) {
      state.defeated += 1;
    } else {
      if (lastChoice() === 216) {
        if (getPropertyInt('minehobo_heapNcsUntilCompost', 0) <= 0) {
          // We just composted.
          setPropertyInt('minehobo_heapNcsUntilCompost', 5);
        }
      } else if (lastChoice() === 203) {
        break;
      } else if ([214, 218].includes(lastChoice())) {
        // Some other choice adventure is filling the queue.
        setPropertyInt('minehobo_heapNcsUntilCompost', getPropertyInt('minehobo_heapNcsUntilCompost', 0) - 1);
        if (lastChoice() === 214) state.trashcanos += 1;
      }
    }

    if (myTurncount() % 20 === 0) state = getHeapState();
  }

  if (getImageHeap() === 10) {
    // Reset for next instance once we find Oscus.
    setPropertyInt('minehobo_heapNcsUntilCompost', 0);
    print('At Oscus. Heap complete!');
  }
}

export function main(args: string) {
  wrapMain(() => doHeap(stopAt(args)));
}
