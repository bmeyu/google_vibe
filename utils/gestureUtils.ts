type XYPoint = { x: number; y: number };

export const isOpenPalm = (hand: XYPoint[]) => {
  const wrist = hand[0];
  const indexBase = hand[5];
  const pinkyBase = hand[17];
  if (!wrist || !indexBase || !pinkyBase) return false;

  const palmWidth = Math.hypot(indexBase.x - pinkyBase.x, indexBase.y - pinkyBase.y);
  if (palmWidth === 0) return false;

  const tips = [4, 8, 12, 16, 20].map((idx) => hand[idx]).filter(Boolean);
  if (tips.length < 5) return false;

  const avgTipDist = tips.reduce((sum, tip) => {
    return sum + Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
  }, 0) / tips.length;

  const ratio = avgTipDist / palmWidth;

  const indexTip = hand[8];
  const pinkyTip = hand[20];
  if (!indexTip || !pinkyTip) return false;
  const fingerSpread = Math.hypot(indexTip.x - pinkyTip.x, indexTip.y - pinkyTip.y) / palmWidth;

  const minTipDist = tips.reduce((min, tip) => {
    const dist = Math.hypot(tip.x - wrist.x, tip.y - wrist.y);
    return Math.min(min, dist);
  }, Infinity);
  const minRatio = minTipDist / palmWidth;

  return ratio > 2.15 && fingerSpread > 1.1 && minRatio > 1.9;
};
