import { describe, expect, it } from 'vitest';
import { computeDay } from '../src/calc';
import {
  EOD_DEFINITION, VERIFIED_TEST_DAY, EditError, FormulaError, addFigure, addRef, connect, deleteFigure, dependsOn,
  disconnect, evaluateDefinition, formulaRefs, parseFormula, removeRef, renameFigure, renameRef, runTestDay, sameFigure,
  testDayInputs, tokenize, uniqueName, updateFigure, usedBy, validateName, wouldLoop, type ReportDefinition,
} from '../src/report-definition';
import { settings, verifiedDraft } from './fixtures';

/** The verified day's values by name, for working out the definition directly. */
const V = testDayInputs(EOD_DEFINITION, VERIFIED_TEST_DAY) as Record<string, number>;

/** Works out a formula on its own, with named values. */
function calc(formula: string, values: Record<string, number> = {}, type: 'money' | 'number' | 'percent' | 'yesno' = 'number') {
  const def: ReportDefinition = {
    version: 't',
    figures: [
      ...Object.keys(values).map((name, i) => ({ id: `in${i}`, name, kind: 'input' as const, type: 'number' as const })),
      { id: 'out', name: 'Out', kind: 'calc', type, formula },
    ],
    actions: [],
  };
  const ev = evaluateDefinition(def, values);
  if (ev.errors.Out) throw new FormulaError(ev.errors.Out);
  return ev.values.Out;
}

describe('formula reader', () => {
  it('follows the usual order: × and ÷ before + and −', () => {
    expect(calc('2 + 3 × 4')).toBe(14);
    expect(calc('(2 + 3) × 4')).toBe(20);
    expect(calc('10 − 4 − 3')).toBe(3);
    expect(calc('24 ÷ 4 ÷ 2')).toBe(3);
  });
  it('accepts keyboard signs and on-screen signs alike', () => {
    expect(calc('10 - 2 * 3 / 2')).toBe(calc('10 − 2 × 3 ÷ 2'));
  });
  it('reads percentages as fractions', () => {
    expect(calc('1.75%')).toBeCloseTo(0.0175);
    expect(calc('200 × 10%')).toBe(20);
  });
  it('handles minus signs in front', () => {
    expect(calc('-5 + 2')).toBe(-3);
    expect(calc('-(2 + 3)')).toBe(-5);
    expect(calc('--4')).toBe(4);
  });
  it('compares to yes (1) or no (0)', () => {
    expect(calc('3 > 2')).toBe(1);
    expect(calc('3 < 2')).toBe(0);
    expect(calc('2 >= 2')).toBe(1);
    expect(calc('2 ≤ 1')).toBe(0);
    expect(calc('2 = 2')).toBe(1);
    expect(calc('2 ≠ 2')).toBe(0);
  });
  it('has round, min, max, abs and if', () => {
    expect(calc('round(2.345, 2)')).toBe(2.35);
    expect(calc('round(2.5)')).toBe(3);
    expect(calc('min(3, 1, 2)')).toBe(1);
    expect(calc('max(3, 1, 2)')).toBe(3);
    expect(calc('abs(0 - 4)')).toBe(4);
    expect(calc('if(1 > 0, 10, 20)')).toBe(10);
    expect(calc('IF(0, 10, 20)')).toBe(20);
  });
  it('if() only works out the branch it takes', () => {
    expect(calc('if([B] > 0, [A] ÷ [B], 0)', { A: 5, B: 0 })).toBe(0);
    expect(calc('if([B] = 0, 0, [A] ÷ [B])', { A: 6, B: 3 })).toBe(2);
  });
  it('uses named figures in square brackets, ignoring spaces inside', () => {
    expect(calc('[Gross] − [ VAT ]', { Gross: 100, VAT: 20 })).toBe(80);
  });
  it('lists the names a formula uses, once each', () => {
    expect(formulaRefs('[A] + [B] × [A]')).toEqual(['A', 'B']);
    expect(formulaRefs('[A] + [B')).toEqual(['A']);
    expect(formulaRefs(undefined)).toEqual([]);
  });

  it.each([
    ['', 'Write a formula'],
    ['[A', 'missing its closing ]'],
    ['[]', 'empty [ ]'],
    ['(1 + 2', 'bracket isn’t closed'],
    ['1 +', 'stops too early'],
    ['1 2', 'Unexpected “2”'],
    ['Gross − VAT', 'Put names in [brackets]'],
    ['sqrt(4)', 'no function called sqrt'],
    ['if(1, 2)', 'if takes 3 values'],
    ['1 # 2', 'I don’t understand “#”'],
  ])('explains what is wrong with “%s”', (formula, message) => {
    expect(() => parseFormula(formula)).toThrow(message);
  });

  it('never runs code: anything that is not a sum is refused', () => {
    for (const evil of ['alert(1)', 'constructor', '__proto__', 'process.exit()', '`${1}`', "require('fs')", 'this', '1;2']) {
      expect(() => parseFormula(evil)).toThrow(FormulaError);
    }
  });

  it('gives the same answers as JavaScript on 500 random sums', () => {
    let seed = 42;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const num = () => String(Math.floor(rnd() * 90) + 1);
    const expr = (d: number): string => {
      if (d === 0 || rnd() < 0.3) return num();
      const op = ['+', '-', '*', '/'][Math.floor(rnd() * 4)]!;
      const e = `${expr(d - 1)} ${op} ${expr(d - 1)}`;
      return rnd() < 0.4 ? `(${e})` : e;
    };
    for (let i = 0; i < 500; i++) {
      const e = expr(4);
      // eslint-disable-next-line no-new-func -- the test's reference answer only, never the app
      const expected = Function(`return (${e})`)() as number;
      expect(calc(e)).toBeCloseTo(expected, 9);
    }
  });

  it('tokenises names, numbers and signs', () => {
    expect(tokenize('[A] × 2%')).toEqual([{ t: 'ref', v: 'A' }, { t: 'op', v: '*' }, { t: 'num', v: 0.02 }]);
  });
});

