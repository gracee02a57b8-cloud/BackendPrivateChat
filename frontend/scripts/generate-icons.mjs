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

// ── Orange/Ginger Cat Face SVG ──
// A cute, warm ginger cat face (like 🐱 emoji) on indigo brand background
const catSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
    <linearGradient id="fur" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#ea580c"/>
    </linearGradient>
    <linearGradient id="furLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fbbf24"/>
      <stop offset="100%" style="stop-color:#f59e0b"/>
    </linearGradient>
    <linearGradient id="earInner" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#fca5a5"/>
      <stop offset="100%" style="stop-color:#fecaca"/>
    </linearGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="256" cy="256" r="256" fill="url(#bg)"/>

  <!-- Left ear (outer orange) -->
  <path d="M108 225 L128 72 L215 178 Z" fill="url(#fur)"/>
  <!-- Left ear (inner pink) -->
  <path d="M128 210 L142 100 L198 175 Z" fill="url(#earInner)"/>

  <!-- Right ear (outer orange) -->
  <path d="M404 225 L384 72 L297 178 Z" fill="url(#fur)"/>
  <!-- Right ear (inner pink) -->
  <path d="M384 210 L370 100 L314 175 Z" fill="url(#earInner)"/>

  <!-- Head (main orange fur) -->
  <ellipse cx="256" cy="282" rx="155" ry="145" fill="url(#furLight)"/>

  <!-- Forehead dark stripes (tabby markings) -->
  <path d="M256 155 L250 200 L262 200 Z" fill="#d97706" opacity="0.5"/>
  <path d="M220 165 L225 205 L235 200 Z" fill="#d97706" opacity="0.35"/>
  <path d="M292 165 L287 205 L277 200 Z" fill="#d97706" opacity="0.35"/>

  <!-- White muzzle area -->
  <ellipse cx="256" cy="320" rx="80" ry="55" fill="#fef3c7"/>
  <ellipse cx="256" cy="310" rx="68" ry="42" fill="white" opacity="0.7"/>

  <!-- Left eye -->
  <ellipse cx="200" cy="262" rx="30" ry="33" fill="white"/>
  <ellipse cx="205" cy="265" rx="18" ry="22" fill="#166534"/>
  <ellipse cx="205" cy="265" rx="10" ry="13" fill="#14532d"/>
  <ellipse cx="211" cy="258" rx="6" ry="7" fill="white"/>
  <ellipse cx="198" cy="270" rx="3" ry="3" fill="white" opacity="0.5"/>

  <!-- Right eye -->
  <ellipse cx="312" cy="262" rx="30" ry="33" fill="white"/>
  <ellipse cx="307" cy="265" rx="18" ry="22" fill="#166534"/>
  <ellipse cx="307" cy="265" rx="10" ry="13" fill="#14532d"/>
  <ellipse cx="313" cy="258" rx="6" ry="7" fill="white"/>
  <ellipse cx="300" cy="270" rx="3" ry="3" fill="white" opacity="0.5"/>

  <!-- Nose (pink triangle) -->
  <path d="M246 308 L266 308 L256 322 Z" fill="#fb7185" stroke="#e11d48" stroke-width="1"/>

  <!-- Mouth -->
  <path d="M256 322 Q238 347 220 336" fill="none" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M256 322 Q274 347 292 336" fill="none" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Whiskers left -->
  <line x1="98" y1="288" x2="185" y2="298" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <line x1="93" y1="315" x2="183" y2="315" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <line x1="98" y1="342" x2="185" y2="332" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>

  <!-- Whiskers right -->
  <line x1="414" y1="288" x2="327" y2="298" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <line x1="419" y1="315" x2="329" y2="315" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <line x1="414" y1="342" x2="327" y2="332" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>

  <!-- Cheek fluff (lighter fur patches) -->
  <ellipse cx="170" cy="305" rx="24" ry="16" fill="#fde68a" opacity="0.45"/>
  <ellipse cx="342" cy="305" rx="24" ry="16" fill="#fde68a" opacity="0.45"/>

  <!-- Subtle smile blush -->
  <ellipse cx="220" cy="338" rx="14" ry="8" fill="#fca5a5" opacity="0.3"/>
  <ellipse cx="292" cy="338" rx="14" ry="8" fill="#fca5a5" opacity="0.3"/>
