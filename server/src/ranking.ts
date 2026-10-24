import type { Article, SectionId } from './types.js';
import type { NormalizedItem } from './normalize.js';

/**
 * Heurística de ranking TRANSPARENTE (sin modelos ni APIs):
 *
 *   score = topic + onDevice + recency + popularity
 *
 * - topic:      suma de pesos de palabras clave encontradas (título ×2, extracto ×1), tope 40.
 * - onDevice:   +30 si el artículo trata de on-device / IA pequeña (puntaje on-device ≥ umbral),
 *               más el puntaje on-device en sí (tope 30). Es el "empujón" editorial del periódico.
 * - recency:    0..30, decae exponencialmente con vida media de 36 horas
 *               (tope 10 si el feed no informa fecha: no premiamos lo que no sabemos).
 * - popularity: 0..10, log10 de puntos de Hacker News (si existen).
 *
 * Cada artículo expone `scoreBreakdown` y `matchedKeywords` para que se pueda auditar.
 */

export interface Keyword {
  label: string;
  re: RegExp;
  weight: number;
}

const k = (label: string, pattern: string, weight: number): Keyword => ({ label, re: new RegExp(pattern, 'i'), weight });

/** Términos on-device / IA pequeña / edge. */
export const ON_DEVICE_KEYWORDS: Keyword[] = [
  k('on-device', String.raw`\bon[- ]device\b`, 10),
  k('edge AI', String.raw`\bedge (ai|devices?|inference|computing|hardware|deployment)\b|\bat the edge\b`, 9),
  k('small language model', String.raw`\bsmall (language )?models?\b|\bslms?\b|\btiny (language )?models?\b|\bcompact models?\b|\blightweight (language )?models?\b`, 9),
  k('local LLM', String.raw`\blocal(ly)? (llms?|models?|ai|inference)\b|\brun(ning|s)? (llms?|models?|ai) locally\b|\b(works?|runs?|fully) offline\b|\boffline (ai|llms?|inference|assistant|mode)\b`, 6),
  k('llama.cpp', String.raw`\bllama\.?cpp\b|\bggml\b|\bgguf\b`, 10),
  k('Ollama', String.raw`\bollama\b`, 8),
  k('LM Studio', String.raw`\blm ?studio\b`, 8),
  k('MLC / WebLLM', String.raw`\bmlc[- ]?llm\b|\bwebllm\b|\bmlc\b`, 8),
  k('MLX', String.raw`\bmlx\b`, 7),
  k('ONNX Runtime', String.raw`\bonnx\b`, 7),
  k('Core ML', String.raw`\bcore ?ml\b`, 8),
  k('MediaPipe / LiteRT', String.raw`\bmediapipe\b|\blitert\b|\btflite\b|\btensorflow lite\b`, 9),
  k('ExecuTorch', String.raw`\bexecutorch\b`, 10),
  k('cuantización', String.raw`\bquanti[sz](ed|ation|ing|e)\b|\b(int4|int8|fp8|fp4|nf4)\b|\b[1-8][- ]?bit\b|\bawq\b|\bgptq\b`, 8),
  k('destilación', String.raw`\bdistill(ed|ation)?\b|\bpruning\b|\bsparsity\b`, 4),
  k('NPU', String.raw`\bnpus?\b|\bneural engine\b|\bsnapdragon\b|\bhexagon\b|\bneural processing unit\b`, 8),
  k('móvil', String.raw`\b(smart)?phones?\b|\bmobile\b|\bandroid\b|\biphone\b|\bios\b|\bwearables?\b|\bsmart ?glasses\b`, 4),
  k('hardware limitado', String.raw`\braspberry pi\b|\bjetson\b|\bmicrocontrollers?\b|\btinyml\b|\blow[- ](power|memory)\b|\blow[- ]resource (devices?|hardware)\b|\bresource[- ]constrained\b|\bconsumer (gpus?|hardware)\b|\blaptops?\b`, 5),
  k('Gemma', String.raw`\bgemma\b|\bgemini nano\b`, 8),
  k('Phi', String.raw`\bphi-?[1-9](\.\d)?\b|\bphi silica\b`, 8),
  k('Llama pequeño', String.raw`\bllama[- ]?\d(\.\d)?[- ](1|3|8)b\b`, 8),
  k('Qwen pequeño', String.raw`\bqwen[\d.]*[- ](0\.5|0\.6|1\.5|1\.7|3|4|7|8)b\b`, 8),
  k('modelos ≤ 8B', String.raw`(?<!\$)\b(0\.\d+|[1-8](\.\d)?)\s?b(illion)?[- ](param(eter)?s?|models?|instruct|it)\b|(?<!\$)\b(135|270|350|360|500|600)m[- ](param(eter)?s?|models?)\b`, 6),
  k('LFM / Liquid AI', String.raw`\blfm[\d.-]*\b|\bliquid ai\b`, 8),
  k('SmolLM', String.raw`\bsmol(lm|vlm)?\w*\b`, 9),
  k('Apple Intelligence', String.raw`\bapple intelligence\b|\bfoundation models framework\b`, 7),
  k('WebGPU', String.raw`\bwebgpu\b|\btransformers\.js\b|\bin[- ]browser\b`, 7),
  k('eficiencia', String.raw`\befficient inference\b|\blow latency\b|\bmemory[- ]efficient\b|\bkv[- ]cache\b|\bspeculative decoding\b`, 4),
];

