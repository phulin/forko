import { farmingClans, printClanStatus, setClan } from "./wl";

export function main() {
  for (const clanName of farmingClans) {
    setClan(clanName, false);
    printClanStatus();
  }
}
