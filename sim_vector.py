import numpy as np
import random

PIPES = 70
BIG_YODELS = 999

YODEL_CHANCE = 1 / 30
NC_CHANCE = 0.15 + 0.30

TRIALS = 100000
turns_sum = 0
big_yodels_sum = 0

MAX_TURNS = 600

pipes = np.zeros((MAX_TURNS, TRIALS))
icicles = np.full((MAX_TURNS, TRIALS), 1000)
frigid_air = np.zeros((MAX_TURNS, TRIALS))
big_yodels = np.zeros((MAX_TURNS, TRIALS))
progress = np.zeros((MAX_TURNS, TRIALS))

yodel_rolls = np.random.random((MAX_TURNS, TRIALS))
nc_rolls = np.random.random((MAX_TURNS, TRIALS))
frigid_air_rolls = np.random.random((MAX_TURNS, TRIALS))
cry_out_rolls = np.random.random((MAX_TURNS, TRIALS))

for turn in range(1, MAX_TURNS):
  do_yodel = (big_yodels[turn - 1] < BIG_YODELS) & (yodel_rolls[turn] < 0.3)
  do_big_yodel = pipes[turn - 1] < PIPES
  do_nc = (pipes[turn - 1] < PIPES) & (nc_rolls[turn] < NC_CHANCE)
  do_frigid = (frigid_air[turn - 1] < 5) & (frigid_air_rolls[turn] < 0.5)

  pipes[turn] = pipes[turn - 1] + np.where(do_nc & ~do_frigid, 1, 0)
  icicles[turn] = icicles[turn - 1] + np.where(
    do_yodel,
    np.where(
      do_big_yodel,
      -np.round(0.05 * icicles[turn - 1]), # small yodel
      -np.round(0.33 * icicles[turn - 1])  # big yodel
    ),
    np.where(
      do_nc,
      np.where(do_frigid, 0, 10),
      np.where(
        cry_out_rolls[turn] > icicles[turn - 1] / 1000,
        -1,
        0
      )
    )
  )
  frigid_air[turn] = frigid_air[turn - 1] + np.where(do_nc & do_frigid, 1, 0)
  big_yodels[turn] = big_yodels[turn - 1] + np.where(do_yodel & do_big_yodel, 1, 0)
  progress[turn] = progress[turn - 1] + np.where(
    do_yodel,
    np.where(
      do_big_yodel,
      np.round(0.01 * icicles[turn - 1]), # small yodel
      np.round(0.09 * icicles[turn - 1])  # big yodel
    ),
    np.where(do_nc, 0, 1)
  )

turns_sum = np.argmax(progress >= 500, axis=0)

print("Up to {} yodels, making {} pipes first, {} trials:".format(BIG_YODELS, PIPES, TRIALS))
print("average turns: {:.2f}".format(turns_sum.mean()))
# print("average big yodels: {:.2f}".format(big_yodels_sum.mean()))