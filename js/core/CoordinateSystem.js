export function mapToGrid(mapX, mapY, layer, mpp) {
  return {
    x: (mapX - layer.originX) * mpp,
    y: (mapY - layer.originY) * mpp,
  };
}

export function gridToMap(gridX, gridY, layer, mpp) {
  return {
    x: layer.originX + gridX / mpp,
    y: layer.originY + gridY / mpp,
  };
}

export function snapToGrid(gridX, gridY) {
  return {
    x: Math.round(gridX),
    y: Math.round(gridY),
  };
}

export function gridSizeFromMapPixels(mapPixels, mpp) {
  return mapPixels * mpp;
}
