import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { ProjectSummary, RecentProject } from "@codepiddy/shared";

interface StoredRecentProjectRow {
	id: string;
	name: string;
	root_path: string;
	last_opened_at: string;
}

interface LegacyRecentProject {
	id: string;
	name: string;
	rootPath: string;
	lastOpenedAt: string;
}

function isLegacyRecentProject(value: unknown): value is LegacyRecentProject {
	return (
		typeof value === "object" &&
		value !== null &&
		"id" in value &&
		typeof value.id === "string" &&
		"name" in value &&
		typeof value.name === "string" &&
		"rootPath" in value &&
		typeof value.rootPath === "string" &&
		"lastOpenedAt" in value &&
		typeof value.lastOpenedAt === "string"
	);
}

function pathKey(value: string): string {
	return path.resolve(value).toLowerCase();
}

export class RecentProjectStore {
	private readonly database: DatabaseSync;
	private readonly userDataPath: string;

	constructor(userDataPath: string, options: { discoverKnownRoots?: boolean } = {}) {
		this.userDataPath = userDataPath;
		const storageDirectory = path.join(userDataPath, "storage");
		mkdirSync(storageDirectory, { recursive: true });
		this.database = new DatabaseSync(path.join(storageDirectory, "codepiddy.sqlite"));
		this.database.exec(`
			PRAGMA journal_mode = WAL;
			PRAGMA foreign_keys = ON;
			CREATE TABLE IF NOT EXISTS recent_projects (
				root_key TEXT PRIMARY KEY,
				id TEXT NOT NULL,
				name TEXT NOT NULL,
				root_path TEXT NOT NULL,
				last_opened_at TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS app_state (
				key TEXT PRIMARY KEY,
				value TEXT
			);
		`);
		this.migrateLegacyFiles();
		this.recoverProjectsFromAgentRegistry();
		if (options.discoverKnownRoots !== false) this.discoverCodePIddyProjects();
	}

	private getState(key: string): string | null {
		const row = this.database.prepare("SELECT value FROM app_state WHERE key = ?").get(key) as
			| { value: string | null }
			| undefined;
		return row?.value ?? null;
	}

	private setState(key: string, value: string | null): void {
		this.database
			.prepare(
				"INSERT INTO app_state(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
			)
			.run(key, value);
	}

	private upsert(project: LegacyRecentProject): void {
		this.database
			.prepare(`
				INSERT INTO recent_projects(root_key, id, name, root_path, last_opened_at)
				VALUES(?, ?, ?, ?, ?)
				ON CONFLICT(root_key) DO UPDATE SET
					id = excluded.id,
					name = excluded.name,
					root_path = excluded.root_path,
					last_opened_at = excluded.last_opened_at
			`)
			.run(
				pathKey(project.rootPath),
				project.id,
				project.name,
				path.resolve(project.rootPath),
				project.lastOpenedAt,
			);
	}

