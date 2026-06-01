const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function convertToIco() {
  const inputPath = path.join(__dirname, 'src-tauri/icons/128x128.png');
  const outputPath = path.join(__dirname, 'src-tauri/icons/icon.ico');
  
  try {
    // Read the PNG file
    const image = sharp(inputPath);
    
    // Get image metadata
    const metadata = await image.metadata();
    console.log(`Input image: ${metadata.width}x${metadata.height}, ${metadata.format}`);
    
    // Create ICO file with multiple sizes
    // ICO format supports multiple images in one file
    const sizes = [16, 32, 48, 64, 128, 256];
    
    // For ICO files, we need to create the binary format
    // Let's use a different approach - use the `to-ico` package which is specifically designed for this
    console.log('Using to-ico package for proper ICO conversion...');
    
    // First uninstall png-to-ico if it exists and install to-ico
    const { execSync } = require('child_process');
    try {
      execSync('npm uninstall png-to-ico --save-dev', { stdio: 'inherit' });
    } catch (e) {
      // Ignore errors if not installed
    }
    
    execSync('npm install to-ico --save-dev', { stdio: 'inherit' });
    
    // Now use to-ico
    const toIco = require('to-ico');
    
    // Read the source PNG
    const pngBuffer = fs.readFileSync(inputPath);
    
    // Convert to ICO
    const icoBuffer = await toIco([pngBuffer], {
      sizes: sizes,
      resize: true
    });
    
    // Write the ICO file
    fs.writeFileSync(outputPath, icoBuffer);
    
    console.log(`Successfully created ICO file: ${outputPath}`);
    console.log(`File size: ${icoBuffer.length} bytes`);
    
  } catch (error) {
    console.error('Error converting to ICO:', error);
    process.exit(1);
  }
}

convertToIco();
