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
console.log('🔍 Test files found:');
files.forEach(file => {
  if (file.includes('test') || file.includes('spec')) {
    if (!file.includes('node_modules') && !file.includes('scratch')) {
      console.log(`- ${file}`);
    }
  }
});
