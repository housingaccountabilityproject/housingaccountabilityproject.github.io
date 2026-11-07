// Browser-only regression: inspect actual computed text colors in light panels.
import assert from 'node:assert/strict';

export async function assertReaderContrast(page, label) {
  const result = await page.evaluate(() => {
    const parse = value => {
      const nums = value.match(/[\d.]+/g)?.map(Number);
      if (!nums || nums.length < 3) throw new Error(`Unsupported computed color: ${value}`);
      return [nums[0] / 255, nums[1] / 255, nums[2] / 255, nums[3] ?? 1];
    };
    const over = (fg, bg) => fg.slice(0, 3).map((c, i) => c * fg[3] + bg[i] * (1 - fg[3])).concat(1);
    const luminance = rgb => rgb.slice(0, 3).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
    const failures = []; let checked = 0;
    for (const panel of document.querySelectorAll('.current-status,.reader-callout,.site-search-form,.reader-tools')) {
      const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const text = walker.currentNode;
        if (!text.textContent.trim()) continue;
        const el = text.parentElement, style = getComputedStyle(el);
        if (!el.getClientRects().length || style.visibility !== 'visible') continue;
        const ancestors = []; let node = el;
        while (node) { ancestors.unshift(node); node = node.parentElement; }
        let bg = [1, 1, 1, 1];
        for (const ancestor of ancestors) {
          const s = getComputedStyle(ancestor);
          bg = over(parse(s.backgroundColor), bg);
        }
        const fg = over(parse(style.color), bg);
        const values = [luminance(fg), luminance(bg)].sort((a, b) => a - b);
        const ratio = (values[1] + .05) / (values[0] + .05);
        checked++;
        // 4.5:1 even for headings, stricter than the 3:1 large-text threshold.
        if (ratio < 4.5) failures.push({text: text.textContent.trim().slice(0, 100), ratio, color: style.color});
      }
    }
    return {checked, failures};
  });
  assert(result.checked > 0, `${label}: no reader text checked`);
  assert.deepEqual(result.failures, [], `${label}: reader text contrast failures`);
  return result.checked;
}
