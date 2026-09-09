const METRES_PER_PIXEL = 4;

export function mapToGrid(mapX, mapY, layer) {
  return {
    x: (mapX - layer.originX) * METRES_PER_PIXEL,
    y: (mapY - layer.originY) * METRES_PER_PIXEL,
  };
}

export function gridToMap(gridX, gridY, layer) {
  return {
    x: layer.originX + gridX / METRES_PER_PIXEL,
    y: layer.originY + gridY / METRES_PER_PIXEL,
  };
}

export function snapToGrid(gridX, gridY) {
  return {
    x: Math.round(gridX),
    y: Math.round(gridY),
  };
}

export function gridSizeFromMapPixels(mapPixels) {
  return mapPixels * METRES_PER_PIXEL;
}
