// Schedule-feed parser contract tests.
//
// The join this feeds is silent when wrong: a 0-indexed order still renders
// numbers 0–8, a missed empty-object still renders dashes. These pin the
// semantics the UI relies on.

import { describe, expect, it } from 'vitest'
import { parseScheduleGames, parseScheduleLineups, slug } from './lineupsParse'

const player = (id: number, name: string, abbr: string) => ({
  id,
  fullName: name,
  firstName: name.split(' ')[0],
  lastName: name.split(' ').slice(1).join(' '),
  useName: name,
  link: `/api/v1/people/${id}`,
  primaryPosition: { code: '9', name: 'Outfielder', type: 'Outfielder', abbreviation: abbr },
})

const GAME = {
  gamePk: 777001,
  teams: {
    away: { team: { id: 119, name: 'Los Angeles Dodgers' } },
    home: { team: { id: 147, name: 'New York Yankees' } },
  },
  lineups: {
    awayPlayers: [player(669373, 'Tarik Skubal', 'P'), player(682998, 'Joe Hitter', 'LF')],
    homePlayers: [player(592450, 'Home Guy', 'CF')],
  },
}

describe('parseScheduleLineups', () => {
  it('maps a known lineup entry to the right batter id and slug', () => {
    const out = parseScheduleLineups({ dates: [{ games: [GAME] }] }, '2026-07-27')
    // 669373 is Skubal's real MLBAM id; the slug must equal the Batter.id the
    // ingest built with the same slug() function — that is the client join.
    expect(out.orders[669373].slug).toBe('tarik-skubal')
    expect(out.orders[669373].position).toBe('P')
    expect(out.postedGamePks).toEqual([777001])
    expect(out.teamsByGamePk[777001]).toEqual({ awayTeamId: 119, homeTeamId: 147 })
  })

  it('an empty lineups: {} yields no orders and does not throw', () => {
    const out = parseScheduleLineups(
      { dates: [{ games: [{ gamePk: 777002, lineups: {} }] }] },
      '2026-07-27',
    )
    expect(out.postedGamePks).toEqual([])
    expect(Object.keys(out.orders)).toHaveLength(0)
    expect(out.teamsByGamePk[777002]).toBeUndefined()
  })

  it('a game with no lineups key at all is likewise skipped', () => {
    const out = parseScheduleLineups({ dates: [{ games: [{ gamePk: 777003 }] }] }, '2026-07-27')
    expect(out.postedGamePks).toEqual([])
    expect(Object.keys(out.orders)).toHaveLength(0)
  })

  it('batting order is 1-indexed — index 0 in the feed is spot 1, not 0', () => {
    const out = parseScheduleLineups({ dates: [{ games: [GAME] }] }, '2026-07-27')
    expect(out.orders[669373].battingOrder).toBe(1) // leadoff
    expect(out.orders[682998].battingOrder).toBe(2)
    expect(out.orders[592450].battingOrder).toBe(1) // other side's leadoff
  })

  it('malformed entries (missing id) are skipped, not crashed on', () => {
    const g = {
      gamePk: 777004,
      lineups: { homePlayers: [{ fullName: 'No Id' }, player(1, 'Has Id', 'C')] },
    }
    const out = parseScheduleLineups({ dates: [{ games: [g] }] }, '2026-07-27')
    expect(Object.keys(out.orders)).toHaveLength(1)
    expect(out.orders[1].battingOrder).toBe(2)
  })
})

describe('slug', () => {
  it('matches the ingest slug contract', () => {
    expect(slug('Tarik Skubal')).toBe('tarik-skubal')
    expect(slug('José Ramírez')).toBe('jose-ramirez')
    expect(slug("Jasson Domínguez")).toBe('jasson-dominguez')
  })
})

describe('parseScheduleGames', () => {
  const SCHED_GAME = {
    gamePk: 823837,
    gameDate: '2026-07-29T16:10:00Z',
    venue: { name: 'loanDepot park' },
    teams: {
      away: { team: { id: 143 }, probablePitcher: { id: 666200, fullName: 'Jesús Luzardo' } },
      home: { team: { id: 146 }, probablePitcher: null },
    },
  }

  it('keeps games with no posted lineup — probables are the content', () => {
    const out = parseScheduleGames({ dates: [{ games: [SCHED_GAME] }] })
    expect(out).toHaveLength(1)
    expect(out[0].awayProbable).toEqual({ id: 666200, name: 'Jesús Luzardo' })
    expect(out[0].homeProbable).toBeNull() // unnamed probable → null, never 'TBD' the data didn't send
    expect(out[0].venue).toBe('loanDepot park')
    expect(out[0].startUtc).toBe('2026-07-29T16:10:00Z')
  })

  it('skips entries without a numeric gamePk and tolerates missing dates', () => {
    expect(parseScheduleGames({ dates: [{ games: [{ teams: {} }] }] })).toEqual([])
    expect(parseScheduleGames({})).toEqual([])
    expect(parseScheduleGames(null)).toEqual([])
  })
})
