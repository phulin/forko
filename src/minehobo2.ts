import {
  visitUrl,
  urlEncode,
  userConfirm,
  getClanName,
  abort,
  haveEffect,
  cliExecute,
  getProperty,
  print,
  formatDateTime,
  todayToString,
  timeToString,
  myAdventures,
  myTurncount,
  wait,
} from 'kolmafia';
import { $effect, $location } from 'libram/src';
import { doEe } from './ee';
import { mustStop, getImage } from './lib';
import { doSewers, getSewersState } from './sewers';
import { doTownsquare } from './townsquare';

function writeWhiteboard(text: string) {
  visitUrl(`clan_basement.php?pwd&action=whitewrite&whiteboard=${urlEncode(text)}`, true, true);
}

export function main(args: string) {
  let stopTurncount = myTurncount() + myAdventures() * 1.1 + 50;
  if (Number.isFinite(parseInt(args, 10))) {
    stopTurncount = myTurncount() + parseInt(args, 10);
  }

  if (!userConfirm('You are in clan ' + getClanName() + '. Is this right?')) {
    abort('Wrong clan.');
  }

  if (haveEffect($effect`Jingle Jangle Jingle`) === 0) {
    cliExecute(`csend to buffy || ${myAdventures() * 1.1 + 200}`);
    for (let i = 0; i < 5; i++) {
      wait(3);
      cliExecute('refresh status');
      if (haveEffect($effect`Jingle Jangle Jingle`) > 0) break;
    }
    if (haveEffect($effect`Jingle Jangle Jingle`) === 0) abort('Get Jingle Bells first.');
  }

  cliExecute('counters nowarn Fortune Cookie');
  if (getProperty('_horsery') !== 'dark horse') cliExecute('horsery dark');

  print(`Starting "mining"! Stopping in ${stopTurncount - myTurncount()} turns.`);

  if (!mustStop(stopTurncount)) doSewers(stopTurncount);

  if (!mustStop(stopTurncount)) doTownsquare(stopTurncount);

  if (!mustStop(stopTurncount)) doEe(stopTurncount, 1);

  if (!mustStop(stopTurncount)) doBb(stopTurncount);

  if (!mustStop(stopTurncount)) doHeap(stopTurncount);

  if (!mustStop(stopTurncount)) doEe(stopTurncount, 2);

  if (!mustStop(stopTurncount)) doPld(stopTurncount);

  if (!mustStop(stopTurncount)) doAhbg(stopTurncount, 100);

  if (!mustStop(stopTurncount)) doEe(stopTurncount, 3);

  const sewers = getSewersState();
  const lines = [
    `Sewers at ${sewers.grates} grates, ${sewers.valves} valves`,
    `Ol' Scratch at image ${getImage($location`Burnbarrel Blvd.`)}`,
    `Frosty at image ${getImage($location`Exposure Esplanade`)}`,
    `Oscus at image ${getImage($location`The Heap`)}`,
    `Zombo at image ${getImage($location`The Ancient Hobo Burial Ground`)}`,
    `Chester at image ${getImage($location`The Purple Light District`)}`,
  ];
  let whiteboard = '';
  const date = formatDateTime('yyyyMMdd', todayToString(), 'yyyy-MM-dd');
  whiteboard += `Status as of ${date} ${timeToString()}:\n`;
  for (const line of lines) {
    print(line);
    whiteboard += `${line}\n`;
  }
  writeWhiteboard(whiteboard);
  print('"Mining" complete.');
}
