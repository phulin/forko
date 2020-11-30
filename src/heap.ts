import { print, lastChoice, visitUrl } from 'kolmafia';
import { $location } from 'libram/src';
import { adventureMacro, Macro } from './combat';
import {
  getPropertyInt,
  getImage,
  setChoice,
  mustStop,
  lastWasCombat,
  setPropertyInt,
  extractInt,
  clamp,
  maximizeCached,
  preAdventure,
  usualDropItems,
  stopAt,
  wrapMain,
  GOAL_MINUS_COMBAT,
} from './lib';
import { expectedTurns, moodMinusCombat } from './mood';

function estimateRemaining() {
  const logText = visitUrl('clan_raidlogs.php');
  const defeated = extractInt(/defeated +Stench hobo x ([0-9]+)/g, logText);
  const trashcanos = extractInt(/started ([0-9]+) trashcano/g, logText);
  return 500 - (defeated + trashcanos * 5);
}

// const FREE_RUN_HEAP = false;
export function doHeap(stopTurncount: number) {
  if (getImage($location`The Heap`) >= 10) {
    print('At Oscus. Heap complete!');
    return;
  }

  setChoice(203, 0); // Show Oscus in browser
  setChoice(214, 1); // Trashcano
  setChoice(218, 1); // I Refuse!
  setChoice(295, 1); // Take SR

  // const tryFreeRun = FREE_RUN_HEAP && myInebriety() <= inebrietyLimit();

  Macro.stasis().kill().setAutoAttack();

  while (getImage($location`The Heap`) < 10 && !mustStop(stopTurncount)) {
    print('NCS until we compost: ' + getPropertyInt('minehobo_heapNcsUntilCompost', 0));
    print('Image: ' + getImage($location`The Heap`));

    setChoice(216, getPropertyInt('minehobo_heapNcsUntilCompost', 0) <= 0 ? 1 : 2);

    const estimatedTurns = estimateRemaining() / 1.9;
    moodMinusCombat(expectedTurns(stopTurncount), clamp(estimatedTurns, 0, 300));
    maximizeCached(['-combat'], usualDropItems);
    preAdventure($location`The Heap`, false, false, GOAL_MINUS_COMBAT);
    maximizeCached(['-combat'], usualDropItems);
    adventureMacro($location`The Heap`, Macro.abort());

    if (!lastWasCombat()) {
      if (lastChoice() === 216) {
        if (getPropertyInt('minehobo_heapNcsUntilCompost', 0) <= 0) {
          // We just composted.
          setPropertyInt('minehobo_heapNcsUntilCompost', 5);
        }
      } else {
        // Some other choice adventure is filling the queue.
        setPropertyInt('minehobo_heapNcsUntilCompost', getPropertyInt('minehobo_heapNcsUntilCompost', 0) - 1);
      }
    }
  }
  if (getImage($location`The Heap`) === 10) {
    // Reset for next instance once we find Oscus.
    setPropertyInt('minehobo_heapNcsUntilCompost', 0);
    print('At Oscus. Heap complete!');
  }
}

export function main(args: string) {
  wrapMain(() => doHeap(stopAt(args)));
}
