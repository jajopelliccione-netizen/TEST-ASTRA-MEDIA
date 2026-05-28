/* ================================================================
   ASTRA MEDIA – MAIN JS
   • Star-field canvas
   • Cursor glow
   • Navbar scroll effect
   • Reveal on scroll (IntersectionObserver)
   • Counter animation
   • Mobile menu
   • Contact form
================================================================ */

/* ── CURSOR GLOW ──────────────────────────────────────────────── */
const cursorGlow = document.getElementById('cursor-glow');

document.addEventListener('mousemove', (e) => {
  cursorGlow.style.left = e.clientX + 'px';
  cursorGlow.style.top  = e.clientY + 'px';
});

/* tint the glow on hover over links/buttons */
document.querySelectorAll('a, button, .service-card, .testimonial-card').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursorGlow.style.background = 'radial-gradient(circle, rgba(255,45,120,.18) 0%, transparent 70%)';
  });
  el.addEventListener('mouseleave', () => {
    cursorGlow.style.background = 'radial-gradient(circle, rgba(123,92,240,.12) 0%, transparent 70%)';
  });
});

/* ── STAR-FIELD CANVAS ────────────────────────────────────────── */
(function initStars() {
  const canvas = document.getElementById('stars-canvas');
  const ctx = canvas.getContext('2d');
  let W, H, stars;

  const STAR_COUNT  = 180;
  const NEBULA_ORBS = 6;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + .2,
      alpha: Math.random() * .6 + .2,
      speed: Math.random() * .3 + .05,
      twinkleSpeed: Math.random() * .02 + .005,
      twinkleDir: Math.random() > .5 ? 1 : -1,
      color: ['#fff','#B44FD8','#7B5CF0','#00F5FF','#FF2D78'][Math.floor(Math.random()*5)],
    }));
  }

  /* slow nebula blobs */
  const nebulae = Array.from({ length: NEBULA_ORBS }, (_, i) => ({
    x: Math.random(),
    y: Math.random(),
    r: 220 + Math.random() * 180,
    color: ['rgba(123,92,240,', 'rgba(255,45,120,', 'rgba(0,245,255,',
            'rgba(180,79,216,',  'rgba(0,229,160,',  'rgba(255,215,0,'][i % 6],
    speed: .00012 + Math.random() * .0001,
    angle: Math.random() * Math.PI * 2,
  }));

  function drawNebulae(t) {
    nebulae.forEach(n => {
      n.angle += n.speed;
      const cx = (n.x + Math.cos(n.angle) * .08) * W;
      const cy = (n.y + Math.sin(n.angle) * .06) * H;
      const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, n.r);
      g.addColorStop(0, n.color + '.06)');
      g.addColorStop(1, n.color + '0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, n.r, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawStars() {
    stars.forEach(s => {
      s.y -= s.speed;
      if (s.y < -4) { s.y = H + 4; s.x = Math.random() * W; }

      /* twinkle */
      s.alpha += s.twinkleSpeed * s.twinkleDir;
      if (s.alpha > .9 || s.alpha < .1) s.twinkleDir *= -1;

      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.shadowBlur = 6;
      ctx.shadowColor = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  /* occasional shooting stars */
  let shooters = [];

  function maybeShoot(t) {
    if (Math.random() < .004) {
      shooters.push({
        x: Math.random() * W,
        y: Math.random() * H * .5,
        len: 80 + Math.random() * 120,
        speed: 8 + Math.random() * 8,
        alpha: 1,
        angle: Math.PI / 5 + (Math.random() - .5) * .4,
      });
    }

    shooters = shooters.filter(s => s.alpha > 0.01);

    shooters.forEach(s => {
      const dx = Math.cos(s.angle) * s.speed;
      const dy = Math.sin(s.angle) * s.speed;
      const g  = ctx.createLinearGradient(s.x, s.y, s.x - Math.cos(s.angle)*s.len, s.y - Math.sin(s.angle)*s.len);
      g.addColorStop(0,   `rgba(255,255,255,${s.alpha})`);
      g.addColorStop(1,   `rgba(123,92,240,0)`);
      ctx.strokeStyle = g;
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 8;
      ctx.shadowColor = '#fff';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - Math.cos(s.angle)*s.len, s.y - Math.sin(s.angle)*s.len);
      ctx.stroke();
      s.x += dx; s.y += dy;
      s.alpha -= .018;
    });
  }

  function loop(t) {
    ctx.clearRect(0, 0, W, H);
    drawNebulae(t);
    drawStars();
    maybeShoot(t);
    requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => { resize(); createStars(); });
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

/* ── SMOOTH SCROLL for anchor links ──────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

/* ── COUNTER ANIMATION ────────────────────────────────────────── */
function animateCounter(el, target, duration = 1800) {
  const suffix = el.nextElementSibling; /* the <span class="stat-suffix"> */
  let start = null;
  const step = (ts) => {
    if (!start) start = ts;
    const progress = Math.min((ts - start) / duration, 1);
    /* easeOutExpo */
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    el.textContent = Math.floor(eased * target);
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = target;
  };
  requestAnimationFrame(step);
}

const counterObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const el = entry.target;
      animateCounter(el, parseInt(el.dataset.target, 10));
      counterObs.unobserve(el);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-num').forEach(el => counterObs.observe(el));

/* ── PARALLAX on hero bg logo ─────────────────────────────────── */
const heroBgLogo = document.querySelector('.hero-logo-bg');

if (heroBgLogo) {
  window.addEventListener('scroll', () => {
    const y = window.scrollY * .25;
    heroBgLogo.style.transform = `translateY(calc(-50% + ${y}px))`;
  }, { passive: true });
}

/* ── ACTIVE NAV LINK HIGHLIGHT ────────────────────────────────── */
const sections   = document.querySelectorAll('section[id]');
const navAnchors = document.querySelectorAll('.nav-links a');

const navObs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navAnchors.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + entry.target.id);
      });
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => navObs.observe(s));

