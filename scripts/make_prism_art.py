"""Generate Prizm prism brand art (hero-prism.png, auth-prism.png).
Code-drawn with PIL: dark Prizm bg, glass prism, white beam in, spectrum fan out.
Decorative brand art only — no data, no text.
"""
from PIL import Image, ImageDraw, ImageFilter

BG = (7, 8, 15)
SPECTRUM = [
    (139, 92, 246),   # violet
    (99, 102, 241),   # indigo
    (34, 211, 238),   # cyan
    (45, 212, 191),   # teal
    (163, 230, 53),   # lime
    (251, 191, 36),   # amber
    (244, 114, 182),  # magenta
]


def radial_glow(size, center, radius, color, peak_alpha):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse(
        [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
        fill=color + (peak_alpha,),
    )
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.55))


def wedge(size, start, end, width_at_end, color, alpha, blur):
    """A tapered beam polygon from point `start` toward `end`."""
    import math

    sx, sy = start
    ex, ey = end
    dx, dy = ex - sx, ey - sy
    length = math.hypot(dx, dy)
    nx, ny = -dy / length, dx / length  # normal
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.polygon(
        [
            (sx, sy),
            (ex + nx * width_at_end / 2, ey + ny * width_at_end / 2),
            (ex - nx * width_at_end / 2, ey - ny * width_at_end / 2),
        ],
        fill=color + (alpha,),
    )
    return layer.filter(ImageFilter.GaussianBlur(blur)) if blur else layer


def prism_art(w, h, cy_frac, scale):
    img = Image.new("RGB", (w, h), BG)

    # ambient glows
    img.paste(
        Image.alpha_composite(
            Image.new("RGBA", (w, h), BG + (255,)),
            radial_glow((w, h), (int(w * 0.16), int(h * 0.12)), int(w * 0.42), (99, 102, 241), 46),
        ).convert("RGB"),
        (0, 0),
    )
    glow2 = radial_glow((w, h), (int(w * 0.86), int(h * 0.9)), int(w * 0.38), (244, 114, 182), 26)

    cy = int(h * cy_frac)
    apex = (int(w * 0.5), int(cy - 150 * scale))
    bl = (int(w * 0.5 - 170 * scale), int(cy + 120 * scale))
    br = (int(w * 0.5 + 170 * scale), int(cy + 120 * scale))
    hit_left = (int((apex[0] + bl[0]) / 2), int((apex[1] + bl[1]) / 2))
    exit_right = (int((apex[0] + br[0]) / 2) + int(6 * scale), int((apex[1] + br[1]) / 2))

    beams = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    # white beam in (left → prism), glow + core
    beam_start = (int(-w * 0.02), int(cy - 260 * scale))
    beams = Image.alpha_composite(beams, wedge((w, h), beam_start, hit_left, 26 * scale, (255, 255, 255), 60, 14 * scale))
    beams = Image.alpha_composite(beams, wedge((w, h), beam_start, hit_left, 7 * scale, (255, 255, 255), 150, 3 * scale))

    # refraction segment inside prism
    beams = Image.alpha_composite(beams, wedge((w, h), hit_left, exit_right, 10 * scale, (226, 232, 255), 90, 6 * scale))

    # spectrum fan out (right)
    import math

    base_ang = math.atan2(exit_right[1] - hit_left[1], exit_right[0] - hit_left[0])
    fan = math.radians(26)
    n = len(SPECTRUM)
    for i, col in enumerate(SPECTRUM):
        ang = base_ang - fan / 2 + fan * (i / (n - 1))
        end = (
            int(exit_right[0] + math.cos(ang) * w * 0.62),
            int(exit_right[1] + math.sin(ang) * w * 0.62),
        )
        beams = Image.alpha_composite(beams, wedge((w, h), exit_right, end, 30 * scale, col, 66, 10 * scale))
        beams = Image.alpha_composite(beams, wedge((w, h), exit_right, end, 8 * scale, col, 120, 2.5 * scale))

    base = Image.new("RGBA", (w, h), BG + (255,))
    base = Image.alpha_composite(base, glow2)
    base = Image.alpha_composite(base, beams)

    # glass prism body + edges
    d = ImageDraw.Draw(base)
    d.polygon([apex, bl, br], fill=(18, 22, 44, 92))
    edge = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    de = ImageDraw.Draw(edge)
    de.line([apex, bl], fill=(226, 232, 255, 120), width=max(2, int(2.5 * scale)))
    de.line([apex, br], fill=(226, 232, 255, 120), width=max(2, int(2.5 * scale)))
    de.line([bl, br], fill=(226, 232, 255, 70), width=max(1, int(1.8 * scale)))
    base = Image.alpha_composite(base, edge.filter(ImageFilter.GaussianBlur(0.6)))
    # apex sparkle
    base = Image.alpha_composite(base, radial_glow((w, h), apex, int(26 * scale), (255, 255, 255), 60))

    # subtle starfield
    import random

    rnd = random.Random(7)
    d = ImageDraw.Draw(base)
    for _ in range(int(140 * scale)):
        x, y = rnd.randint(0, w - 1), rnd.randint(0, h - 1)
        a = rnd.randint(14, 46)
        r = rnd.choice([1, 1, 2])
        d.ellipse([x - r, y - r, x + r, y + r], fill=(200, 210, 255, a))

    img = base.convert("RGB")
    # re-apply the indigo ambient glow lost in base rebuild
    top = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    top = Image.alpha_composite(
        top, radial_glow((w, h), (int(w * 0.16), int(h * 0.12)), int(w * 0.42), (99, 102, 241), 46)
    )
    return Image.alpha_composite(img.convert("RGBA"), top).convert("RGB")


hero = prism_art(1600, 1000, 0.52, 1.0)
hero.save("public/hero-prism.png", optimize=True)
auth = prism_art(1200, 1600, 0.42, 0.85)
auth.save("public/auth-prism.png", optimize=True)
print("wrote public/hero-prism.png", hero.size, "and public/auth-prism.png", auth.size)
