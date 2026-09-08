import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { getBaseUrl } from '@/lib/env';
import { decryptToken, encryptToken } from '@/lib/meta/oauth';
import { zernioRequest } from '@/lib/zernio/client';
import { loadConnection } from '@/lib/zernio/load-connection';
import { ensureWebhook, listInstagramAccounts, listProfiles, listWebhooks, webhookUrl } from '@/lib/zernio/manage-remote';
import { ConnectionError, readBody, withZernioManagement } from '@/lib/zernio/route-handler';

const keyBodySchema = z.object({ apiKey: z.string().trim().min(10).max(512) });
const profileBodySchema = z.object({ profileId: z.string().min(1) });

export const GET = withZernioManagement(async ({ workspaceId }) => {
  const saved = await prisma.zernioConnection.findUnique({ where: { workspaceId } });
  if (!saved) return NextResponse.json({ success: true, data: { configured: false, profiles: [], accounts: [] } });
  const apiKey = decryptToken(saved.apiKey);
  const [profiles, accounts] = await Promise.all([
    listProfiles(apiKey), saved.profileId ? listInstagramAccounts({ apiKey, profileId: saved.profileId }) : [],
  ]);
  const connected = await prisma.instagramAccount.findMany({ where: { workspaceId, provider: 'ZERNIO' }, select: { zernioAccountId: true } });
  const connectedIds = new Set(connected.map(a => a.zernioAccountId));
  return NextResponse.json({ success: true, data: { configured: true, profileId: saved.profileId, webhookReady: Boolean(saved.webhookId), profiles, accounts: accounts.map(a => ({ ...a, connected: connectedIds.has(a.id) })) } });
});

export const POST = withZernioManagement(async ({ workspaceId }, request) => {
  const { apiKey } = await readBody(request, keyBodySchema);
  if (await prisma.zernioConnection.findUnique({ where: { workspaceId } })) throw new ConnectionError('Remove the current Zernio connection before replacing its API key.');
  await Promise.all([listProfiles(apiKey), listWebhooks(apiKey)]);
  await prisma.zernioConnection.create({ data: { workspaceId, apiKey: encryptToken(apiKey), webhookSecret: encryptToken(randomBytes(32).toString('hex')) } });
  return NextResponse.json({ success: true });
});

export const PUT = withZernioManagement(async ({ workspaceId }, request) => {
  const { profileId } = await readBody(request, profileBodySchema);
  const connection = await loadConnection(workspaceId);
  if (!(await listProfiles(connection.apiKey)).some(p => p.id === profileId)) throw new ConnectionError('That profile is not accessible with this API key.', 403);
  if (connection.profileId && connection.profileId !== profileId && await prisma.instagramAccount.count({ where: { workspaceId, provider: 'ZERNIO' } })) {
    throw new ConnectionError('Disconnect this workspace’s Zernio accounts before changing profile.');
  }
  const webhookId = await ensureWebhook({ apiKey: connection.apiKey, workspaceId, secret: decryptToken(connection.webhookSecret), baseUrl: getBaseUrl() });
  await prisma.zernioConnection.update({ where: { workspaceId }, data: { profileId, webhookId } });
  return NextResponse.json({ success: true });
});

export const DELETE = withZernioManagement(async ({ workspaceId }) => {
  const connection = await loadConnection(workspaceId);
  if (await prisma.instagramAccount.count({ where: { workspaceId, provider: 'ZERNIO' } })) throw new ConnectionError('Disconnect this workspace’s Zernio accounts first.');
  const url = webhookUrl({ baseUrl: getBaseUrl(), workspaceId });
  const ours = (await listWebhooks(connection.apiKey)).find(w => w._id === connection.webhookId && w.url === url);
  if (ours) await zernioRequest({ apiKey: connection.apiKey, path: `/webhooks/settings?id=${encodeURIComponent(ours._id)}`, method: 'DELETE' });
  await prisma.zernioConnection.delete({ where: { workspaceId } });
  return NextResponse.json({ success: true });
});
