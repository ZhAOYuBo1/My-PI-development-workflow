import { getNonEmptyString } from "./common.ts";

export type PermissionDecisionState = "approved" | "denied" | "denied_with_reason" | "once" | "always" | "reject";

export type PermissionPromptDecision = {
	approved: boolean;
	state: PermissionDecisionState;
	denialReason?: string;
};

export interface PermissionDecisionUiSelectOptions {
	timeout?: number;
}

export interface PermissionDecisionUi {
	select(
		title: string,
		options: string[],
		optionsOverride?: PermissionDecisionUiSelectOptions,
	): Promise<string | undefined>;
	input(title: string, placeholder?: string): Promise<string | undefined>;
}

export type PermissionDecisionRequestOptions = {
	timeoutMs?: number;
	timeoutDenialReason?: string;
};

/**
 * 弹窗选项。桌面端把这个列表原样渲染成按钮，所以文案是这个界面的唯一真相源。
 *
 * 之前这里是英文，而整个客户端都是中文 —— 权限请求恰好是安全最关键的一次交互，
 * 却是唯一没翻译的地方。桌面端还靠 `option.startsWith("Allow")` 猜哪个是主按钮，
 * 改一次文案样式就错位。现在标签与语义一起导出，桌面端按标签查表，
 * `permission-settings.test.ts` 会断言两边覆盖同一组标签。
 */
export const PERMISSION_DECISION_LABELS = {
	once: "仅本次允许",
	always: "该 Agent 始终允许",
	reject: "拒绝",
	reject_with_reason: "拒绝并说明原因",
} as const;

export type PermissionDecisionOptionId = keyof typeof PERMISSION_DECISION_LABELS;

/** 按展示顺序排列：先放放行，再放拒绝，默认焦点落在第一个。 */
export const PERMISSION_DECISION_OPTION_IDS = [
	"once",
	"always",
	"reject",
	"reject_with_reason",
] as const satisfies readonly PermissionDecisionOptionId[];

export const PERMISSION_DECISION_OPTIONS: readonly string[] = PERMISSION_DECISION_OPTION_IDS.map(
	(id) => PERMISSION_DECISION_LABELS[id],
);

/** 桌面上被点中的标签还原成语义 id；认不出来的标签一律按拒绝处理。 */
export function permissionDecisionIdForLabel(label: string | undefined): PermissionDecisionOptionId | undefined {
	if (label === undefined) return undefined;
	return PERMISSION_DECISION_OPTION_IDS.find((id) => PERMISSION_DECISION_LABELS[id] === label);
}
const PERMISSION_DIALOG_MAX_VISIBLE_LINES = 32;
const PERMISSION_DIALOG_MAX_VISIBLE_CHARACTERS = 2_200;

function splitPromptLines(value: string): string[] {
	return value.split(/\r\n|\r|\n/);
}

function formatPromptCompactionNotice(omittedLines: number, omittedCharacters: number): string {
	const omittedParts = [
		omittedLines > 0 ? `${omittedLines} ${omittedLines === 1 ? "line" : "lines"}` : null,
		omittedCharacters > 0 ? `${omittedCharacters} ${omittedCharacters === 1 ? "character" : "characters"}` : null,
	].filter((part): part is string => typeof part === "string");
	const omittedSummary = omittedParts.length > 0 ? omittedParts.join(" and ") : "content";
	return `[Permission prompt compacted: omitted ${omittedSummary} to keep the permission dialog usable.]`;
}

function compactPermissionPromptForSelect(value: string): string {
	const lines = splitPromptLines(value);
	if (
		lines.length <= PERMISSION_DIALOG_MAX_VISIBLE_LINES &&
		value.length <= PERMISSION_DIALOG_MAX_VISIBLE_CHARACTERS
	) {
		return value;
	}

	const maxPrefixLines = Math.max(1, PERMISSION_DIALOG_MAX_VISIBLE_LINES - 1);
	const prefixLines = lines.slice(0, maxPrefixLines);
	const omittedLines = Math.max(0, lines.length - prefixLines.length);
	let prefix = prefixLines.join("\n");

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const omittedCharacters = Math.max(0, value.length - prefix.length);
		const notice = formatPromptCompactionNotice(omittedLines, omittedCharacters);
		const separatorLength = prefix.trimEnd() ? 1 : 0;
		const maxPrefixCharacters = Math.max(
			0,
			PERMISSION_DIALOG_MAX_VISIBLE_CHARACTERS - notice.length - separatorLength,
		);

		if (prefix.length <= maxPrefixCharacters) {
			return prefix.trimEnd() ? `${prefix.trimEnd()}\n${notice}` : notice;
		}

		prefix = prefix.slice(0, maxPrefixCharacters).trimEnd();
	}

	const omittedCharacters = Math.max(0, value.length - prefix.length);
	const notice = formatPromptCompactionNotice(omittedLines, omittedCharacters);
	return prefix.trimEnd() ? `${prefix.trimEnd()}\n${notice}` : notice;
}

export function normalizePermissionDenialReason(value: unknown): string | undefined {
	return getNonEmptyString(value) ?? undefined;
}

export function createDeniedPermissionDecision(denialReason?: string): PermissionPromptDecision {
	const normalizedReason = normalizePermissionDenialReason(denialReason);
	return normalizedReason
		? {
				approved: false,
				state: "denied_with_reason",
				denialReason: normalizedReason,
			}
		: {
				approved: false,
				state: "denied",
			};
}

export function isPermissionDecisionState(value: unknown): value is PermissionDecisionState {
	return (
		value === "approved" ||
		value === "denied" ||
		value === "denied_with_reason" ||
		value === "once" ||
		value === "always" ||
		value === "reject"
	);
}

export async function requestPermissionDecisionFromUi(
	ui: PermissionDecisionUi,
	title: string,
	message: string,
	options: PermissionDecisionRequestOptions = {},
): Promise<PermissionPromptDecision> {
	const selectOptions =
		typeof options.timeoutMs === "number" && Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
			? { timeout: options.timeoutMs }
			: undefined;
	const selected = await ui.select(
		compactPermissionPromptForSelect(`${title}\n${message}`),
		[...PERMISSION_DECISION_OPTIONS],
		selectOptions,
	);
	const decisionId = permissionDecisionIdForLabel(selected);

	if (decisionId === "once") {
		return {
			approved: true,
			state: "once",
		};
	}

	if (decisionId === "always") {
		return {
			approved: true,
			state: "always",
		};
	}

	if (decisionId === "reject_with_reason") {
		const denialReason = normalizePermissionDenialReason(
			await ui.input(`${title}\nShare why this request was denied (optional).`, "Reason shown back to the agent"),
		);

		return denialReason ? { approved: false, state: "reject", denialReason } : { approved: false, state: "reject" };
	}

	return options.timeoutDenialReason
		? { approved: false, state: "reject", denialReason: options.timeoutDenialReason }
		: { approved: false, state: "reject" };
}
