/* ═══════════════════════════════════════════════════════════════
   Quantum Lab — GitHub API Integration
   Uploads files directly to the GitHub repo via the Contents API.
   Token is stored ONLY in sessionStorage (never committed to code).
   ═══════════════════════════════════════════════════════════════ */

const GitHubAPI = (() => {
  const TOKEN_KEY = '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';
  const REPO_OWNER = 'quantumlabgndu';        // ← your GitHub username/org
  const REPO_NAME = 'quantumlabgndu.github.io'; // ← your repo name
  const BRANCH = 'main';
  const UPLOAD_DIR = 'uploads';                // folder in repo for uploads

  /* ── Token management (sessionStorage only) ── */
  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token.trim());
  }

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  }

  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function hasToken() {
    return !!getToken();
  }

  /* ── Verify token works ── */
  async function verifyToken() {
    const token = getToken();
    if (!token) return { ok: false, msg: 'No token set.' };
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (res.ok) {
        const user = await res.json();
        return { ok: true, msg: `Authenticated as ${user.login}`, user: user.login };
      }
      return { ok: false, msg: `Auth failed (${res.status})` };
    } catch (e) {
      return { ok: false, msg: 'Network error: ' + e.message };
    }
  }

  /* ── Upload a file (base64) to the repo ── */
  async function uploadFile(fileName, base64Content, commitMsg) {
    const token = getToken();
    if (!token) throw new Error('GitHub token not set. Go to Admin → GitHub Settings.');

    const path = `${UPLOAD_DIR}/${fileName}`;
    const encodedFileName = encodeURIComponent(fileName);
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${UPLOAD_DIR}/${encodedFileName}`;

    // Check if file already exists (to get its SHA for update)
    let sha = null;
    try {
      const check = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (check.ok) {
        const existing = await check.json();
        sha = existing.sha;
      }
    } catch (e) { /* file doesn't exist, that's fine */ }

    // Create or update the file
    const body = {
      message: commitMsg || `Upload ${fileName} via Quantum Lab admin`,
      content: base64Content,
      branch: BRANCH
    };
    if (sha) body.sha = sha; // required for updates

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`GitHub API error ${res.status}: ${err.message || 'Unknown error'}`);
    }

    const result = await res.json();
    return {
      ok: true,
      downloadUrl: result.content.download_url,
      htmlUrl: result.content.html_url,
      path: result.content.path,
      // GitHub Pages URL
      pagesUrl: `https://${REPO_OWNER}.github.io/${path}`
    };
  }

  /* ── List files in the uploads directory ── */
  async function listUploads() {
    const token = getToken();
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${UPLOAD_DIR}`;
    const headers = { 'Accept': 'application/vnd.github+json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return [];
      const files = await res.json();
      return Array.isArray(files) ? files.map(f => ({
        name: f.name,
        size: f.size,
        url: f.download_url,
        pagesUrl: `https://${REPO_OWNER}.github.io/${f.path}`,
        sha: f.sha
      })) : [];
    } catch (e) {
      console.warn('Could not list uploads:', e);
      return [];
    }
  }

  /* ── Delete a file from the repo ── */
  async function deleteFile(fileName, sha) {
    const token = getToken();
    if (!token) throw new Error('GitHub token not set.');

    const path = `${UPLOAD_DIR}/${fileName}`;
    const encodedFileName = encodeURIComponent(fileName);
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${UPLOAD_DIR}/${encodedFileName}`;

    // If no SHA provided, fetch it
    if (!sha) {
      const check = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
      });
      if (check.ok) {
        const existing = await check.json();
        sha = existing.sha;
      } else {
        throw new Error('File not found.');
      }
    }

    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Delete ${fileName} via Quantum Lab admin`,
        sha: sha,
        branch: BRANCH
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Delete failed (${res.status}): ${err.message || 'Unknown'}`);
    }
    return { ok: true };
  }

  /* ── Helper: convert File object to base64 ── */
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove the data:...;base64, prefix
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /* ── Helper: format file size ── */
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  return {
    setToken, getToken, clearToken, hasToken,
    verifyToken, uploadFile, listUploads, deleteFile,
    fileToBase64, formatSize,
    REPO_OWNER, REPO_NAME, UPLOAD_DIR
  };
})();
