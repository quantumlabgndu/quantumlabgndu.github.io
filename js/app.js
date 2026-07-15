/* ═══════════════════════════════════════════════════════════════
   Quantum Lab — Main Application (Public Site)
   ═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  QLab.initUsers();
  const data = QLab.getData();

  // ─── Particle Canvas ───
  (function initParticles() {
    const canvas = document.getElementById('quantum-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles = [], mouse = { x: -1000, y: -1000 };
    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);
    document.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * w; this.y = Math.random() * h;
        this.vx = (Math.random() - 0.5) * 0.4; this.vy = (Math.random() - 0.5) * 0.4;
        this.r = Math.random() * 1.5 + 0.5;
        this.o = Math.random() * 0.4 + 0.1;
        this.color = ['rgba(124,58,237,', 'rgba(34,211,238,', 'rgba(251,191,36,'][Math.floor(Math.random() * 3)];
      }
      update() {
        this.x += this.vx; this.y += this.vy;
        if (this.x < 0 || this.x > w) this.vx *= -1;
        if (this.y < 0 || this.y > h) this.vy *= -1;
        const dx = mouse.x - this.x, dy = mouse.y - this.y, dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 120) { this.x -= dx * 0.01; this.y -= dy * 0.01; }
      }
      draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fillStyle = this.color + this.o + ')'; ctx.fill();
      }
    }
    const count = Math.min(80, Math.floor(w * h / 15000));
    for (let i = 0; i < count; i++) particles.push(new Particle());
    function drawLines() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < 150) {
            ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = 'rgba(124,58,237,' + (1 - dist / 150) * 0.15 + ')';
            ctx.stroke();
          }
        }
      }
    }
    function animate() {
      ctx.clearRect(0, 0, w, h);
      particles.forEach(p => { p.update(); p.draw(); });
      drawLines();
      requestAnimationFrame(animate);
    }
    animate();
  })();

  // ─── Navbar scroll ───
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  });

  // ─── Hamburger ───
  const hamburger = document.getElementById('hamburger');
  const navLinks = document.getElementById('navLinks');
  if (hamburger) {
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      hamburger.classList.toggle('open');
    });
  }

  // ─── Page Navigation (SPA-like) ───
  const allNavLinks = document.querySelectorAll('[data-page]');
  const allSections = document.querySelectorAll('.page-section');
  const newsSection = document.getElementById('news-section');

  function switchPage(pageId) {
    allSections.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
    // Show home extras
    if (newsSection) newsSection.style.display = pageId === 'home' ? '' : 'none';
    // Update nav
    allNavLinks.forEach(a => {
      a.classList.toggle('active', a.getAttribute('data-page') === pageId);
    });
    // Close mobile menu
    if (navLinks) navLinks.classList.remove('open');
    if (hamburger) hamburger.classList.remove('open');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  allNavLinks.forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const pageId = a.getAttribute('data-page');
      switchPage(pageId);
      history.pushState(null, '', '#' + pageId);
    });
  });

  // ─── Render Announcements ───
  const newsInner = document.getElementById('newsInner');
  if (newsInner && data.announcements) {
    newsInner.innerHTML = data.announcements.map(a =>
      `<div class="news-ticker-item"><span class="news-date">${a.date}</span> ${a.text}</div>`
    ).join('');
    // Adjust animation for number of items
    const count = data.announcements.length;
    if (count > 0) {
      const pct = 100 / count;
      let keyframes = '@keyframes tickerScroll{';
      for (let i = 0; i <= count; i++) {
        const p = Math.round(i * pct);
        keyframes += `${Math.min(p, 100)}%{transform:translateY(-${i * 48}px)}`;
      }
      keyframes += '}';
      const style = document.createElement('style');
      style.textContent = keyframes;
      document.head.appendChild(style);
    }
  }

  // ─── Render Features ───
  const featureGrid = document.getElementById('featureGrid');
  const iconMap = { atom: '⚛️', cpu: '🔬', tool: '🛠️', graduation: '🎓' };
  const colorMap = { atom: 'purple', cpu: 'cyan', tool: 'gold', graduation: 'emerald' };
  if (featureGrid && data.features) {
    featureGrid.innerHTML = data.features.map(f =>
      `<div class="card animate-on-scroll">
        <div class="card-icon ${colorMap[f.icon] || 'purple'}">${iconMap[f.icon] || '⚛️'}</div>
        <h3>${f.title}</h3>
        <p>${f.desc}</p>
      </div>`
    ).join('');
  }

  // ─── Render Research ───
  const researchList = document.getElementById('researchList');
  if (researchList && data.research) {
    researchList.innerHTML = data.research.map(r =>
      `<div class="card research-card animate-on-scroll">
        ${r.img ? `<img src="${r.img}" alt="${r.title}" class="research-img" loading="lazy">` : ''}
        <div>
          <h3>${r.title}</h3>
          <p>${r.body.replace(/\n/g, '</p><p>')}</p>
        </div>
      </div>`
    ).join('');
  }

  // ─── Render Publications ───
  const pubList = document.getElementById('pubList');
  if (pubList && data.publications) {
    const years = [...new Set(data.publications.map(p => p.year))].sort((a, b) => b - a);
    pubList.innerHTML = years.map(yr => {
      const pubs = data.publications.filter(p => p.year === yr);
      return `<h3 class="pub-year">${yr}</h3>` + pubs.map(p =>
        `<div class="pub-item" data-search="${(p.authors + p.title + p.journal + p.year).toLowerCase()}">
          ${p.authors} ${p.title} ${p.journal}
          <div class="pub-links"><a href="${p.doi}">[DOI]</a> <a href="${p.pdf}">[PDF]</a></div>
        </div>`
      ).join('');
    }).join('');
    // Update stat
    const pubCount = document.getElementById('pubCount');
    if (pubCount) pubCount.textContent = data.publications.length;
  }

  // Publication filter
  const pubFilter = document.getElementById('pubFilter');
  if (pubFilter) {
    pubFilter.addEventListener('input', () => {
      const q = pubFilter.value.trim().toLowerCase();
      document.querySelectorAll('.pub-item').forEach(el => {
        el.style.display = el.getAttribute('data-search').includes(q) ? '' : 'none';
      });
      document.querySelectorAll('.pub-year').forEach(el => {
        const next = [];
        let sib = el.nextElementSibling;
        while (sib && !sib.classList.contains('pub-year')) { next.push(sib); sib = sib.nextElementSibling; }
        el.style.display = next.some(n => n.style.display !== 'none') ? '' : 'none';
      });
    });
  }

  // ─── Render Members ───
  const membersList = document.getElementById('membersList');
  const categories = { pi: 'Principal Investigator', phd: 'Ph.D. Scholars', grad: 'Graduate Students', undergrad: 'Undergraduate', alumni: 'Alumni' };
  if (membersList && data.members) {
    let html = '';
    for (const [cat, label] of Object.entries(categories)) {
      const mems = data.members.filter(m => m.category === cat);
      if (mems.length === 0) continue;
      html += `<div class="category-label">${label}</div><div class="members-grid">`;
      html += mems.map(m =>
        `<div class="card member-card animate-on-scroll">
          <img src="${m.img || 'pic/default-avatar.png'}" alt="${m.name}" class="avatar" loading="lazy">
          <div class="name">${m.name}</div>
          <div class="role">${m.role}</div>
          <div class="bio">${m.bio}</div>
          ${m.email ? `<div class="email"><a href="mailto:${m.email}">${m.email}</a></div>` : ''}
        </div>`
      ).join('');
      html += '</div>';
    }
    membersList.innerHTML = html;
    const memberCount = document.getElementById('memberCount');
    if (memberCount) memberCount.textContent = data.members.length;
  }

  // ─── Render Collaborators ───
  const collabList = document.getElementById('collabList');
  if (collabList && data.collaborators) {
    collabList.innerHTML = data.collaborators.map(c =>
      `<div class="card collab-card animate-on-scroll">
        <div class="collab-icon">🤝</div>
        <div>
          <div class="collab-name">${c.name}</div>
          <div class="collab-aff">${c.affiliation}</div>
        </div>
      </div>`
    ).join('');
  }

  // ─── Internal / Workspace ───
  const loginForm = document.getElementById('loginForm');
  const loginMsg = document.getElementById('loginMsg');
  const internalLogin = document.getElementById('internalLogin');
  const workspaceWrap = document.getElementById('workspaceWrap');

  function showWorkspace(session) {
    if (!session) return;
    internalLogin.style.display = 'none';
    workspaceWrap.style.display = 'block';
    // User info
    const wsUser = document.getElementById('wsUser');
    wsUser.innerHTML = `<img src="${session.avatar || 'pic/default-avatar.png'}" alt="${session.name}">
      <div><div class="ws-uname">${session.name}</div><div class="ws-urole">${session.role}</div></div>`;
    renderResources();
  }

  function renderResources(filter) {
    const d = QLab.getData();
    let resources = d.internalResources || [];
    if (filter && filter !== 'files') resources = resources.filter(r => r.category === filter);
    const tbody = document.getElementById('resourceBody');
    tbody.innerHTML = resources.map(r =>
      `<tr>
        <td class="file-name"><a href="${r.url}" target="_blank" rel="noopener">${r.name}</a></td>
        <td><span class="file-cat">${r.category}</span></td>
        <td>${r.uploadedBy}</td><td>${r.date}</td><td>${r.size}</td>
        <td><a href="${r.url}" class="btn btn-ghost btn-sm" download>⬇</a></td>
      </tr>`
    ).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:2rem">No resources found</td></tr>';
  }

  // Check existing session
  const session = QLab.getMemberSession();
  if (session) showWorkspace(session);

  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const user = document.getElementById('loginUser').value.trim();
      const pass = document.getElementById('loginPass').value;
      const result = QLab.memberLogin(user, pass);
      if (result) {
        loginMsg.className = 'form-msg success';
        loginMsg.textContent = 'Welcome, ' + result.name + '!';
        setTimeout(() => showWorkspace(QLab.getMemberSession()), 500);
      } else {
        loginMsg.className = 'form-msg error';
        loginMsg.textContent = 'Incorrect credentials.';
        setTimeout(() => { loginMsg.textContent = ''; }, 2500);
      }
    });
  }

  // Workspace nav
  document.querySelectorAll('[data-ws]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('[data-ws]').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      const filter = a.getAttribute('data-ws');
      if (filter === 'upload') {
        document.getElementById('uploadModal').classList.add('show');
      } else {
        const label = { files: '📁 All Files', manuals: '📖 Manuals', data: '📊 Data' }[filter] || '📁 Files';
        document.querySelector('#wsHeader h2').textContent = label;
        renderResources(filter);
      }
    });
  });

  // Logout
  const wsLogout = document.getElementById('wsLogout');
  if (wsLogout) {
    wsLogout.addEventListener('click', () => {
      QLab.memberLogout();
      workspaceWrap.style.display = 'none';
      internalLogin.style.display = '';
      loginForm.reset();
    });
  }

  // Upload modal
  const uploadModal = document.getElementById('uploadModal');
  const modalClose = document.getElementById('modalClose');
  const wsUploadBtn = document.getElementById('wsUploadBtn');
  if (wsUploadBtn) wsUploadBtn.addEventListener('click', () => uploadModal.classList.add('show'));
  if (modalClose) modalClose.addEventListener('click', () => uploadModal.classList.remove('show'));
  uploadModal?.addEventListener('click', e => { if (e.target === uploadModal) uploadModal.classList.remove('show'); });

  const uploadForm = document.getElementById('uploadForm');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async e => {
      e.preventDefault();
      const upMsg = document.getElementById('upMsg');
      const upBtn = document.getElementById('upSubmitBtn');
      const fileInput = document.getElementById('upFile');
      const file = fileInput?.files[0];
      if (!file) { upMsg.className='form-msg error'; upMsg.textContent='Please select a file.'; return; }

      // Check if GitHub token is available
      if (typeof GitHubAPI !== 'undefined' && GitHubAPI.hasToken()) {
        try {
          upBtn.disabled = true;
          upMsg.className = 'form-msg'; upMsg.textContent = '⏳ Uploading to GitHub...';
          const base64 = await GitHubAPI.fileToBase64(file);
          const result = await GitHubAPI.uploadFile(file.name, base64);
          // Save to localStorage too
          const sess = QLab.getMemberSession();
          QLab.addItem('internalResources', {
            name: file.name,
            url: result.pagesUrl,
            category: document.getElementById('upCat').value,
            size: GitHubAPI.formatSize(file.size),
            uploadedBy: sess ? sess.name : 'Unknown',
            date: new Date().toISOString().split('T')[0]
          });
          upMsg.className = 'form-msg success'; upMsg.textContent = '✅ Uploaded to GitHub!';
          setTimeout(() => { uploadForm.reset(); uploadModal.classList.remove('show'); upMsg.textContent=''; }, 1500);
          renderResources();
        } catch (err) {
          upMsg.className = 'form-msg error'; upMsg.textContent = '❌ ' + err.message;
        } finally { upBtn.disabled = false; }
      } else {
        // Fallback: just save metadata locally
        const sess = QLab.getMemberSession();
        QLab.addItem('internalResources', {
          name: file.name, url: '#', category: document.getElementById('upCat').value,
          size: (file.size / (1024*1024)).toFixed(1) + ' MB',
          uploadedBy: sess ? sess.name : 'Unknown',
          date: new Date().toISOString().split('T')[0]
        });
        upMsg.className = 'form-msg success'; upMsg.textContent = 'Saved locally (set GitHub token in Admin for cloud upload).';
        setTimeout(() => { uploadForm.reset(); uploadModal.classList.remove('show'); upMsg.textContent=''; }, 2000);
        renderResources();
      }
    });
  }

  // ─── Scroll Animations ───
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
  }, { threshold: 0.1 });
  document.querySelectorAll('.animate-on-scroll').forEach(el => observer.observe(el));
});
