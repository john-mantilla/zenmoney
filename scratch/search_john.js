const fs = require('fs');
const path = require('path');

function searchJohn(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchJohn(fullPath);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.env') || file.endsWith('.md')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('john.mantillah')) {
          console.log(`Found in: ${fullPath}`);
          // Print lines containing it
          const lines = content.split('\n');
          lines.forEach((line, idx) => {
            if (line.includes('john.mantillah')) {
              console.log(`  Line ${idx+1}: ${line.trim()}`);
            }
          });
        }
      }
    }
  }
}

searchJohn('.');
