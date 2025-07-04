import sys
import pathlib
import yt_dlp
from time import sleep

# Constants
VIDEO_FOLDER = pathlib.Path(__file__).parent / "video"
OUTPUT_FILE = VIDEO_FOLDER / "stream.mp4"

def download_stream(url):
    """Downloads a stream to the fixed output filename"""
    if not url:
        print("Error: Please enter a valid URL")
        return False

    # Ensure video directory exists
    VIDEO_FOLDER.mkdir(exist_ok=True)

    # Clear existing stream file if it exists
    if OUTPUT_FILE.exists():
        OUTPUT_FILE.unlink()

    ydl_opts = {
        'format': 'bestvideo+bestaudio/best',
        'outtmpl': str(OUTPUT_FILE),
        'cookies-from-browser': 'chrome',  # Change browser if needed
        'quiet': True,  # Suppress most output
        'no_warnings': True  # Suppress warnings
    }

    # TODO: ADD THIS TEXT TO THE FRONTEND
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            print(f"✅ Successfully downloaded: {info.get('title', 'stream')}")
            return True
    except Exception as e:
        print(f"❌ Download failed: {e}")
        return False

if __name__ == "__main__":
    stream_url = sys.argv[1]
    if download_stream(stream_url):
        print("Stream ready for playback")
        sys.exit(0)
    else:
        sys.exit(1)