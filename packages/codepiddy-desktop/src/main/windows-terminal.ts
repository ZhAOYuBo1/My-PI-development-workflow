import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type TerminalCursorStyle = "bar" | "block" | "underline";

export interface ResolvedTerminalProfile {
	name: string;
	command: string;
	args: string[];
	label: string;
	fontFamily: string | null;
	fontSize: number | null;
	cursorStyle: TerminalCursorStyle | null;
}

interface WindowsTerminalSettings {
	defaultProfile?: unknown;
	profiles?: unknown;
}

interface WindowsTerminalProfileEntry {
	guid?: unknown;
	name?: unknown;
	commandline?: unknown;
	source?: unknown;
	font?: unknown;
	cursorShape?: unknown;
}

// Windows Terminal 的配置位置：稳定版 / 预览版（打包版）+ 非打包版。
// 全部是标准路径，不依赖具体机器。
function windowsTerminalSettingsPaths(): string[] {
	const localAppData = process.env.LOCALAPPDATA;
	if (!localAppData) return [];
	return [
		path.join(localAppData, "Packages", "Microsoft.WindowsTerminal_8wekyb3d8bbwe", "LocalState", "settings.json"),
		path.join(
			localAppData,
			"Packages",
			"Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe",
			"LocalState",
			"settings.json",
		),
		path.join(localAppData, "Microsoft", "Windows Terminal", "settings.json"),
	];
}

// WT 的 settings.json 允许注释和尾逗号，先做一次容错清洗再 JSON.parse。
function stripJsonComments(value: string): string {
	let result = "";
	let inString = false;
	let inLineComment = false;
	let inBlockComment = false;
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		const next = value[index + 1];
		if (inLineComment) {
			if (char === "\n") {
				inLineComment = false;
				result += char;
			}
			continue;
		}
		if (inBlockComment) {
			if (char === "*" && next === "/") {
				inBlockComment = false;
				index += 1;
			}
			continue;
		}
		if (inString) {
			result += char;
			if (char === "\\") {
				result += next ?? "";
				index += 1;
				continue;
			}
			if (char === '"') inString = false;
			continue;
		}
		if (char === '"') {
			inString = true;
			result += char;
			continue;
		}
		if (char === "/" && next === "/") {
			inLineComment = true;
			index += 1;
			continue;
		}
		if (char === "/" && next === "*") {
			inBlockComment = true;
			index += 1;
			continue;
		}
		result += char;
	}
	return result.replace(/,\s*([}\]])/g, "$1");
}

function readSettingsFile(filePath: string): WindowsTerminalSettings | null {
	try {
		const raw = readFileSync(filePath, "utf8");
		const parsed = JSON.parse(stripJsonComments(raw)) as unknown;
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
		return parsed as WindowsTerminalSettings;
	} catch {
		return null;
	}
}

function expandEnvironmentVariables(value: string): string {
	return value.replace(/%([^%]+)%/g, (match, name: string) => process.env[name] ?? match);
}