describe('working out a definition', () => {
  it('rounds money to the penny and keeps percentages as fractions', () => {
    expect(calc('10 ÷ 3', {}, 'money')).toBe(3);
    expect(calc('1 ÷ 3', {}, 'percent')).toBeCloseTo(0.3333);
    expect(calc('5', {}, 'yesno')).toBe(1);
  });
  it('treats an empty input as zero', () => {
    const ev = evaluateDefinition(EOD_DEFINITION, {});
    expect(ev.values['Lunch net']).toBe(0);
  });
  it('reports a figure that does not exist', () => {
    expect(() => calc('[Nope] + 1')).toThrow('Can’t find [Nope]');
  });
  it('reports dividing by zero instead of showing Infinity', () => {
    expect(() => calc('[A] ÷ [B]', { A: 1, B: 0 })).toThrow('Divides by zero on this day');
  });
  it('the EOD guards its own divisions, so an empty day works out to zero', () => {
    const ev = evaluateDefinition(EOD_DEFINITION, { 'Wage cost': 80000 });
    expect(ev.errors).toEqual({});
    expect(ev.values['Wage %']).toBe(0);
    expect(ev.values['Net per head']).toBe(0);
  });
  it('marks figures that depend on a broken one', () => {
    const def = updateFigure(EOD_DEFINITION, 'lunchNet', { formula: '[Lunch gross] −' });
    const ev = evaluateDefinition(def, V);
    expect(ev.errors['Lunch net']).toBe('The formula stops too early');
    expect(ev.errors['Day total net']).toMatch(/Waiting on \[Lunch net\]/);
    expect(ev.values['Dinner net']).toBe(170000);
  });
  it('catches a figure that uses itself, directly or through others', () => {
    const a = updateFigure(EOD_DEFINITION, 'dayNet', { formula: '[Day total net] + 1' });
    expect(evaluateDefinition(a, {}).errors['Day total net']).toMatch(/ends up using itself/);
    const b = updateFigure(EOD_DEFINITION, 'lunchNet', { formula: '[Day total net]' });
    const ev = evaluateDefinition(b, V);
    expect(ev.errors['Lunch net'] ?? ev.errors['Day total net']).toMatch(/itself|Waiting on/);
  });
});

