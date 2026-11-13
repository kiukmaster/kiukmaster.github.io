const DISPATCH_URL = 'https://api.github.com/repos/kiukmaster/kiukmaster.github.io/actions/workflows/news.yml/dispatches';

export default {
  async scheduled(controller, env) {
    const token = typeof env.GITHUB_ACTIONS_TOKEN === 'string' ? env.GITHUB_ACTIONS_TOKEN.trim() : '';
    if (!token || /[^\x21-\x7e]/.test(token)) {
      throw new Error('GitHub dispatch token is missing or invalid');
    }

    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 15000);
    try {
      let response;
      try {
        response = await fetch(DISPATCH_URL, {
          method: 'POST',
          redirect: 'manual',
          signal: abort.signal,
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': 'KIUK-News-Scheduler',
            'X-GitHub-Api-Version': '2026-03-10',
          },
          body: JSON.stringify({ref: 'main'}),
        });
      } catch {
        throw new Error('GitHub dispatch request failed or timed out');
      }

      if (response.status !== 200) {
        throw new Error(`GitHub dispatch rejected: HTTP ${response.status}`);
      }
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('GitHub dispatch response could not be read as JSON');
      }
      if (!Number.isSafeInteger(result?.workflow_run_id) || result.workflow_run_id <= 0) {
        throw new Error('GitHub dispatch response has no valid workflow run ID');
      }

      console.log('GitHub dispatch accepted; workflow completion is not confirmed', {
        workflow_run_id: result.workflow_run_id,
        scheduled_at: controller.scheduledTime,
      });
    } finally {
      clearTimeout(timeout);
    }
  },
};
