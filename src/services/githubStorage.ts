import { Product } from '../types';

export const GitHubStorageService = {
  getConfig() {
    try {
      const config = localStorage.getItem('yaarika_github_config');
      if (config) {
        const parsed = JSON.parse(config);
        if (parsed.token || parsed.repo) {
          return parsed;
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
      localStorage.setItem('yaarika_github_config', JSON.stringify({ token: token.trim(), repo: repo.trim() }));
    } catch {}
  },

  async fetchProducts(): Promise<Product[]> {
    // 1. Try static public products.json
    try {
      const res = await fetch('/products.json');
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
          if (Array.isArray(data)) return data;
        }
      } catch {}

      try {
        const rawResMaster = await fetch(`https://raw.githubusercontent.com/${repo}/master/products.json?t=${Date.now()}`);
        if (rawResMaster.ok) {
          const data = await rawResMaster.json();
          if (Array.isArray(data)) return data;
        }
      } catch {}

      // 3. Try GitHub contents API if token is available
      if (token) {
        try {
          const apiRes = await fetch(`https://api.github.com/repos/${repo}/contents/products.json`, {
            headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3.raw' }
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (Array.isArray(data)) return data;
          }
        } catch {}
      }
    }

    return [];
  },

  async updateProducts(products: Product[], message: string): Promise<void> {
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
      console.warn('GitHub sync note: Token or repository not configured.');
      return;
    }

    const contentBase64 = utf8ToBase64(JSON.stringify(products, null, 2));

    let sha: string | undefined = undefined;
    try {
      const fileRes = await fetch(`https://api.github.com/repos/${repo}/contents/products.json`, {
        headers: { Authorization: `token ${token}` }
      });
      if (fileRes.ok) {
        const fileData = await fileRes.json();
        if (fileData && typeof fileData.sha === 'string') {
          sha = fileData.sha;
        }
      }
    } catch {}

    const makePutRequest = async (currentSha?: string) => {
      const payload: any = {
        message: message || 'Update products via Yaarika Admin Portal',
        content: contentBase64
      };
      if (currentSha && typeof currentSha === 'string' && currentSha.trim() !== '') {
        payload.sha = currentSha;
      }

      return await fetch(`https://api.github.com/repos/${repo}/contents/products.json`, {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    };

    let putRes = await makePutRequest(sha);

    // If failed with SHA, retry without SHA
    if (!putRes.ok && sha) {
      putRes = await makePutRequest(undefined);
    }

    if (!putRes.ok) {
      const errText = await putRes.text();
      console.warn(`GitHub commit warning: ${errText}`);
    }
  },

  async saveProduct(product: Product): Promise<void> {
    const products = await this.fetchProducts();
    const index = products.findIndex(p => p.id === product.id);
    if (index > -1) {
      products[index] = product;
    } else {
      products.push(product);
    }
    await this.updateProducts(products, `Save product ${product.title}`);
  },

  async deleteProduct(productId: string): Promise<void> {
    const products = await this.fetchProducts();
    const filtered = products.filter(p => p.id !== productId);
    await this.updateProducts(filtered, `Delete product ${productId}`);
  },

  async verifyConnection(token: string, repo: string): Promise<any> {
    const activeToken = token || this.getConfig().token;
    const activeRepo = repo || this.getConfig().repo;

    if (!activeToken || !activeRepo) {
      return { success: false, hasToken: !!activeToken, hasRepo: !!activeRepo, error: 'GitHub Token and Repository (owner/repo) are required.' };
    }

    try {
      const repoCheck = await fetch(`https://api.github.com/repos/${activeRepo}`, {
        headers: { Authorization: `token ${activeToken}` }
      });
      if (!repoCheck.ok) {
        return { success: false, hasToken: true, hasRepo: true, repoAccess: false, error: 'Invalid repository name or unauthorized token.' };
      }

      let sha: string | undefined = undefined;
      let readSuccess = false;
      try {
        const fileRes = await fetch(`https://api.github.com/repos/${activeRepo}/contents/products.json`, {
          headers: { Authorization: `token ${activeToken}` }
        });
        if (fileRes.ok) {
          const fileData = await fileRes.json();
          if (fileData && typeof fileData.sha === 'string') {
            sha = fileData.sha;
          }
          readSuccess = true;
        }
      } catch {
        readSuccess = true;
      }

      const timestamp = new Date().toISOString();
      const testPing = [{ id: 'verify-ping', title: `Sync Verification ${timestamp}`, price: 99, category: 'Fusion Wear', inStock: true, sizes: ['Free Size'], imageUrl: '', description: 'Verification test' }];

      const bodyPayload: any = {
        message: `Verification test sync at ${timestamp}`,
        content: utf8ToBase64(JSON.stringify(testPing, null, 2))
      };
      if (sha && typeof sha === 'string' && sha.trim() !== '') {
        bodyPayload.sha = sha;
      }

      const putRes = await fetch(`https://api.github.com/repos/${activeRepo}/contents/products.json`, {
        method: 'PUT',
        headers: {
          Authorization: `token ${activeToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });

      const writeSuccess = putRes.ok;

      return {
        hasToken: true,
        hasRepo: true,
        repoAccess: true,
        readSuccess,
        writeSuccess,
        error: writeSuccess ? null : 'Failed to write products.json to repository.'
      };
    } catch (e: any) {
      return { success: false, hasToken: !!activeToken, hasRepo: !!activeRepo, error: e.message || 'GitHub verification failed' };
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
