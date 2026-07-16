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
console.log('🔍 Searching for date parsing/formatting that could cause shifts...');
files.forEach(file => {
  if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('new Date(') || content.includes('toLocaleDateString') || content.includes('Date.parse')) {
      console.log(`- File: ${file}`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('new Date(') || line.includes('toLocaleDateString') || line.includes('Date.parse')) {
          console.log(`  Line ${idx+1}: ${line.trim()}`);
        }
      });
    }
  }
});
