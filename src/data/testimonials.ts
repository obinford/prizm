// Prizm seed data — testimonials for the landing page.

export interface Testimonial {
  id: string
  quote: string
  name: string
  role: string
  location: string
  avatar: string
}

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't-1',
    quote:
      'The rolling windows are the whole product. I stopped guessing which sample to trust — Prizm just shows me all four, color-coded.',
    name: 'Marcus D.',
    role: 'MLB props bettor',
    location: 'Chicago',
    avatar: '/avatar-1.png',
  },
  {
    id: 't-2',
    quote: 'Hit Rates with the price alert flag paid for a year of All Access in one weekend.',
    name: 'Jenna K.',
    role: 'DFS player',
    location: 'Toronto',
    avatar: '/avatar-2.png',
  },
  {
    id: 't-3',
    quote: 'Ask Prizm is my pre-slate ritual. It answers with tables, not vibes.',
    name: 'Rob T.',
    role: 'NHL bettor',
    location: 'Boston',
    avatar: '/avatar-3.png',
  },
]

export function getTestimonials(): Testimonial[] {
  return TESTIMONIALS
}
