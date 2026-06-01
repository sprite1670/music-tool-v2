const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [32, 128, 256, 512];
const svgPath = path.join(__dirname, 'src-tauri/icons/icon.svg');
const svgBuffer = fs.readFileSync(svgPath);

async function generateIcons() {
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, `src-tauri/icons/${size}x${size}.png`));
    console.log(`Generated ${size}x${size}.png`);
  }
  
  // Generate 128x128@2x.png (256x256)
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(path.join(__dirname, 'src-tauri/icons/128x128@2x.png'));
  console.log('Generated 128x128@2x.png');
  
  // Generate icon.ico (multi-size)
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const icoImages = await Promise.all(
    icoSizes.map(size => 
      sharp(svgBuffer).resize(size, size).png().toBuffer()
    )
  );
  
  // Simple ICO format (just use 256x256 PNG as ICO)
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(path.join(__dirname, 'src-tauri/icons/icon.ico'));
  console.log('Generated icon.ico');
  
  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
