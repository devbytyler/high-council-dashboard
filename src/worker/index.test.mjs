import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { setSignedCookie } from "hono/cookie";
import app from "./index.ts";

const env = {
	ALLOWED_EMAILS: " member@example.com , second@example.com ",
	SESSION_SECRET: "test-only-secret-that-is-at-least-32-characters",
};
const origin = "https://dashboard.example";

function request(path, { method = "GET", cookie, body, requestOrigin = origin } = {}, bindings = env) {
	return app.request(`${origin}${path}`, {
		method,
		headers: {
			Origin: requestOrigin,
			...(cookie ? { Cookie: cookie } : {}),
			...(body !== undefined ? { "Content-Type": "application/json" } : {}),
		},
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
	}, bindings);
}

async function login() {
	const response = await request("/api/login", {
		method: "POST", body: { email: " MEMBER@Example.com " },
	});
	assert.equal(response.status, 200);
	return response.headers.get("set-cookie").split(";")[0];
}

test("approved email receives a secure session usable by protected APIs", async () => {
	const response = await request("/api/login", {
		method: "POST", body: { email: " MEMBER@Example.com " },
	});
	assert.equal(response.status, 200);
	assert.deepEqual(await response.json(), { email: "member@example.com" });
	const setCookie = response.headers.get("set-cookie");
	for (const attribute of ["HttpOnly", "Secure", "SameSite=Strict", "Max-Age=86400"]) {
		assert.ok(setCookie.includes(attribute));
	}
	const cookie = setCookie.split(";")[0];
	const session = await request("/api/session", { cookie });
	assert.deepEqual(await session.json(), { email: "member@example.com" });
	assert.equal(session.headers.get("cache-control"), "no-store");
	assert.equal((await request("/api/", { cookie })).status, 200);
});

test("unapproved and malformed emails are rejected without issuing cookies", async () => {
	for (const [email, status] of [
		["stranger@example.com", 403], ["member@example.com.evil", 403],
		["invalid", 400], ["", 400], [null, 400],
	]) {
		const response = await request("/api/login", { method: "POST", body: { email } });
		assert.equal(response.status, status);
		assert.equal(response.headers.get("set-cookie"), null);
	}
	const malformed = await app.request(`${origin}/api/login`, {
		method: "POST", headers: { Origin: origin }, body: "{",
	}, env);
	assert.equal(malformed.status, 400);
});

test("missing, forged and revoked sessions cannot access protected routes", async () => {
	assert.equal((await request("/api/")).status, 401);
	assert.equal((await request("/api/session", { cookie: "dashboard_session=forged" })).status, 401);
	const cookie = await login();
	assert.equal((await request("/api/session", {
		cookie: cookie.replace("dashboard_session=", "dashboard_session=x"),
	})).status, 401);
	assert.equal((await request("/api/session", { cookie }, {
		...env, ALLOWED_EMAILS: "second@example.com",
	})).status, 401);
	assert.equal((await request("/api/", { cookie }, {
		...env, SESSION_SECRET: `${env.SESSION_SECRET}-rotated`,
	})).status, 401);
});

test("expired and malformed signed sessions are rejected server-side", async () => {
	for (const value of [
		JSON.stringify({ email: "member@example.com", expiresAt: Date.now() - 1000 }),
		JSON.stringify({ email: "member@example.com" }),
		"invalid-json",
	]) {
		const signer = new Hono();
		signer.get("/", async (c) => {
			await setSignedCookie(c, "dashboard_session", value, env.SESSION_SECRET);
			return c.text("");
		});
		const signed = await signer.request(origin);
		const cookie = signed.headers.get("set-cookie").split(";")[0];
		assert.equal((await request("/api/session", { cookie })).status, 401);
	}
});

test("configuration fails closed and cross-origin state changes are denied", async () => {
	for (const bindings of [{}, { ...env, SESSION_SECRET: "short" }, { ...env, ALLOWED_EMAILS: "" }]) {
		assert.equal((await request("/api/", {}, bindings)).status, 503);
	}
	for (const path of ["/api/login", "/api/logout"]) {
		assert.equal((await request(path, {
			method: "POST", requestOrigin: "https://other.example",
			body: { email: "member@example.com" },
		})).status, 403);
	}
});

test("logout clears the browser session cookie", async () => {
	const cookie = await login();
	const response = await request("/api/logout", { method: "POST", cookie });
	assert.equal(response.status, 200);
	assert.match(response.headers.get("set-cookie"), /dashboard_session=;.*Max-Age=0/);
});
