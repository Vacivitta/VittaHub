import { TestBed } from '@angular/core/testing';
import { DecisionBadge } from './decision-badge';

describe('DecisionBadge', () => {
  it('pulses only on appearance or increase and hides zero', () => {
    const fixture = TestBed.createComponent(DecisionBadge);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toBe('');
    fixture.componentRef.setInput('count', 2);
    fixture.detectChanges();
    expect(fixture.componentInstance.pulse()).toBe(true);
    const first = fixture.nativeElement.querySelector('span');
    fixture.componentRef.setInput('count', 3);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span')).not.toBe(first);
    expect(fixture.componentInstance.pulse()).toBe(true);
    fixture.componentRef.setInput('count', 1);
    fixture.detectChanges();
    expect(fixture.componentInstance.pulse()).toBe(false);
    fixture.componentRef.setInput('count', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('span')).toBeNull();
  });
});