describe('definition v1.3 matches today’s rules (HANDOFF.md §5)', () => {
  const ev = evaluateDefinition(EOD_DEFINITION, V);

  it('lunch net £850.00, day total net £2,687.50, wages 29.8%', () => {
    expect(ev.errors).toEqual({});
    expect(ev.values['Lunch net']).toBe(85000);
    expect(ev.values['Dinner net']).toBe(170000);
    expect(ev.values['Deliveroo net']).toBe(13750);
    expect(ev.values['Day total net']).toBe(268750);
    expect(Math.round(ev.values['Wage %']! * 1000) / 10).toBe(29.8);
    expect(ev.values['Wages over red?']).toBe(0);
  });

  it('gives exactly the same figures as computeDay', () => {
    const day = computeDay(verifiedDraft(), settings);
    const deliveroo = settings.platforms.find((p) => p.id === 'deliveroo')!;
    const fromSettings = evaluateDefinition(EOD_DEFINITION, {
      ...V,
      'VAT rate': settings.vatRatePct / 100,
      'Deliveroo payout %': deliveroo.estimatedNetPct / 100,
      'Wage % red limit': settings.wageRedPct / 100,
    });
    expect(fromSettings.values['Lunch net']).toBe(day.sessions.lunch.net);
    expect(fromSettings.values['Dinner net']).toBe(day.sessions.dinner.net);
    expect(fromSettings.values['Day total net']).toBe(day.totalNet);
    expect(Math.round(fromSettings.values['Wage %']! * 1000) / 10).toBe(day.wagePct);
    expect(fromSettings.values['Wages over red?']).toBe(day.wageRag === 'red' ? 1 : 0);
  });

  it('passes the verified test day', () => {
    expect(runTestDay(EOD_DEFINITION, VERIFIED_TEST_DAY).every((r) => r.pass)).toBe(true);
  });

  it('turns wages red above 35%', () => {
    const ev2 = evaluateDefinition(EOD_DEFINITION, { ...V, 'Wage cost': 100000 });
    expect(ev2.values['Wages over red?']).toBe(1);
  });
});

describe('formula text edits', () => {
  it('renames every use of a name, however it is spaced', () => {
    expect(renameRef('[A] + [ A ] × [AB]', 'A', 'Z')).toBe('[Z] + [Z] × [AB]');
  });
  it('treats names with symbols literally', () => {
    expect(renameRef('[Wage %] × 2', 'Wage %', 'Wage share')).toBe('[Wage share] × 2');
    expect(renameRef('[A.B] + [AxB]', 'A.B', 'C')).toBe('[C] + [AxB]');
  });
  it('adds a figure to the end, or starts an empty formula', () => {
    expect(addRef('', 'A')).toBe('[A]');
    expect(addRef('[A]', 'B')).toBe('[A] + [B]');
    expect(addRef('[A]', 'B', '−')).toBe('[A] − [B]');
  });
  it('removes a figure with the sign next to it', () => {
    expect(removeRef('[A] − [B] − [C]', 'B')).toBe('[A] − [C]');
    expect(removeRef('[A] − [B]', 'A')).toBe('[B]');
    expect(removeRef('[A]', 'A')).toBe('');
    expect(removeRef('[A] + [B]', 'Z')).toBe('[A] + [B]');
  });
});

