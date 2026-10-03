# Kenyan Trap Beatmaker

A browser-based Kenyan trap beat studio powered by Django. Build four-bar arrangements with kick, snare, hi-hat, log drum, and shaker; detect tempo from local audio or MP4 files, play with Web Audio, export a stereo WAV, and save patterns to the local database. Audio analysis stays in the browser; MP4 decoding depends on browser codec support.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

Open http://127.0.0.1:8000. Audio starts after pressing **Play** (browsers require a user gesture).

## Tests

```bash
python manage.py test
```