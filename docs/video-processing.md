# Traitement vidéo Toolia

Ces commandes sont optionnelles et ne sont pas utilisées au runtime ni pendant `npm run build`.

## Hero

Source recommandée : une vidéo naturelle, calme, lumineuse, sans filtre bleu destructif.

Chemin attendu par le frontend :

- `public/videos/hero-desk.mp4`
- `public/videos/hero-desk-loop.mp4` optionnel, utilisé en priorité si présent
- `public/videos/hero-desk-poster.jpg`

Boucle ping-pong optionnelle, pour éviter une coupe visible au redémarrage :

```bash
ffmpeg -i public/videos/hero-desk.mp4 \
  -filter_complex "[0:v]split=2[forward][copy];[copy]reverse[reverse];[forward][reverse]concat=n=2:v=1:a=0,setpts=PTS-STARTPTS,fps=30,scale=-2:1080,format=yuv420p[v]" \
  -map "[v]" -an -movflags +faststart public/videos/hero-desk-loop.mp4
```

Si FFmpeg avec `vidstab` est disponible :

```bash
ffmpeg -i hero-desk-original.mp4 -vf "vidstabdetect=shakiness=4:accuracy=15" -f null -
ffmpeg -i hero-desk-original.mp4 \
  -vf "vidstabtransform=smoothing=18:zoom=3,crop=iw-80:ih-80,scale=1920:-2,eq=contrast=1.03:saturation=0.95" \
  -c:v libx264 -crf 22 -preset slow -movflags +faststart \
  -an public/videos/hero-desk.mp4
```

Fallback simple si `vidstab` n’est pas disponible :

```bash
ffmpeg -i hero-desk-original.mp4 \
  -vf "scale=2160:-2,crop=1920:1080,eq=contrast=1.03:saturation=0.95" \
  -c:v libx264 -crf 22 -preset slow -movflags +faststart \
  -an public/videos/hero-desk.mp4
```

Poster :

```bash
ffmpeg -ss 00:00:02 -i public/videos/hero-desk.mp4 -frames:v 1 -q:v 3 public/videos/hero-desk-poster.jpg
```

## Section calme

Chemins attendus :

- `public/videos/calm-water.mp4`
- `public/videos/calm-water-poster.jpg`

Important : ne pas créer de boucle ping-pong/reverse pour cette vidéo. Le mouvement de l'eau doit rester en lecture avant uniquement, avec `loop` natif ou une transition forward-only si une version plus longue est exportée plus tard.

Cette vidéo doit rester subtile, lente et abstraite. Elle ne doit pas concurrencer le hero.
