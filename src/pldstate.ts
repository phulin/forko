import { print, visitUrl } from "kolmafia";
import { getPldState } from "./pld";

export function main(): void {
  print(
    `Image: ${
      visitUrl(`clan_hobopolis.php?place=8`).match(/purplelightdistrict([0-9]+)o?.gif/)?.[1]
    }`
  );
  print(`Kills: ${getPldState().kills}`);
}
