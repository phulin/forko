import numpy as np
import random

PIPE_TURNS = 180
PIPES = 38

ICICLE_COEFF = 0.085
PROGRESS_COEFF = 1.85

BIG_YODELS = 999

YODEL_CHANCE = 1 / 30
NC_CHANCE = 0.15 + 0.30

TRIALS = 10000
turns_record = np.zeros((TRIALS,))
big_yodels_record = np.zeros((TRIALS,))

MAX_TURNS = 600

for trial in range(TRIALS):
  turns = 0
  pipes = 0
  icicles = 1000
  frigid_air = 0
  little_yodels = 0
  big_yodels = 0
  progress = 0

  while progress < 500:
    # make_pipes = ICICLE_COEFF * max(0, icicles - 1000) + PROGRESS_COEFF * progress < 300
    make_pipes = pipes < PIPES
    outcome = ""
    if big_yodels < BIG_YODELS and random.random() < YODEL_CHANCE:
      if make_pipes:
        outcome = "yodel little"
        progress += round(0.01 * icicles)
        icicles = round(0.95 * icicles)
      else:
        outcome = "yodel crazy"
        big_yodels += 1
        progress += round(0.09 * icicles)
        icicles = round(0.67 * icicles)
        
    elif make_pipes and random.random() < NC_CHANCE:
      if frigid_air < 5 and random.random() < 0.5:
        outcome = "frigid air"
        frigid_air += 1
      else:
        outcome = "piping cold"
        pipes += 1
        icicles += 10
    
    else:
      outcome = "hobo"
      progress += 1
      if random.random() > icicles / 1000:
        icicles = max(0, icicles - 1)
    
    if TRIALS == 1: print("{} {} {}".format(outcome, icicles, progress))
    turns += 1
  turns_record[trial] = turns
  big_yodels_record[trial] = big_yodels

print("Up to {} yodels, coeffs {:.3f} {:.3f}, {} trials:".format(BIG_YODELS, ICICLE_COEFF, PROGRESS_COEFF, TRIALS))
print("average turns: {:.2f}".format(turns_record.mean()))
print("average big yodels: {:.2f}".format(big_yodels_record.mean()))