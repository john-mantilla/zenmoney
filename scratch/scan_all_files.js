/**
 * Escaneo exhaustivo en todo el proyecto
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function scanDirRecursive(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    // Ignorar directorios del sistema y dependencias
    if (stat.isDirectory()) {
      if (['node_modules', '.git', '.expo', 'dist', 'build', '.agents'].includes(file)) {
        return;
      }
      scanDirRecursive(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Buscar referencias a Platform
      if (content.includes('Platform.OS') || content.includes('Platform.')) {
        const hasImport = content.includes('Platform') && content.includes('react-native');
        if (!hasImport) {
          console.log(`💥 ENCONTRADO EN: ${fullPath} - Falta importar Platform`);
        }
      }
    }
  });
}

console.log('Iniciando escaneo exhaustivo en todo el proyecto...\n');
scanDirRecursive(rootDir);
console.log('\nEscaneo finalizado.');
