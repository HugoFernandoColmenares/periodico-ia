import { TestBed } from '@angular/core/testing';
import { makeArticle } from '../testing';
import { ArticleCard } from './article-card';

describe('ArticleCard', () => {
  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(ArticleCard);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('enlaza al original en una pestaña nueva y da crédito a la fuente', async () => {
    const el = await render({ article: makeArticle({ title: 'Gemma en tu teléfono', url: 'https://hf.co/gemma' }) });
    const link = el.querySelector<HTMLAnchorElement>('.card__title a')!;
    expect(link.textContent?.trim()).toBe('Gemma en tu teléfono');
    expect(link.href).toBe('https://hf.co/gemma');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(el.querySelector('.card__source')?.textContent).toContain('Hugging Face Blog');
    expect(el.querySelector('.card__read')?.textContent).toContain('Leer en Hugging Face Blog');
    expect(el.querySelector('.kicker')?.textContent).toContain('On-device e IA pequeña');
  });

  it('muestra el desglose del puntaje y la etiqueta de muestra', async () => {
    const el = await render({ article: makeArticle({ sample: true, score: 81 }) });
    expect(el.querySelector('.card__why summary')?.textContent).toContain('81 pts');
    expect(el.querySelector('.badge--sample')).not.toBeNull();
  });

  it('en modo compacto no muestra extracto ni imagen', async () => {
    const el = await render({ article: makeArticle({ image: 'https://img/x.png' }), variant: 'compact' });
    expect(el.querySelector('.card__excerpt')).toBeNull();
    expect(el.querySelector('img')).toBeNull();
  });

  it('la nota principal muestra imagen si existe', async () => {
    const el = await render({ article: makeArticle({ image: 'https://img/x.png' }), variant: 'lead' });
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://img/x.png');
  });
});
