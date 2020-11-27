import {
  inMultiFight,
  choiceFollowsFight,
  print,
  visitUrl,
  availableAmount,
  setProperty,
  getProperty,
  getLocationMonsters,
  myLocation,
  toMonster,
  myMp,
  haveSkill,
  useSkill,
  myFamiliar,
  haveEffect,
  runaway,
  itemAmount,
  use,
  handlingChoice,
  lastChoice,
  runChoice,
  adv1,
  availableChoiceOptions,
  runCombat,
  urlEncode,
  xpath,
  getAutoAttack,
} from 'kolmafia';
import { $familiar, $item, $items, $monster, $skill } from 'libram/src';
import { getPropertyInt, myFamiliarWeight } from './lib';

// multiFight() stolen from Aenimus: https://github.com/Aenimus/aen_cocoabo_farm/blob/master/scripts/aen_combat.ash.
// Thanks! Licensed under MIT license.
function multiFight() {
  while (inMultiFight()) runCombat();
  if (choiceFollowsFight()) visitUrl('choice.php');
}

export class Macro {
  static cachedMacroId: number | null = null;
  static cachedAutoAttack: Macro | null = null;

  components: string[] = [];

  toString() {
    return this.components.join(';');
  }

  step(...nextSteps: string[]) {
    this.components = [...this.components, ...nextSteps.filter(s => s.length > 0)];
    return this;
  }

  static step(...nextSteps: string[]) {
    return new Macro().step(...nextSteps);
  }

  submit() {
    const final = this.toString();
    print(`Submitting macro: ${final}`);
    return visitUrl('fight.php?action=macro&macrotext=' + urlEncode(final), true, true);
  }

  setAutoAttack() {
    if (
      getAutoAttack() === MACRO_NAME &&
      Macro.cachedAutoAttack !== null &&
      this.toString() === Macro.cachedAutoAttack.toString()
    ) {
      // This macro is already set. Don't make the server request.
      return;
    }
    if (Macro.cachedMacroId === null) Macro.cachedMacroId = getMacroId();
    visitUrl(
      `account_combatmacros.php?macroid=${Macro.cachedMacroId}&name=${urlEncode(MACRO_NAME)}&macrotext=${urlEncode(
        this.toString()
      )}&action=save`,
      true,
      true
    );
    visitUrl(`account.php?am=1&action=autoattack&value=99${Macro.cachedMacroId}&ajax=1`);
  }

  static abort() {
    return new Macro().step('abort');
  }

  static hpbelow(threshold: number) {
    return `hpbelow ${threshold}`;
  }

  static monster(foe: Monster) {
    return `monsterid ${foe.id}`;
  }

  static and(left: string, right: string) {
    return `(${left}) && (${right})`;
  }

  static not(condition: string) {
    return `!${condition}`;
  }

  mIf(condition: string, ifTrue: Macro) {
    return this.step(`if ${condition}`)
      .step(...ifTrue.components)
      .step('endif');
  }

  static mIf(condition: string, ifTrue: Macro) {
    return new Macro().mIf(condition, ifTrue);
  }

  mWhile(condition: string, contents: Macro) {
    return this.step(`while ${condition}`)
      .step(...contents.components)
      .step('endwhile');
  }

  static mWhile(condition: string, contents: Macro) {
    return new Macro().mWhile(condition, contents);
  }

  externalIf(condition: boolean, ...next: string[]) {
    return condition ? this.step(...next) : this;
  }

  static externalIf(condition: boolean, ...next: string[]) {
    return new Macro().externalIf(condition, ...next);
  }

  repeat() {
    return this.step('repeat');
  }

  repeatSubmit() {
    return this.step('repeat').submit();
  }

  skill(sk: Skill) {
    const name = sk.name.replace('%fn, ', '');
    return this.mIf(`hasskill ${name}`, Macro.step(`skill ${name}`));
  }

  static skill(sk: Skill) {
    return new Macro().skill(sk);
  }

  skillRepeat(sk: Skill) {
    const name = sk.name.replace('%fn, ', '');
    return this.mIf(`hasskill ${name}`, Macro.step(`skill ${name}`, 'repeat'));
  }

  static skillRepeat(sk: Skill) {
    return new Macro().skillRepeat(sk);
  }

  item(it: Item) {
    if (availableAmount(it) > 0) {
      return this.step(`use ${it.name}`);
    } else return this;
  }

  static item(it: Item) {
    return new Macro().item(it);
  }

  attack() {
    return this.step('attack');
  }

  static attack() {
    return new Macro().attack();
  }

