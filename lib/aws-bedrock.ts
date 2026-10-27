import {
  AgentTurnMessage,
  AIProviderAdapter,
  TokenUsage,
  ToolCall,
  ToolDefinition,
} from "./contracts";
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import type { ConverseCommandInput } from "@aws-sdk/client-bedrock-runtime";

export class BedrockAdapter implements AIProviderAdapter {
  providerName: "bedrock" = "bedrock";
  modelId: string;
  region: string;

  constructor() {
    this.modelId =
      process.env.SIGAP_BEDROCK_MODEL_ID ||
      process.env.AWS_BEDROCK_MODEL_ID ||
      "amazon.nova-lite-v1:0";
    this.region =
      process.env.SIGAP_AWS_REGION ||
      process.env.AWS_REGION ||
      "us-east-1";
  }

  private getClient(): BedrockRuntimeClient {
    const accessKeyId =
      process.env.SIGAP_AWS_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.SIGAP_AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
    const sessionToken =
      process.env.SIGAP_AWS_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN;

    return new BedrockRuntimeClient({
      region: this.region,
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
              ...(sessionToken ? { sessionToken } : {}),
            },
          }
        : {}),
    });
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
    const client = this.getClient();

    const bedrockMessages: Array<{
      role: "user" | "assistant";
      content: Array<Record<string, unknown>>;
    }> = [];

    for (const msg of messages) {
      if (msg.role === "user" && msg.content) {
        bedrockMessages.push({
          role: "user",
          content: [{ text: msg.content }],
        });
      } else if (msg.role === "assistant") {
        const contents: Array<Record<string, unknown>> = [];
        if (msg.summary) {
          contents.push({ text: msg.summary });
        }
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          for (const tc of msg.toolCalls) {
            contents.push({
              toolUse: {
                toolUseId: tc.id,
                name: tc.name,
                input: tc.input,
              },
            });
          }
        }
        if (contents.length > 0) {
          bedrockMessages.push({
            role: "assistant",
            content: contents,
          });
        }
      } else if (msg.toolResults || msg.toolResult) {
        const resultsList = msg.toolResults || (msg.toolResult ? [msg.toolResult] : []);
        const blocks = resultsList.map((tr) => ({
          toolResult: {
            toolUseId: tr.toolCallId,
            content: [
              typeof tr.result === "string"
                ? { text: tr.result }
                : { json: tr.result as Record<string, unknown> },
            ],
            ...(tr.isError ? { status: "error" } : {}),
          },
        }));

        const last = bedrockMessages[bedrockMessages.length - 1];
        if (last && last.role === "user") {
          last.content.push(...blocks);
        } else {
          bedrockMessages.push({
            role: "user",
            content: blocks,
          });
        }
      }
    }

    const toolConfig =
      tools.length > 0
        ? {
            tools: tools.map((t) => ({
              toolSpec: {
                name: t.name,
                description: t.description,
                inputSchema: {
                  json: t.inputSchema,
                },
              },
            })),
          }
        : undefined;

    const command = new ConverseCommand({
      modelId: this.modelId,
      system: systemPrompt ? [{ text: systemPrompt }] : undefined,
      messages: bedrockMessages as unknown as NonNullable<ConverseCommandInput["messages"]>,
      toolConfig: toolConfig as unknown as ConverseCommandInput["toolConfig"],
      inferenceConfig: {
        maxTokens: 1200,
        temperature: 0.1,
      },
    });

    const response = await client.send(command);
    const toolCalls: ToolCall[] = [];
    let summary: string | undefined;

    const contentList = response.output?.message?.content || [];
    for (const item of contentList) {
      if ("text" in item && item.text) {
        summary = (summary ? summary + "\n" : "") + item.text;
      }
      if ("toolUse" in item && item.toolUse) {
        toolCalls.push({
          id: item.toolUse.toolUseId || `call-${Date.now()}`,
          name: item.toolUse.name || "unknown_tool",
          input: (item.toolUse.input as Record<string, unknown>) || {},
        });
      }
    }

    const usage: TokenUsage = {
      inputTokens: response.usage?.inputTokens || 0,
      outputTokens: response.usage?.outputTokens || 0,
      totalTokens: response.usage?.totalTokens || 0,
    };

    return {
      toolCalls,
      summary,
      usage,
    };
  }
}
