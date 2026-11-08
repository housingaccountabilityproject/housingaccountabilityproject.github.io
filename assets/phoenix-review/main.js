/* Optional reading-position indicator. Content and navigation also work without JavaScript. */
(() => {
  const navigation = document.querySelector('.section-nav');
  if (!navigation) return;
  const links = Array.from(navigation.querySelectorAll('a[href^="#"]'));
  const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
  let scheduled = false;
  function update() {
    scheduled = false;
    const navRect = navigation.getBoundingClientRect();
    const readingLine = navRect.bottom + 65;
    const entryOffset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const beforeContent = navRect.top > Math.max(0, entryOffset - navRect.height) + 2;
    const current = beforeContent ? undefined : sections.find(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= readingLine && rect.bottom > readingLine;
    });
    links.forEach(link => {
      const active = !!current && link.getAttribute('href') === '#' + current.id;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function schedule() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(update);
    }
  }
  window.addEventListener('scroll', schedule, {passive:true});
  window.addEventListener('resize', schedule, {passive:true});
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pageshow', schedule);
  window.addEventListener('load', schedule);
  update();
})();
