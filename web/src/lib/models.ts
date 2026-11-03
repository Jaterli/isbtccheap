/** Nombre legible de los modelos de IA que usan los scripts de news/ (llm.py guarda el identificador: "glm-5.3-flash"). */
const NAMES: Record<string, string> = {
  "glm-5.3-flash": "GLM-5.3 Flash",
  "qwen3.5-397b-a17b": "Qwen 3.5",
  "gpt-oss-120b": "gpt-oss-120b",
  "gemini-3.5-flash": "Gemini 3.5 Flash",
  "gemini-flash-latest": "Gemini Flash",
};

export const modelName = (id: string) => NAMES[id] ?? id;
