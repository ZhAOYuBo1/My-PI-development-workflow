import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const outputRoot = path.join(repositoryRoot, ".artifacts", "codepiddy-runtime");

await rm(outputRoot, { force: true, recursive: true });
await mkdir(path.join(outputRoot, "extensions"), { recursive: true });
await mkdir(path.join(outputRoot, "mcp"), { recursive: true });
await mkdir(path.join(outputRoot, "skills"), { recursive: true });
await mkdir(path.join(outputRoot, "dependencies", "@earendil-works", "chord"), { recursive: true });

const common = {
	absWorkingDir: repositoryRoot,
	bundle: true,
	format: "esm",
	legalComments: "none",
	ignoreAnnotations: true,
	minify: true,
	platform: "node",
	target: "node22.19",
};

await Promise.all([
	build({
		...common,
		alias: {
			"jsonc-parser": path.join(repositoryRoot, "node_modules", "jsonc-parser", "lib", "esm", "main.js"),
		},
		entryPoints: [path.join(repositoryRoot, "packages", "codepiddy-permission-extension", "index.ts")],
		outfile: path.join(outputRoot, "extensions", "permission.js"),
	}),
	build({
		...common,
		entryPoints: [path.join(repositoryRoot, "packages", "codepiddy-tavily-tool-extension", "index.ts")],
		outfile: path.join(outputRoot, "extensions", "tavily-tool.js"),
	}),
	build({
		...common,
		entryPoints: [path.join(repositoryRoot, "packages", "codepiddy-tavily-search-mcp", "src", "index.ts")],
		outfile: path.join(outputRoot, "mcp", "tavily-search.js"),
	}),
]);

await Promise.all([
	cp(
		path.join(repositoryRoot, "packages", "codepiddy-agent-skills"),
		path.join(outputRoot, "skills"),
		{ recursive: true },
	),
	cp(
		path.join(repositoryRoot, "packages", "coding-agent", "dist"),
		path.join(outputRoot, "coding-agent-package", "dist"),
		{ recursive: true },
	),
	cp(
		path.join(repositoryRoot, "packages", "coding-agent", "package.json"),
		path.join(outputRoot, "coding-agent-package", "package.json"),
	),
	cp(path.join(repositoryRoot, "packages", "chord", "dist"), path.join(outputRoot, "dependencies", "@earendil-works", "chord", "dist"), {
		recursive: true,
	}),
	cp(path.join(repositoryRoot, "packages", "chord", "package.json"), path.join(outputRoot, "dependencies", "@earendil-works", "chord", "package.json")),
	cp(path.join(repositoryRoot, "node_modules", "npm"), path.join(outputRoot, "npm"), { recursive: true }),
	cp(path.join(repositoryRoot, "node_modules", "jiti"), path.join(outputRoot, "dependencies", "jiti"), { recursive: true }),
	cp(
		path.join(repositoryRoot, "node_modules", "@silvia-odwyer", "photon-node"),
		path.join(outputRoot, "dependencies", "@silvia-odwyer", "photon-node"),
		{ recursive: true },
	),
]);

const jitiPackagePath = path.join(outputRoot, "dependencies", "jiti", "package.json");
const jitiPackage = JSON.parse(await readFile(jitiPackagePath, "utf8"));
delete jitiPackage.devDependencies;
delete jitiPackage.scripts;
delete jitiPackage.packageManager;
await writeFile(jitiPackagePath, `${JSON.stringify(jitiPackage, null, 2)}\n`, "utf8");

console.log(`Prepared packaged runtime at ${outputRoot}`);
