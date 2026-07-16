const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.next')) {
        results = results.concat(walk(file));
      }
    } else {
      results.push(file);
    }
  });
  return results;
}

const files = walk('.');
console.log('🔍 Buscando referencias de CalculateAccountBalance...');
files.forEach(file => {
  if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('CalculateAccountBalance')) {
      console.log(`- Encontrado en: ${file}`);
    }
  }
});