  stasis() {
    return this.mIf('!hpbelow 500', Macro.skill($skill`Extract`))
      .mIf('!hpbelow 500', Macro.skill($skill`Extract Jelly`))
      .mWhile('!pastround 10 && !hpbelow 500', Macro.item($item`seal tooth`));
  }

  static stasis() {
    return new Macro().stasis();
  }

  kill() {
    return this.mIf(Macro.monster($monster`sleaze hobo`), Macro.skillRepeat($skill`Saucegeyser`))
      .skill($skill`Shattering Punch`)
      .skill($skill`Gingerbread Mob Hit`)
      .skill($skill`Chest X-Ray`)
      .skill($skill`Lunging Thrust-Smack`)
      .skill($skill`Lunging Thrust-Smack`)
      .skill($skill`Lunging Thrust-Smack`)
      .attack();
  }

  static kill() {
    return new Macro().kill();
  }
}

export const MODE_NULL = '';
export const MODE_CUSTOM = 'custom';
export const MODE_FIND_MONSTER_THEN = 'findthen';
export const MODE_RUN_UNLESS_FREE = 'rununlessfree';
export const MODE_KILL = 'kill';

export function setMode(mode: string, arg1: string | null = null, arg2: string | null = null) {
  setProperty('minehobo_combatMode', mode);
  if (arg1 !== null) setProperty('minehobo_combatArg1', arg1);
  if (arg2 !== null) setProperty('minehobo_combatArg2', arg2);
}

export function getMode() {
  return getProperty('minehobo_combatMode');
}

export function getArg1() {
  return getProperty('minehobo_combatArg1');
}

export function getArg2() {
  return getProperty('minehobo_combatArg2');
}

function banishedMonsters() {
  const banishedstring = getProperty('banishedMonsters');
  const banishedComponents = banishedstring.split(':');
  const result: { [index: string]: Monster } = {};
  if (banishedComponents.count() < 3) return result;
  for (let idx = 0; idx < banishedComponents.count() / 3 - 1; idx++) {
    const foe = banishedComponents[idx * 3].toMonster();
    const banisher = banishedComponents[idx * 3 + 1];
    print(`Banished ${foe.name} using ${banisher}`);
    result[banisher] = foe;
  }
  return result;
}

function usedBanisherInZone(banished: { [index: string]: Monster }, banisher: string, loc: Location) {
  print(`Checking to see if we've used ${banisher} in ${loc}.`);
  if (banished[banisher] === undefined) return false;
  print(`Used it to banish ${banished[banisher].name}`);
  return getLocationMonsters(loc)[banished[banisher].name] === undefined;
}

const freeRunItems = $items`Louder Than Bomb, tattered scrap of paper, GOTO`;
export function main(initround: number, foe: Monster) {
  const mode = getMode();
  const loc = myLocation();
  if (mode === MODE_CUSTOM) {
    Macro.step(getArg1()).repeatSubmit();
  } else if (mode === MODE_FIND_MONSTER_THEN) {
    const monsterId = parseInt(getArg1(), 10);
    const desired = toMonster(monsterId);
    const banished = banishedMonsters();
    if (foe === desired) {
      setProperty('minehobo_combatFound', 'true');
      new Macro().step(getArg2()).repeatSubmit();
    } else if (
      myMp() >= 50 &&
      haveSkill(Skill.get('Snokebomb')) &&
      getPropertyInt('_snokebombUsed') < 3 &&
      !usedBanisherInZone(banished, 'snokebomb', loc)
    ) {
      useSkill(1, Skill.get('Snokebomb'));
      /* } else if (haveSkill(Skill.get('Reflex Hammer')) && getPropertyInt("ReflexHammerUsed") < 3 && !usedBanisherInZone(banished, "Reflex Hammer", loc)) {
          useSkill(1, Skill.get('Reflex Hammer')); */
    } else if (haveSkill(Skill.get('Macrometeorite')) && getPropertyInt('_macrometeoriteUses') < 10) {
      useSkill(1, Skill.get('Macrometeorite'));
    } else if (
      haveSkill(Skill.get('CHEAT CODE: Replace Enemy')) &&
      getPropertyInt('_powerfulGloveBatteryPowerUsed') <= 80
    ) {
      const originalBattery = getPropertyInt('_powerfulGloveBatteryPowerUsed');
      useSkill(1, Skill.get('CHEAT CODE: Replace Enemy'));
      const newBattery = getPropertyInt('_powerfulGloveBatteryPowerUsed');
      if (newBattery === originalBattery) {
        print('WARNING: Mafia is not updating PG battery charge.');
        setProperty('_powerfulGloveBatteryPowerUsed', '' + (newBattery + 10));
      }
      // Hopefully at this point it comes back to the consult script.
    }
  } else if (mode === MODE_RUN_UNLESS_FREE) {
    if (foe.attributes.includes('FREE')) {
      new Macro().skill(Skill.get('Curse of Weaksauce')).skill(Skill.get('Saucegeyser')).repeatSubmit();
    } else if (
      myFamiliar() === Familiar.get('Frumious Bandersnatch') &&
      haveEffect(Effect.get('Ode to Booze')) > 0 &&
      getPropertyInt('_banderRunaways') < myFamiliarWeight() / 5
    ) {
      const banderRunaways = getPropertyInt('_banderRunaways');
      runaway();
      if (getPropertyInt('_banderRunaways') === banderRunaways) {
        print('WARNING: Mafia is not tracking bander runaways correctly.');
        setProperty('_banderRunaways', banderRunaways + 1);
      }
    } else if (haveSkill(Skill.get('Reflex Hammer')) && getPropertyInt('_reflexHammerUsed') < 3) {
      useSkill(1, Skill.get('Reflex Hammer'));
    } else if (myMp() >= 50 && haveSkill(Skill.get('Snokebomb')) && getPropertyInt('_snokebombUsed') < 3) {
      useSkill(1, Skill.get('Snokebomb'));
    } else if (freeRunItems.some(it => itemAmount(it) > 0)) {
      use(
        1,
        freeRunItems.find(it => itemAmount(it) > 0)
      );
    } else {
      // non-free, whatever
      throw "Couldn't find a way to run away for free!";
    }
  } else if (mode === MODE_KILL) {
    Macro.kill().submit();
  } else {
    throw 'Unrecognized mode.';
  }

  multiFight();
}

