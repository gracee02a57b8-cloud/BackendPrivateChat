/**
 * Generate BarsikChat cat icon in all required Android mipmap sizes.
 * Uses SVG → PNG conversion via sharp.
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resDir = join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const publicDir = join(__dirname, '..', 'public');

// ── Cat Face SVG ──
// A cute, friendly cat face with the BarsikChat purple/indigo brand colors
const catSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
    <linearGradient id="ear" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#a78bfa"/>
      <stop offset="100%" style="stop-color:#c4b5fd"/>
    </linearGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="256" cy="256" r="256" fill="url(#bg)"/>

  <!-- Left ear (outer) -->
  <path d="M110 220 L135 80 L210 180 Z" fill="#e0e7ff" opacity="0.95"/>
  <!-- Left ear (inner pink) -->
  <path d="M130 200 L147 105 L195 175 Z" fill="url(#ear)"/>

  <!-- Right ear (outer) -->
  <path d="M402 220 L377 80 L302 180 Z" fill="#e0e7ff" opacity="0.95"/>
  <!-- Right ear (inner pink) -->
  <path d="M382 200 L365 105 L317 175 Z" fill="url(#ear)"/>

  <!-- Head -->
  <ellipse cx="256" cy="280" rx="150" ry="140" fill="#e0e7ff"/>

  <!-- Left eye -->
  <ellipse cx="205" cy="260" rx="28" ry="32" fill="white"/>
  <ellipse cx="210" cy="263" rx="16" ry="20" fill="#1e1b4b"/>
  <ellipse cx="215" cy="256" rx="6" ry="7" fill="white"/>

  <!-- Right eye -->
  <ellipse cx="307" cy="260" rx="28" ry="32" fill="white"/>
  <ellipse cx="312" cy="263" rx="16" ry="20" fill="#1e1b4b"/>
  <ellipse cx="317" cy="256" rx="6" ry="7" fill="white"/>

  <!-- Nose -->
  <path d="M248 310 L264 310 L256 322 Z" fill="#c084fc" stroke="#a855f7" stroke-width="1"/>

  <!-- Mouth -->
  <path d="M256 322 Q240 345 225 335" fill="none" stroke="#6d28d9" stroke-width="3" stroke-linecap="round"/>
  <path d="M256 322 Q272 345 287 335" fill="none" stroke="#6d28d9" stroke-width="3" stroke-linecap="round"/>

  <!-- Whiskers left -->
  <line x1="105" y1="290" x2="190" y2="300" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="100" y1="315" x2="188" y2="315" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="105" y1="340" x2="190" y2="330" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>

  <!-- Whiskers right -->
  <line x1="407" y1="290" x2="322" y2="300" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="412" y1="315" x2="324" y2="315" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="407" y1="340" x2="322" y2="330" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>

  <!-- Cheek blush -->
  <ellipse cx="175" cy="310" rx="22" ry="14" fill="#c4b5fd" opacity="0.4"/>
  <ellipse cx="337" cy="310" rx="22" ry="14" fill="#c4b5fd" opacity="0.4"/>
</svg>
`;

// Foreground SVG (just the cat, no background circle — for adaptive icons)
const catForegroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="ear" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#a78bfa"/>
      <stop offset="100%" style="stop-color:#c4b5fd"/>
    </linearGradient>
  </defs>

  <!-- Left ear (outer) -->
  <path d="M110 220 L135 80 L210 180 Z" fill="#e0e7ff" opacity="0.95"/>
  <path d="M130 200 L147 105 L195 175 Z" fill="url(#ear)"/>

  <!-- Right ear (outer) -->
  <path d="M402 220 L377 80 L302 180 Z" fill="#e0e7ff" opacity="0.95"/>
  <path d="M382 200 L365 105 L317 175 Z" fill="url(#ear)"/>

  <!-- Head -->
  <ellipse cx="256" cy="280" rx="150" ry="140" fill="#e0e7ff"/>

  <!-- Left eye -->
  <ellipse cx="205" cy="260" rx="28" ry="32" fill="white"/>
  <ellipse cx="210" cy="263" rx="16" ry="20" fill="#1e1b4b"/>
  <ellipse cx="215" cy="256" rx="6" ry="7" fill="white"/>

  <!-- Right eye -->
  <ellipse cx="307" cy="260" rx="28" ry="32" fill="white"/>
  <ellipse cx="312" cy="263" rx="16" ry="20" fill="#1e1b4b"/>
  <ellipse cx="317" cy="256" rx="6" ry="7" fill="white"/>

  <!-- Nose -->
  <path d="M248 310 L264 310 L256 322 Z" fill="#c084fc" stroke="#a855f7" stroke-width="1"/>

  <!-- Mouth -->
  <path d="M256 322 Q240 345 225 335" fill="none" stroke="#6d28d9" stroke-width="3" stroke-linecap="round"/>
  <path d="M256 322 Q272 345 287 335" fill="none" stroke="#6d28d9" stroke-width="3" stroke-linecap="round"/>

  <!-- Whiskers left -->
  <line x1="105" y1="290" x2="190" y2="300" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="100" y1="315" x2="188" y2="315" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="105" y1="340" x2="190" y2="330" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>

  <!-- Whiskers right -->
  <line x1="407" y1="290" x2="322" y2="300" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="412" y1="315" x2="324" y2="315" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>
  <line x1="407" y1="340" x2="322" y2="330" stroke="#6d28d9" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>

  <!-- Cheek blush -->
  <ellipse cx="175" cy="310" rx="22" ry="14" fill="#c4b5fd" opacity="0.4"/>
  <ellipse cx="337" cy="310" rx="22" ry="14" fill="#c4b5fd" opacity="0.4"/>
</svg>
`;

// Android mipmap sizes
const mipmapSizes = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Foreground for adaptive icons needs to be 108dp with safe zone 66dp centered
// At xxxhdpi (4x) that's 432px with safe area in the center
const foregroundSizes = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

async function generate() {
  const svgBuffer = Buffer.from(catSvg);
  const fgBuffer = Buffer.from(catForegroundSvg);

  // Generate launcher icons (ic_launcher.png and ic_launcher_round.png)
  for (const [folder, size] of Object.entries(mipmapSizes)) {
    const dir = join(resDir, folder);

    // ic_launcher.png — square with rounded corners (applied by OS)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(dir, 'ic_launcher.png'));

    // ic_launcher_round.png — circular mask
    const roundMask = Buffer.from(`
      <svg width="${size}" height="${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="white"/>
      </svg>
    `);
    await sharp(svgBuffer)
      .resize(size, size)
      .composite([{ input: roundMask, blend: 'dest-in' }])
      .png()
      .toFile(join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png — for adaptive icons
    const fgSize = foregroundSizes[folder];
    // Create foreground with padding (the cat centered in 108dp canvas)
    await sharp(fgBuffer)
      .resize(Math.round(fgSize * 0.7), Math.round(fgSize * 0.7), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .extend({
        top: Math.round(fgSize * 0.15),
        bottom: Math.round(fgSize * 0.15),
        left: Math.round(fgSize * 0.15),
        right: Math.round(fgSize * 0.15),
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .resize(fgSize, fgSize)
      .png()
      .toFile(join(dir, 'ic_launcher_foreground.png'));

    console.log(`✓ ${folder}: ${size}px launcher + ${fgSize}px foreground`);
  }

  // Generate PWA icons for public/
  await sharp(svgBuffer).resize(192, 192).png().toFile(join(publicDir, 'icon-192.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(join(publicDir, 'icon-512.png'));

  // Maskable icon (with extra padding for safe zone)
  const maskableSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640">
  <defs>
    <linearGradient id="mbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#mbg)"/>
</svg>`;

  // Create maskable icon: full purple bg + cat centered
  await sharp(Buffer.from(maskableSvg))
    .resize(512, 512)
    .composite([{
      input: await sharp(svgBuffer).resize(380, 380).png().toBuffer(),
      top: 66,
      left: 66,
    }])
    .png()
    .toFile(join(publicDir, 'icon-maskable-512.png'));

  console.log('✓ PWA icons: 192, 512, maskable-512');
  console.log('✅ All icons generated!');
}

generate().catch(console.error);
