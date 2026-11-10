# Draw text in a font as an outlined SVG image, so the TVs show the exact
# lettering without needing the (licensed) font installed.
#
# Used to make public/assets/smart-center-title.svg:
#   pip install fonttools==4.55.3 uharfbuzz==0.42.0
#   python3 tools/text2svg.py ~/Library/Fonts/"United Sans Reg-Heavy.otf" \
#       "SMART Center" "#CFB991" public/assets/smart-center-title.svg
#
# Arguments: font file, text, fill color, output file.
import sys
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

font_path, text, fill, out = sys.argv[1:5]
data = open(font_path, 'rb').read()
face = hb.Face(data); hbfont = hb.Font(face)
buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
hb.shape(hbfont, buf, {"kern": True, "liga": True})

tt = TTFont(font_path); gs = tt.getGlyphSet(); order = tt.getGlyphOrder()
pen = SVGPathPen(gs); bounds = BoundsPen(gs)
x = 0
for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
    name = order[info.codepoint]
    # flip Y (font units go up, SVG goes down)
    t = (1, 0, 0, -1, x + pos.x_offset, -pos.y_offset)
    gs[name].draw(TransformPen(pen, t)); gs[name].draw(TransformPen(bounds, t))
    x += pos.x_advance
xmin, ymin, xmax, ymax = bounds.bounds
w, h = xmax - xmin, ymax - ymin
svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{xmin} {ymin} {w} {h}" '
       f'role="img" aria-label="{text}"><title>{text}</title>'
       f'<path fill="{fill}" d="{pen.getCommands()}"/></svg>\n')
open(out, 'w').write(svg)
print(f"{out}: {len(svg)} bytes, aspect {w/h:.3f}")
