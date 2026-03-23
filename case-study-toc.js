(() => {
  const sections = document.querySelectorAll('.case-study__section[id]');
  const links = document.querySelectorAll('.case-study__toc a[href^="#"]');
  if (!sections.length || !links.length) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const linkById = new Map();
  links.forEach((a) => {
    const id = a.getAttribute('href').slice(1);
    if (id) linkById.set(id, a);
  });

  function setActive(id) {
    links.forEach((l) => {
      const isActive = l.getAttribute('href') === `#${id}`;
      l.classList.toggle('is-active', isActive);
      if (isActive) l.setAttribute('aria-current', 'location');
      else l.removeAttribute('aria-current');
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((e) => e.isIntersecting && e.target.id)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible.length) {
        setActive(visible[0].target.id);
      }
    },
    {
      root: null,
      rootMargin: '-38% 0px -48% 0px',
      threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
    }
  );

  sections.forEach((sec) => observer.observe(sec));

  const firstId = sections[0]?.id;
  if (firstId && linkById.has(firstId)) setActive(firstId);

  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      if (history.replaceState) {
        history.replaceState(null, '', `#${id}`);
      }
      setActive(id);
    });
  });

  if (location.hash) {
    const target = document.querySelector(location.hash);
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        const id = target.id;
        if (id) setActive(id);
      });
    }
  }
})();
