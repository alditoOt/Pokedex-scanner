# Pokédex Scanner

Point your phone at someone, tap **SCAN**, and they get a random Pokédex entry — shown on a full-screen, phone-sized Pokédex with their photo in the display window.

- **SCAN / RETAKE** – take the photo (front or back camera with **FLIP**), or **UPLOAD** one
- **RE-ROLL** – new random Pokémon for the same photo
- **SAVE** – exports the entry as a 1080×1920 PNG (uses the share sheet on phones)

Entries (1–1025) come live from [PokeAPI](https://pokeapi.co); if you're offline it falls back to a built-in set.

## Run it

Static files, no build. The camera needs HTTPS or `localhost`:

```sh
python3 -m http.server 8000      # then open http://localhost:8000
```

To use it on your phone, host the folder anywhere with HTTPS (GitHub Pages, Netlify, …) and use *Add to Home Screen* — it installs as a standalone app.

Pokémon and Pokédex text © Nintendo / Game Freak. Fan project, not affiliated.
