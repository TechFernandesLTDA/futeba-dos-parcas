import os, re, glob

sep = os.sep
files = glob.glob('app/src/main/java/**/*.kt', recursive=True)
files = [f for f in files if sep+'di'+sep not in f and '/di/' not in f]

count = 0
for f in files:
    with open(f, 'r', encoding='utf-8') as fp:
        content = fp.read()
    orig = content
    content = re.sub(r'import javax\.inject\.(Inject|Singleton|Named|Qualifier)\r?\n', '', content)
    content = re.sub(r'@Inject\r?\n', '', content)
    content = re.sub(r'@Singleton\r?\n', '', content)
    content = content.replace('@Inject ', '').replace('@Singleton ', '')
    if content != orig:
        with open(f, 'w', encoding='utf-8') as fp:
            fp.write(content)
        count += 1
        print('Fixed: ' + os.path.basename(f))

print('Total: ' + str(count))
