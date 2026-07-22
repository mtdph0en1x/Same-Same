import glob
files = glob.glob('d:/gamedev/same-same/frontend/src/screens/*.js')
for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i, line in enumerate(lines):
        if '&&' in line and '<' in line:
            print(f"{filepath}:{i+1}: {line.strip()}")
