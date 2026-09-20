import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
	AgentRole,
	AgentUiState,
	LaneKind,
	ProjectSummary,
	ProjectUiState,
	RecentProject,
} from "@codepiddy/shared";

interface StoredRecentProjectRow {
	id: string;
	name: string;
	root_path: string;
	last_opened_at: string;
}

export interface StoredWindowState {
	x: number;
	y: number;
	width: number;
	height: number;
	maximized: boolean;
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
			CREATE TABLE IF NOT EXISTS project_ui_state (
				root_key TEXT PRIMARY KEY,
				root_path TEXT NOT NULL,
				selection_type TEXT NOT NULL,
				lane TEXT,
				work_item_id TEXT,
				agent_role TEXT,
				expanded_keys TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS agent_ui_state (
				agent_instance_id TEXT PRIMARY KEY,
				draft TEXT NOT NULL,
				scroll_top REAL NOT NULL,
				unread_count INTEGER NOT NULL,
				updated_at TEXT NOT NULL
			);
			CREATE TABLE IF NOT EXISTS window_state (
				window_key TEXT PRIMARY KEY,
				x INTEGER NOT NULL,
				y INTEGER NOT NULL,
				width INTEGER NOT NULL,
				height INTEGER NOT NULL,
				maximized INTEGER NOT NULL
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

	async getProjectUiState(projectRoot: string): Promise<ProjectUiState | null> {
		const row = this.database
			.prepare(
				"SELECT root_path, selection_type, lane, work_item_id, agent_role, expanded_keys FROM project_ui_state WHERE root_key = ?",
			)
			.get(pathKey(projectRoot)) as
			| {
					root_path: string;
					selection_type: ProjectUiState["selectionType"];
					lane: LaneKind | null;
					work_item_id: string | null;
					agent_role: AgentRole | null;
					expanded_keys: string;
			  }
			| undefined;
		if (!row) return null;
		let expandedKeys: string[] = [];
		try {
			const parsed = JSON.parse(row.expanded_keys) as unknown;
			if (Array.isArray(parsed)) expandedKeys = parsed.filter((item): item is string => typeof item === "string");
		} catch {}
		return {
			projectRoot: row.root_path,
			selectionType: row.selection_type,
			...(row.lane ? { lane: row.lane } : {}),
			...(row.work_item_id ? { workItemId: row.work_item_id } : {}),
			...(row.agent_role ? { role: row.agent_role } : {}),
			expandedKeys,
		};
	}

	async saveProjectUiState(state: ProjectUiState): Promise<void> {
		this.database
			.prepare(`
				INSERT INTO project_ui_state(root_key, root_path, selection_type, lane, work_item_id, agent_role, expanded_keys, updated_at)
				VALUES(?, ?, ?, ?, ?, ?, ?, ?)
				ON CONFLICT(root_key) DO UPDATE SET
					root_path = excluded.root_path,
					selection_type = excluded.selection_type,
					lane = excluded.lane,
					work_item_id = excluded.work_item_id,
					agent_role = excluded.agent_role,
					expanded_keys = excluded.expanded_keys,
					updated_at = excluded.updated_at
			`)
			.run(
				pathKey(state.projectRoot),
				path.resolve(state.projectRoot),
				state.selectionType,
				state.lane ?? null,
				state.workItemId ?? null,
				state.role ?? null,
				JSON.stringify([...new Set(state.expandedKeys)]),
				new Date().toISOString(),
			);
	}

	async getAgentUiState(agentInstanceId: string): Promise<AgentUiState | null> {
		const row = this.database
			.prepare("SELECT draft, scroll_top, unread_count FROM agent_ui_state WHERE agent_instance_id = ?")
			.get(agentInstanceId) as { draft: string; scroll_top: number; unread_count: number } | undefined;
		return row
			? { agentInstanceId, draft: row.draft, scrollTop: row.scroll_top, unreadCount: row.unread_count }
			: null;
	}

	async saveAgentUiState(state: AgentUiState): Promise<void> {
		this.database
			.prepare(`
				INSERT INTO agent_ui_state(agent_instance_id, draft, scroll_top, unread_count, updated_at)
				VALUES(?, ?, ?, ?, ?)
				ON CONFLICT(agent_instance_id) DO UPDATE SET
					draft = excluded.draft,
					scroll_top = excluded.scroll_top,
					unread_count = excluded.unread_count,
					updated_at = excluded.updated_at
			`)
			.run(state.agentInstanceId, state.draft, state.scrollTop, state.unreadCount, new Date().toISOString());
	}

	deleteAgentUiState(agentInstanceId: string): void {
		this.database.prepare("DELETE FROM agent_ui_state WHERE agent_instance_id = ?").run(agentInstanceId);
	}

	getWindowState(windowKey = "main"): StoredWindowState | null {
		const row = this.database
			.prepare("SELECT x, y, width, height, maximized FROM window_state WHERE window_key = ?")
			.get(windowKey) as (Omit<StoredWindowState, "maximized"> & { maximized: number }) | undefined;
		return row ? { ...row, maximized: row.maximized === 1 } : null;
	}

	saveWindowState(state: StoredWindowState, windowKey = "main"): void {
		this.database
			.prepare(`
				INSERT INTO window_state(window_key, x, y, width, height, maximized)
				VALUES(?, ?, ?, ?, ?, ?)
				ON CONFLICT(window_key) DO UPDATE SET
					x = excluded.x,
					y = excluded.y,
					width = excluded.width,
					height = excluded.height,
					maximized = excluded.maximized
			`)
			.run(windowKey, state.x, state.y, state.width, state.height, state.maximized ? 1 : 0);
	}

	close(): void {
		this.database.close();
	}
}
