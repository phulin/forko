import { getClanName, myTurncount, print, userConfirm } from 'kolmafia';
import { doAhbg } from './ahbg';
import { doBb } from './bb';
import { doEe } from './ee';
import { doHeap } from './heap';
import { mustStop, stopAt, wrapMain } from './lib';
import { doPld } from './pld';
import { doSewers } from './sewers';
import { doTownsquare } from './townsquare';

export function main(args: string) {
  const stopTurncount = stopAt(args);

  if (['Ferengi Commerce Authority', 'Bonus Adventures From Hell'].includes(getClanName())) {
    print(`Clan ${getClanName()} is on blacklist.`, 'red');
    return;
  }

  if (!userConfirm(`You are in clan ${getClanName()}. Is this right?`)) {
    print('Wrong clan.', 'red');
    return;
  }

  print(`Starting "mining"! Stopping in ${stopTurncount - myTurncount()} turns.`);

  wrapMain(() => {
    if (!mustStop(stopTurncount)) doSewers(stopTurncount);
    if (!mustStop(stopTurncount)) doTownsquare(stopTurncount);
    if (!mustStop(stopTurncount)) doEe(stopTurncount, 1);
    if (!mustStop(stopTurncount)) doBb(stopTurncount);
    if (!mustStop(stopTurncount)) doHeap(stopTurncount);
    if (!mustStop(stopTurncount)) doEe(stopTurncount, 2);
    if (!mustStop(stopTurncount)) doPld(stopTurncount);
    if (!mustStop(stopTurncount)) doAhbg(stopTurncount);
    if (!mustStop(stopTurncount)) doEe(stopTurncount, 3);
  });
}
