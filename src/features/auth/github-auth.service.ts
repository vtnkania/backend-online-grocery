import jwt from 'jsonwebtoken';
import { StatusCodes } from 'http-status-codes';
import { prisma } from '@/application/database';
import { ResponseError } from '@/error/response.error';

type GitHubToken = { access_token?: string; error_description?: string };
type GitHubProfile = { id: number; name: string | null; login: string; avatar_url: string | null };
type GitHubEmail = { email: string; primary: boolean; verified: boolean };

const selectUser = {
  id: true, name: true, email: true, role: true, authProvider: true,
  isVerified: true, emailVerifiedAt: true, profileImageUrl: true,
} as const;

const jwtSecret = () => process.env.JWT_SECRET ?? 'freshmart-dev-secret';
const callbackUrl = () => process.env.GITHUB_REDIRECT_URI ?? 'http://localhost:3000/social-callback';

const requireEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new ResponseError(StatusCodes.INTERNAL_SERVER_ERROR, `${key} is not configured.`);
  return value;
};

const jsonFetch = async <T>(url: string, init: RequestInit) => {
  const response = await fetch(url, init);
  if (!response.ok) throw new ResponseError(StatusCodes.BAD_GATEWAY, 'GitHub request failed.');
  return response.json() as Promise<T>;
};

const githubToken = async (code: string) => {
  const body = new URLSearchParams({
    code,
    client_id: requireEnv('GITHUB_CLIENT_ID'),
    client_secret: requireEnv('GITHUB_CLIENT_SECRET'),
    redirect_uri: callbackUrl(),
  });
  const token = await jsonFetch<GitHubToken>('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body,
  });
  if (!token.access_token) throw new ResponseError(StatusCodes.BAD_REQUEST, token.error_description ?? 'Invalid GitHub code.');
  return token.access_token;
};

const githubGet = async <T>(path: string, token: string) => jsonFetch<T>(`https://api.github.com${path}`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
});

const verifiedPrimaryEmail = (emails: GitHubEmail[]) => {
  const email = emails.find((item) => item.primary && item.verified);
  if (!email) throw new ResponseError(StatusCodes.BAD_REQUEST, 'GitHub account must have a verified primary email.');
  return email.email.toLowerCase();
};

const signInResponse = async (userId: string) => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: selectUser });
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, jwtSecret(), { expiresIn: '1d' });
  return { accessToken, user };
};

const linkToUser = async (userId: string, profile: GitHubProfile, email: string) => {
  await prisma.socialAccount.upsert({
    where: { userId_provider: { userId, provider: 'GITHUB' } },
    update: { providerUserId: String(profile.id), email, avatarUrl: profile.avatar_url },
    create: { userId, provider: 'GITHUB', providerUserId: String(profile.id), email, avatarUrl: profile.avatar_url },
  });
};

const createGitHubUser = async (profile: GitHubProfile, email: string) => prisma.user.create({
  data: {
    email,
    name: profile.name ?? profile.login,
    authProvider: 'GITHUB',
    isVerified: true,
    emailVerifiedAt: new Date(),
    profileImageUrl: profile.avatar_url,
  },
});

const ensureLinkedUser = async (profile: GitHubProfile, email: string) => {
  const account = await prisma.socialAccount.findUnique({
    where: { provider_providerUserId: { provider: 'GITHUB', providerUserId: String(profile.id) } },
  });
  if (account) return account.userId;
  const existing = await prisma.user.findUnique({ where: { email } });
  const user = existing ?? await createGitHubUser(profile, email);
  await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, emailVerifiedAt: new Date(), profileImageUrl: user.profileImageUrl ?? profile.avatar_url },
  });
  await linkToUser(user.id, profile, email);
  return user.id;
};

export const loginWithGitHub = async (code: string) => {
  const token = await githubToken(code);
  const profile = await githubGet<GitHubProfile>('/user', token);
  const emails = await githubGet<GitHubEmail[]>('/user/emails', token);
  const email = verifiedPrimaryEmail(emails);
  const userId = await ensureLinkedUser(profile, email);
  return signInResponse(userId);
};
