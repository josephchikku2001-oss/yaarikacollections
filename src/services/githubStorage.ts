import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';

function cleanRepo(repo: string): string {
  if (!repo) return '';
  return repo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
}

function cleanToken(token: string): string {
  if (!token) return '';
  return token.trim().replace(/^['"]|['"]$/g, '');
}

function getAuthHeaders(token: string): Record<string, string> {
  const t = cleanToken(token);
  return {
    Authorization: `Bearer ${t}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

export const GitHubStorageService = {
  getConfig() {
    try {
      const config = localStorage.getItem('yaarika_github_config');
      if (config) {
        const parsed = JSON.parse(config);
        if (parsed.token || parsed.repo) {
          return {
            token: cleanToken(parsed.token || ''),
            repo: cleanRepo(parsed.repo || '')
          };
        }
      }
    } catch {}

    return {
      token: '',
      repo: ''
    };
  },

  saveConfig(token: string, repo: string) {
    try {
      const cleaned = {
        token: cleanToken(token),
        repo: cleanRepo(repo)
      };
      localStorage.setItem('yaarika_github_config', JSON.stringify(cleaned));
    } catch {}
  },

  async fetchProducts(): Promise<Product[]> {
    // 0. Try server /api/products first
    try {
      const apiRes = await fetch('/api/products');
      if (apiRes.ok) {
        const data = await apiRes.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {}

    // 1. Try static public products.json
    try {
      const res = await fetch(`/products.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch {}

    // 2. Try direct GitHub raw URL using configured repo
    const { repo, token } = this.getConfig();
    if (repo) {
      try {
        const rawRes = await fetch(`https://raw.githubusercontent.com/${repo}/main/products.json?t=${Date.now()}`);
        if (rawRes.ok) {
          const data = await rawRes.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch {}

      try {
        const rawResMaster = await fetch(`https://raw.githubusercontent.com/${repo}/master/products.json?t=${Date.now()}`);
        if (rawResMaster.ok) {
          const data = await rawResMaster.json();
          if (Array.isArray(data) && data.length > 0) return data;
        }
      } catch {}

      // 3. Try GitHub contents API if token is available
      if (token) {
        try {
          const apiRes = await fetch(`https://api.github.com/repos/${repo}/contents/products.json`, {
            headers: { ...getAuthHeaders(token), Accept: 'application/vnd.github.v3.raw' }
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (Array.isArray(data) && data.length > 0) return data;
          }
        } catch {}
      }
    }

    return [];
  },

  async updateProducts(products: Product[], message: string): Promise<{ success: boolean; error?: string }> {
    // 1. Try local server save if available
    try {
      await fetch('/api/github/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: products, message })
      });
    } catch {}

    // 2. Push to GitHub repository via direct REST API with automatic SHA fallback
    const { token, repo } = this.getConfig();
    if (!token || !repo) {
      return { success: false, error: 'GitHub Token or repository not configured.' };
    }

    const contentBase64 = utf8ToBase64(JSON.stringify(products, null, 2));

    // Get current SHA from repo
    let sha: string | undefined = undefined;
    try {
      const fileRes = await fetch(`https://api.github.com/repos/${repo}/contents/products.json?ref=main`, {
        headers: getAuthHeaders(token),
        cache: 'no-store'
      });
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData && typeof fileData.sha === 'string') {
          sha = fileData.sha;
        }
      }
    } catch {}

    const makePutRequest = async (currentSha?: string, useTokenHeader = false) => {
      const payload: any = {
        message: message || 'Update products.json via Yaarika Admin Portal',
        content: contentBase64,
        branch: 'main'
      };
      if (currentSha && typeof currentSha === 'string' && currentSha.trim() !== '') {
        payload.sha = currentSha;
      }

      const headers: Record<string, string> = useTokenHeader
        ? {
            Authorization: `token ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json'
          }
        : {
            ...getAuthHeaders(token),
            'Content-Type': 'application/json'
          };

      return await fetch(`https://api.github.com/repos/${repo}/contents/products.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(payload)
      });
    };

    let putRes = await makePutRequest(sha, false);

    // If failed with Bearer header, retry with legacy token prefix
    if (!putRes.ok) {
      putRes = await makePutRequest(sha, true);
    }

    // If failed with SHA, retry without SHA in case file was newly created or branch differs
    if (!putRes.ok && sha) {
      putRes = await makePutRequest(undefined, false);
    }

    if (!putRes.ok) {
      let errText = '';
      try {
        const errJson = await putRes.json();
        errText = errJson.message || JSON.stringify(errJson);
      } catch {
        errText = await putRes.text();
      }
      console.warn(`GitHub commit warning (${putRes.status}):`, errText);
      return { success: false, error: `GitHub Error (${putRes.status}): ${errText}` };
    }

    return { success: true };
  },

  async saveProduct(product: Product): Promise<{ success: boolean; error?: string }> {
    const products = await this.fetchProducts();
    const effective = products.length > 0 ? [...products] : [...INITIAL_PRODUCTS];
    const index = effective.findIndex(p => p.id === product.id);
    if (index > -1) {
      effective[index] = product;
    } else {
      effective.unshift(product);
    }
    return await this.updateProducts(effective, `Save product ${product.title}`);
  },

  async deleteProduct(productId: string): Promise<{ success: boolean; error?: string }> {
    const products = await this.fetchProducts();
    const filtered = products.filter(p => p.id !== productId);
    return await this.updateProducts(filtered, `Delete product ${productId}`);
  },

  async verifyConnection(token: string, repo: string): Promise<any> {
    const activeToken = cleanToken(token || this.getConfig().token);
    const activeRepo = cleanRepo(repo || this.getConfig().repo);

    if (!activeToken || !activeRepo) {
      return {
        success: false,
        hasToken: !!activeToken,
        hasRepo: !!activeRepo,
        error: 'GitHub Token and Repository (owner/repo, e.g. josephchikku2001-oss/yaarikacollections) are required.'
      };
    }

    if (!activeRepo.includes('/')) {
      return {
        success: false,
        hasToken: true,
        hasRepo: false,
        error: 'Repository name must be in "owner/repository" format (e.g., josephchikku2001-oss/yaarikacollections).'
      };
    }

    try {
      // 1. Check repository access
      const repoCheck = await fetch(`https://api.github.com/repos/${activeRepo}`, {
        headers: getAuthHeaders(activeToken)
      });
      if (!repoCheck.ok) {
        let repoErr = '';
        try {
          const errData = await repoCheck.json();
          repoErr = errData.message || '';
        } catch {}
        return {
          success: false,
          hasToken: true,
          hasRepo: true,
          repoAccess: false,
          error: `Cannot access repository: ${repoErr || `HTTP ${repoCheck.status}`}. Please check token permissions.`
        };
      }

      // 2. Read products.json SHA if it exists
      let sha: string | undefined = undefined;
      let readSuccess = false;
      try {
        const fileRes = await fetch(`https://api.github.com/repos/${activeRepo}/contents/products.json?ref=main`, {
          headers: getAuthHeaders(activeToken),
          cache: 'no-store'
        });
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          if (fileData && typeof fileData.sha === 'string') {
            sha = fileData.sha;
          }
          readSuccess = true;
        } else if (fileRes.status === 404) {
          // File does not exist yet, that's fine
          readSuccess = true;
        }
      } catch {
        readSuccess = true;
      }

      // 3. Attempt verification write using REAL catalog items (not dummy ping item)
      // This ensures verifying also populates the file with actual catalog!
      let catalog = INITIAL_PRODUCTS;
      try {
        const local = localStorage.getItem('yaarika_products_v10');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) catalog = parsed;
        }
      } catch {}

      const timestamp = new Date().toISOString();
      const bodyPayload: any = {
        message: `Verify & sync catalog (${catalog.length} items) via Yaarika Admin at ${timestamp}`,
        content: utf8ToBase64(JSON.stringify(catalog, null, 2)),
        branch: 'main'
      };
      if (sha && typeof sha === 'string' && sha.trim() !== '') {
        bodyPayload.sha = sha;
      }

      const makePut = async (useToken = false) => {
        const h: Record<string, string> = useToken
          ? {
              Authorization: `token ${activeToken}`,
              Accept: 'application/vnd.github+json',
              'Content-Type': 'application/json'
            }
          : {
              ...getAuthHeaders(activeToken),
              'Content-Type': 'application/json'
            };
        return await fetch(`https://api.github.com/repos/${activeRepo}/contents/products.json`, {
          method: 'PUT',
          headers: h,
          body: JSON.stringify(bodyPayload)
        });
      };

      let putRes = await makePut(false);
      if (!putRes.ok) {
        putRes = await makePut(true);
      }

      if (!putRes.ok) {
        let errDetail = '';
        try {
          const errData = await putRes.json();
          errDetail = errData.message || JSON.stringify(errData);
        } catch {
          errDetail = await putRes.text();
        }

        return {
          hasToken: true,
          hasRepo: true,
          repoAccess: true,
          readSuccess,
          writeSuccess: false,
          error: `GitHub Error (${putRes.status}): ${errDetail}`
        };
      }

      return {
        success: true,
        hasToken: true,
        hasRepo: true,
        repoAccess: true,
        readSuccess,
        writeSuccess: true,
        error: null,
        message: `Successfully connected & synced ${catalog.length} products to GitHub!`
      };
    } catch (e: any) {
      return {
        success: false,
        hasToken: !!activeToken,
        hasRepo: !!activeRepo,
        error: e.message || 'GitHub verification failed'
      };
    }
  }
};

function utf8ToBase64(str: string): string {
  try {
    return btoa(
      encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
        String.fromCharCode(parseInt(p1, 16))
      )
    );
  } catch {
    return btoa(str);
  }
}
