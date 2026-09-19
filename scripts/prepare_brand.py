from PIL import Image
from pathlib import Path
root = Path(__file__).resolve().parents[1] / 'assets'
im = Image.open(root / 'logo.png').convert('RGBA')
# Isolate the supplied symbol; retain the original source untouched.
symbol = im.crop((60, 180, 750, 525))
symbol = symbol.crop(symbol.getchannel('A').point(lambda a: 255 if a > 100 else 0).getbbox())
symbol.save(root / 'brand-symbol.png', optimize=True)
wordmark = im.crop((60, 180, 2120, 550))
wordmark = wordmark.crop(wordmark.getchannel('A').point(lambda a: 255 if a > 100 else 0).getbbox())
wordmark.thumbnail((820, 200), Image.Resampling.LANCZOS)
wordmark.save(root / 'brand-wordmark.png', optimize=True)
def canvas(size, width, background):
    result = Image.new('RGBA', (size, size), background)
    mark = symbol.copy()
    mark.thumbnail((width, width), Image.Resampling.LANCZOS)
    result.alpha_composite(mark, ((size-mark.width)//2, (size-mark.height)//2))
    return result
canvas(1024, 820, '#f4f7ef').save(root / 'icon.png', optimize=True)
canvas(1024, 600, (0,0,0,0)).save(root / 'android-icon-foreground.png', optimize=True)
mono = canvas(1024, 600, (0,0,0,0))
mono.paste((0, 0, 0, 255), (0,0,1024,1024), mono.getchannel('A'))
mono.save(root / 'android-icon-monochrome.png', optimize=True)
canvas(128, 104, '#f4f7ef').save(root / 'favicon.png', optimize=True)
