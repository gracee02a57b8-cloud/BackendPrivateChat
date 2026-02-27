// Generate a deterministic random avatar URL from DiceBear API
// Uses "thumbs" style — cute cartoon faces, unique per seed
export function getRandomAvatar(name) {
  const seed = encodeURIComponent((name || "user").trim());
  return `https://api.dicebear.com/7.x/thumbs/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;
}
