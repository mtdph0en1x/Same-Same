import glob
files = glob.glob('d:/gamedev/same-same/frontend/src/screens/*.js')
for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    if 'TouchableOpacity' in content:
        if 'NeoButton' not in content:
            content = content.replace("from 'react-native';", "from 'react-native';\nimport NeoButton from '../components/NeoButton';")
        content = content.replace('<TouchableOpacity', '<NeoButton')
        content = content.replace('</TouchableOpacity>', '</NeoButton>')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
print('Replacement complete.')
