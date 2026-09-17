# ADR-0007：只提供基于 Tavily Search API 的 Web Search MCP

- 状态：已接受
- 日期：2026-09-15

## 背景

CodePIddy 的 Agent 需要搜索当前网络信息，但 MVP 不需要网页抓取、正文抽取、站点遍历、地图生成、浏览器自动化或通用 MCP 市场。官方 Tavily MCP 暴露 search、extract、map 和 crawl，多于当前需求。

## 决策

1. MVP 的 Web 能力只有 Search。
2. 实现一个 CodePIddy 管理的最小 MCP server，例如 `codepiddy-tavily-search-mcp`。
3. MCP server 只注册一个工具：`web_search`。
4. `web_search` 只调用 Tavily Search API 的 `POST /search`。
5. 不注册或转发 Tavily Extract、Crawl、Map、Research 和图片能力。
6. Agent 不直接看到 Tavily API Key。
7. `web_search` 调用仍经过 `pi-permission-system` 的 MCP/tool 配置。
8. Search 结果归一化后返回标题、URL、摘要、分数和可用的发布时间信息。

## 建议工具输入

```typescript
interface WebSearchInput {
  query: string;
  searchDepth?: "basic" | "advanced" | "fast" | "ultra-fast";
  maxResults?: number;
  timeRange?: "day" | "week" | "month" | "year";
  startDate?: string;
  endDate?: string;
  includeDomains?: string[];
  excludeDomains?: string[];
}
```

## 建议默认值

```json
{
  "searchDepth": "basic",
  "maxResults": 5,
  "includeAnswer": false,
  "includeRawContent": false,
  "includeImages": false,
  "autoParameters": false
}
```

默认关闭 `autoParameters`，避免 Tavily 自动升级为更高成本的 advanced 搜索。用户或 Agent 必须明确请求 advanced。

## 建议输出

```typescript
interface WebSearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score?: number;
    publishedDate?: string;
  }>;
  responseTime?: number;
  requestId?: string;
}
```

## 凭据

- API Key 不写入项目文件、Prompt、Artifact 或日志；
- Windows MVP 通过凭据适配器读取，具体可先使用进程环境变量，后续接 Windows Credential Manager；
- 日志只记录 provider、请求 ID、耗时和用量信息，不记录密钥。

## 参考

- Tavily Search API：`https://docs.tavily.com/documentation/api-reference/endpoint/search`
- Tavily 官方 MCP：`https://github.com/tavily-ai/tavily-mcp`

## 后果

- 工具表面非常小，角色提示词稳定；
- 权限配置简单，只需控制一个搜索工具；
- 不能读取搜索结果的完整网页正文；这是已接受的 MVP 边界；
- 后续若增加其他 Web 能力，需要新的显式决策，不能静默扩展现有工具。
