type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};
export type PanLabel = { readonly id: string; readonly box: Box };

/** Calibration is not arrival: the real edge-position assertion still decides arrival. */
export function calibratedPanGain(measured: number | null, previous: number | null): number {
  // A name may leave the safe sample without the camera changing scale. Keep
  // the last independently measured scale only; never calibrate from the edge
  // target or turn a missing sample into a claimed positive movement.
  if (measured === null && previous !== null && Number.isFinite(previous) && previous > 0)
    return previous;
  if (measured === null || !Number.isFinite(measured))
    throw new Error("没有足够的共同可见名牌测量真实拖动，不能用边缘目标冒充");
  if (measured <= 0) throw new Error("真实拖动没有把课程岛向预期方向平移");
  return measured;
}

/** Measure common labels, not the single label being pushed into the edge. */
export function measureIslandPan(
  before: readonly PanLabel[],
  after: readonly PanLabel[],
  pointerDx: number,
  canvas: Box,
  edgeMarker: string,
) {
  if (!Number.isFinite(pointerDx) || pointerDx === 0)
    throw new Error("Invalid pointer displacement");
  const common = before.flatMap((label) => {
    const next = after.find((entry) => entry.id === label.id);
    if (!next) return [];
    const beforeX = label.box.x + label.box.width / 2;
    const afterX = next.box.x + next.box.width / 2;
    return [
      {
        id: label.id,
        beforeX,
        afterX,
        displacement: afterX - beforeX,
        distanceFromCanvasCenter: Math.hypot(
          beforeX - (canvas.x + canvas.width / 2),
          label.box.y + label.box.height / 2 - (canvas.y + canvas.height / 2),
        ),
      },
    ];
  });
  const used =
    common.length >= 3
      ? common
      : common
          .filter((label) => label.id !== edgeMarker)
          .toSorted(
            (a, b) =>
              a.distanceFromCanvasCenter - b.distanceFromCanvasCenter || a.id.localeCompare(b.id),
          )
          .slice(0, 1);
  const values = used.map((label) => label.displacement).toSorted((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const displacement =
    values.length === 0
      ? null
      : values.length % 2
        ? values[middle]!
        : (values[middle - 1]! + values[middle]!) / 2;
  return {
    method: common.length >= 3 ? "median" : "nearest-center",
    common,
    used: used.map((label) => label.id),
    displacement,
    gain: displacement === null ? null : displacement / pointerDx,
  };
}
