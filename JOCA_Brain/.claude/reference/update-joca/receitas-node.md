# /update-joca — receitas `node -e`

## 6b. Identify local-origin files

Scan for files with `origin: local` in their frontmatter (use cross-platform approach):

```
node -e "
const fs = require('fs'); const path = require('path');
const dirs = ['.claude/skills', '.claude/agents', '.claude/commands'];
const found = [];
for (const dir of dirs) {
  const full = path.join(process.cwd(), dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full, {recursive:true})) {
    const fp = path.join(full, f);
    if (!fs.statSync(fp).isFile()) continue;
    const head = fs.readFileSync(fp, 'utf8').slice(0, 500);
    if (/^origin:\s*local/m.test(head)) found.push(path.relative(process.cwd(), fp));
  }
}
found.forEach(f => console.log(f));
"
```
## 5b. Statusline script

If `.claude/scripts/statusline-command.js` was in the diff:

```
node -e "
const fs = require('fs'); const path = require('path');
const src = path.join(process.cwd(), '.claude/scripts/statusline-command.js');
const home = process.env.HOME || process.env.USERPROFILE;
const dest = path.join(home, '.claude', 'statusline-command.js');
fs.mkdirSync(path.dirname(dest), {recursive: true});
fs.copyFileSync(src, dest);
console.log('Copied to ' + dest);
"
```
