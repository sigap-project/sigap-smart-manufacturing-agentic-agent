import fs from "fs/promises";
import {
  AgentTurnMessage,
  AIProviderAdapter,
  TokenUsage,
  ToolCall,
  ToolDefinition,
} from "./contracts";

interface CachedToken {
  accessToken: string;
  expiresAt: number; // Unix ms
}

let inMemoryTokenCache: CachedToken | null = null;

interface SapAiCoreServiceKey {
  clientid: string;
  clientsecret: string;
  url: string;
  serviceurls: {
    AI_API_URL: string;
  };
}

async function loadServiceKey(): Promise<SapAiCoreServiceKey | null> {
  const filePath = process.env.SIGAP_SAP_AI_CORE_SERVICE_KEY_FILE;
  if (!filePath) return null;
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.clientid && parsed.clientsecret && parsed.url && parsed.serviceurls?.AI_API_URL) {
      return parsed as SapAiCoreServiceKey;
    }
    return null;
  } catch {
    return null;
  }
}

async function getAccessToken(key: SapAiCoreServiceKey): Promise<string> {
  const now = Date.now();
  if (inMemoryTokenCache && inMemoryTokenCache.expiresAt - now > 60000) {
    return inMemoryTokenCache.accessToken;
  }

  const tokenUrl = `${key.url.replace(/\/+$/, "")}/oauth/token`;
  const basicAuth = Buffer.from(`${key.clientid}:${key.clientsecret}`).toString("base64");

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`SAP AI Core OAuth token error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  inMemoryTokenCache = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in || 3600) * 1000,
  };

  return inMemoryTokenCache.accessToken;
}

export class SapAiCoreAdapter implements AIProviderAdapter {
  providerName: "sap-ai-core" = "sap-ai-core";
  modelId: string;
  resourceGroup: string;

  constructor() {
    this.modelId = process.env.SIGAP_SAP_DEPLOYMENT_ID || "d1a82575de60e02a";
    this.resourceGroup = process.env.SIGAP_SAP_RESOURCE_GROUP || "default";
  }

  async isConfigured(): Promise<boolean> {
    const key = await loadServiceKey();
    return key !== null;
  }

  async nextTurn(
    messages: AgentTurnMessage[],
    tools: ToolDefinition[],
    systemPrompt?: string
  ): Promise<{
    toolCalls: ToolCall[];
    summary?: string;
    usage?: TokenUsage;
  }> {
    const key = await loadServiceKey();
    if (!key) {
      throw new Error("SAP AI Core service key file not configured or invalid");
    }

    const token = await getAccessToken(key);
    const apiUrl = `${key.serviceurls.AI_API_URL.replace(
      /\/+$/,
      ""
    )}/v2/inference/deployments/${this.modelId}/chat/completions?api-version=2024-12-01-preview`;

    // Map messages to OpenAI / GenAI Hub Chat Completion format
    const chatMessages: Array<Record<string, unknown>> = [];
    if (systemPrompt) {
      chatMessages.push({ role: "system", content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === "user" && msg.content) {
        chatMessages.push({ role: "user", content: msg.content });
      } else if (msg.role === "assistant") {
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          chatMessages.push({
            role: "assistant",
            content: msg.summary || null,
            tool_calls: msg.toolCalls.map((tc) => ({
              id: tc.id,
              type: "function",
              function: {
                name: tc.name,
                arguments: JSON.stringify(tc.input),
              },
            })),
          });
        } else {
          chatMessages.push({ role: "assistant", content: msg.summary || msg.content || "" });
        }
      } else if (msg.toolResult) {
        chatMessages.push({
          role: "tool",
          tool_call_id: msg.toolResult.toolCallId,
          content:
            typeof msg.toolResult.result === "string"
              ? msg.toolResult.result
              : JSON.stringify(msg.toolResult.result),
        });
      }
    }

    const formattedTools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "AI-Resource-Group": this.resourceGroup,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: chatMessages,
        ...(formattedTools.length > 0 ? { tools: formattedTools } : {}),
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`SAP AI Core inference call failed ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0]?.message;
    const toolCalls: ToolCall[] = [];

    if (choice?.tool_calls) {
      for (const tc of choice.tool_calls) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(tc.function.arguments || "{}");
        } catch {
          input = { raw: tc.function.arguments };
        }
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          input,
        });
      }
    }

    const usage: TokenUsage = {
      inputTokens: data.usage?.prompt_tokens || 0,
      outputTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    };

    return {
      toolCalls,
      summary: choice?.content || undefined,
      usage,
    };
  }
}
