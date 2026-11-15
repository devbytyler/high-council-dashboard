import { Hono } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";

type Bindings = {
	ALLOWED_EMAILS?: string;
	SESSION_SECRET?: string;
};

const app = new Hono<{
	Bindings: Bindings;
	Variables: { email: string };
}>();
const sessionCookie = "dashboard_session";
const sessionDuration = 24 * 60 * 60;

app.use("/api/*", async (c, next) => {
	c.header("Cache-Control", "no-store");
	if (
		!c.env.ALLOWED_EMAILS?.trim() ||
		!c.env.SESSION_SECRET ||
		c.env.SESSION_SECRET.length < 32
	) {
		return c.json({ error: "Access is not configured. Contact the administrator." }, 503);
	}
	if (
		c.req.method !== "GET" &&
		c.req.header("Origin") !== new URL(c.req.url).origin
	) {
		return c.json({ error: "Request not permitted." }, 403);
	}
	await next();
});

function allowedEmails(value: string) {
	return value.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
}

app.post("/api/login", async (c) => {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: "Provide a valid email address." }, 400);
	}
	const email = (
		typeof body === "object" && body !== null && "email" in body &&
		typeof body.email === "string" ? body.email : ""
	).trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
		return c.json({ error: "Provide a valid email address." }, 400);
	}
	if (!allowedEmails(c.env.ALLOWED_EMAILS!).includes(email)) {
		return c.json({ error: "Unable to grant access with that email address." }, 403);
	}

	await setSignedCookie(
		c,
		sessionCookie,
		JSON.stringify({ email, expiresAt: Date.now() + sessionDuration * 1000 }),
		c.env.SESSION_SECRET!,
		{
			httpOnly: true,
			secure: new URL(c.req.url).protocol === "https:",
			sameSite: "Strict",
			path: "/",
			maxAge: sessionDuration,
		},
	);
	return c.json({ email });
});

app.post("/api/logout", (c) => {
	deleteCookie(c, sessionCookie, { path: "/" });
	return c.json({ success: true });
});

app.use("/api/*", async (c, next) => {
	const cookie = await getSignedCookie(c, c.env.SESSION_SECRET!, sessionCookie);
	let session: unknown;
	if (cookie) {
		try {
			session = JSON.parse(cookie);
		} catch {
			// Invalid session data is treated as signed out.
		}
	}
	if (
		typeof session === "object" && session !== null &&
		"email" in session && typeof session.email === "string" &&
		"expiresAt" in session && typeof session.expiresAt === "number" &&
		session.expiresAt > Date.now() &&
		allowedEmails(c.env.ALLOWED_EMAILS!).includes(session.email)
	) {
		c.set("email", session.email);
		return next();
	}
	deleteCookie(c, sessionCookie, { path: "/" });
	return c.json({ error: "Enter an approved email address to continue." }, 401);
});

app.get("/api/session", (c) => c.json({ email: c.get("email") }));
app.get("/api/", (c) => c.json({ name: "High Council Dashboard" }));

export default app;
