# Pokédex Scanner

Point your phone at someone, tap **SCAN**, and the app reads the photo and finds a matching Pokémon — shown on a full-screen, phone-sized Pokédex with their photo in the display window.

- **SCAN / RETAKE** – take the photo (front or back camera with **FLIP**), or **UPLOAD** one
- **RE-ROLL** – the next-best match for the same photo
- **SAVE** – exports the entry as a 1080×1920 PNG (uses the share sheet on phones)

## How the match works

Everything runs on the phone. The photo is shrunk and its colours, brightness and contrast are read (centre of the frame counts most, skin tones and plain backdrops count less). The dominant colour is mapped to PokeAPI's official Pokémon colours and to the types that colour suggests (blue → water/ice, green → grass/bug, dark → dark/ghost, …). Pokémon of those types and that colour are ranked, and the best one is shown with a match score. The same photo always gives the same match.

It matches colour and mood, not faces — no photo ever leaves the device.

Entries (1–1025) come live from [PokeAPI](https://pokeapi.co); if you're offline it falls back to 55 built-in entries (still matched the same way).

## Run it

Static files, no build. The camera needs HTTPS or `localhost`:

```sh
python3 -m http.server 8000      # then open http://localhost:8000
```

To use it on your phone, host the folder anywhere with HTTPS (GitHub Pages, Netlify, …) and use *Add to Home Screen* — it installs as a standalone app.

Pokémon and Pokédex text © Nintendo / Game Freak. Fan project, not affiliated.
