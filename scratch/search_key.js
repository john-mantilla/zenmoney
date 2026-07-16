const fs = require('fs');
const path = require('path');

function searchServiceKey(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        searchServiceKey(fullPath);
      }
    } else {
      if (file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.json') || file.endsWith('.txt') || file.endsWith('.env')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('service_role') || content.includes('service-role')) {
          console.log(`Found in: ${fullPath}`);
        }
      }
    }
  }
}

searchServiceKey('.');
