import fs from 'node:fs';
import { transformSync } from '@babel/core';
for (const file of fs.readdirSync('dist/scripts')) {
  const path = `dist/scripts/${file}`;
  if (file.endsWith('.map')) { fs.unlinkSync(path); continue; }
  if (!file.endsWith('.js')) continue;
  const code = transformSync(fs.readFileSync(path, 'utf8'), {
    babelrc: false, configFile: false, comments: false, compact: false,
  }).code;
  fs.writeFileSync(path, `${code}\n`);
}
fs.rmSync('dist/images/donate.svg', { force: true });
