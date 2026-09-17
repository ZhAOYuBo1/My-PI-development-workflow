# Tavily Search MCP 设计草案

- 状态：草案
- 日期：2026-09-15

## 范围

只实现 Web Search。明确不实现：

- URL fetch；
- extract；
- crawl；
- map；
- research；
- browser automation；
- image search。

## 组件

```text
Pi Agent
  -> MCP client/adapter
      -> codepiddy-tavily-search-mcp
          -> Tavily POST /search
```

## MCP Tool

名称：`web_search`

输入：查询、深度、结果数、时间/日期和域名过滤。

输出：归一化搜索结果列表，不返回原始整页内容。

## Tavily 请求约束

- `include_answer=false`：由调用 Agent 自己分析结果，不付费生成额外答案；
- `include_raw_content=false`：保持 Search-only 边界；
- `include_images=false`；
- `auto_parameters=false`：避免不可预期的 advanced 费用；
- `max_results` 使用产品上限；
- 支持 `include_domains` 和 `exclude_domains`；
- 支持 `time_range` 或 `start_date/end_date`。

## 错误映射

至少标准化：

- 缺少或无效 API Key；
- 配额/速率限制；
- Tavily 服务错误；
- 网络超时；
- 用户取消；
- 权限插件拒绝；
- 返回 schema 无效。

## 待实现确认

- MCP client 是最小自研 stdio client，还是复用现有 Pi MCP adapter；
- API Key 首版采用环境变量还是 Windows Credential Manager；
- 哪些 Agent Role 的默认配置允许 `web_search`。
