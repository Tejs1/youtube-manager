import { and, eq } from "drizzle-orm";
import { env } from "@/env";
import { db } from "@/server/db";
import { accounts } from "@/server/db/schema";

type TokenResponse = {
	access_token: string;
	expires_in: number;
	scope?: string;
	token_type?: string;
	id_token?: string;
};

export async function getGoogleAccessToken(userId: string): Promise<string> {
	const [account] = await db
		.select()
		.from(accounts)
		.where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
		.limit(1);

	if (!account) {
		throw new Error("Google account not linked. Please sign in with Google.");
	}

	const nowSec = Math.floor(Date.now() / 1000);
	if (
		account.access_token &&
		account.expires_at &&
		account.expires_at > nowSec + 60
	) {
		return account.access_token;
	}

	if (!account.refresh_token) {
		throw new Error("Missing refresh token. Re-connect Google with consent.");
	}

	const body = new URLSearchParams({
		client_id: env.AUTH_GOOGLE_ID,
		client_secret: env.AUTH_GOOGLE_SECRET,
		refresh_token: account.refresh_token,
		grant_type: "refresh_token",
	});

	const res = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: body.toString(),
	});

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Failed to refresh token: ${res.status} ${text}`);
	}

	const data = (await res.json()) as TokenResponse;
	const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in ?? 0);

	await db
		.update(accounts)
		.set({
			access_token: data.access_token,
			expires_at: expiresAt,
			scope: data.scope,
			token_type: data.token_type,
			id_token: data.id_token,
		})
		.where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")));

	return data.access_token;
}

export async function youtubeFetch<T = unknown>(
	userId: string,
	path: string,
	opts?: {
		method?: string;
		query?: Record<string, string | number | boolean | undefined>;
		body?: unknown;
	},
): Promise<T> {
	const accessToken = await getGoogleAccessToken(userId);
	const base = "https://www.googleapis.com/youtube/v3";
	const url = new URL(base + path);
	if (opts?.query) {
		for (const [k, v] of Object.entries(opts.query)) {
			if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
		}
	}
	const res = await fetch(url.toString(), {
		method: opts?.method ?? "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: opts?.body ? JSON.stringify(opts.body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`YouTube API error ${res.status}: ${text}`);
	}
	return (await res.json()) as T;
}

export async function getMyChannelId(userId: string): Promise<string | null> {
	const data = await youtubeFetch<{ items?: Array<{ id: string }> }>(
		userId,
		"/channels",
		{
			query: { part: "id", mine: true },
		},
	);
	return data.items?.[0]?.id ?? null;
}
