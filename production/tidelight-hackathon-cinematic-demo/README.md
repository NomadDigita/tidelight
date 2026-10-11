# Tidelight cinematic demo production

A self-contained production folder for the public desktop demonstration film created for the Bitget AI Base Camp Hackathon S2. It contains the final 1080p master, narration and timed captions, original Tide character files, source media used in the edit, and reusable capture/render scripts.

## Master deliverable

`deliverables/Tidelight_Hackathon_Cinematic_Demo_1080p.mp4` is the finished H.264/AAC film: 1920×1080, 16:9, 60 fps, approximately 3:54. The compact captions are burned into the master and supplied separately as SRT and ASS. The separate narration and original ambient score are also included.

## Contents

- `deliverables/` — final MP4, narration script and synchronized SRT/ASS subtitles.
- `assets/tide/` — saved Blender scene, editable Blender Python source, transparent hero render, concept reference and the animated Tide presenter clip.
- `assets/audio/` — selected ElevenLabs narration, licensed voice sample, and original ambient score.
- `assets/screenshots/` — representative desktop screenshots from the public pages.
- `production/clips/` — the captured public desktop footage and assembled edit sections/cards used by the render script.
- `production/scripts/` — portable Playwright capture helpers, Blender animation render helper, title card source, audio mix and final assembly scripts.
- `docs/` — production notes and research notes, including the content limits of the logged-out public walkthrough.

Generated frame sequences, dependency caches, duplicate media exports, and credentials are excluded. The original artwork was provided as the character reference; Tide's Blender scene and source are included. No passwords, exchange keys, Supabase keys, ElevenLabs API key, or private account data are included.

## Rebuild the edit

Prerequisites: FFmpeg with `libx264`, AAC and libass support. Run from this folder:

```sh
bash production/scripts/render_final.sh
```

The rebuilt master is written under `production/rebuilt/`. The script uses the supplied edit sections, subtitles, narration and score. To regenerate Tide's transparent animation frames from the saved scene, install Blender and run:

```sh
blender --background assets/tide/Tide_Original_3D_Asset.blend --python production/scripts/render_tide_anim.py
```

To recapture the public site, install Node.js dependencies from `production/` (`npm install`, then `npx playwright install chromium`) and run one of the `capture:*` scripts. They use a desktop 1920×1080 viewport and visit public pages at `https://tidelight.app`; they do not sign in or submit trades. `TIDELIGHT_BASE_URL`, `PRODUCTION_DIR`, and `CHROMIUM_EXECUTABLE` can be set to choose the site, destination and browser.

`production/scripts/generate_narration.py` uses the selected voice ID and reads `ELEVENLABS_API_KEY` from the environment only. Regenerating narration makes an API request and may consume account credits; the already generated audio is included.

## Product-footage scope

The footage is a genuine desktop capture of Tidelight's public, logged-out pages. It does not show private research jobs, a completed authenticated strategy backtest, Nightwatch ledger entries, paper fills, or exchange execution. No live trades were placed. Market information in the video is presented as public data and not as a guarantee of liquidity or execution. The film describes Strategy Lab as historical replay and retains the documented benchmark caveat in the narration.

## Voice, music and use

The user confirmed the selected ElevenLabs voice is licensed for the intended hackathon submission. The voice sample is included for production continuity. The ambient score is an original generated production asset. Review applicable service and submission terms before reusing these assets outside this project.
