from gtts import gTTS
import io

try:
    text = "Hola"
    tts = gTTS(text=text, lang="es")
    fp = io.BytesIO()
    tts.write_to_fp(fp)
    audio_bytes = fp.getvalue()
    print(f"Generated audio for '{text}', size: {len(audio_bytes)} bytes")
except Exception as e:
    print(f"Error: {e}")
