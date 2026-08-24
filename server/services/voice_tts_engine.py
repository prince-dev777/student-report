import sys
import asyncio
import json
import os
import edge_tts

async def synthesize(text, voice, output_path, rate="+0%", pitch="+0Hz"):
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)
    await communicate.save(output_path)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No arguments provided"}))
        sys.exit(1)

    try:
        if os.path.exists(sys.argv[1]):
            with open(sys.argv[1], 'r', encoding='utf-8') as f:
                args = json.load(f)
        else:
            args = json.loads(sys.argv[1])
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Failed to parse JSON: {str(e)}"}))
        sys.exit(1)

    text = args.get("text", "").strip()
    voice = args.get("voice", "hi-IN-SwaraNeural")
    output_path = args.get("output_path", "")
    rate = args.get("rate", "+0%")
    pitch = args.get("pitch", "+0Hz")

    if not text:
        print(json.dumps({"success": False, "error": "Text is empty"}))
        sys.exit(1)

    if not output_path:
        print(json.dumps({"success": False, "error": "Output path is missing"}))
        sys.exit(1)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    try:
        asyncio.run(synthesize(text, voice, output_path, rate, pitch))
        print(json.dumps({"success": True, "output_path": output_path, "voice": voice}))
    except Exception as e:
        print(json.dumps({"success": False, "error": f"TTS synthesis failed: {str(e)}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
