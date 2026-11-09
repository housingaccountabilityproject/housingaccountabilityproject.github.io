(() => {
  const button = document.getElementById('print-project-file');
  if (button) {
    button.hidden = false;
    button.addEventListener('click', () => window.print());
  }
})();