// 把 WT 的 commandline 字符串拆成 command + args；支持双引号包裹的段。
function splitCommandLine(value: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let inQuotes = false;
	for (let index = 0; index < value.length; index += 1) {
		const char = value[index];
		if (char === "\\" && inQuotes && value[index + 1] === '"') {
			current += '"';
			index += 1;
			continue;
		}
		if (char === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (!inQuotes && /\s/.test(char)) {
			if (current) {
				tokens.push(current);
				current = "";
			}
			continue;
		}
		current += char;
	}
	if (current) tokens.push(current);
	return tokens;
}

let cachedPwshExecutable: string | null | undefined;

function resolvePwshExecutable(): string | null {
	if (cachedPwshExecutable !== undefined) return cachedPwshExecutable;
	cachedPwshExecutable = null;
	// Windows Terminal 的 PowershellCore profile 指向 Microsoft Store 版 PowerShell。
	// 用 Get-AppxPackage 拿真实安装路径：app execution alias 不能被 CreateProcess 直接启动，
	// 而 PATH 上又可能混进别的 pwsh（例如别的工具自带的运行时）。
	const windowsPowerShell = path.join(
		process.env.SystemRoot ?? "C:\\Windows",
		"System32",
		"WindowsPowerShell",
		"v1.0",
		"powershell.exe",
	);
	const probe = spawnSync(
		existsSync(windowsPowerShell) ? windowsPowerShell : "powershell.exe",
		[
			"-NoLogo",
			"-NoProfile",
			"-NonInteractive",
			"-Command",
			"(Get-AppxPackage -Name Microsoft.PowerShell | Select-Object -First 1).InstallLocation",
		],
		{ encoding: "utf8", windowsHide: true },
	);
	const installLocation = probe.status === 0 ? probe.stdout.trim() : "";
	if (installLocation) {
		const candidate = path.join(installLocation, "pwsh.exe");
		if (existsSync(candidate)) {
			cachedPwshExecutable = candidate;
			return cachedPwshExecutable;
		}
	}
	if (spawnSync("where.exe", ["pwsh.exe"], { windowsHide: true }).status === 0) {
		cachedPwshExecutable = "pwsh.exe";
		return cachedPwshExecutable;
	}
	return null;
}

function resolveProfileCommand(
	entry: WindowsTerminalProfileEntry,
): { command: string; args: string[]; label: string } | null {
	const rawCommandLine = typeof entry.commandline === "string" ? entry.commandline.trim() : "";
	if (rawCommandLine) {
		const tokens = splitCommandLine(expandEnvironmentVariables(rawCommandLine));
		const [command, ...args] = tokens;
		if (command) {
			return {
				command,
				args,
				label: typeof entry.name === "string" && entry.name ? entry.name : path.basename(command),
			};
		}
	}
	const source = typeof entry.source === "string" ? entry.source : "";
	const name = typeof entry.name === "string" && entry.name ? entry.name : "终端";
	if (source.includes("PowershellCore")) {
		const command = resolvePwshExecutable();
		if (command) return { command, args: [], label: name };
	}
	if (source.includes("Windows.Terminal.Powershell")) {
		const command = path.join(
			process.env.SystemRoot ?? "C:\\Windows",
			"System32",
			"WindowsPowerShell",
			"v1.0",
			"powershell.exe",
		);
		if (existsSync(command)) return { command, args: [], label: name };
	}
	if (source.includes("Wsl")) {
		const distro = typeof entry.name === "string" ? entry.name : "";
		return { command: "wsl.exe", args: distro ? ["-d", distro] : [], label: name };
	}
	return null;
}

function resolveFont(
	defaults: WindowsTerminalProfileEntry,
	entry: WindowsTerminalProfileEntry,
): { fontFamily: string | null; fontSize: number | null } {
	const merged = {
		...((typeof defaults.font === "object" && defaults.font !== null ? defaults.font : {}) as Record<
			string,
			unknown
		>),
		...((typeof entry.font === "object" && entry.font !== null ? entry.font : {}) as Record<string, unknown>),
	};
	const face = typeof merged.face === "string" && merged.face ? merged.face : null;
	const size = typeof merged.size === "number" && merged.size > 0 ? merged.size : null;
	return { fontFamily: face, fontSize: size };
}

function resolveCursorStyle(
	defaults: WindowsTerminalProfileEntry,
	entry: WindowsTerminalProfileEntry,
): TerminalCursorStyle | null {
	const raw = typeof entry.cursorShape === "string" ? entry.cursorShape : defaults.cursorShape;
	if (raw === "bar" || raw === "block" || raw === "underline") return raw;
	return null;
}

function profileList(settings: WindowsTerminalSettings): WindowsTerminalProfileEntry[] {
	const profiles = settings.profiles;
	if (typeof profiles !== "object" || profiles === null || Array.isArray(profiles)) return [];
	const list = (profiles as { list?: unknown }).list;
	if (!Array.isArray(list)) return [];
	return list.filter(
		(entry): entry is WindowsTerminalProfileEntry =>
			typeof entry === "object" && entry !== null && !Array.isArray(entry),
	);
}

function profileDefaults(settings: WindowsTerminalSettings): WindowsTerminalProfileEntry {
	const profiles = settings.profiles;
	if (typeof profiles !== "object" || profiles === null || Array.isArray(profiles)) return {};
	const defaults = (profiles as { defaults?: unknown }).defaults;
	if (typeof defaults !== "object" || defaults === null || Array.isArray(defaults)) return {};
	return defaults as WindowsTerminalProfileEntry;
}

/**
 * 读取本机 Windows Terminal 的默认 profile。找不到配置或解析失败时返回 null，
 * 由调用方回退到系统默认 shell。这里只读取标准配置路径，不做任何机器特定的写死。
 */
export function readWindowsTerminalProfile(): ResolvedTerminalProfile | null {
	if (process.platform !== "win32") return null;
	for (const settingsPath of windowsTerminalSettingsPaths()) {
		if (!existsSync(settingsPath)) continue;
		const settings = readSettingsFile(settingsPath);
		if (!settings) continue;
		const entries = profileList(settings);
		if (entries.length === 0) continue;
		const defaultProfile = typeof settings.defaultProfile === "string" ? settings.defaultProfile : "";
		const entry =
			entries.find((candidate) => typeof candidate.guid === "string" && candidate.guid === defaultProfile) ??
			entries.find((candidate) => candidate.source !== undefined) ??
			entries[0];
		if (!entry) continue;
		const resolved = resolveProfileCommand(entry);
		if (!resolved) continue;
		const defaults = profileDefaults(settings);
		const font = resolveFont(defaults, entry);
		return {
			name: typeof entry.name === "string" && entry.name ? entry.name : resolved.label,
			command: resolved.command,
			args: resolved.args,
			label: resolved.label,
			fontFamily: font.fontFamily,
			fontSize: font.fontSize,
			cursorStyle: resolveCursorStyle(defaults, entry),
		};
	}
	return null;
}