</svg>
`;

// Foreground SVG (just the ginger cat, no background — for adaptive icons)
const catForegroundSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="fur" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b"/>
      <stop offset="100%" style="stop-color:#ea580c"/>
    </linearGradient>
    <linearGradient id="furLight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#fbbf24"/>
      <stop offset="100%" style="stop-color:#f59e0b"/>
    </linearGradient>
    <linearGradient id="earInner" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#fca5a5"/>
      <stop offset="100%" style="stop-color:#fecaca"/>
    </linearGradient>
  </defs>

  <!-- Left ear -->
  <path d="M108 225 L128 72 L215 178 Z" fill="url(#fur)"/>
  <path d="M128 210 L142 100 L198 175 Z" fill="url(#earInner)"/>

  <!-- Right ear -->
  <path d="M404 225 L384 72 L297 178 Z" fill="url(#fur)"/>
  <path d="M384 210 L370 100 L314 175 Z" fill="url(#earInner)"/>

  <!-- Head -->
  <ellipse cx="256" cy="282" rx="155" ry="145" fill="url(#furLight)"/>

  <!-- Forehead stripes -->
  <path d="M256 155 L250 200 L262 200 Z" fill="#d97706" opacity="0.5"/>
  <path d="M220 165 L225 205 L235 200 Z" fill="#d97706" opacity="0.35"/>
  <path d="M292 165 L287 205 L277 200 Z" fill="#d97706" opacity="0.35"/>

  <!-- White muzzle -->
  <ellipse cx="256" cy="320" rx="80" ry="55" fill="#fef3c7"/>
  <ellipse cx="256" cy="310" rx="68" ry="42" fill="white" opacity="0.7"/>

  <!-- Left eye -->
  <ellipse cx="200" cy="262" rx="30" ry="33" fill="white"/>
  <ellipse cx="205" cy="265" rx="18" ry="22" fill="#166534"/>
  <ellipse cx="205" cy="265" rx="10" ry="13" fill="#14532d"/>
  <ellipse cx="211" cy="258" rx="6" ry="7" fill="white"/>
  <ellipse cx="198" cy="270" rx="3" ry="3" fill="white" opacity="0.5"/>

  <!-- Right eye -->
  <ellipse cx="312" cy="262" rx="30" ry="33" fill="white"/>
  <ellipse cx="307" cy="265" rx="18" ry="22" fill="#166534"/>
  <ellipse cx="307" cy="265" rx="10" ry="13" fill="#14532d"/>
  <ellipse cx="313" cy="258" rx="6" ry="7" fill="white"/>
  <ellipse cx="300" cy="270" rx="3" ry="3" fill="white" opacity="0.5"/>

  <!-- Nose -->
  <path d="M246 308 L266 308 L256 322 Z" fill="#fb7185" stroke="#e11d48" stroke-width="1"/>

  <!-- Mouth -->
  <path d="M256 322 Q238 347 220 336" fill="none" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M256 322 Q274 347 292 336" fill="none" stroke="#92400e" stroke-width="2.5" stroke-linecap="round"/>

  <!-- Whiskers left -->
  <line x1="98" y1="288" x2="185" y2="298" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <line x1="93" y1="315" x2="183" y2="315" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <line x1="98" y1="342" x2="185" y2="332" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>

  <!-- Whiskers right -->
  <line x1="414" y1="288" x2="327" y2="298" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <line x1="419" y1="315" x2="329" y2="315" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>
  <line x1="414" y1="342" x2="327" y2="332" stroke="#92400e" stroke-width="2" stroke-linecap="round" opacity="0.5"/>

  <!-- Cheek fluff -->
  <ellipse cx="170" cy="305" rx="24" ry="16" fill="#fde68a" opacity="0.45"/>
  <ellipse cx="342" cy="305" rx="24" ry="16" fill="#fde68a" opacity="0.45"/>

  <!-- Blush -->
  <ellipse cx="220" cy="338" rx="14" ry="8" fill="#fca5a5" opacity="0.3"/>
  <ellipse cx="292" cy="338" rx="14" ry="8" fill="#fca5a5" opacity="0.3"/>
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
