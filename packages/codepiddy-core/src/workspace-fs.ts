import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { WorkspaceDirEntry, WorkspaceFileContent } from "@codepiddy/shared";

const TEXT_LIMIT_BYTES = 512 * 1024;
const IMAGE_LIMIT_BYTES = 8 * 1024 * 1024;

const imageMimeByExtension = new Map([
	[".png", "image/png"],
	[".jpg", "image/jpeg"],
	[".jpeg", "image/jpeg"],
	[".gif", "image/gif"],
	[".webp", "image/webp"],
	[".svg", "image/svg+xml"],
	[".bmp", "image/bmp"],
	[".ico", "image/x-icon"],
]);

/** 相对路径钳制在项目根内，越界抛错（主进程透传给渲染进程展示）。 */
function resolveInside(projectRoot: string, relativePath: string): string {
	const root = path.resolve(projectRoot);
	const absolute = path.resolve(root, relativePath || ".");
	if (absolute !== root && !absolute.startsWith(root + path.sep))
		throw new Error(`路径超出项目范围：${relativePath || "."}`);
	return absolute;
}

/** 列单层目录：目录优先、名称不区分大小写排序，附文件大小。 */
export async function listWorkspaceDir(projectRoot: string, relativeDir: string): Promise<WorkspaceDirEntry[]> {
	const directory = resolveInside(projectRoot, relativeDir);
	const dirents = await readdir(directory, { withFileTypes: true });
	const entries: WorkspaceDirEntry[] = [];
	for (const dirent of dirents) {
		if (dirent.isDirectory()) {
			entries.push({ name: dirent.name, kind: "dir", size: 0 });
			continue;
		}
		if (!dirent.isFile()) continue;
		let size = 0;
		try {
			size = (await stat(path.join(directory, dirent.name))).size;
		} catch {}
		entries.push({ name: dirent.name, kind: "file", size });
	}
	return entries.sort(
		(left, right) =>
			(left.kind === right.kind ? 0 : left.kind === "dir" ? -1 : 1) ||
			left.name.toLowerCase().localeCompare(right.name.toLowerCase()),
	);
}

/**
 * 读单个文件：图片转 dataUrl，大文件与二进制只报 kind 不给内容
 * （调用方展示空态，避免渲染进程载入乱码与巨内容）。
 */
export async function readWorkspaceFile(projectRoot: string, relativePath: string): Promise<WorkspaceFileContent> {
	const absolute = resolveInside(projectRoot, relativePath);
	const fileStat = await stat(absolute);
	if (!fileStat.isFile()) throw new Error(`不是文件：${relativePath}`);
	const size = fileStat.size;
	const mime = imageMimeByExtension.get(path.extname(absolute).toLowerCase());
	if (mime) {
		if (size > IMAGE_LIMIT_BYTES) return { kind: "tooLarge", size };
		const buffer = await readFile(absolute);
		return { kind: "image", size, dataUrl: `data:${mime};base64,${buffer.toString("base64")}` };
	}
	if (size > TEXT_LIMIT_BYTES) return { kind: "tooLarge", size };
	const buffer = await readFile(absolute);
	if (buffer.subarray(0, 8192).includes(0)) return { kind: "binary", size };
	return { kind: "text", size, content: buffer.toString("utf8") };
}
