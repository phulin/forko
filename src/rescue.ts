import { getClanName, lastChoice, print, visitUrl } from "kolmafia";
import { $location } from "libram";
import { AdventuringManager, PrimaryGoal } from "./adventure";
import { adventureRunOrStasis } from "./combat";
import { extractInt, lastWasCombat, setChoice, wrapMain } from "./lib";
import { moodAddItem, moodMinusCombat } from "./mood";
import { sewerAccess, throughSewers } from "./sewers";
import { setClan } from "./wl";

export function main(args: string) {
  setClan(args);
  if (!throughSewers() && !sewerAccess())
    throw `You do not have dungeon access in clan ${getClanName()}.`;

  wrapMain(args, () => {
    const initialRescues = extractInt(
      /from a C. H. U. M. cage \(([0-9]+) turn/g,
      visitUrl("clan_raidlogs.php")
    );

    setChoice(197, 2); // Turn valve - skip
    setChoice(198, 2); // Open grate - skil
    setChoice(199, 3); // Ladder - free BK

    do {
      moodMinusCombat(10, 10);
      const manager = new AdventuringManager(
        $location`A Maze of Sewer Tunnels`,
        PrimaryGoal.MINUS_COMBAT,
        [],
        []
      );
      manager.setupFreeRuns();
      manager.preAdventure();
      if (!manager.willFreeRun) moodAddItem();
      adventureRunOrStasis($location`A Maze of Sewer Tunnels`, manager.willFreeRun);
    } while (lastWasCombat() || lastChoice() !== 199);

    const finalRescues = extractInt(
      /from a C. H. U. M. cage \(([0-9]+) turn/g,
      visitUrl("clan_raidlogs.php")
    );

    if (initialRescues + 1 === finalRescues) {
      print("Successfully rescued someone.", "green");
    } else {
      throw "Something went wrong. Rescue failed.";
    }
  });
}
