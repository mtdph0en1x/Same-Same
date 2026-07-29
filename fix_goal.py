
import re
import glob

for path in glob.glob('frontend/src/i18n/*.js'):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # English
    content = content.replace('Goal: Match with as many', 'Goal: MATCH with as many')
    content = content.replace('Goal: Type as fast as you can to match', 'Goal: Type as fast as you can to MATCH')
    
    # Spanish
    content = content.replace('¡Coincidir con tantos', '¡COINCIDIR con tantos')
    content = content.replace('para coincidir!', 'para COINCIDIR!')
    
    # Russian
    content = content.replace('Совпасть с как можно', 'СОВПАСТЬ с как можно')
    content = content.replace('чтобы совпасть с', 'чтобы СОВПАСТЬ с')
    
    # Ukrainian
    content = content.replace('Збігтися з якомога', 'ЗБІГТИСЯ з якомога')
    content = content.replace('щоб збігтися з', 'щоб ЗБІГТИСЯ з')
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

