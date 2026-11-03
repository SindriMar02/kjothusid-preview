/* A disclosure beside a real navigation link. Pointer opening focuses the panel. */
(function () {
  'use strict';
  var drop = document.querySelector('[data-navdrop]');
  if (!drop) return;
  var trigger = drop.parentElement;
  var button = drop.querySelector('button');
  var panel = drop.querySelector('.navdrop__panel');
  var fine = matchMedia('(hover: hover) and (pointer: fine)');
  var openTimer,
    closeTimer,
    keyboardOpen = false;
  function allowed() {
    return fine.matches && innerWidth >= 1024 && !drop.hidden;
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
    keyboardOpen = open && !!keyboard;
    if (open && !keyboard) panel.focus({ preventScroll: true });
    if (open && keyboard) {
      var first = Array.from(panel.querySelectorAll('a,button')).find(
        function (el) {
          return !el.closest('[hidden]');
        },
      );
      if (first) first.focus();
    }
  }
  trigger.addEventListener('pointerenter', function () {
    cancelTimers();
    if (allowed())
      openTimer = setTimeout(function () {
        setOpen(true);
      }, 80);
  });
  trigger.addEventListener('pointerleave', function () {
    cancelTimers();
    closeTimer = setTimeout(function () {
      if (!keyboardOpen) setOpen(false);
    }, 200);
  });
  button.addEventListener('click', function (event) {
    setOpen(
      button.getAttribute('aria-expanded') !== 'true',
      event.detail === 0,
    );
    if (event.detail !== 0 && drop.classList.contains('is-open'))
      panel.focus({ preventScroll: true });
  });
  trigger.addEventListener('focusin', function () {
    clearTimeout(closeTimer);
  });
  trigger.addEventListener('focusout', function (event) {
    if (!trigger.contains(event.relatedTarget)) setOpen(false);
  });
  trigger.addEventListener('keydown', function (event) {
    if (
      event.key === 'Escape' &&
      button.getAttribute('aria-expanded') === 'true'
    ) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      button.focus();
    }
  });
  document.addEventListener('pointerdown', function (event) {
    if (!trigger.contains(event.target)) setOpen(false);
  });
  function availability() {
    var season = !!panel.querySelector('[data-christmas]:not([hidden])');
    var basket = panel.querySelector('[data-nav-basket]');
    drop.hidden =
      KJOrdering.dropdownRows(season, basket && !basket.hidden) === 1;
    if (drop.hidden) setOpen(false);
  }
  document.addEventListener('kj:dropdown-state', availability);
  new MutationObserver(availability).observe(panel, {
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden'],
  });
  availability();
  fine.addEventListener('change', function () {
    setOpen(false);
  });
  // A pointer-opened panel should not ride along over the page while it scrolls.
  window.addEventListener(
    'scroll',
    function () {
      if (drop.classList.contains('is-open') && !keyboardOpen) setOpen(false);
    },
    { passive: true },
  );
})();
