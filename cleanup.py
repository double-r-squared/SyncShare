# cleanup.py
import os
import pathlib

VIDEO_FOLDER = pathlib.Path(__file__).parent / "video"

def clear_video_folder():
    try:
        for item in VIDEO_FOLDER.iterdir():
            if item.is_file():
                item.unlink()
                print(f"🗑️ Deleted file: {item.name}")
    except Exception as e:
        print(f"Error clearing video folder: {e}")

if __name__ == "__main__":
    clear_video_folder()
