
import re

files = {
    'en.js': [
        '      placeholderSameSame: \'Type a word to MATCH... ({{left}} left)\',',
        '      placeholderButDifferent: \'Type a UNIQUE word... ({{left}} left)\',',
        '      placeholderBlitz: \'Type FAST to match... ({{left}} left)\',',
        '      goalSameSame: \'🎯 Goal: Match with as many players as possible!\',',
        '      goalButDifferent: \'🎯 Goal: Submit a unique answer no one else thought of!\',',
        '      goalBlitz: \'🎯 Goal: Type as fast as you can to match others!\','
    ],
    'es.js': [
        '      placeholderSameSame: \'Escribe para COINCIDIR... (faltan {{left}})\',',
        '      placeholderButDifferent: \'Escribe una palabra ÚNICA... (faltan {{left}})\',',
        '      placeholderBlitz: \'Escribe RÁPIDO... (faltan {{left}})\',',
        '      goalSameSame: \'🎯 Objetivo: ¡Coincidir con tantos jugadores como sea posible!\',',
        '      goalButDifferent: \'🎯 Objetivo: ¡Enviar una respuesta única en la que nadie más haya pensado!\',',
        '      goalBlitz: \'🎯 Objetivo: ¡Escribir lo más rápido posible para coincidir!\','
    ],
    'ru.js': [
        '      placeholderSameSame: \'Слово для СОВПАДЕНИЯ... (осталось {{left}})\',',
        '      placeholderButDifferent: \'УНИКАЛЬНОЕ слово... (осталось {{left}})\',',
        '      placeholderBlitz: \'Печатай БЫСТРО... (осталось {{left}})\',',
        '      goalSameSame: \'🎯 Цель: Совпасть с как можно большим количеством игроков!\',',
        '      goalButDifferent: \'🎯 Цель: Написать уникальный ответ, до которого никто не додумался!\',',
        '      goalBlitz: \'🎯 Цель: Напечатать как можно быстрее, чтобы совпасть с другими!\','
    ],
    'uk.js': [
        '      placeholderSameSame: \'Слово для ЗБІГУ... (залишилось {{left}})\',',
        '      placeholderButDifferent: \'УНІКАЛЬНЕ слово... (залишилось {{left}})\',',
        '      placeholderBlitz: \'Друкуй ШВИДКО... (залишилось {{left}})\',',
        '      goalSameSame: \'🎯 Мета: Збігтися з якомога більшою кількістю гравців!\',',
        '      goalButDifferent: \'🎯 Мета: Написати унікальну відповідь, до якої ніхто не додумався!\',',
        '      goalBlitz: \'🎯 Мета: Надрукувати якнайшвидше, щоб збігтися з іншими!\','
    ]
}

for filename, lines in files.items():
    path = f'frontend/src/i18n/{filename}'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    inject_str = '\n'.join(lines) + '\n'
    new_content = re.sub(r'(nameSomething:\s*\'.*?\',)', r'\1\n' + inject_str, content)
    
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_content)