/** Términos por sección (además de on-device). */
export const SECTION_KEYWORDS: Record<Exclude<SectionId, 'on-device'>, Keyword[]> = {
  modelos: [
    k('lanzamiento de modelo', String.raw`\b(releases?|launch(es|ed)?|introduc(es|ing)|unveil(s|ed)?|announc(es|ed))\b.*\bmodels?\b|\bopen[- ]?(weights?|source) models?\b`, 6),
    k('LLM', String.raw`\bllms?\b|\blarge language models?\b|\bfoundation models?\b`, 4),
    k('familias de modelos', String.raw`\b(gpt-?\d|claude|gemini|llama|qwen|mistral|deepseek|grok|kimi|glm|olmo|granite|nemotron)\b`, 5),
    k('multimodal', String.raw`\bmultimodal\b|\bvision[- ]language\b|\bvlms?\b|\bspeech\b|\btext[- ]to[- ](image|video|speech)\b`, 3),
    k('benchmark', String.raw`\bbenchmarks?\b|\bleaderboard\b|\bsota\b|\bstate[- ]of[- ]the[- ]art\b`, 3),
  ],
  investigacion: [
    k('paper', String.raw`\bpapers?\b|\barxiv\b|\bpreprint\b|\bwe (propose|present|introduce)\b`, 6),
    k('investigación', String.raw`\bresearch(ers)?\b|\bstudy\b|\bexperiments?\b|\bdataset\b|\btheor(y|etical)\b`, 4),
    k('aprendizaje', String.raw`\breinforcement learning\b|\bfine[- ]?tun(e|ing)\b|\btraining\b|\balignment\b|\binterpretability\b`, 3),
  ],
  industria: [
    k('negocios', String.raw`\bfunding\b|\braises?\b|\bvaluation\b|\bacqui(res?|sition)\b|\binvest(s|ment|ors?)\b|\bipo\b|\brevenue\b|\b\$\d`, 6),
    k('empresas', String.raw`\bopenai\b|\banthropic\b|\bnvidia\b|\bmicrosoft\b|\bgoogle\b|\bmeta\b|\bapple\b|\bamazon\b|\bxai\b|\bsamsung\b|\bqualcomm\b`, 3),
    k('regulación', String.raw`\bregulat(ion|ors?)\b|\blawsuits?\b|\blawmakers?\b|\bpolicy\b|\bcopyright\b|\bcongress\b|\beu ai act\b|\bcourt\b`, 5),
    k('mercado', String.raw`\bstartups?\b|\bchips?\b|\bdata ?cent(er|re)s?\b|\bjobs?\b|\bcustomers?\b|\benterprise\b`, 3),
  ],
  herramientas: [
    k('SDK / librerías', String.raw`\bsdks?\b|\blibrar(y|ies)\b|\bframeworks?\b|\bapis?\b|\bcli\b|\bplugins?\b|\bextensions?\b`, 5),
    k('open source', String.raw`\bopen[- ]source\b|\bgithub\b|\brepo(sitory)?\b|\bshow hn\b`, 4),
    k('agentes', String.raw`\bagents?\b|\bagentic\b|\bmcp\b|\bmodel context protocol\b|\btool calling\b`, 4),
    k('dev tools', String.raw`\bcoding (assistant|agent)s?\b|\bide\b|\bvs ?code\b|\bcopilot\b|\bcursor\b|\btransformers\b|\bpytorch\b|\bvllm\b|\blangchain\b|\brag\b`, 4),
  ],
};

