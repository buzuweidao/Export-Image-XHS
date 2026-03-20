export function buildProjectLinks(repoUrl) {
  const normalizedRepoUrl = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');

  return {
    repoUrl: normalizedRepoUrl,
    issuesUrl: `${normalizedRepoUrl}/issues`,
  };
}

export const PROJECT_LINKS = buildProjectLinks('https://github.com/buzuweidao/Export-Image-XHS.git');