describe('editing a definition', () => {
  const def = EOD_DEFINITION;

  describe('names', () => {
    it('must be filled in, short, unique and bracket-free', () => {
      expect(validateName(def, '  ')).toBe('Give it a name');
      expect(validateName(def, 'x'.repeat(61))).toMatch(/under 60/);
      expect(validateName(def, 'A [b]')).toMatch(/can’t contain/);
      expect(validateName(def, 'lunch GROSS')).toMatch(/already a figure/);
      expect(validateName(def, 'Lunch gross', 'lunch.gross')).toBeNull();
      expect(validateName(def, 'Card takings')).toBeNull();
    });
    it('suggests the next free name', () => {
      expect(uniqueName(def, 'New input')).toBe('New input');
      const d2 = addFigure(def, { id: 'n1', name: 'New input', kind: 'input', type: 'money', group: 'lunch' });
      expect(uniqueName(d2, 'New input')).toBe('New input 2');
    });
  });

  describe('add', () => {
    it('adds an input to a section', () => {
      const d2 = addFigure(def, { id: 'lunch.tips', name: 'Lunch card tips', kind: 'input', type: 'money', group: 'lunch' });
      expect(d2.figures.filter((f) => f.group === 'lunch').map((f) => f.name)).toContain('Lunch card tips');
      expect(def.figures).toHaveLength(EOD_DEFINITION.figures.length);
    });
    it('gives a new calculation an empty formula and a check a yes/no type', () => {
      const d2 = addFigure(def, { id: 'c', name: 'New calc', kind: 'calc', type: 'money' });
      expect(d2.figures.at(-1)!.formula).toBe('');
      const d3 = addFigure(def, { id: 'k', name: 'New check', kind: 'check', type: 'money' });
      expect(d3.figures.at(-1)!.type).toBe('yesno');
    });
    it('refuses a duplicate name or id', () => {
      expect(() => addFigure(def, { id: 'x', name: 'Lunch VAT', kind: 'input', type: 'money' })).toThrow(EditError);
      expect(() => addFigure(def, { id: 'lunchNet', name: 'Other', kind: 'input', type: 'money' })).toThrow('id is already used');
    });
  });

  describe('rename', () => {
    const d2 = renameFigure(def, 'lunch.gross', 'Lunch sales');
    it('updates formulas that use it', () => {
      expect(d2.figures.find((f) => f.id === 'lunchNet')!.formula).toMatch(/^\[Lunch sales\] −/);
    });
    it('keeps the same answers and the same id', () => {
      const values = { ...V, 'Lunch sales': 120000 };
      expect(evaluateDefinition(d2, values).values['Lunch net']).toBe(85000);
      expect(d2.figures.find((f) => f.name === 'Lunch sales')!.id).toBe('lunch.gross');
    });
    it('updates actions and their conditions', () => {
      const d3 = renameFigure(renameFigure(def, 'dayNet', 'Net sales'), 'check', 'Wages over?');
      expect(d3.actions.find((a) => a.id === 'email')!.shows).toContain('Net sales');
      expect(d3.actions.find((a) => a.id === 'alert')).toMatchObject({ shows: ['Wages over?'], when: 'Wages over?' });
    });
    it('keeps test days working, because they use ids for values and results', () => {
      expect(runTestDay(renameFigure(def, 'dayNet', 'Net sales'), VERIFIED_TEST_DAY).find((r) => r.id === 'dayNet')).toMatchObject({ name: 'Net sales', pass: true });
    });
    it('refuses a name that is taken', () => {
      expect(() => renameFigure(def, 'lunch.gross', 'Dinner gross')).toThrow('already a figure');
    });
  });

  describe('update', () => {
    it('changes type, help and required', () => {
      const d2 = updateFigure(def, 'lunch.gross', { help: 'From the Z report', required: false });
      expect(d2.figures.find((f) => f.id === 'lunch.gross')).toMatchObject({ help: 'From the Z report', required: false });
    });
    it('won’t turn one kind into another, or a check into money', () => {
      expect(() => updateFigure(def, 'lunch.gross', { kind: 'calc' })).toThrow(EditError);
      expect(() => updateFigure(def, 'check', { type: 'money' })).toThrow('yes or no');
    });
  });

  describe('delete', () => {
    it('refuses while something uses it, and says what', () => {
      expect(() => deleteFigure(def, 'lunch.vat')).toThrow('Lunch VAT is used by Lunch net. Take it out of those first.');
      expect(() => deleteFigure(def, 'dayNet')).toThrow(/^Day total net is used by .*Wage %.*Send the summary email, Save to SharePoint/);
    });
    it('deletes once nothing uses it', () => {
      const d2 = disconnect(def, 'Lunch VAT', 'lunchNet');
      const d3 = deleteFigure(d2, 'lunch.vat');
      expect(d3.figures.some((f) => f.id === 'lunch.vat')).toBe(false);
      expect(usedBy(d3, 'Lunch VAT')).toEqual([]);
    });
    it('flags a test day for a deleted figure', () => {
      const d2 = addFigure(def, { id: 'tmp', name: 'Tmp', kind: 'calc', type: 'money', formula: '1' });
      const results = runTestDay(deleteFigure(d2, 'tmp'), { ...VERIFIED_TEST_DAY, expect: { tmp: 1 } });
      expect(results[0]).toMatchObject({ pass: false, error: 'This figure was deleted' });
    });
  });

  describe('connect and disconnect', () => {
    it('adds a figure to a calculation’s formula', () => {
      const d2 = addFigure(def, { id: 'tips', name: 'Lunch tips', kind: 'input', type: 'money', group: 'lunch' });
      const d3 = connect(d2, 'Lunch tips', 'lunchNet');
      expect(d3.figures.find((f) => f.id === 'lunchNet')!.formula).toMatch(/\+ \[Lunch tips\]$/);
    });
    it('adds a figure to an action', () => {
      const d2 = connect(def, 'Deliveroo net', 'email');
      expect(d2.actions.find((a) => a.id === 'email')!.shows.at(-1)).toBe('Deliveroo net');
    });
    it('refuses to feed an input, repeat a link, or make a loop', () => {
      expect(() => connect(def, 'Lunch net', 'lunch.gross')).toThrow('typed in');
      expect(() => connect(def, 'Lunch VAT', 'lunchNet')).toThrow('already uses');
      expect(() => connect(def, 'Day total net', 'lunchNet')).toThrow('depend on itself');
      expect(() => connect(def, 'Day total net', 'sp')).toThrow('already shows');
      expect(() => connect(def, 'Nope', 'sp')).toThrow('Can’t find');
    });
    it('knows what depends on what', () => {
      expect([...dependsOn(def, 'Wage %')]).toEqual(expect.arrayContaining(['Wage cost', 'Day total net', 'Lunch net', 'Lunch gross']));
      expect(wouldLoop(def, 'Wage %', 'Lunch net')).toBe(true);
      expect(wouldLoop(def, 'Lunch net', 'Wage %')).toBe(false);
    });
    it('takes a figure out of a formula or an action', () => {
      const d2 = disconnect(def, 'Lunch discounts', 'lunchNet');
      expect(d2.figures.find((f) => f.id === 'lunchNet')!.formula).toBe('[Lunch gross] − [Lunch service charge] − [Lunch VAT]');
      expect(evaluateDefinition(d2, V).values['Lunch net']).toBe(90000);
      const d3 = disconnect(def, 'Wages over red?', 'alert');
      expect(d3.actions.find((a) => a.id === 'alert')).toMatchObject({ shows: [], when: undefined });
    });
    it('connect then disconnect gets back to the start', () => {
      const d2 = disconnect(connect(def, 'Deliveroo net', 'lunchNet'), 'Deliveroo net', 'lunchNet');
      expect(d2.figures.find((f) => f.id === 'lunchNet')!.formula).toBe(def.figures.find((f) => f.id === 'lunchNet')!.formula);
    });
  });

  it('never changes the definition it was given', () => {
    const before = JSON.stringify(EOD_DEFINITION);
    renameFigure(def, 'lunch.gross', 'X');
    connect(def, 'Deliveroo net', 'email');
    disconnect(def, 'Lunch VAT', 'lunchNet');
    updateFigure(def, 'lunchNet', { formula: '1' });
    expect(JSON.stringify(EOD_DEFINITION)).toBe(before);
  });
});

describe('test days', () => {
  it('fail when a change moves a figure, and say by how much', () => {
    const def = updateFigure(EOD_DEFINITION, 'lunchNet', { formula: '[Lunch gross] − [Lunch VAT] − [Lunch discounts]' });
    const r = runTestDay(def, VERIFIED_TEST_DAY);
    expect(r.find((x) => x.id === 'lunchNet')).toMatchObject({ pass: false, expected: 85000, got: 97000 });
    expect(r.filter((x) => !x.pass)).toHaveLength(5); // lunch net, day total, wage %, net a head, vs target
  });
  it('compare money to the penny and percentages to 0.1 of a point', () => {
    expect(sameFigure('money', 85000, 85000.4)).toBe(true);
    expect(sameFigure('money', 85000, 85001)).toBe(false);
    expect(sameFigure('percent', 0.2977, 0.298)).toBe(true);
    expect(sameFigure('percent', 0.2977, 0.297)).toBe(false);
    expect(sameFigure('number', 1.234, 1.23)).toBe(true);
  });
});