/** Términos genéricos de IA (para filtrar fuentes generalistas). */
export const AI_TERMS = /\b(ai|a\.i\.|artificial intelligence|machine learning|ml|llms?|neural|deep learning|gemini|gpt|chatbot|genai|generative|models?|inference|transformers?)\b/i;

export const ON_DEVICE_THRESHOLD = 10;
export const RECENCY_HALF_LIFE_HOURS = 36;
export const UNDATED_RECENCY_CAP = 10;

export interface Match {
  score: number;
  labels: string[];
}

export function matchKeywords(title: string, excerpt: string, keywords: Keyword[]): Match {
  let score = 0;
  const labels: string[] = [];
  for (const kw of keywords) {
    const inTitle = kw.re.test(title);
    const inBody = kw.re.test(excerpt);
    if (inTitle || inBody) {
      score += kw.weight * (inTitle ? 2 : 1);
      labels.push(kw.label);
    }
  }
  return { score, labels };
}

export function recencyScore(publishedAt: string, now = new Date()): number {
  const ageHours = Math.max(0, (now.getTime() - new Date(publishedAt).getTime()) / 36e5);
  return 30 * Math.pow(0.5, ageHours / RECENCY_HALF_LIFE_HOURS);
}

export function popularityScore(points?: number): number {
  if (!points || points <= 0) return 0;
  return Math.min(10, Math.log10(points + 1) * 3.5);
}

export function isOnDevice(title: string, excerpt: string): boolean {
  return matchKeywords(title, excerpt, ON_DEVICE_KEYWORDS).score >= ON_DEVICE_THRESHOLD;
}

/** Elige la sección: on-device si supera el umbral; si no, la sección con más puntaje (empate → la de la fuente). */
export function classify(title: string, excerpt: string, fallback: SectionId): SectionId {
  if (isOnDevice(title, excerpt)) return 'on-device';
  let best: SectionId = fallback === 'on-device' ? 'modelos' : fallback;
  let bestScore = 0;
  for (const [section, kws] of Object.entries(SECTION_KEYWORDS) as [SectionId, Keyword[]][]) {
    const { score } = matchKeywords(title, excerpt, kws);
    const adjusted = score + (section === fallback ? 3 : 0);
    if (adjusted > bestScore) {
      bestScore = adjusted;
      best = section;
    }
  }
  return best;
}

const round = (n: number) => Math.round(n * 10) / 10;

export function scoreItem(item: NormalizedItem, fallback: SectionId, now = new Date()): Article {
  const od = matchKeywords(item.title, item.excerpt, ON_DEVICE_KEYWORDS);
  const allSection = Object.values(SECTION_KEYWORDS).flat();
  const topicMatch = matchKeywords(item.title, item.excerpt, allSection);
  const onDevice = od.score >= ON_DEVICE_THRESHOLD ? 30 + Math.min(30, od.score) : 0;
  const breakdown = {
    topic: round(Math.min(40, topicMatch.score)),
    onDevice: round(onDevice),
    recency: round(Math.min(item.undated ? UNDATED_RECENCY_CAP : 30, recencyScore(item.publishedAt, now))),
    popularity: round(popularityScore(item.points)),
  };
  const { points: _p, comments: _c, ...rest } = item;
  void _p;
  void _c;
  return {
    ...rest,
    section: classify(item.title, item.excerpt, fallback),
    score: round(breakdown.topic + breakdown.onDevice + breakdown.recency + breakdown.popularity),
    scoreBreakdown: breakdown,
    matchedKeywords: [...new Set([...od.labels, ...topicMatch.labels])],
  };
}

export function rank(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => b.score - a.score || b.publishedAt.localeCompare(a.publishedAt));
}
