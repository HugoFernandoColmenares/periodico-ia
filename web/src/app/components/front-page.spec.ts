import { TestBed } from '@angular/core/testing';
import { makeArticle } from '../testing';
import { buildLayout, FrontPage, pickDiverse } from './front-page';

describe('FrontPage', () => {
  const items = [
    makeArticle({ id: 'od1', section: 'on-device', source: 'arxiv' }),
    makeArticle({ id: 'od2', section: 'on-device', source: 'arxiv' }),
    makeArticle({ id: 'od3', section: 'on-device', source: 'arxiv' }),
    makeArticle({ id: 'od4', section: 'on-device', source: 'hn', image: 'https://img/1.png' }),
    makeArticle({ id: 'od5', section: 'on-device', source: 'hf' }),
    makeArticle({ id: 'm1', section: 'modelos', title: 'Nuevo modelo' }),
    makeArticle({ id: 'i1', section: 'industria', title: 'Ronda de inversión' }),
  ];

  it('la nota principal es on-device y prefiere una con imagen', () => {
    const l = buildLayout(items);
    expect(l.lead?.id).toBe('od4');
    expect(l.columns.find((c) => c.id === 'modelos')?.items.map((a) => a.id)).toEqual(['m1']);
  });

  it('no repite notas y limita notas por fuente', () => {
    const used = new Set<string>();
    expect(pickDiverse(items, 5, used, 1).map((a) => a.id)).toEqual(['od1', 'od4', 'od5']);
    expect(pickDiverse(items, 2, used, 2).map((a) => a.id)).toEqual(['od2', 'od3']); // ya usados no se repiten
  });

  it('renderiza la sección On-device y las columnas de secciones', async () => {
    const fixture = TestBed.createComponent(FrontPage);
    fixture.componentRef.setInput('articles', items);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#sec-on-device')?.textContent).toContain('On-device e IA pequeña');
    const heads = [...el.querySelectorAll('.section-head--col')].map((h) => h.textContent?.trim());
    expect(heads).toEqual(['Modelos', 'Investigación', 'Industria', 'Herramientas']);
    expect(el.querySelectorAll('app-article-card').length).toBe(items.length);
  });
});
