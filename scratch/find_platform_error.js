/**
 * Diagnóstico de imports de Platform
 */

const fs = require('fs');
const path = require('path');

const directoryPath = path.resolve(__dirname, '../app');
const srcPath = path.resolve(__dirname, '../src');

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      
      // Si el archivo contiene "Platform." pero no importa "Platform" desde "react-native"
      if (content.includes('Platform.OS') || content.includes('Platform.')) {
        const hasImport = content.includes('Platform') && (content.includes("from 'react-native'") || content.includes('from "react-native"'));
        
        if (!hasImport) {
          console.log(`❌ ERROR ENCONTRADO: ${fullPath} utiliza Platform pero NO lo importa.`);
        } else {
          console.log(`✅ OK: ${fullPath} importa Platform correctamente.`);
        }
      }
    }
  });
}

console.log('Buscando referencias a Platform en la carpeta app/ y src/...\n');
scanDirectory(directoryPath);
scanDirectory(srcPath);
console.log('\nEscaneo finalizado.');
