import { load, save } from '../core/storage.js';

const DEFAULTS = { token: '', repo: 'gizmo73/valheim-planner', branch: 'main' };

// Settings saved by earlier versions of the planner.
function legacySettings() {
  try {
    const token = localStorage.getItem('vp_gh_token');
    return token ? { token, repo: localStorage.getItem('vp_gh_repo') || DEFAULTS.repo, branch: localStorage.getItem('vp_gh_branch') || DEFAULTS.branch } : {};
  } catch {
    return {};
  }
}

export function githubSettings() {
  return { ...DEFAULTS, ...legacySettings(), ...load('github', {}) };
}

export function saveGithubSettings(patch) {
  save('github', { ...githubSettings(), ...patch });
}

// Commits every file in one go through the Git Data API.
// files: [{ path, content }] — content null deletes the file.
export async function commitFiles(files, message) {
  const { token, repo, branch } = githubSettings();
  if (!token) throw new Error('Add a GitHub access token first.');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('Repository should look like owner/name.');
  const api = `https://api.github.com/repos/${repo}`;
  const ref = branch.split('/').map(encodeURIComponent).join('/');
  const call = async (path, method = 'GET', body) => {
    const res = await fetch(api + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: body && JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`GitHub ${res.status}: ${json.message || res.statusText}`);
    return json;
  };

  const head = await call(`/git/ref/heads/${ref}`);
  const commit = await call(`/git/commits/${head.object.sha}`);
  const tree = await call('/git/trees', 'POST', {
    base_tree: commit.tree.sha,
    tree: files.map(f => ({ path: f.path, mode: '100644', type: 'blob', ...(f.content == null ? { sha: null } : { content: f.content }) })),
  });
  const next = await call('/git/commits', 'POST', { message, tree: tree.sha, parents: [commit.sha] });
  await call(`/git/refs/heads/${ref}`, 'PATCH', { sha: next.sha });
  return next;
}
