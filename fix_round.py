
import re
import glob

for path in glob.glob('frontend/src/i18n/*.js'):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Restore the ' · {{type}}' part
    # We replace roundHeader: 'Round {{current}}/{{total}}' back to its original
    
    if 'en.js' in path:
        content = re.sub(r'roundHeader:\s*\'[^\'\n]*?\{\{total\}\}\'', r"roundHeader: 'Round {{current}}/{{total}} · {{type}}'", content)
    elif 'es.js' in path:
        content = re.sub(r'roundHeader:\s*\'[^\'\n]*?\{\{total\}\}\'', r"roundHeader: 'Ronda {{current}}/{{total}} · {{type}}'", content)
    elif 'ru.js' in path:
        content = re.sub(r'roundHeader:\s*\'[^\'\n]*?\{\{total\}\}\'', r"roundHeader: 'Раунд {{current}}/{{total}} · {{type}}'", content)
    elif 'uk.js' in path:
        content = re.sub(r'roundHeader:\s*\'[^\'\n]*?\{\{total\}\}\'', r"roundHeader: 'Раунд {{current}}/{{total}} · {{type}}'", content)
        
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

