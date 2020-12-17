import { numericModifier } from 'kolmafia';
import { $effect, $skill, $skills } from 'libram/src';

function equipmentItem(itemOrString: Item | string) {
  const item = typeof itemOrString === 'string' ? Item.get(itemOrString) : itemOrString;
  return numericModifier(item, 'item drop');
}

class Override {
  item = 0;
  weight = 0;
  constructor(item: number, weight = 0) {
    this.item = item;
    this.weight = weight;
  }
}

const overrides = new Map<Effect, Override>([
  [$effect`Tiffany's Breakfast`, new Override(40, 0)],
  [$effect`Thanksgetting`, new Override(200, 10)],
  [$effect`She Ate Too Much Candy`, new Override(0, 25)],
  [$effect`Cold Hearted`, new Override(0, 10)],
  [$effect`Blue Swayed`, new Override(0, 10)],
  [$effect`Withered Heart`, new Override(20, 0)],
  [$effect`Sole Soul`, new Override(300, 0)],
  [$effect`The HeyDezebound Heart`, new Override(300, 0)],
  [$effect`Sour Softshoe`, new Override(50, 0)],
  [$effect`Puzzle Champ`, new Override(0, 20)],
  [$effect`Bubble Vision`, new Override(20, 0)],
  [$effect`Voracious Gorging`, new Override(40, 0)],
]);

const impossibleEffects = new Set<Effect>([
  $effect`Bounty of Renenutet`, // Ed
  $effect`Of Course It Looks Great`, // AoSP
  $effect`School Spirited`, // KOLHS
  $effect`Jukebox Hero`, // nope
  $effect`Bats Form`, // DG turn into bats
  $effect`Magnetized Ears`,
  $effect`Song of Fortune`,
  $effect`Spice Haze`, // We are PM so we have a spice ghost.
  $effect`Gettin' the Goods`, // G-Lover
  $effect`Green Tongue`, // Can't have both green + black tongue.
  $effect`Blue Tongue`, // Can't have both blue + black tongue.
]);

const impossiblePassives = new Set<Skill>([
  ...$skills`Overactive Pheromones, Two Right Feet, Sucker Fingers`, // Nuclear Autumn skills
  $skill`Envy`, // Bad Moon skill
]);

const familiarMultiplier = 1.25; // Jumpsuited Hound Dog;

function effectItem(effectOrName: Effect | string) {
  const effect = typeof effectOrName === 'string' ? Effect.get(effectOrName) : effectOrName;
  return overrides.get(effect)?.item ?? numericModifier(effect, 'item drop');
}

const outfitBonus =
  50 + // eldritch hat/pants
  equipmentItem('vampyric cloake') +
  equipmentItem('tunac') +
  75 + // scratch n' sniff sword
  60 + // A Light
  equipmentItem("Mayor Ghost's sash") +
  30 + // old soft shoes
  equipmentItem('ring of the Skeleton Lord');
