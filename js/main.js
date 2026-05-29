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
  const dpr    = Math.min(window.devicePixelRatio || 1, 2);
  let W, H, stars, animId;

  const STAR_COUNT  = isMobile() ? 130 : 220;
  const NEBULA_ORBS = isMobile() ? 5   : 8;

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);
    W = w; H = h;
  }

  function createStars() {
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x:           Math.random() * W,
      y:           Math.random() * H,
      r:           Math.random() * 2.0 + .3,
      alpha:       Math.random() * .7 + .25,
      speed:       Math.random() * .25 + .04,
      twinkleSpd:  Math.random() * .015 + .004,
      twinkleDir:  Math.random() > .5 ? 1 : -1,
      color:       ['#fff','#B44FD8','#7B5CF0','#00F5FF','#FF2D78'][Math.floor(Math.random()*5)],
    }));
  }

  /* nebula orbs – positions are relative so they don't need recreating on resize */
  const nebulae = Array.from({ length: NEBULA_ORBS }, (_, i) => ({
    rx:    Math.random(),
    ry:    Math.random(),
    r:     200 + Math.random() * 150,
    color: ['rgba(123,92,240,','rgba(255,45,120,','rgba(0,245,255,','rgba(180,79,216,','rgba(0,229,160,'][i % 5],
    speed: .00008 + Math.random() * .00007,
    angle: Math.random() * Math.PI * 2,
  }));

  function drawNebulae() {
    nebulae.forEach(n => {
      n.angle += n.speed;
      const cx = (n.rx + Math.cos(n.angle) * .07) * W;
      const cy = (n.ry + Math.sin(n.angle) * .05) * H;
      const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, n.r);
      g.addColorStop(0, n.color + '.10)');
      g.addColorStop(1, n.color + '0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, n.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawStars() {
    ctx.shadowBlur = 0;
    stars.forEach(s => {
      s.y -= s.speed;
      if (s.y < -2) { s.y = H + 2; s.x = Math.random() * W; }
      s.alpha += s.twinkleSpd * s.twinkleDir;
      if (s.alpha > .95 || s.alpha < .1) s.twinkleDir *= -1;
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
    if (!isMobile() && Math.random() < .003) {
      shooters.push({
        x: Math.random() * W, y: Math.random() * H * .5,
        len: 70 + Math.random() * 100,
        speed: 7 + Math.random() * 7,
        alpha: 1,
        angle: Math.PI / 5 + (Math.random() - .5) * .35,
      });
    }
    shooters = shooters.filter(s => s.alpha > .01);
    shooters.forEach(s => {
      const dx = Math.cos(s.angle) * s.speed;
      const dy = Math.sin(s.angle) * s.speed;
      const g  = ctx.createLinearGradient(s.x, s.y,
        s.x - Math.cos(s.angle)*s.len, s.y - Math.sin(s.angle)*s.len);
      g.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
      g.addColorStop(1, 'rgba(123,92,240,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth   = 1.2;
      ctx.shadowBlur  = 0;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - Math.cos(s.angle)*s.len, s.y - Math.sin(s.angle)*s.len);
      ctx.stroke();
      s.x += dx; s.y += dy;
      s.alpha -= .02;
    });
  }

  function loop() {
    ctx.clearRect(0, 0, W, H);
    drawNebulae();
    drawStars();
    maybeShoot();
    animId = requestAnimationFrame(loop);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); createStars(); }, 200);
  }, { passive: true });

  resize();
  createStars();
  loop();
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
