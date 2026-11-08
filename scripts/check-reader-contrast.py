#!/usr/bin/env python3
"""Source-contract and WCAG 2.x color-pair regression checks, not browser QA.

The browser test checks the real computed cascade. This complementary test
keeps light reader panels from relying on a surrounding hero's text color.
"""
from pathlib import Path
import re
from lxml import html

ROOT = Path(__file__).resolve().parents[1]


def property_for(css, selector, prop):
    value = None
    for selectors, declarations in re.findall(r"([^{}]+)\{([^{}]*)\}", re.sub(r"/\*.*?\*/", "", css, flags=re.S)):
        if selector in [part.strip() for part in selectors.split(",")]:
            for name, declared in re.findall(r"([\w-]+)\s*:\s*([^;]+)", declarations):
                if name == prop:
                    value = declared.strip()
    return value


def luminance(color):
    rgb = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return sum(c * weight for c, weight in zip(linear, (0.2126, 0.7152, 0.0722)))


def contrast(foreground, background):
    lo, hi = sorted((luminance(foreground), luminance(background)))
    return (hi + 0.05) / (lo + 0.05)


def check_css(css):
    for panel in (".current-status", ".reader-callout", ".site-search-form"):
        assert property_for(css, panel, "color") == "#17303d", (panel, "must own its foreground")
        assert property_for(css, panel, "background") == "#edf5f2", (panel, "background changed; review contrast")
    for panel in (".current-status", ".reader-callout"):
        for tag in ("h2", "h3", "p", "li"):
            assert property_for(css, f"{panel} {tag}", "color") == "inherit", (panel, tag, "must reset hero text styles")
        assert property_for(css, f"{panel} .meta", "color") == "#4a626a"
        assert property_for(css, f"{panel} a", "color") == "#075f69"
    assert property_for(css, ".current-status summary", "color") == "inherit"
    pairs = [("body/headings", "#17303d", "#edf5f2"), ("metadata", "#4a626a", "#edf5f2"), ("links", "#075f69", "#edf5f2")]
    for label, fg, bg in pairs:
        ratio = contrast(fg, bg)
        assert ratio >= 4.5, (label, ratio)
    return {label: round(contrast(fg, bg), 2) for label, fg, bg in pairs}


if __name__ == "__main__":
    ratios = check_css((ROOT / "assets/reader-tools.css").read_text())
    pages = [*ROOT.glob("*.html"), *ROOT.glob("reports/*.html"), ROOT/"tucson/index.html"]
    panel_count = 0
    for path in pages:
        doc = html.parse(str(path))
        panels = doc.xpath('//*[contains(concat(" ",normalize-space(@class)," ")," current-status ") or contains(concat(" ",normalize-space(@class)," ")," reader-callout ") or contains(concat(" ",normalize-space(@class)," ")," site-search-form ")]')
        if not panels:
            continue
        styles = doc.xpath('//head/style|//head/link[@rel="stylesheet"]')
        assert styles[-1].get("href", "").endswith("assets/reader-tools.css"), path
        for panel in panels:
            for element in [panel, *panel.iterdescendants()]:
                assert not re.search(r"(?:^|;)\s*(?:color|background(?:-color)?)\s*:", element.get("style", "")), (path, "inline panel color requires review")
        panel_count += len(panels)
    assert panel_count == 8, ("panel inventory changed; review new uses", panel_count)
    print(f"PASS: {panel_count} light reader panels; explicit foreground and child/link rules; calculated WCAG contrast {ratios}. Source checks only, not a rendered accessibility audit.")