	private migrateLegacyFiles(): void {
		if (this.getState("legacy_recent_projects_migrated") === "1") return;
		const recentPath = path.join(this.userDataPath, "settings", "recent-projects.json");
		const statePath = path.join(this.userDataPath, "settings", "project-state.json");
		this.database.exec("BEGIN IMMEDIATE");
		try {
			if (existsSync(recentPath)) {
				const parsed = JSON.parse(readFileSync(recentPath, "utf8")) as unknown;
				if (Array.isArray(parsed)) {
					for (const item of parsed) if (isLegacyRecentProject(item)) this.upsert(item);
				}
			}
			if (existsSync(statePath)) {
				const parsed = JSON.parse(readFileSync(statePath, "utf8")) as unknown;
				if (
					typeof parsed === "object" &&
					parsed !== null &&
					"activeProjectRoot" in parsed &&
					typeof parsed.activeProjectRoot === "string"
				) {
					this.setState("active_project_root", path.resolve(parsed.activeProjectRoot));
				}
			}
			this.setState("legacy_recent_projects_migrated", "1");
			this.database.exec("COMMIT");
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	private recoverProjectsFromAgentRegistry(): void {
		if (this.getState("agent_registry_projects_recovered") === "1") return;
		const projectsDirectory = path.join(this.userDataPath, "projects");
		if (!existsSync(projectsDirectory)) {
			this.setState("agent_registry_projects_recovered", "1");
			return;
		}
		for (const projectEntry of readdirSync(projectsDirectory, { withFileTypes: true })) {
			if (!projectEntry.isDirectory()) continue;
			const workItemsDirectory = path.join(projectsDirectory, projectEntry.name, "work-items");
			if (!existsSync(workItemsDirectory)) continue;
			let recovered: LegacyRecentProject | null = null;
			for (const workItemEntry of readdirSync(workItemsDirectory, { withFileTypes: true })) {
				if (!workItemEntry.isDirectory()) continue;
				const agentsDirectory = path.join(workItemsDirectory, workItemEntry.name, "agents");
				if (!existsSync(agentsDirectory)) continue;
				for (const roleEntry of readdirSync(agentsDirectory, { withFileTypes: true })) {
					if (!roleEntry.isDirectory()) continue;
					const metadataPath = path.join(agentsDirectory, roleEntry.name, "agent.json");
					if (!existsSync(metadataPath)) continue;
					try {
						const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
						if (typeof metadata.projectRoot !== "string" || !existsSync(metadata.projectRoot)) continue;
						recovered = {
							id: typeof metadata.projectId === "string" ? metadata.projectId : projectEntry.name,
							name: path.basename(metadata.projectRoot),
							rootPath: metadata.projectRoot,
							lastOpenedAt:
								typeof metadata.createdAt === "string"
									? metadata.createdAt
									: statSync(metadataPath).mtime.toISOString(),
						};
						break;
					} catch {}
				}
				if (recovered) break;
			}
			if (recovered) {
				const exists = this.database
					.prepare("SELECT 1 FROM recent_projects WHERE root_key = ?")
					.get(pathKey(recovered.rootPath));
				if (!exists) this.upsert(recovered);
			}
		}
		this.setState("agent_registry_projects_recovered", "1");
	}

	private discoverCodePIddyProjects(): void {
		if (this.getState("codepiddy_projects_discovered") === "1") return;
		const roots = ["Desktop", "Documents", "Downloads"]
			.map((name) => path.join(os.homedir(), name))
			.filter((directory) => existsSync(directory));
		const skipped = new Set(["node_modules", ".git", "AppData", "$Recycle.Bin"]);
		let visited = 0;
		for (const root of roots) {
			const queue: Array<{ directory: string; depth: number }> = [{ directory: root, depth: 0 }];
			while (queue.length > 0 && visited < 10_000) {
				const current = queue.shift();
				if (!current) break;
				visited += 1;
				const manifestPath = path.join(current.directory, ".codepiddy", "manifest.json");
				if (existsSync(manifestPath)) {
					try {
						const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
						if (typeof manifest.projectId === "string" && typeof manifest.name === "string") {
							const key = pathKey(current.directory);
							const exists = this.database.prepare("SELECT 1 FROM recent_projects WHERE root_key = ?").get(key);
							if (!exists) {
								this.upsert({
									id: manifest.projectId,
									name: manifest.name,
									rootPath: current.directory,
									lastOpenedAt: statSync(manifestPath).mtime.toISOString(),
								});
							}
						}
					} catch {}
					continue;
				}
				if (current.depth >= 5) continue;
				try {
					for (const entry of readdirSync(current.directory, { withFileTypes: true })) {
						if (!entry.isDirectory() || skipped.has(entry.name) || entry.name.startsWith(".")) continue;
						queue.push({ directory: path.join(current.directory, entry.name), depth: current.depth + 1 });
					}
				} catch {}
			}
		}
		this.setState("codepiddy_projects_discovered", "1");
	}

	async record(project: ProjectSummary): Promise<void> {
		const openedAt = new Date().toISOString();
		this.database.exec("BEGIN IMMEDIATE");
		try {
			this.upsert({ id: project.id, name: project.name, rootPath: project.rootPath, lastOpenedAt: openedAt });
			this.setState("active_project_root", path.resolve(project.rootPath));
			this.database
				.prepare(`
				DELETE FROM recent_projects
				WHERE root_key NOT IN (
					SELECT root_key FROM recent_projects ORDER BY last_opened_at DESC LIMIT 50
				)
			`)
				.run();
			this.database.exec("COMMIT");
		} catch (error) {
			this.database.exec("ROLLBACK");
			throw error;
		}
	}

	async getActiveProjectRoot(): Promise<string | null> {
		return this.getState("active_project_root");
	}

	async clearActiveProject(projectRoot?: string): Promise<void> {
		const current = this.getState("active_project_root");
		if (projectRoot && current && pathKey(current) !== pathKey(projectRoot)) return;
		this.setState("active_project_root", null);
	}

	async list(): Promise<RecentProject[]> {
		const rows = this.database
			.prepare("SELECT id, name, root_path, last_opened_at FROM recent_projects ORDER BY last_opened_at DESC")
			.all() as unknown as StoredRecentProjectRow[];
		return Promise.all(
			rows.map(async (row) => {
				try {
					await access(row.root_path);
					return {
						id: row.id,
						name: row.name,
						rootPath: row.root_path,
						lastOpenedAt: row.last_opened_at,
						available: true,
					};
				} catch {
					return {
						id: row.id,
						name: row.name,
						rootPath: row.root_path,
						lastOpenedAt: row.last_opened_at,
						available: false,
					};
				}
			}),
		);
	}

	async forget(projectRoot: string): Promise<RecentProject[]> {
		this.database.prepare("DELETE FROM recent_projects WHERE root_key = ?").run(pathKey(projectRoot));
		await this.clearActiveProject(projectRoot);
		return this.list();
	}

	close(): void {
		this.database.close();
	}
}
