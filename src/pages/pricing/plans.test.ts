// Pricing integrity guard. Two failure classes, both of which actually
// happened and both of which a customer should never have to report:
//
// 1. The annual monthly-equivalent didn't divide cleanly — the displayed
//    "/mo · billed annually" figure was stored separately from the yearly
//    charge, so the two could (and did) disagree. Now the equivalent is
//    derived (annualTotal / 12) and this test pins that it lands exactly on
//    a cent boundary, plus that annual billing is actually cheaper.
// 2. A price literal outside plans.ts. Checkout ($149.99/yr) once charged
//    25% more than the pricing page advertised ($119.88) because two files
//    each had their own copy. plans.ts is the single source of truth; any
//    USD literal or known plan-price number anywhere else fails this test.

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLANS, monthlyEquivalent, savingsPct } from './plans'

describe('plan pricing', () => {
  it('monthly-equivalent equals annualTotal / 12 exactly, to the cent', () => {
    for (const p of PLANS) {
      const equiv = monthlyEquivalent(p)
      // display never shows a repeating decimal like $19.991666…
      expect(Number(equiv.toFixed(2))).toBe(equiv)
    }
  })

  it('annual billing is cheaper than twelve monthly payments', () => {
    for (const p of PLANS) {
      expect(p.annualTotal).toBeLessThan(p.monthlyPrice * 12)
      expect(savingsPct(p)).toBeGreaterThan(0)
      expect(savingsPct(p)).toBeLessThan(50) // sanity: a typo can't claim 90% off
    }
  })

  it('no price literal exists outside plans.ts', () => {
    const offenders = scanForOffenders()
    expect(offenders, `price literals outside plans.ts:\n${offenders.join('\n')}`).toEqual([])
  })

  it('no savings arithmetic exists outside plans.ts', () => {
    // The literal guard catches quoted prices; it does NOT catch a price
    // CALCULATION — which is how a blended "save 21%" (true of nobody)
    // survived Fix 5 on the Pricing page. All savings math lives in plans.ts
    // (savingsPct / minSavingsPct). Heuristic, line-based: flag direct
    // arithmetic on the price fields, or aggregation over them.
    const offenders: string[] = []
    for (const path of sourceFiles()) {
      readFileSync(path, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (/\.(annualTotal|monthlyPrice)\s*[*/]/.test(line)) {
            offenders.push(`${path}:${i + 1}: arithmetic on a price field`)
          }
          if (/\.reduce\([^)]*\.(annualTotal|monthlyPrice)/.test(line)) {
            offenders.push(`${path}:${i + 1}: aggregation over price fields`)
          }
        })
    }
    expect(offenders, `savings arithmetic outside plans.ts:\n${offenders.join('\n')}`).toEqual([])
  })
})

/** All client source files except the source of truth and test fixtures. */
function sourceFiles(): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(path)
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        entry.name !== 'plans.ts' &&
        !/\.test\.(ts|tsx)$/.test(entry.name)
      ) {
        out.push(path)
      }
    }
  }
  walk(join(__dirname, '..', '..'))
  return out
}

function scanForOffenders(): string[] {
  const offenders: string[] = []
  for (const path of sourceFiles()) {
    const text = readFileSync(path, 'utf8')
    // USD display literals like $12.99 ("$0 today" has no decimals — not a plan price)
    if (/\$\d+\.\d{2}/.test(text)) offenders.push(`${path}: USD literal`)
    // known plan-price numbers in any form (stale local PLANS copies, etc.)
    if (/\b(12\.99|24\.99|9\.99|19\.99|149\.99|249\.99|119\.88|239\.88)\b/.test(text)) {
      offenders.push(`${path}: plan-price numeric`)
    }
  }
  return offenders
}
