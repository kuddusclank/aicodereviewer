import OpenAI from "openai";
import { z } from "zod";

// --- Provider abstraction ---

type AIProvider = {
  id: string;
  name: string;
  model: string;
  baseURL?: string;
  apiKey: string;
};

const PROVIDER_CONFIGS = [
  {
    id: "openai",
    name: "GPT-4o Mini",
    model: "gpt-4o-mini",
    envKey: "OPENAI_API_KEY",
  },
  {
    id: "gemini",
    name: "Gemini 2.0 Flash",
    model: "gemini-2.0-flash",
    envKey: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  },
  {
    id: "qwen",
    name: "Qwen Plus",
    model: "qwen-plus",
    envKey: "QWEN_API_KEY",
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },
] as const;

export function getAvailableProviders(): { id: string; name: string }[] {
  return PROVIDER_CONFIGS.filter((p) => !!process.env[p.envKey]).map((p) => ({
    id: p.id,
    name: p.name,
  }));
}

export function getDefaultProvider(): AIProvider | null {
  for (const config of PROVIDER_CONFIGS) {
    const apiKey = process.env[config.envKey];
    if (apiKey) {
      return {
        id: config.id,
        name: config.name,
        model: config.model,
        baseURL: config.baseURL,
        apiKey,
      };
    }
  }
  return null;
}

function getProvider(providerId?: string): AIProvider {
  if (providerId) {
    const config = PROVIDER_CONFIGS.find((p) => p.id === providerId);
    if (!config) {
      throw new Error(`Unknown AI provider: ${providerId}`);
    }
    const apiKey = process.env[config.envKey];
    if (!apiKey) {
      throw new Error(
        `API key not configured for provider: ${config.name} (${config.envKey})`,
      );
    }
    return {
      id: config.id,
      name: config.name,
      model: config.model,
      baseURL: config.baseURL,
      apiKey,
    };
  }

  const defaultProvider = getDefaultProvider();
  if (!defaultProvider) {
    throw new Error(
      "No AI provider configured. Set OPENAI_API_KEY, GEMINI_API_KEY, or QWEN_API_KEY.",
    );
  }
  return defaultProvider;
}

const clientCache = new Map<string, OpenAI>();

function getClientForProvider(provider: AIProvider): OpenAI {
  const cacheKey = provider.id;
  let client = clientCache.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      apiKey: provider.apiKey,
      ...(provider.baseURL && { baseURL: provider.baseURL }),
    });
    clientCache.set(cacheKey, client);
  }
  return client;
}

// --- Schemas ---

export const ReviewCommentSchema = z.object({
  file: z.string(),
  line: z.number(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  category: z.enum(["bug", "security", "performance", "style", "suggestion"]),
  message: z.string(),
  suggestion: z.string().optional(),
});

export const ReviewResultSchema = z.object({
  summary: z.string(),
  riskScore: z.number().min(0).max(100),
  comments: z.array(ReviewCommentSchema),
});

export type ReviewComment = z.infer<typeof ReviewCommentSchema>;
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

interface FileChange {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

const SYSTEM_PROMPT = `You are an expert code reviewer. Analyze the provided pull request diff and provide a structured review.

Your review should:
1. Identify bugs, security issues, performance problems, and code style issues
2. Provide a brief summary of the changes
3. Assign a risk score (0-100) based on the complexity and potential issues
4. Give specific, actionable feedback with line numbers

Respond with valid JSON matching this schema:
{
  "summary": "Brief summary of changes and overall assessment",
  "riskScore": 0-100,
  "comments": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "critical" | "high" | "medium" | "low",
      "category": "bug" | "security" | "performance" | "style" | "suggestion",
      "message": "What the issue is",
      "suggestion": "How to fix it (optional)"
    }
  ]
}

Severity guide:
- critical: Security vulnerabilities, data loss, crashes
- high: Bugs that will cause issues in production
- medium: Should be fixed but won't break things
- low: Style issues, minor improvements

Be concise but specific. Reference exact line numbers from the diff.`;

export async function reviewCode(
  prTitle: string,
  files: FileChange[],
  providerId?: string,
): Promise<ReviewResult & { aiModel: string }> {
  const provider = getProvider(providerId);

  const diffContent = files
    .filter((f) => f.patch)
    .map(
      (f) => `### ${f.filename} (${f.status})\n\`\`\`diff\n${f.patch}\n\`\`\``,
    )
    .join("\n\n");

  if (!diffContent.trim()) {
    return {
      summary: "No code changes to review (binary files or empty diff).",
      riskScore: 0,
      comments: [],
      aiModel: provider.name,
    };
  }

  const userPrompt = `Review this pull request:

**Title:** ${prTitle}

**Changes:**
${diffContent}`;

  const client = getClientForProvider(provider);
  const response = await client.chat.completions.create({
    model: provider.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from AI");
  }

  const parsed = JSON.parse(content);
  const validated = ReviewResultSchema.parse(parsed);

  return { ...validated, aiModel: provider.name };
}
