/** Nombre legible de los modelos de IA que usan los scripts de news/ (llm.py guarda el identificador: "glm-5.3-flash"). */
const NAMES: Record<string, string> = {
  "glm-5.3-flash": "GLM-5.3 Flash",
  "qwen3.5-397b-a17b": "Qwen 3.5",
  "gpt-oss-120b": "gpt-oss-120b",
  "openai-gpt-oss-120b": "gpt-oss-120b",
  "gpt-oss-20b": "gpt-oss-20b",
  "qwen3.8-27b": "Qwen 3.8",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-flash-latest": "Gemini Flash",
  "claude-haiku-5-5": "Claude Haiku 5.5",
};

/** El esfuerzo de razonamiento ("glm-5.3-flash@high") no se muestra: es el mismo modelo */
export const modelName = (id: string) => {
  const base = id.split("@")[0];
  return NAMES[base] ?? base;
};
