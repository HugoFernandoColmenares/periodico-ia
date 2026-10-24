import { TestBed } from '@angular/core/testing';
import { Masthead } from './masthead';

describe('Masthead', () => {
  it('muestra el nombre, la fecha y avisa cuando son datos de muestra', async () => {
    const fixture = TestBed.createComponent(Masthead);
    fixture.componentRef.setInput('mode', 'sample');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('El Periódico de la IA');
    expect(el.querySelector('.masthead__top')?.textContent).toMatch(/\d{4}/);
    expect(el.querySelector('.notice--sample')?.textContent).toContain('datos de muestra');
  });

  it('emite la sección elegida en la navegación', async () => {
    const fixture = TestBed.createComponent(Masthead);
    const seen: string[] = [];
    fixture.componentInstance.navigate.subscribe((v) => seen.push(v));
    await fixture.whenStable();
    const links = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('nav a')];
    links.find((a) => a.textContent?.includes('Herramientas'))!.click();
    expect(seen).toEqual(['herramientas']);
  });
});
