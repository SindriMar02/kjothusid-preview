/* A disclosure beside a real navigation link. Pointer opening never focuses. */
(function () {
  'use strict';
  var drop = document.querySelector('[data-navdrop]');
  if (!drop) return;
  var trigger = drop.parentElement;
  var button = drop.querySelector('button');
  var panel = drop.querySelector('.navdrop__panel');
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var openTimer, closeTimer;
  function allowed() {
    return fine.matches && !drop.hidden;
  }
  function cancelTimers() {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
  }
  function setOpen(open, keyboard) {
    cancelTimers();
    open = open && allowed();
    drop.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    panel.inert = !open;
    if (open && keyboard) panel.querySelector('a').focus();
  }
  trigger.addEventListener('pointerenter', function () {
    cancelTimers();
    if (allowed()) openTimer = setTimeout(function () { setOpen(true); }, 80);
  });
  trigger.addEventListener('pointerleave', function () {
    cancelTimers();
    closeTimer = setTimeout(function () {
      if (!trigger.contains(document.activeElement)) setOpen(false);
    }, 200);
  });
  button.addEventListener('click', function (event) {
    setOpen(button.getAttribute('aria-expanded') !== 'true', event.detail === 0);
  });
  trigger.addEventListener('focusin', function () { clearTimeout(closeTimer); });
  trigger.addEventListener('focusout', function (event) {
    if (!trigger.contains(event.relatedTarget)) setOpen(false);
  });
  trigger.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('pointerdown', function (event) {
    if (!trigger.contains(event.target)) setOpen(false);
  });
  fine.addEventListener('change', function () { setOpen(false); });
  // A pointer-opened panel should not ride along over the page while it scrolls.
  window.addEventListener('scroll', function () {
    if (drop.classList.contains('is-open') && !trigger.contains(document.activeElement)) setOpen(false);
  }, { passive: true });
})();
