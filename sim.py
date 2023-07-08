import random

import numpy as np

PIPE_TURNS = 180
PIPES = 39

ICICLE_COEFF = 0.09
PROGRESS_COEFF = 1.85

FREE_RUN = False

BIG_YODEL_FIRST = False
BIG_YODELS = 4

YODEL_CHANCE = 1 / 30
NC_CHANCE = 0.05 + 0.30

TRIALS = 30000
turns_record = np.zeros((TRIALS,))
big_yodels_record = np.zeros((TRIALS,))
free_runs_record = np.zeros((TRIALS))

MAX_TURNS = 600

for trial in range(TRIALS):
  turns = 0
  pipes = 0
  icicles = 900
  frigid_air = 0
  little_yodels = 0
  big_yodels = 0
  progress = 0
  free_runs = 0

  hobos = 490 + random.randint(0, 10) + random.randint(0, 10)

  while progress < 500:
    # make_pipes = ICICLE_COEFF * max(0, icicles - 1000) + PROGRESS_COEFF * progress < 300
    make_pipes = pipes < PIPES
    outcome = ""
    if big_yodels < BIG_YODELS and random.random() < YODEL_CHANCE:
      if make_pipes and not (BIG_YODEL_FIRST and big_yodels == 0):
        outcome = "yodel little"
        progress += round(0.01 * icicles)
        icicles = round(0.95 * icicles)
      else:
        outcome = "yodel crazy"
        big_yodels += 1
        progress += round(0.1 * icicles)
        icicles = round(0.7 * icicles)
        
    elif make_pipes and random.random() < NC_CHANCE:
      if frigid_air < 5 and random.random() < 0.5:
        outcome = "frigid air"
        frigid_air += 1
      else:
        outcome = "piping cold"
        pipes += 1
        icicles += 9
    
    else:
      outcome = "hobo"
      if FREE_RUN and big_yodels < BIG_YODELS:
        free_runs += 1
        turns -= 1
      else:
        progress += 1
      if random.random() > icicles / 1000:
        icicles = max(0, icicles - 1)
    
    # if trial == 0: print("{} {} {}".format(outcome, icicles, progress))
    turns += 1
  turns_record[trial] = turns
  big_yodels_record[trial] = big_yodels
  free_runs_record[trial] = free_runs
  # if trial == 0: print("trial 0: {} turns".format(turns))

# print("Up to {} yodels, coeffs {:.3f} {:.3f}, {} trials:".format(BIG_YODELS, ICICLE_COEFF, PROGRESS_COEFF, TRIALS))
print("Up to {} yodels, making {} pipes first, {} trials:".format(BIG_YODELS, PIPES, TRIALS))
print("average turns: {:.2f}".format(turns_record.mean()))
print("average big yodels: {:.2f}".format(big_yodels_record.mean()))
if free_runs_record.mean() > 0.5:
  print("average free runs: {:.2f}".format(free_runs_record.mean()))