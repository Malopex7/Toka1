import os
from PIL import Image

logo_path = r"f:\cursor-dev\Toka1\frontend\public\images\logo\logo.png"

if not os.path.exists(logo_path):
    print("Logo file does not exist!")
    exit(1)

try:
    img = Image.open(logo_path)
    print(f"Format: {img.format}")
    print(f"Size: {img.size}")
    print(f"Mode: {img.mode}")
    
    # Check if it has an alpha channel
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        print("Image has transparency channel!")
        # Let's count transparent pixels
        rgba = img.convert('RGBA')
        pixels = list(rgba.getdata())
        transparent_count = sum(1 for p in pixels if p[3] < 255)
        print(f"Total pixels: {len(pixels)}, Transparent pixels: {transparent_count} ({transparent_count/len(pixels)*100:.2f}%)")
    else:
        print("Image does NOT have transparency channel.")
        
except Exception as e:
    print(f"Error: {e}")
