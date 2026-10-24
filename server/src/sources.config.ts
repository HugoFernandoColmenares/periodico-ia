import type { SourceConfig } from './types.js';

/**
 * Fuentes de noticias. Todas son gratuitas y no requieren API key.
 * Para agregar una fuente: añade un objeto a este arreglo y ejecuta
 * `npm run check:sources` para verificar que la URL responde.
 *
 * Verificadas el 2026-10-23. Las que no respondían quedaron con `enabled: false`
 * y una nota explicando el motivo.
 */
export const SOURCES: SourceConfig[] = [
  { id: 'huggingface', name: 'Hugging Face Blog', type: 'rss', url: 'https://huggingface.co/blog/feed.xml', homepage: 'https://huggingface.co/blog', defaultSection: 'modelos', maxItems: 25, enabled: true },
  { id: 'google-research', name: 'Google Research', type: 'rss', url: 'https://research.google/blog/rss/', homepage: 'https://research.google/blog/', defaultSection: 'investigacion', maxItems: 20, enabled: true },
  { id: 'google-ai', name: 'Google AI (The Keyword)', type: 'rss', url: 'https://blog.google/technology/ai/rss/', homepage: 'https://blog.google/technology/ai/', defaultSection: 'industria', maxItems: 20, enabled: true },
  { id: 'google-developers', name: 'Google Developers Blog', type: 'rss', url: 'https://developers.googleblog.com/feeds/posts/default', homepage: 'https://developers.googleblog.com/', defaultSection: 'herramientas', requireKeywords: true, maxItems: 20, enabled: true },
  { id: 'apple-ml', name: 'Apple Machine Learning Research', type: 'rss', url: 'https://machinelearning.apple.com/rss.xml', homepage: 'https://machinelearning.apple.com/', defaultSection: 'investigacion', maxItems: 20, enabled: true },
  { id: 'meta-engineering', name: 'Meta Engineering', type: 'rss', url: 'https://engineering.fb.com/feed/', homepage: 'https://engineering.fb.com/', defaultSection: 'industria', requireKeywords: true, maxItems: 10, enabled: true, note: 'ai.meta.com/blog no publica RSS (404); se usa el blog de ingeniería de Meta filtrado por términos de IA.' },
  { id: 'pytorch', name: 'PyTorch Blog', type: 'rss', url: 'https://pytorch.org/blog/feed.xml', homepage: 'https://pytorch.org/blog/', defaultSection: 'herramientas', maxItems: 15, enabled: true },
  { id: 'ollama', name: 'Ollama Blog', type: 'rss', url: 'https://ollama.com/blog/rss.xml', homepage: 'https://ollama.com/blog', defaultSection: 'herramientas', maxItems: 10, enabled: true },
  { id: 'arxiv', name: 'arXiv (cs.LG, cs.CL, cs.AR)', type: 'rss', url: 'https://rss.arxiv.org/rss/cs.LG+cs.CL+cs.AR', homepage: 'https://arxiv.org/', defaultSection: 'investigacion', requireKeywords: 'on-device', maxItems: 25, enabled: true, note: 'Se filtran solo papers sobre on-device, edge, cuantización y modelos pequeños.' },
  { id: 'arxiv-api', name: 'arXiv API (consulta on-device)', type: 'rss', url: 'https://export.arxiv.org/api/query?search_query=abs:%22on-device%22+OR+abs:%22small+language+model%22+OR+abs:quantization&sortBy=submittedDate&max_results=30', homepage: 'https://arxiv.org/', defaultSection: 'investigacion', requireKeywords: 'on-device', maxItems: 20, enabled: false, note: 'export.arxiv.org no respondió (timeout) al verificar; se usa rss.arxiv.org. Actívala si te funciona.' },
  { id: 'techcrunch-ai', name: 'TechCrunch AI', type: 'rss', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', homepage: 'https://techcrunch.com/category/artificial-intelligence/', defaultSection: 'industria', maxItems: 20, enabled: true },
  { id: 'verge-ai', name: 'The Verge AI', type: 'rss', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', homepage: 'https://www.theverge.com/ai-artificial-intelligence', defaultSection: 'industria', maxItems: 20, enabled: true },
  { id: 'marktechpost', name: 'MarkTechPost', type: 'rss', url: 'https://www.marktechpost.com/feed/', homepage: 'https://www.marktechpost.com/', defaultSection: 'modelos', maxItems: 20, enabled: true },
  { id: 'venturebeat-ai', name: 'VentureBeat', type: 'rss', url: 'https://feeds.feedburner.com/venturebeat/SZYF', homepage: 'https://venturebeat.com/category/ai/', defaultSection: 'industria', requireKeywords: true, maxItems: 15, enabled: true, note: 'venturebeat.com/category/ai/feed/ responde 429; se usa el feed de FeedBurner (puede venir desactualizado).' },
  { id: 'reddit-localllama', name: 'Reddit r/LocalLLaMA', type: 'rss', url: 'https://www.reddit.com/r/LocalLLaMA/top/.rss?t=week', homepage: 'https://www.reddit.com/r/LocalLLaMA/', defaultSection: 'on-device', maxItems: 20, enabled: true, note: 'Reddit limita peticiones sin cuenta (429 intermitente); si falla se omite sin romper nada.' },
  { id: 'hackernews', name: 'Hacker News', type: 'hn', url: 'https://hn.algolia.com/api/v1/search', homepage: 'https://news.ycombinator.com/', defaultSection: 'on-device', requireKeywords: true, maxItems: 60, enabled: true, note: 'Varias búsquedas en la API de Algolia (últimos 10 días, ≥ 20 puntos).' },
];

/** Consultas que se lanzan contra la API de Algolia para la fuente `hn`. */
export const HN_QUERIES = [
  'llama.cpp', 'ollama', 'on-device', 'local LLM', 'small language model', 'quantization', 'gguf',
  'gemma', 'phi-4', 'qwen', 'mlx', 'edge AI', 'executorch', 'webgpu llm', 'npu', 'LLM', 'OpenAI', 'AI model',
];
