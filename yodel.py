import re
import sys

# ash string text = visit_url('clan_hobopolis.php?place=5'); matcher m = create_matcher('exposureesplanade([0-9]+)\.gif', text); m.find(); print('Image: ' + to_int(m.group(1)));

def print_image(s, n):
    print('{}\t{}'.format(s, n))

encounter_re = r'\[[0-9]+\] Exposure Esplanade'

def process(filename):
    text = open(filename).read()
    blocks = text.split('\n\n')
    for i, block in enumerate(blocks):
        if not re.match(encounter_re, block): continue
        lines = [line for line in block.splitlines() if not line.startswith("Preference")]
        encounter_line = lines[1].strip()
        assert encounter_line.startswith('Encounter: ')
        encounter = encounter_line[len('Encounter: '):]

        image = ''
        next_block = ''
        consolidated = block
        if i < len(blocks) - 2:
            next_block = blocks[i + 1]
            next2_block = blocks[i + 2]
            if not re.match(encounter_re, next_block):
                consolidated += '\n' + next_block
                if not re.match(encounter_re, next2_block):
                    consolidated += '\n' + next2_block
            consolidated_lines = consolidated.splitlines()
            try:
                image_line = next(filter(lambda l: l.startswith('> Image'), consolidated_lines))
                image = int(image_line.replace(" (approx)", "")[len('> Image: '):])
            except StopIteration:
                try:
                    image_line = next(filter(lambda l: l.startswith('Image'), consolidated_lines))
                    image = int(image_line.replace(" (approx)", "")[len('Image'):])
                except StopIteration:
                    pass
        if encounter == 'Piping Cold':
            choice = next(filter(lambda l: l.startswith('Took choice'), lines))
            if 'increase number of icicles' in choice:
                print_image('increase number of icicles', image)
            elif 'decrease sleaze hobos' in choice:
                print_image('decrease sleaze hobos', image)
        elif encounter == 'There Goes Fritz!':
            choice = next(filter(lambda l: l.startswith('Took choice'), consolidated_lines))
            if 'yodel a little' in choice:
                print_image('yodel a little', image)
            elif 'yodel your heart out' in choice:
                print_image('yodel your heart out', image)
        elif encounter in ['The Frigid Air', 'Cold Comfort']:
            pass
        elif encounter == 'Bumpity Bump Bump':
            print_image('done', 500)
            break
        elif 'wins the fight' in consolidated.lower() and not 'cleesh' in consolidated.lower() and not 'sausage goblin' in consolidated.lower(): # hobo
            print_image('hobo', image)
        else:
            pass

print('Processing', sys.argv[1:])

for filename in sys.argv[1:]:
    process(filename)
