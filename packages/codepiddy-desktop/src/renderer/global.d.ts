import type { CodePIddyClientApi } from "@codepiddy/shared";

declare global {
	interface Window {
		codepiddy: CodePIddyClientApi;
	}
}
