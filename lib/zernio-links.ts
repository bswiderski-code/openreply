export function zernioLink({ path = '/', placement }: { path?: string; placement: string }): string {
  const url = new URL(path, 'https://zernio.com');
  if (!['zernio.com', 'docs.zernio.com'].includes(url.hostname) || url.protocol !== 'https:') throw new Error('Expected a Zernio destination.');
  url.searchParams.set('utm_source', 'openreply');
  url.searchParams.set('utm_medium', 'sponsorship');
  url.searchParams.set('utm_campaign', 'openreply-integration');
  url.searchParams.set('utm_content', placement);
  return url.toString();
}
