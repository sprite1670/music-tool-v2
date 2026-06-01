// CommonJS script to convert PNG to ICO
const fs = require('fs');
const path = require('path');

async function convertToIco() {
  const inputPath = path.join(__dirname, 'src-tauri/icons/128x128.png');
  const outputPath = path.join(__dirname, 'src-tauri/icons/icon.ico');
  
  try {
    console.log('Installing to-ico package...');
    const { execSync } = require('child_process');
    
    // Install to-ico package
    execSync('npm install to-ico --save-dev', { stdio: 'inherit' });
    
    console.log('Converting PNG to ICO...');
    const toIco = require('to-ico');
    
    // Read the source PNG
    const pngBuffer = fs.readFileSync(inputPath);
    
    // Convert to ICO with multiple sizes
    const icoBuffer = await toIco([pngBuffer], {
      sizes: [16, 32, 48, 64, 128, 256],
      resize: true
    });
    
    // Write the ICO file
    fs.writeFileSync(outputPath, icoBuffer);
    
    console.log(`Successfully created ICO file: ${outputPath}`);
    console.log(`File size: ${icoBuffer.length} bytes`);
    
    // Verify the file is not PNG
    const { execSync: exec } = require('child_process');
    try {
      const fileOutput = exec(`file "${outputPath}"`, { encoding: 'utf8' });
      console.log(`File type: ${fileOutput}`);
    } catch (e) {
      console.log('Could not verify file type with file command');
    }
    
  } catch (error) {
    console.error('Error converting to ICO:', error);
    process.exit(1);
  }
}

convertToIco();
