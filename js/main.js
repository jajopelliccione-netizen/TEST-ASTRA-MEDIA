/* ================================================================
   ASTRA STUDIO – MAIN JS  (optimized)
================================================================ */

const isMobile = () => window.innerWidth < 768;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── CURSOR GLOW (desktop only, very subtle) ─────────────────── */
const cursorGlow = document.getElementById('cursor-glow');
let rafCursor = null;

if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  document.addEventListener('mousemove', (e) => {
    if (rafCursor) return;
    rafCursor = requestAnimationFrame(() => {
      cursorGlow.style.transform = `translate(${e.clientX - 150}px, ${e.clientY - 150}px)`;
      rafCursor = null;
    });
  }, { passive: true });
} else {
  cursorGlow.style.display = 'none';
}

/* ── STAR-FIELD CANVAS ────────────────────────────────────────── */
(function initStars() {
  if (prefersReducedMotion) return;

  const canvas = document.getElementById('stars-canvas');
  const ctx    = canvas.getContext('2d', { alpha: true });
  const dpr    = Math.min(window.devicePixelRatio || 1, 1); // cap dpr at 1 on canvas
  let W, H, stars, animId;
  let paused = false;

  const STAR_COUNT = isMobile() ? 70 : 150;
  const FPS        = isMobile() ? 24 : 30;
  const INTERVAL   = 1000 / FPS;
  let lastFrame    = 0;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    if (dpr > 1) ctx.scale(dpr, dpr);
    W = w; H = h;
  }

  function createStars() {
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x:          Math.random() * W,
      y:          Math.random() * H,
      r:          Math.random() * 1.5 + .3,
      alpha:      Math.random() * .6 + .25,
      speed:      Math.random() * .2 + .03,
      twinkleSpd: Math.random() * .012 + .003,
      twinkleDir: Math.random() > .5 ? 1 : -1,
      color:      ['#fff','#B44FD8','#7B5CF0','#00F5FF'][Math.floor(Math.random()*4)],
    }));
  }

  function drawStars() {
    stars.forEach(s => {
      s.y -= s.speed;
      if (s.y < -2) { s.y = H + 2; s.x = Math.random() * W; }
      s.alpha += s.twinkleSpd * s.twinkleDir;
      if (s.alpha > .9 || s.alpha < .1) s.twinkleDir *= -1;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle   = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  let shooters = [];
  function maybeShoot() {
    if (isMobile()) return;
    if (Math.random() < .002) {
      shooters.push({
        x: Math.random() * W, y: Math.random() * H * .5,
        len: 60 + Math.random() * 80,
        speed: 8 + Math.random() * 6,
        alpha: 1,
        angle: Math.PI / 5 + (Math.random() - .5) * .35,
      });
    }
    shooters = shooters.filter(s => s.alpha > .01);
    shooters.forEach(s => {
      const g = ctx.createLinearGradient(s.x, s.y,
        s.x - Math.cos(s.angle)*s.len, s.y - Math.sin(s.angle)*s.len);
      g.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
      g.addColorStop(1, 'rgba(123,92,240,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - Math.cos(s.angle)*s.len, s.y - Math.sin(s.angle)*s.len);
      ctx.stroke();
      s.x += Math.cos(s.angle)*s.speed;
      s.y += Math.sin(s.angle)*s.speed;
      s.alpha -= .025;
    });
  }

  function loop(ts) {
    animId = requestAnimationFrame(loop);
    if (paused) return;
    if (ts - lastFrame < INTERVAL) return;
    lastFrame = ts;
    ctx.clearRect(0, 0, W, H);
    drawStars();
    maybeShoot();
  }

  document.addEventListener('visibilitychange', () => { paused = document.hidden; });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); createStars(); }, 250);
  }, { passive: true });

  resize();
  createStars();
  requestAnimationFrame(loop);
})();

/* ── NAVBAR SCROLL ────────────────────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ── MOBILE MENU ──────────────────────────────────────────────── */
const burger     = document.getElementById('burger');
const mobileMenu = document.getElementById('mobile-menu');

burger.addEventListener('click', () => {
  const open = burger.classList.toggle('open');
  mobileMenu.classList.toggle('open', open);
});
mobileMenu.querySelectorAll('.mob-link').forEach(link => {
  link.addEventListener('click', () => {
    burger.classList.remove('open');
    mobileMenu.classList.remove('open');
  });
});

/* ── SMOOTH SCROLL ────────────────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  });
});

/* ── REVEAL ON SCROLL ─────────────────────────────────────────── */
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -32px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ── COUNTER ANIMATION ────────────────────────────────────────── */
function animateCounter(el, target) {
  let start = null;
  const dur = 1600;
  const step = ts => {
    if (!start) start = ts;
    const p = Math.min((ts - start) / dur, 1);
    const v = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    el.textContent = Math.floor(v * target);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

const counterObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target, parseInt(entry.target.dataset.target, 10));
      counterObs.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('.stat-num').forEach(el => counterObs.observe(el));

/* ── PARALLAX hero logo (desktop only, throttled) ────────────── */
const heroBgLogo = document.querySelector('.hero-logo-bg');
if (heroBgLogo && !isMobile()) {
  let rafScroll = null;
  window.addEventListener('scroll', () => {
    if (rafScroll) return;
    rafScroll = requestAnimationFrame(() => {
      heroBgLogo.style.transform = `translateY(calc(-50% + ${window.scrollY * .2}px))`;
      rafScroll = null;
    });
  }, { passive: true });
}

/* ── ACTIVE NAV HIGHLIGHT ─────────────────────────────────────── */
const navAnchors = document.querySelectorAll('.nav-links a');
const navObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
      });
    }
  });
}, { threshold: 0.35 });
document.querySelectorAll('section[id]').forEach(s => navObs.observe(s));

/* ── TILT on service cards (desktop only) ─────────────────────── */
if (!isMobile()) {
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const r  = card.getBoundingClientRect();
      const dx = (e.clientX - r.left - r.width  / 2) / (r.width  / 2);
      const dy = (e.clientY - r.top  - r.height / 2) / (r.height / 2);
      card.style.transform  = `translateY(-6px) rotateX(${-dy * 4}deg) rotateY(${dx * 4}deg)`;
      card.style.transition = 'transform .08s';
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform  = '';
      card.style.transition = 'transform .4s cubic-bezier(.4,0,.2,1)';
    });
  });
}

/* ── CONTACT FORM ─────────────────────────────────────────────── */
const form    = document.getElementById('contact-form');
const success = document.getElementById('form-success');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn-primary');
    const txt = btn.querySelector('.btn-text');
    txt.textContent     = 'Invio in corso…';
    btn.style.opacity   = '.7';
    btn.style.pointerEvents = 'none';
    setTimeout(() => {
      txt.textContent     = 'Invia messaggio';
      btn.style.opacity   = '';
      btn.style.pointerEvents = '';
      success.classList.add('show');
      form.reset();
      setTimeout(() => success.classList.remove('show'), 5000);
    }, 1400);
  });
}

/* inject active-link style */
const navStyle = document.createElement('style');
navStyle.textContent = '.nav-links a.active{color:#fff}.nav-links a.active::after{transform:scaleX(1)}';
document.head.appendChild(navStyle);

/* ── AMBILIGHT: classe sezione su navbar → CSS gestisce i drop-shadow colors ── */
const ambiObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navbar.className = navbar.className.split(' ').filter(c => !c.startsWith('section-')).join(' ');
      navbar.classList.add('section-' + entry.target.id);
    }
  });
}, { threshold: 0.2 });
document.querySelectorAll('section[id]').forEach(s => ambiObs.observe(s));
