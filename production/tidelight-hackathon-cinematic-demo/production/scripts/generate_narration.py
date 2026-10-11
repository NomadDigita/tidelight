"""Regenerate the narration using the user's selected licensed ElevenLabs voice.

Set ELEVENLABS_API_KEY in the environment. This script makes one API request and
may consume account credits; it never reads a key from a file or writes it to disk.
"""
import json
import os
import pathlib
import urllib.request

root = pathlib.Path(__file__).resolve().parents[2]
text = (root / 'deliverables' / 'narration.txt').read_text(encoding='utf-8').strip()
key = os.environ.get('ELEVENLABS_API_KEY')
if not key:
    raise SystemExit('Set ELEVENLABS_API_KEY in the environment to regenerate voice audio.')
voice_id = os.environ.get('ELEVENLABS_VOICE_ID', 'FGY2WhTYpPnrIDTdsKH5')
payload = {
    'text': text,
    'model_id': 'eleven_turbo_v2_5',
    'voice_settings': {'stability': 0.62, 'similarity_boost': 0.74, 'style': 0.22, 'use_speaker_boost': True},
}
request = urllib.request.Request(
    f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}',
    data=json.dumps(payload).encode('utf-8'),
    headers={'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg'},
    method='POST',
)
response = urllib.request.urlopen(request, timeout=120).read()
out = root / 'assets' / 'audio' / 'narration.mp3'
out.write_bytes(response)
print(f'Wrote {out} ({len(response)} bytes)')
