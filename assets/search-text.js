/* Safe, local matching and highlighting shared by both city search interfaces. */
(() => {
  const fold = value => String(value).normalize('NFKC').toLocaleLowerCase('en').replace(/[’‘]/g, "'").replace(/[–—]/g, '-');
  const tokens = value => [...new Set((String(value).replace(/[“”]/g, '"').match(/"[^"]+"|\S+/g) || []).map(term => fold(term.replace(/^"|"$/g, ''))).filter(Boolean))];
  const segmenter = new Intl.Segmenter('en', {granularity: 'grapheme'});
  function clear(root) {
    for (const mark of root.querySelectorAll('mark[data-search-mark]')) mark.replaceWith(root.ownerDocument.createTextNode(mark.textContent));
    root.normalize();
  }
  function highlight(root, terms) {
    if (!terms.length) return;
    const doc = root.ownerDocument;
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.nodeValue.trim() || node.parentElement.closest('mark,script,style,button,input,select,textarea,summary,.search-why')) continue;
      nodes.push(node);
    }
    for (const node of nodes) {
      const value = node.nodeValue;
      if (!terms.some(term => fold(value).includes(term))) continue;
      let normalized = '';
      const starts = [], ends = [];
      for (const part of segmenter.segment(value)) {
        const key = fold(part.segment);
        normalized += key;
        for (let i = 0; i < key.length; i++) { starts.push(part.index); ends.push(part.index + part.segment.length); }
      }
      const spans = [];
      for (const term of terms) {
        let from = 0, index;
        while ((index = normalized.indexOf(term, from)) !== -1) {
          spans.push([starts[index], ends[index + term.length - 1]]);
          from = index + term.length;
        }
      }
      spans.sort((a,b) => a[0]-b[0] || b[1]-a[1]);
      const merged = [];
      for (const span of spans) {
        const last = merged.at(-1);
        if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1]);
        else merged.push([...span]);
      }
      const fragment = doc.createDocumentFragment();
      let at = 0;
      for (const [start,end] of merged) {
        fragment.append(doc.createTextNode(value.slice(at,start)));
        const mark = doc.createElement('mark');
        mark.dataset.searchMark = '';
        mark.textContent = value.slice(start,end);
        fragment.append(mark);
        at = end;
      }
      fragment.append(doc.createTextNode(value.slice(at)));
      node.replaceWith(fragment);
    }
  }
  function matchedFields(fields, terms) {
    return fields.filter(([,value]) => terms.some(term => fold(value).includes(term))).map(([label]) => label);
  }
  function explanation(labels) {
    return 'Matched in: ' + labels.slice(0,3).join(', ') + (labels.length > 3 ? ', and other fields.' : '.');
  }
  window.HAPSearchText = {fold, tokens, clear, highlight, matchedFields, explanation};
})();
