import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { act, createElement } from "react";
import { JSDOM } from "jsdom";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";

const storageKey = "dashboard.rememberedEmail";
const email = "member@example.com";
const dom = new JSDOM("<div id='root'></div>", { url: "https://dashboard.example" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let server;
let App;
let root;
let createRoot;
let requests;
let loginStatus;
let sessionStatus;

before(async () => {
	({ createRoot } = await import("react-dom/client"));
	server = await createServer({
		configFile: false,
		plugins: [react()],
		server: { middlewareMode: true, watch: null },
	});
	({ default: App } = await server.ssrLoadModule("/src/react-app/App.tsx"));
});

beforeEach(() => {
	globalThis.localStorage = dom.window.localStorage;
	localStorage.clear();
	requests = [];
	loginStatus = 200;
	sessionStatus = 401;
	globalThis.fetch = async (path, options) => {
		requests.push({ path, options });
		const status = path === "/api/session" ? sessionStatus : loginStatus;
		return Response.json(
			status === 200 ? { email } : { error: "Access denied." },
			{ status },
		);
	};
	root = createRoot(document.getElementById("root"));
});

afterEach(async () => {
	await act(async () => root.unmount());
});

after(async () => {
	await server?.close();
	dom.window.close();
});

async function render() {
	await act(async () => root.render(createElement(App)));
}

async function submit() {
	await act(async () => {
		document.querySelector("form").dispatchEvent(
			new window.Event("submit", { bubbles: true, cancelable: true }),
		);
	});
}

test("successful email entry is remembered across visits and checked again", async () => {
	await render();
	const input = document.querySelector("input");
	await act(async () => {
		Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, email);
		input.dispatchEvent(new window.Event("input", { bubbles: true }));
	});
	await submit();
	assert.match(document.body.textContent, /You have access as/);
	assert.equal(localStorage.getItem(storageKey), email);
	await act(async () => document.querySelector("button").click());
	assert.equal(document.querySelector("button").textContent, `Continue as ${email}`);
	assert.equal(localStorage.getItem(storageKey), email);
	await act(async () => root.unmount());
	root = createRoot(document.getElementById("root"));
	await render();
	assert.equal(document.querySelector("button").textContent, `Continue as ${email}`);
	await submit();
	const logins = requests.filter(({ path }) => path === "/api/login");
	assert.equal(logins.length, 2);
	assert.deepEqual(JSON.parse(logins[1].options.body), { email });
});

test("a remembered email never grants access when the server rejects it", async () => {
	localStorage.setItem(storageKey, email);
	loginStatus = 403;
	await render();
	assert.equal(document.querySelector("input"), null);
	await submit();
	assert.equal(document.querySelector("[role='alert']").textContent, "Access denied.");
	assert.doesNotMatch(document.body.textContent, /You have access as/);
	await act(async () => {
		document.querySelector("button.secondary").click();
	});
	assert.equal(localStorage.getItem(storageKey), null);
	assert.ok(document.querySelector("input"));
	assert.equal(document.querySelector("[role='alert']"), null);
});

test("an existing session offers Continue rather than skipping the returning-user screen", async () => {
	sessionStatus = 200;
	await render();
	assert.equal(document.querySelector("button").textContent, `Continue as ${email}`);
	assert.equal(localStorage.getItem(storageKey), email);
	assert.doesNotMatch(document.body.textContent, /You have access as/);
	await submit();
	assert.match(document.body.textContent, /You have access as/);
});

test("unavailable browser storage does not prevent admission", async () => {
	sessionStatus = 200;
	globalThis.localStorage = {
		getItem() { throw new Error("Storage blocked"); },
		setItem() { throw new Error("Storage blocked"); },
	};
	await render();
	await submit();
	assert.match(document.body.textContent, /You have access as/);
});
