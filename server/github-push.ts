import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function createRepoAndPush() {
  try {
    const octokit = await getUncachableGitHubClient();
    const accessToken = await getAccessToken();
    
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`Authenticated as: ${user.login}`);
    
    const repoName = 'dark-pool-data-2';
    const description = 'Institutional Grade Dark Pool & Options Flow Research Workspace - Automated Twitter/X thread generation with real API data';
    
    let repoUrl: string;
    try {
      const { data: repo } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        description: description,
        private: false,
        auto_init: false
      });
      console.log(`Created new repository: ${repo.html_url}`);
      repoUrl = repo.clone_url;
    } catch (error: any) {
      if (error.status === 422) {
        console.log(`Repository ${repoName} already exists, using existing repo`);
        const { data: existingRepo } = await octokit.repos.get({
          owner: user.login,
          repo: repoName
        });
        repoUrl = existingRepo.clone_url;
      } else {
        throw error;
      }
    }
    
    const authenticatedUrl = repoUrl.replace('https://', `https://${accessToken}@`);
    
    try {
      execSync('git remote remove origin', { stdio: 'pipe' });
    } catch (e) {
    }
    
    execSync(`git remote add origin ${authenticatedUrl}`, { stdio: 'inherit' });
    console.log('Added remote origin');
    
    execSync('git branch -M main', { stdio: 'inherit' });
    console.log('Set branch to main');
    
    execSync('git push -u origin main --force', { stdio: 'inherit' });
    console.log(`Successfully pushed to: https://github.com/${user.login}/${repoName}`);
    
    return `https://github.com/${user.login}/${repoName}`;
  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

createRepoAndPush()
  .then(url => {
    console.log(`\nRepository URL: ${url}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed to push to GitHub:', err);
    process.exit(1);
  });
