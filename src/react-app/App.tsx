import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import "./App.css";

type User = { email: string };
const rememberedEmailKey = "dashboard.rememberedEmail";

function readRememberedEmail() {
	try {
		return localStorage.getItem(rememberedEmailKey) ?? "";
	} catch {
		return "";
	}
}

function storeRememberedEmail(email: string) {
	try {
		if (email) localStorage.setItem(rememberedEmailKey, email);
		else localStorage.removeItem(rememberedEmailKey);
	} catch {
		// Admission still works when browser storage is unavailable.
	}
}

async function readUser(response: Response): Promise<User> {
	const data = await response.json() as User & { error?: string };
	if (!response.ok) {
		throw new Error(data.error ?? "Unable to connect. Please try again.");
	}
	return { email: data.email };
}

function App() {
	const [user, setUser] = useState<User | null>(null);
	const [email, setEmail] = useState("");
	const [rememberedEmail, setRememberedEmail] = useState(readRememberedEmail);
	const [checking, setChecking] = useState(true);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const controller = new AbortController();
		fetch("/api/session", { signal: controller.signal })
			.then(async (response) => {
				if (response.status !== 401) {
					const previousUser = await readUser(response);
					if (!controller.signal.aborted) {
						storeRememberedEmail(previousUser.email);
						setRememberedEmail(previousUser.email);
					}
				}
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError("Unable to check access. Please try again.");
				}
			})
			.finally(() => {
				if (!controller.signal.aborted) setChecking(false);
			});
		return () => controller.abort();
	}, []);

	async function signIn(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: rememberedEmail || email }),
			});
			const admittedUser = await readUser(response);
			storeRememberedEmail(admittedUser.email);
			setRememberedEmail(admittedUser.email);
			setUser(admittedUser);
			setEmail("");
		} catch (error) {
			setError(error instanceof Error ? error.message : "Unable to connect. Please try again.");
		} finally {
			setBusy(false);
		}
	}

	async function signOut() {
		setBusy(true);
		setError("");
		try {
			const response = await fetch("/api/logout", { method: "POST" });
			if (!response.ok) throw new Error("Unable to sign out. Please try again.");
			setUser(null);
		} catch (error) {
			setError(error instanceof Error ? error.message : "Unable to connect. Please try again.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="card">
			<h1>High Council Dashboard</h1>
			{checking ? <p role="status">Checking access...</p> : user ? (
				<>
					<h2>Welcome</h2>
					<p>You have access as <strong>{user.email}</strong>.</p>
					<button onClick={signOut} disabled={busy}>
						{busy ? "Signing out..." : "Sign out"}
					</button>
				</>
			) : (
				<>
					<p>{rememberedEmail
						? "Welcome back. Continue with your remembered email address."
						: "Enter your approved email address to continue."}</p>
					<form onSubmit={signIn}>
						{!rememberedEmail && (
							<>
								<label htmlFor="email">Email address</label>
								<input
									id="email"
									name="email"
									type="email"
									autoComplete="email"
									autoCapitalize="none"
									spellCheck={false}
									maxLength={254}
									required
									value={email}
									onChange={(event) => setEmail(event.target.value)}
									disabled={busy}
									aria-describedby={error ? "access-error" : undefined}
								/>
							</>
						)}
						<button type="submit" disabled={busy}>
							{busy ? "Checking..." : rememberedEmail ? `Continue as ${rememberedEmail}` : "Continue"}
						</button>
						{rememberedEmail && (
							<button
								type="button"
								className="secondary"
								disabled={busy}
								onClick={() => {
									storeRememberedEmail("");
									setRememberedEmail("");
									setEmail("");
									setError("");
								}}
							>
								Use a different email
							</button>
						)}
					</form>
				</>
			)}
			{error && <p id="access-error" role="alert">{error}</p>}
		</main>
	);
}

export default App;
