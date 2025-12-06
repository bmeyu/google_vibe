import { Point } from '../types';

/**
 * Checks if two line segments intersect.
 * Segment 1: p1 to p2 (The String)
 * Segment 2: p3 to p4 (The Finger Movement)
 */
export const segmentsIntersect = (p1: Point, p2: Point, p3: Point, p4: Point): boolean => {
  const ccw = (a: Point, b: Point, c: Point) => {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  };

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && 
    ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
};

export const normalizePoint = (p: Point, width: number, height: number): Point => {
  return { x: p.x * width, y: p.y * height };
};
