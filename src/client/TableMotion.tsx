import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { COIN_FLIGHT_MS, PURCHASE_FLIGHT_MS } from '../game/match.ts';
import { TABLE_CARDS } from '../game/view.ts';
import type { GameEvent } from '../game/match.ts';
import { Coin } from './Cards.tsx';
import { BuildingArt } from './BuildingArt.tsx';

interface Point { x: number; y: number }
interface Flight {
  key: string;
  start: Point;
  end: Point;
  duration: number;
  delay: number;
  amount?: number;
  cardId?: string;
}

function center(element: Element): Point {
  const { left, top, width, height } = element.getBoundingClientRect();
  return { x: left + width / 2, y: top + height / 2 };
}

export function TableMotion({ events }: { events?: GameEvent[] }) {
  const [flights, setFlights] = useState<Flight[]>([]);
  const last = useRef<number | undefined>(undefined);
  const marketCards = useRef(new Map<string, Point>());
  const lastEvent = events?.at(-1)?.id;
  useLayoutEffect(() => {
    const market = document.querySelector('.market');
    if (!market) return;
    function marketPositions() {
      return new Map(Array.from(market!.querySelectorAll<HTMLElement>('[data-card]'), element =>
        [element.dataset.card!, center(element)] as const));
    }
    const before = marketCards.current;
    marketCards.current = marketPositions();
    const previous = last.current;
    last.current = lastEvent;
    function refresh() { marketCards.current = marketPositions(); }
    window.addEventListener('scroll', refresh, true);
    if (previous !== undefined && lastEvent !== undefined && lastEvent > previous &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const points = new Map(Array.from(document.querySelectorAll<HTMLElement>('[data-motion-anchor]'), element =>
        [element.dataset.motionAnchor!, center(element)] as const));
      const batch = events!.filter(event => event.id > previous);
      const fresh: Flight[] = [];
      let payoutDelay = 0;
      for (const event of batch) {
        const purchase = event.purchase;
        if (purchase) {
          const city = points.get(event.playerId);
          const bank = points.get('bank');
          if (city && bank && purchase.cost > 0) fresh.push({
            key: `${event.id}-price`, start: city, end: bank, amount: purchase.cost, duration: COIN_FLIGHT_MS, delay: 0,
          });
          if (city) fresh.push({
            key: `${event.id}-card`, start: before.get(purchase.cardId) ?? center(market), end: city,
            cardId: purchase.cardId, duration: 900, delay: PURCHASE_FLIGHT_MS - 900,
          });
          payoutDelay = PURCHASE_FLIGHT_MS;
        }
        event.coins?.forEach((movement, index) => {
          const start = points.get(movement.from);
          const end = points.get(movement.to);
          if (start && end) fresh.push({
            key: `${event.id}-${index}`, start, end, amount: movement.amount, duration: COIN_FLIGHT_MS, delay: payoutDelay,
          });
        });
      }
      if (fresh.length) setFlights(current => [...current, ...fresh]);
    }
    return () => window.removeEventListener('scroll', refresh, true);
  }, [events, lastEvent]);

  return createPortal(<div className="table-motion" aria-hidden="true">
    {flights.map(flight => <FlightPiece key={flight.key} flight={flight}
      done={() => setFlights(current => current.filter(piece => piece !== flight))} />)}
  </div>, document.body);
}

function FlightPiece({ flight, done }: { flight: Flight; done: () => void }) {
  const piece = useRef<HTMLDivElement>(null);
  const callback = useRef(done);
  callback.current = done;
  useLayoutEffect(() => {
    const { start, end, duration, delay } = flight;
    const x = end.x - start.x;
    const y = end.y - start.y;
    const animation = piece.current!.animate([
      { transform: 'translate(-50%, -50%) scale(.72)', opacity: 0 },
      { transform: `translate(calc(-50% + ${x * .18}px), calc(-50% + ${y * .18 - 28}px)) scale(1.08)`, opacity: 1, offset: .18 },
      { transform: `translate(calc(-50% + ${x * .82}px), calc(-50% + ${y * .82 - 20}px)) scale(.96)`, opacity: 1, offset: .82 },
      { transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(.6)`, opacity: 0 },
    ], { duration, delay, fill: 'both', easing: 'ease-in-out' });
    animation.onfinish = () => callback.current();
    return () => animation.cancel();
  }, [flight]);
  const card = flight.cardId ? TABLE_CARDS[flight.cardId] : undefined;
  return <div className={card ? 'traveling-card' : 'traveling-coins'} ref={piece} style={{ left: flight.start.x, top: flight.start.y }}>
    {card ? <><BuildingArt source={card.art} /><strong>{card.name}</strong></>
      : <Coin value={flight.amount ?? 0} metal={(flight.amount ?? 0) >= 10 ? 'gold' : (flight.amount ?? 0) >= 5 ? 'silver' : 'bronze'} />}
  </div>;
}
