import {
  Location,
  Monster,
  adv1,
  canAdventure,
  choiceFollowsFight,
  currentRound,
  getAutoAttack,
  handlingChoice,
  inMultiFight,
  inebrietyLimit,
  lastChoice,
  myFamiliar,
  myInebriety,
  myLevel,
  myTurncount,
  print,
  runChoice,
  runCombat,
  setAutoAttack,
  setCcs,
  toUrl,
  useSkill,
  visitUrl,
  writeCcs,
} from "kolmafia";
import { $effect, $familiar, $item, $skill, Macro as LibramMacro, get, have } from "libram";
import { turboMode } from "./lib";

export function canStasis(): boolean {
  return !have($effect`Eldritch Attunement`) && myLevel() >= 40;
}

export class Macro extends LibramMacro {
  submit() {
    print(`Submitting macro: ${this.toString()}`);
    return super.submit();
  }

  stasis() {
    return this.externalIf(myInebriety() > inebrietyLimit(), "attack")
      .externalIf(
        myFamiliar() === $familiar`Stocking Mimic`,
        Macro.if_(
          "!hpbelow 500",
          Macro.skill($skill`Curse of Weaksauce`).skill($skill`Micrometeorite`)
        )
      )
      .externalIf(!turboMode(), Macro.skill($skill`Entangling Noodles`))
      .externalIf(
        myFamiliar() === $familiar`Stocking Mimic`,
        Macro.while_(`!pastround 9 && !hpbelow 500`, Macro.item($item`seal tooth`))
      );
  }

  static stasis() {
    return new Macro().stasis();
  }

  static nonFree() {
    return '!monstername "witchess" && !monstername "sausage goblin" && !monstername "black crayon"';
  }

  kill() {
    return this.externalIf(myInebriety() > inebrietyLimit(), "attack")
      .skill($skill`Stuffed Mortar Shell`)
      .skill($skill`Cannelloni Cannon`)
      .repeat();
  }

  spellKill() {
    return this.skill(
      "Curse of Weaksauce",
      "Micrometeorite",
      "Stuffed Mortar Shell",
      "Saucegeyser"
    ).repeat();
  }

  static spellKill() {
    return new Macro().spellKill();
  }

  tentacle() {
    return this.if_(
      "monstername eldritch tentacle",
      Macro.skill(
        "Curse of Weaksauce",
        "Micrometeorite",
        "Stuffed Mortar Shell",
        "Saucestorm"
      ).repeat()
    );
  }

  static tentacle() {
    return new Macro().tentacle();
  }
}

export function withMacro<T>(macro: Macro, action: () => T): T {
  if (getAutoAttack() > 0) setAutoAttack(0);
  makeCcs(macro);
  try {
    return action();
  } finally {
    makeCcs(Macro.abort());
  }
}

export function mapMonster(
  location: Location,
  monster: Monster | Monster[],
  macro: Macro
): boolean {
  return withMacro(macro, () => {
    if (!have($skill`Map the Monsters`)) return false;
    if (get("_monstersMapped") >= 3) return false;
    if (!canAdventure(location)) return false;

    useSkill($skill`Map the Monsters`);
    if (!get("mappingMonsters")) return false;

    const monsterArray = Array.isArray(monster) ? monster : [monster];

    const turns = myTurncount();
    while (currentRound() < 1) {
      // Not in combat
      if (myTurncount() > turns) {
        throw new Error("Map the Monsters unsuccessful?");
      }
      const page = visitUrl(toUrl(location));
      if (handlingChoice() && lastChoice() === 1435) {
        const chosenMonster = monsterArray.find((m) => page.includes(m.name));
        if (!chosenMonster) {
          throw new Error("Couldn't find any of the supplied monsters while mapping the monsters");
        }
        runChoice(1, `heyscriptswhatsupwinkwink=${chosenMonster.id}`);
        return true;
      } else {
        runChoice(-1, false);
      }
    }
    runCombat();
    while (inMultiFight()) runCombat();
    if (choiceFollowsFight()) visitUrl("choice.php");
    return false;
  });
}

export function makeCcs(macro: Macro): void {
  // print(`writing ccs [default]\n${macro.toString()}`);
  writeCcs(`[default]\n"${macro.toString()}"`, "forko");
  setCcs("forko");
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function adventureRunOrStasis(loc: Location, freeRun: boolean) {
  adventureMacro(loc, Macro.stasis().kill());
}

/**
 * Adventure in a location and handle all combats with a given macro.
 * To use this function you will need to create a consult script that runs Macro.load().submit() and a CCS that calls that consult script.
 * See examples/consult.ts for an example.
 *
 * @category Combat
 * @param loc Location to adventure in.
 * @param macro Macro to execute.
 */
export function adventureMacro(loc: Location, macro: Macro): void {
  // if (getAutoAttack() !== 0) setAutoAttack(0);
  makeCcs(macro);
  try {
    adv1(loc, 0, "");
    while (inMultiFight()) runCombat();
    if (choiceFollowsFight()) visitUrl("choice.php");
  } catch (e) {
    throw `Combat exception! Last macro error: ${get("lastMacroError")}. Exception ${e}.`;
  } finally {
    // makeCcs(Macro.abort());
  }
}

/**
 * Adventure in a location and handle all combats with a given autoattack and manual macro.
 * To use the nextMacro parameter you will need to create a consult script that runs Macro.load().submit() and a CCS that calls that consult script.
 * See examples/consult.ts for an example.
 *
 * @category Combat
 * @param loc Location to adventure in.
 * @param autoMacro Macro to execute via KoL autoattack.
 * @param nextMacro Macro to execute manually after autoattack completes.
 */
export function adventureMacroAuto(
  loc: Location,
  autoMacro: Macro,
  nextMacro = Macro.abort()
): void {
  // printHtml(autoMacro.components.join("<br />"));
  // print("=>");
  // printHtml(nextMacro.components.join("<br />"));
  autoMacro.setAutoAttack();
  makeCcs(nextMacro);
  try {
    adv1(loc, 0, "");
    while (inMultiFight()) runCombat();
    if (choiceFollowsFight()) visitUrl("choice.php");
  } catch (e) {
    throw `Combat exception! Last macro error: ${get("lastMacroError")}. Exception ${e}.`;
  } finally {
    // makeCcs(Macro.abort());
  }
}
