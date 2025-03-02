// This script generates all the necessary icons for the PWA
// Run with Node.js: node generate-icons.js

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Create splash screens directory if it doesn't exist
const splashDir = path.join(__dirname, 'public', 'splash');
if (!fs.existsSync(splashDir)) {
  fs.mkdirSync(splashDir, { recursive: true });
}

// Source icon (make sure this exists)
const sourceIcon = path.join(__dirname, 'source-icon.png');

// Icon sizes needed for PWA
const iconSizes = [16, 32, 70, 72, 96, 128, 144, 150, 152, 167, 180, 192, 310, 384, 512];

// Generate regular icons
async function generateIcons() {
  for (const size of iconSizes) {
    // Handle special case for wide MS tile
    if (size === 310) {
      // Generate square icon
      await sharp(sourceIcon)
        .resize(size, size)
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
        
      // Generate wide icon
      await sharp(sourceIcon)
        .resize(310, 150)
        .toFile(path.join(iconsDir, `icon-310x150.png`));
    } else {
      await sharp(sourceIcon)
        .resize(size, size)
        .toFile(path.join(iconsDir, `icon-${size}x${size}.png`));
    }
  }
  
  // Generate favicon.ico
  await sharp(sourceIcon)
    .resize(32, 32)
    .toFile(path.join(__dirname, 'public', 'favicon.ico'));
}

// Apple splash screen sizes (width, height)
const appleSplashSizes = [
  { width: 2048, height: 2732 }, // 12.9" iPad Pro
  { width: 1668, height: 2388 }, // 11" iPad Pro
  { width: 1536, height: 2048 }, // 10.5" iPad Pro
  { width: 1125, height: 2436 }, // iPhone X/XS
  { width: 1242, height: 2688 }, // iPhone XS Max
  { width: 828, height: 1792 },  // iPhone XR
  { width: 750, height: 1334 },  // iPhone 8
  { width: 640, height: 1136 }   // iPhone SE
];

// Generate Apple splash screens
async function generateSplashScreens() {
  const backgroundColor = '#2563eb'; // Blue background, match your app's theme color
  
  for (const { width, height } of appleSplashSizes) {
    // Create a background with the primary color
    const splash = await sharp({
      create: {
        width: width,
        height: height,
        channels: 4,
        background: { r: 37, g: 99, b: 235, alpha: 1 } // #2563eb in RGB
      }
    }).png();
    
    // Create a centered logo (40% of the shortest dimension)
    const logoSize = Math.floor(Math.min(width, height) * 0.4);
    const logo = await sharp(sourceIcon)
      .resize(logoSize, logoSize)
      .toBuffer();
    
    // Overlay the logo on the background
    await splash
      .composite([{ 
        input: logo, 
        gravity: 'center' 
      }])
      .toFile(path.join(splashDir, `apple-splash-${width}-${height}.png`));
  }
}

// Run both generation functions
(async () => {
  try {
    await generateIcons();
    console.log('✅ Icons generated successfully');
    
    await generateSplashScreens();
    console.log('✅ Splash screens generated successfully');
  } catch (error) {
    console.error('❌ Error generating assets:', error);
  }
})();