/* ── TILT EFFECT on service cards ────────────────────────────── */
document.querySelectorAll('.service-card').forEach(card => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const cx   = rect.left + rect.width  / 2;
    const cy   = rect.top  + rect.height / 2;
    const dx   = (e.clientX - cx) / (rect.width  / 2);
    const dy   = (e.clientY - cy) / (rect.height / 2);
    card.style.transform = `translateY(-8px) rotateX(${-dy * 5}deg) rotateY(${dx * 5}deg)`;
    card.style.transition = 'transform .1s';
  });

  card.addEventListener('mouseleave', () => {
    card.style.transform = '';
    card.style.transition = 'transform .45s cubic-bezier(.4,0,.2,1)';
  });
});

/* ── CONTACT FORM (demo) ──────────────────────────────────────── */
const form    = document.getElementById('contact-form');
const success = document.getElementById('form-success');

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const btn = form.querySelector('.btn-primary');
    const txt = btn.querySelector('.btn-text');
    txt.textContent = 'Invio in corso…';
    btn.style.opacity = '.7';
    btn.style.pointerEvents = 'none';

    setTimeout(() => {
      txt.textContent = 'Invia messaggio';
      btn.style.opacity = '';
      btn.style.pointerEvents = '';
      success.classList.add('show');
      form.reset();
      setTimeout(() => success.classList.remove('show'), 5000);
    }, 1400);
  });
}

/* ── ACTIVE NAV STYLE ─────────────────────────────────────────── */
const style = document.createElement('style');
style.textContent = `.nav-links a.active { color: white; } .nav-links a.active::after { transform: scaleX(1); }`;
document.head.appendChild(style);

/* ── FLOATING AURA ORBS on mouse drag ────────────────────────── */
let lastOrb = 0;

document.addEventListener('mousemove', (e) => {
  if (Date.now() - lastOrb < 120) return;
  lastOrb = Date.now();

  const orb = document.createElement('div');
  const colors = ['rgba(123,92,240', 'rgba(255,45,120', 'rgba(0,245,255', 'rgba(0,229,160'];
  const c = colors[Math.floor(Math.random() * colors.length)];
  const size = 20 + Math.random() * 30;

  orb.style.cssText = `
    position: fixed;
    left: ${e.clientX - size/2}px;
    top:  ${e.clientY - size/2}px;
    width: ${size}px; height: ${size}px;
    border-radius: 50%;
    background: radial-gradient(circle, ${c},.35) 0%, transparent 70%);
    pointer-events: none;
    z-index: 9999;
    animation: orbFade .8s ease forwards;
  `;
  document.body.appendChild(orb);
  setTimeout(() => orb.remove(), 800);
});

/* inject orbFade keyframe */
const orbStyle = document.createElement('style');
orbStyle.textContent = `
  @keyframes orbFade {
    0%   { opacity: 1; transform: scale(1); }
    100% { opacity: 0; transform: scale(2.5); }
  }
`;
document.head.appendChild(orbStyle);
