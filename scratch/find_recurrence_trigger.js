/**
 * Buscar invocaciones de GenerateRecurringInstances
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function searchInDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (['node_modules', '.git', '.expo', 'dist', 'build', '.agents'].includes(file)) return;
      searchInDirectory(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('GenerateRecurringInstances')) {
        console.log(`🔍 ENCONTRADO EN: ${fullPath}`);
      }
    }
  });
}

searchInDirectory(rootDir);