export function saberYr() {
  if (!handlingChoice()) throw 'No saber choice?';
  if (lastChoice() === 1387 && availableChoiceOptions().length > 0) {
    runChoice(3);
  }
}

export function adventureMacro(loc: Location, macro: Macro) {
  setMode(MODE_CUSTOM, macro.toString());
  adv1(loc, -1, '');
  setMode(MODE_NULL, '');
}

export function adventureKill(loc: Location) {
  adventureMacro(loc, Macro.kill());
}

function findMonsterThen(loc: Location, foe: Monster, macro: Macro) {
  setMode(MODE_FIND_MONSTER_THEN, foe.id.toString(), macro.toString());
  setProperty('minehobo_combatFound', 'false');
  while (getProperty('minehobo_combatFound') !== 'true') {
    adv1(loc, -1, '');
  }
  setMode(MODE_NULL, '');
}

export function findMonsterSaberYr(loc: Location, foe: Monster) {
  setProperty('choiceAdventure1387', '3');
  findMonsterThen(loc, foe, Macro.skill(Skill.get('Use the Force')));
}

export function adventureCopy(loc: Location, foe: Monster) {
  setMode(
    MODE_CUSTOM,
    Macro.mIf(`!monstername "${foe.name}"`, new Macro().step('abort'))
      .skill(Skill.get('Lecture on Relativity'))
      .kill()
      .toString()
  );
  adv1(loc, -1, '');
  setMode(MODE_NULL, '');
}

export function adventureRunUnlessFree(loc: Location) {
  setMode(MODE_RUN_UNLESS_FREE);
  adv1(loc, -1, '');
  setMode(MODE_NULL);
}

export function adventureRunOrStasis(loc: Location, freeRun: boolean) {
  if (freeRun) {
    adventureRunUnlessFree(loc);
  } else if (myFamiliar() === $familiar`Stocking Mimic`) {
    adventureMacro(loc, Macro.stasis().kill());
  } else {
    adventureMacro(loc, Macro.kill());
  }
}

const MACRO_NAME = 'Bean Scripts Macro';
export function getMacroId() {
  const macroMatches = xpath(
    visitUrl('account_combatmacros.php'),
    `//select[@name="macroid"]/option[text()="${MACRO_NAME}"]/@value`
  );
  if (macroMatches.length === 0) {
    visitUrl('account_combatmacros.php?action=new');
    const newMacroText = visitUrl(`account_combatmacros.php?macroid=0&name=${MACRO_NAME}&macrotext=abort&action=save`);
    return parseInt(xpath(newMacroText, '//input[@name=macroid]/@value')[0], 10);
  } else {
    return parseInt(macroMatches[0], 10);
  }
}
